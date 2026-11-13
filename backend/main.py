import hashlib, secrets, os
from datetime import timedelta, date
from decimal import Decimal
from typing import Literal
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select, insert, update, delete, and_, func
from sqlalchemy.exc import IntegrityError
from models import *

app = FastAPI(title='Auto Parts', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('CORS_ORIGINS','http://localhost:5173,http://localhost:8080').split(','), allow_methods=['*'], allow_headers=['*'])
@app.exception_handler(IntegrityError)
async def integrity_error(request, exc): return JSONResponse(status_code=409, content={'detail':'Duplicate value or invalid related record.'})
def fail(code, message): raise HTTPException(code, message)
def password_hash(password):
    salt=secrets.token_hex(16)
    return salt+':'+hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex()
def verify(password, encoded):
    salt, hashed=encoded.split(':')
    return secrets.compare_digest(hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex(),hashed)
def public(row): return {k:v for k,v in dict(row).items() if k!='password_hash'}
def auth(authorization: str = Header(default='')):
    token=authorization.removeprefix('Bearer ')
    with engine.connect() as c:
        row=c.execute(select(users).join(sessions, users.c.id==sessions.c.user_id).where(sessions.c.token_hash==hashlib.sha256(token.encode()).hexdigest(),sessions.c.expires>now(),users.c.active==True)).mappings().first()
    if not row: fail(401,'Please sign in again.')
    return dict(row)
def staff(u=Depends(auth)):
    if u['role'] not in ('employee','manager'): fail(403,'Employee access required.')
    return u
def manager(u=Depends(staff)):
    if u['role']!='manager': fail(403,'Manager access required.')
    return u
def scope(u, store_id):
    if u['role']=='employee' and u['store_id']!=store_id: fail(403,'This store is outside your assignment.')
def exists(c, table, id):
    row=c.execute(select(table).where(table.c.id==id)).mappings().first()
    if not row: fail(404,'Record not found.')
    return row
class Model(BaseModel):
    model_config=ConfigDict(extra='forbid', str_strip_whitespace=True)
class Login(Model):
    username: str
    password: str
class Profile(Model):
    name: str=Field(min_length=1,max_length=100)
    email: str=Field(min_length=3,max_length=150,pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    phone: str=Field(default='',max_length=30)
    address: str=Field(default='',max_length=255)
    vehicle: str=Field(default='',max_length=100)
    store_id: int|None=None
class Registration(Profile):
    username: str=Field(min_length=3,max_length=80)
    password: str=Field(min_length=8,max_length=128)
class Employee(Registration):
    role: Literal['employee','manager']='employee'
    department: str=Field(default='Sales',max_length=80)
class EmployeeEdit(Profile):
    department: str=Field(default='Sales',max_length=80)
    active: bool=True
class Store(Model):
    name: str=Field(min_length=1,max_length=100)
    address: str=Field(min_length=1,max_length=255)
class Supplier(Model):
    name: str=Field(min_length=1,max_length=100)
    email: str=Field(min_length=3,max_length=150)
class Part(Model):
    sku: str=Field(min_length=1,max_length=50)
    name: str=Field(min_length=1,max_length=120)
    category: str=Field(min_length=1,max_length=80)
    description: str=Field(min_length=1,max_length=1000)
    condition: Literal['new','rebuilt']='new'
    price: Decimal=Field(ge=0,le=99999999,max_digits=10,decimal_places=2)
    supplier_id: int
    active: bool=True
class Stock(Model):
    quantity: int=Field(ge=0,le=1000000)
    reorder_level: int=Field(default=5,ge=0,le=1000000)
class Item(Model):
    part_id: int
    quantity: int=Field(gt=0,le=10000)
class Checkout(Model):
    store_id: int
    items: list[Item]=Field(min_length=1,max_length=100)
    shipping_address: str=Field(min_length=5,max_length=255)
    payment_method: Literal['demo_credit_card','pay_at_store']='demo_credit_card'
    demo_token: Literal['demo_approved','demo_declined']='demo_approved'
class Status(Model):
    status: Literal['shipped','delivered','cancelled','returned']
    delivery_date: date|None=None
class Purchase(Model):
    store_id: int
    part_id: int
    quantity: int=Field(gt=0,le=1000000)
class PurchaseStatus(Model):
    status: Literal['received','cancelled']

@app.get('/api/health')
def health():
    with engine.connect() as c: c.execute(select(1))
    return {'status':'ok','database':engine.dialect.name}
@app.post('/api/register',status_code=201)
def register(body: Registration):
    data=body.model_dump(); password=data.pop('password')
    with engine.begin() as c:
        id=c.execute(insert(users).values(**data,password_hash=password_hash(password),role='customer')).inserted_primary_key[0]
    return {'id':id}
@app.post('/api/login')
def login(body: Login):
    with engine.begin() as c:
        user=c.execute(select(users).where(users.c.username==body.username,users.c.active==True)).mappings().first()
        if not user or not verify(body.password,user['password_hash']): fail(401,'Incorrect username or password.')
        token=secrets.token_urlsafe(32)
        c.execute(insert(sessions).values(token_hash=hashlib.sha256(token.encode()).hexdigest(),user_id=user['id'],expires=now()+timedelta(hours=8)))
    return {'token':token,'user':public(user)}
@app.post('/api/logout')
def logout(u=Depends(auth),authorization: str=Header()):
    with engine.begin() as c: c.execute(delete(sessions).where(sessions.c.token_hash==hashlib.sha256(authorization.removeprefix('Bearer ').encode()).hexdigest()))
    return {'ok':True}
@app.get('/api/me')
def me(u=Depends(auth)): return public(u)
@app.put('/api/me')
def edit_me(body:Profile,u=Depends(auth)):
    data=body.model_dump()
    if u['role']!='customer': data.pop('store_id')
    with engine.begin() as c: c.execute(update(users).where(users.c.id==u['id']).values(**data))
    return {'ok':True}
@app.get('/api/stores')
def list_stores():
    with engine.connect() as c: return list(c.execute(select(stores)).mappings())
@app.post('/api/stores',status_code=201)
def add_store(body:Store,u=Depends(manager)):
    with engine.begin() as c:
        id=c.execute(insert(stores).values(**body.model_dump())).inserted_primary_key[0]
        for p in c.execute(select(parts.c.id)).scalars(): c.execute(insert(inventory).values(store_id=id,part_id=p,quantity=0))
    return {'id':id}
@app.put('/api/stores/{id}')
def edit_store(id:int,body:Store,u=Depends(manager)):
    with engine.begin() as c: exists(c,stores,id); c.execute(update(stores).where(stores.c.id==id).values(**body.model_dump()))
    return {'ok':True}
@app.get('/api/parts')
def catalog(store_id:int=1,q:str=''):
    with engine.connect() as c:
        query=select(parts,inventory.c.quantity,inventory.c.reorder_level).join(inventory,parts.c.id==inventory.c.part_id).where(inventory.c.store_id==store_id)
        # Archived items remain visible only in historical orders, never in the catalog.
        query=query.where(parts.c.active==True)
        if q: query=query.where((parts.c.name.contains(q,autoescape=True)) | (parts.c.sku.contains(q,autoescape=True)) | (parts.c.category.contains(q,autoescape=True)))
        return list(c.execute(query.order_by(parts.c.name)).mappings())
@app.get('/api/suppliers')
def list_suppliers(u=Depends(staff)):
    with engine.connect() as c: return list(c.execute(select(suppliers)).mappings())
@app.post('/api/suppliers',status_code=201)
def add_supplier(body:Supplier,u=Depends(manager)):
    with engine.begin() as c: return {'id':c.execute(insert(suppliers).values(**body.model_dump())).inserted_primary_key[0]}
@app.post('/api/parts',status_code=201)
def add_part(body:Part,u=Depends(manager)):
    with engine.begin() as c:
        id=c.execute(insert(parts).values(**body.model_dump())).inserted_primary_key[0]
        for s in c.execute(select(stores.c.id)).scalars(): c.execute(insert(inventory).values(store_id=s,part_id=id,quantity=0))
    return {'id':id}
@app.put('/api/parts/{id}')
def edit_part(id:int,body:Part,u=Depends(manager)):
    with engine.begin() as c: exists(c,parts,id); c.execute(update(parts).where(parts.c.id==id).values(**body.model_dump()))
    return {'ok':True}
@app.put('/api/inventory/{store_id}/{part_id}')
def edit_stock(store_id:int,part_id:int,body:Stock,u=Depends(staff)):
    scope(u,store_id)
    with engine.begin() as c:
        result=c.execute(update(inventory).where(inventory.c.store_id==store_id,inventory.c.part_id==part_id).values(**body.model_dump()))
        if not result.rowcount: fail(404,'Inventory not found.')
    return {'ok':True}
@app.get('/api/employees')
def employees(u=Depends(manager)):
    with engine.connect() as c: return [public(r) for r in c.execute(select(users).where(users.c.role!='customer')).mappings()]
@app.post('/api/employees',status_code=201)
def add_employee(body:Employee,u=Depends(manager)):
    data=body.model_dump(); password=data.pop('password')
    if not data['store_id']: fail(422,'Assign an employee to a store.')
    with engine.begin() as c: return {'id':c.execute(insert(users).values(**data,password_hash=password_hash(password))).inserted_primary_key[0]}
@app.put('/api/employees/{id}')
def edit_employee(id:int,body:EmployeeEdit,u=Depends(manager)):
    if id==u['id'] and not body.active: fail(409,'You cannot deactivate yourself.')
    if not body.store_id: fail(422,'Assign an employee to a store.')
    with engine.begin() as c:
        row=exists(c,users,id)
        if row['role']=='customer': fail(404,'Employee not found.')
        c.execute(update(users).where(users.c.id==id).values(**body.model_dump()))
    return {'ok':True}
@app.delete('/api/employees/{id}')
def remove_employee(id:int,u=Depends(manager)):
    if id==u['id']: fail(409,'You cannot deactivate yourself.')
    with engine.begin() as c:
        row=exists(c,users,id)
        if row['role']=='customer': fail(404,'Employee not found.')
        c.execute(update(users).where(users.c.id==id).values(active=False))
        c.execute(delete(sessions).where(sessions.c.user_id==id))
    return {'ok':True}
@app.post('/api/orders',status_code=201)
def checkout(body:Checkout,u=Depends(auth)):
    if u['role']!='customer': fail(403,'Use a customer account to purchase.')
    if body.payment_method=='demo_credit_card' and body.demo_token=='demo_declined': fail(402,'Demo payment declined. No order was created.')
    quantities={}
    for item in body.items: quantities[item.part_id]=quantities.get(item.part_id,0)+item.quantity
    with engine.begin() as c:
        exists(c,stores,body.store_id)
        lines=[]; total=Decimal('0')
        for id,qty in sorted(quantities.items()):
            p=exists(c,parts,id)
            if not p['active']: fail(409,'Part is no longer for sale.')
            stock=c.execute(select(inventory).where(inventory.c.store_id==body.store_id,inventory.c.part_id==id).with_for_update()).mappings().first()
            if not stock or stock['quantity']<qty: fail(409,f"Insufficient stock: {p['name']}")
            c.execute(update(inventory).where(inventory.c.store_id==body.store_id,inventory.c.part_id==id).values(quantity=inventory.c.quantity-qty))
            lines.append(dict(part_id=id,quantity=qty,unit_price=p['price'])); total+=p['price']*qty
        id=c.execute(insert(orders).values(customer_id=u['id'],store_id=body.store_id,shipping_address=body.shipping_address)).inserted_primary_key[0]
        c.execute(insert(order_items),[dict(order_id=id,**line) for line in lines])
        c.execute(insert(payments).values(order_id=id,method=body.payment_method,status='demo_paid' if body.payment_method=='demo_credit_card' else 'due',amount=total,reference='DEMO-'+secrets.token_hex(6)))
    return {'id':id,'total':total}
@app.get('/api/orders')
def list_orders(u=Depends(auth)):
    with engine.connect() as c:
        q=select(orders,users.c.name.label('customer_name'),payments.c.amount,payments.c.method,payments.c.status.label('payment_status')).join(users,orders.c.customer_id==users.c.id).join(payments,payments.c.order_id==orders.c.id)
        if u['role']=='customer': q=q.where(orders.c.customer_id==u['id'])
        if u['role']=='employee': q=q.where(orders.c.store_id==u['store_id'])
        result=[]
        for r in c.execute(q.order_by(orders.c.id.desc())).mappings():
            d=dict(r); d['items']=list(c.execute(select(order_items,parts.c.name,parts.c.sku).join(parts,parts.c.id==order_items.c.part_id).where(order_items.c.order_id==r['id'])).mappings()); result.append(d)
        return result
@app.patch('/api/orders/{id}')
def order_status(id:int,body:Status,u=Depends(auth)):
    with engine.begin() as c:
        o=c.execute(select(orders).where(orders.c.id==id).with_for_update()).mappings().first()
        if not o: fail(404,'Order not found.')
        if u['role']=='customer':
            if o['customer_id']!=u['id']: fail(403,'Not your order.')
            if body.status not in ('cancelled','returned'): fail(403,'Employee access required.')
        scope(u,o['store_id'])
        allowed={'placed':['shipped','cancelled'],'shipped':['delivered'],'delivered':['returned']}
        if body.status not in allowed.get(o['status'],[]): fail(409,'This order cannot make that status change.')
        if body.delivery_date and body.delivery_date<o['created_at'].date(): fail(422,'Delivery date cannot precede the order.')
        if body.status in ('cancelled','returned'):
            for line in c.execute(select(order_items).where(order_items.c.order_id==id).order_by(order_items.c.part_id)).mappings():
                c.execute(update(inventory).where(inventory.c.store_id==o['store_id'],inventory.c.part_id==line['part_id']).values(quantity=inventory.c.quantity+line['quantity']))
            payment_status=c.execute(select(payments.c.status).where(payments.c.order_id==id)).scalar()
            refund_status={'demo_paid':'demo_refunded','collected':'refunded'}.get(payment_status,'void')
            c.execute(update(payments).where(payments.c.order_id==id).values(status=refund_status))
        values={'status':body.status}
        if body.delivery_date: values['delivery_date']=body.delivery_date
        if body.status=='delivered':
            values['delivered_at']=now()
            c.execute(update(payments).where(payments.c.order_id==id,payments.c.status=='due').values(status='collected'))
        c.execute(update(orders).where(orders.c.id==id).values(**values))
    return {'ok':True}
@app.get('/api/purchases')
def list_purchases(u=Depends(staff)):
    with engine.connect() as c:
        q=select(purchases,parts.c.name,suppliers.c.name.label('supplier_name')).join(parts,parts.c.id==purchases.c.part_id).join(suppliers,suppliers.c.id==purchases.c.supplier_id)
        if u['role']=='employee': q=q.where(purchases.c.store_id==u['store_id'])
        return list(c.execute(q.order_by(purchases.c.id.desc())).mappings())
@app.post('/api/purchases',status_code=201)
def purchase(body:Purchase,u=Depends(staff)):
    scope(u,body.store_id)
    with engine.begin() as c:
        p=exists(c,parts,body.part_id)
        if not p['active']: fail(409,'Part is archived.')
        return {'id':c.execute(insert(purchases).values(**body.model_dump(),supplier_id=p['supplier_id'],employee_id=u['id'])).inserted_primary_key[0]}
@app.patch('/api/purchases/{id}')
def purchase_status(id:int,body:PurchaseStatus,u=Depends(staff)):
    with engine.begin() as c:
        p=c.execute(select(purchases).where(purchases.c.id==id).with_for_update()).mappings().first()
        if not p: fail(404,'Purchase not found.')
        scope(u,p['store_id'])
        if p['status']!='ordered': fail(409,'Purchase is already closed.')
        if body.status=='received': c.execute(update(inventory).where(inventory.c.store_id==p['store_id'],inventory.c.part_id==p['part_id']).values(quantity=inventory.c.quantity+p['quantity']))
        c.execute(update(purchases).where(purchases.c.id==id).values(status=body.status))
    return {'ok':True}
@app.get('/api/reports')
def reports(period:Literal['daily','weekly','monthly']='daily',store_id:int|None=None,u=Depends(staff)):
    if u['role']=='employee': store_id=u['store_id']
    start=now()-timedelta(days={'daily':1,'weekly':7,'monthly':30}[period])
    with engine.connect() as c:
        q=select(orders.c.status,payments.c.amount).join(payments,payments.c.order_id==orders.c.id).where(orders.c.created_at>=start)
        low=select(inventory,parts.c.name).join(parts,parts.c.id==inventory.c.part_id).where(inventory.c.quantity<=inventory.c.reorder_level,parts.c.active==True)
        employees_q=select(users.c.id,users.c.name,users.c.department,users.c.store_id,users.c.active).where(users.c.role!='customer')
        if store_id:
            q=q.where(orders.c.store_id==store_id); low=low.where(inventory.c.store_id==store_id); employees_q=employees_q.where(users.c.store_id==store_id)
        rows=list(c.execute(q).mappings())
        return {'period':period,'from':start,'order_count':len(rows),'net_sales':sum((r['amount'] for r in rows if r['status'] not in ('cancelled','returned')),Decimal('0')),'cancelled_or_returned':sum(r['status'] in ('cancelled','returned') for r in rows),'low_stock':list(c.execute(low).mappings()),'employees':list(c.execute(employees_q).mappings())}
