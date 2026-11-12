"""Integration tests. TEST_DATABASE_URL opts into a DEDICATED disposable MySQL database."""
import os, sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select, update
os.environ['DATABASE_URL']=os.environ.get('TEST_DATABASE_URL','sqlite:///'+str(Path(__file__).parent/'test.sqlite'))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.models import engine, meta, inventory, users, payments
if engine.dialect.name != 'sqlite' and not (engine.url.database or '').endswith('_test'):
    raise RuntimeError('Refusing destructive tests: database name must end with _test')
from app.main import app
from app.seed import seed
if engine.dialect.name=='sqlite':
    @event.listens_for(engine,'connect')
    def foreign_keys(dbapi, connection_record): dbapi.execute('PRAGMA foreign_keys=ON')
client=TestClient(app)
@pytest.fixture(autouse=True)
def reset():
    meta.drop_all(engine); seed()
    yield
    meta.drop_all(engine)
def login(name='customer'):
    r=client.post('/api/login',json={'username':name,'password':'DemoPass123!'})
    assert r.status_code==200,r.text
    return {'Authorization':'Bearer '+r.json()['token']}
def order(headers=None,**kw):
    return client.post('/api/orders',headers=headers or login(),json={'store_id':1,'items':[{'part_id':1,'quantity':2}],'shipping_address':'123 Test Street',**kw})
def stock():
    return next(p['quantity'] for p in client.get('/api/parts?store_id=1').json() if p['id']==1)
def test_health(): assert client.get('/api/health').json()['status']=='ok'
def test_login_logout_and_wrong_password():
    assert client.post('/api/login',json={'username':'customer','password':'wrong'}).status_code==401
    h=login();assert client.get('/api/me',headers=h).status_code==200
    assert client.post('/api/logout',headers=h).status_code==200
    assert client.get('/api/me',headers=h).status_code==401
@pytest.mark.parametrize('path',['/api/employees','/api/purchases','/api/reports','/api/suppliers'])
def test_customer_cannot_access_staff(path): assert client.get(path,headers=login()).status_code==403
def test_register_profile_duplicate():
    d={'username':'newuser','password':'Password123!','name':'New Customer','email':'new@example.com','store_id':2}
    assert client.post('/api/register',json=d).status_code==201
    assert client.post('/api/register',json=d).status_code==409
    d['username']='other';d['role']='manager'
    assert client.post('/api/register',json=d).status_code==422
    h=login();assert client.put('/api/me',headers=h,json={'name':'Updated','email':'up@example.com','store_id':2,'address':'456 New Road','phone':'123','vehicle':'Mustang'}).status_code==200
    assert client.get('/api/me',headers=h).json()['name']=='Updated'
def test_checkout_uses_server_prices_and_stock():
    r=order();assert r.status_code==201,r.text
    assert float(r.json()['total'])==99.98;assert stock()==18
    rows=client.get('/api/orders',headers=login()).json();assert len(rows)==1
    assert rows[0]['payment_status']=='demo_paid';assert len(rows[0]['items'])==1
    assert order(items=[{'part_id':1,'quantity':1,'unit_price':0}]).status_code==422
def test_duplicate_cart_lines_aggregated():
    r=order(items=[{'part_id':1,'quantity':2},{'part_id':1,'quantity':3}]);assert r.status_code==201;assert stock()==15
def test_failed_stock_rolls_back_all_lines():
    r=order(items=[{'part_id':1,'quantity':2},{'part_id':3,'quantity':999}]);assert r.status_code==409;assert stock()==20
    assert client.get('/api/orders',headers=login()).json()==[]
def test_payment_decline_no_mutations():
    assert order(demo_token='demo_declined').status_code==402;assert stock()==20
@pytest.mark.parametrize('qty',[0,-1,1.5])
def test_invalid_quantity(qty): assert order(items=[{'part_id':1,'quantity':qty}]).status_code==422
def test_cancel_restocks_once():
    h=login();id=order(h).json()['id']
    assert client.patch(f'/api/orders/{id}',headers=h,json={'status':'cancelled'}).status_code==200
    assert stock()==20
    assert client.patch(f'/api/orders/{id}',headers=h,json={'status':'cancelled'}).status_code==409
    assert stock()==20
    assert client.get('/api/orders',headers=h).json()[0]['payment_status']=='demo_refunded'
def test_shipping_delivery_return():
    h=login();s=login('employee');id=order(h).json()['id']
    assert client.patch(f'/api/orders/{id}',headers=h,json={'status':'shipped'}).status_code==403
    assert client.patch(f'/api/orders/{id}',headers=s,json={'status':'delivered'}).status_code==409
    assert client.patch(f'/api/orders/{id}',headers=s,json={'status':'shipped','delivery_date':'2000-01-01'}).status_code==422
    assert client.patch(f'/api/orders/{id}',headers=s,json={'status':'shipped','delivery_date':'2099-01-01'}).status_code==200
    assert client.patch(f'/api/orders/{id}',headers=s,json={'status':'delivered'}).status_code==200
    assert client.patch(f'/api/orders/{id}',headers=h,json={'status':'returned'}).status_code==200
    assert stock()==20
    assert client.patch(f'/api/orders/{id}',headers=h,json={'status':'returned'}).status_code==409
def test_cash_refund():
    h=login();s=login('employee');id=order(h,payment_method='pay_at_store').json()['id']
    for status in ['shipped','delivered']: assert client.patch(f'/api/orders/{id}',headers=s,json={'status':status}).status_code==200
    assert client.patch(f'/api/orders/{id}',headers=h,json={'status':'returned'}).status_code==200
    assert client.get('/api/orders',headers=h).json()[0]['payment_status']=='refunded'
def test_customer_order_isolation():
    id=order().json()['id']
    client.post('/api/register',json={'username':'another','password':'DemoPass123!','name':'Other','email':'other@example.com'})
    h=login('another');assert client.get('/api/orders',headers=h).json()==[]
    assert client.patch(f'/api/orders/{id}',headers=h,json={'status':'cancelled'}).status_code==403
def test_employee_scope():
    id=order(store_id=2).json()['id'];h=login('employee')
    assert client.get('/api/orders',headers=h).json()==[]
    assert client.patch(f'/api/orders/{id}',headers=h,json={'status':'shipped'}).status_code==403
    assert client.put('/api/inventory/2/1',headers=h,json={'quantity':99}).status_code==403
    assert client.post('/api/purchases',headers=h,json={'store_id':2,'part_id':1,'quantity':3}).status_code==403
    assert client.get('/api/employees',headers=h).status_code==403
def test_purchase_receipt_and_stop():
    h=login('employee');d={'store_id':1,'part_id':1,'quantity':10}
    id=client.post('/api/purchases',headers=h,json=d).json()['id']
    assert client.patch(f'/api/purchases/{id}',headers=h,json={'status':'received'}).status_code==200;assert stock()==30
    assert client.patch(f'/api/purchases/{id}',headers=h,json={'status':'received'}).status_code==409;assert stock()==30
    id=client.post('/api/purchases',headers=h,json=d).json()['id']
    assert client.patch(f'/api/purchases/{id}',headers=h,json={'status':'cancelled'}).status_code==200;assert stock()==30
def test_employee_management_and_revocation():
    h=login('manager');d={'username':'newstaff','password':'DemoPass123!','name':'Staff','email':'staff@example.com','store_id':2,'department':'Warehouse'}
    r=client.post('/api/employees',headers=h,json=d);assert r.status_code==201
    id=r.json()['id'];s=login('newstaff')
    d={k:v for k,v in d.items() if k not in ['username','password']};d['name']='Updated'
    assert client.put(f'/api/employees/{id}',headers=h,json=d).status_code==200
    assert client.delete(f'/api/employees/{id}',headers=h).status_code==200
    assert client.get('/api/me',headers=s).status_code==401
    assert client.delete('/api/employees/1',headers=h).status_code==409
def test_store_part_supplier_inventory_management():
    h=login('manager')
    s=client.post('/api/stores',headers=h,json={'name':'New Branch','address':'123 Branch Road'});assert s.status_code==201
    assert len(client.get('/api/parts?store_id='+str(s.json()['id'])).json())==8
    supplier=client.post('/api/suppliers',headers=h,json={'name':'Test Supply','email':'supply@example.com'}).json()['id']
    p={'sku':'TEST-1','name':'Test part','category':'Test','description':'Testing part','condition':'new','price':'12.34','supplier_id':supplier}
    r=client.post('/api/parts',headers=h,json=p);assert r.status_code==201
    id=r.json()['id'];assert client.put(f'/api/inventory/1/{id}',headers=h,json={'quantity':10}).status_code==200
    assert client.put(f'/api/inventory/1/{id}',headers=h,json={'quantity':-1}).status_code==422
    p['active']=False;assert client.put(f'/api/parts/{id}',headers=h,json=p).status_code==200
    assert order(items=[{'part_id':id,'quantity':1}]).status_code==409
def test_report_net_sales_after_cancellation():
    h=login();id=order(h).json()['id'];s=login('manager')
    assert float(client.get('/api/reports',headers=s).json()['net_sales'])==99.98
    client.patch(f'/api/orders/{id}',headers=h,json={'status':'cancelled'})
    r=client.get('/api/reports?period=weekly',headers=s).json()
    assert float(r['net_sales'])==0;assert r['order_count']==1;assert r['cancelled_or_returned']==1
    assert len(r['low_stock'])==2

def test_search_and_injection():
    assert len(client.get('/api/parts?q=BRK-101').json())==1
    assert client.get('/api/parts',params={'q':"' OR 1=1 --"}).json()==[]
    assert client.post('/api/login',json={'username':"' OR 1=1 --",'password':'anything'}).status_code==401

@pytest.mark.skipif(engine.dialect.name!='mysql',reason='Requires real MySQL row locking')
def test_concurrent_checkout_no_oversell():
    from concurrent.futures import ThreadPoolExecutor
    with engine.begin() as c:c.execute(update(inventory).where(inventory.c.store_id==1,inventory.c.part_id==1).values(quantity=1))
    h=login()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:order(h,items=[{'part_id':1,'quantity':1}]).status_code,range(2)))
    assert sorted(results)==[201,409];assert stock()==0


def test_database_failure_is_readable_json(monkeypatch):
    from sqlalchemy.exc import OperationalError
    def unavailable(*args, **kwargs):
        raise OperationalError('SELECT 1', {}, Exception('Database offline'))
    with monkeypatch.context() as patch:
        patch.setattr(engine, 'connect', unavailable)
        response = client.get('/api/health')
    assert response.status_code == 503
    assert response.headers['content-type'].startswith('application/json')
    assert 'Database unavailable' in response.json()['detail']
