from app.models import *
from app.security import password_hash
from sqlalchemy import select, insert

def seed():
    meta.create_all(engine)
    with engine.begin() as c:
        if c.execute(select(stores.c.id)).first(): return
        c.execute(insert(stores),[{'id':1,'name':'Denton · University','address':'100 University Dr, Denton, TX'},{'id':2,'name':'Coppell · Main Street','address':'200 Main St, Coppell, TX'}])
        c.execute(insert(suppliers),[{'id':1,'name':'Metro Parts Supply','email':'orders@metro.example'},{'id':2,'name':'Precision Rebuilders','email':'orders@precision.example'}])
        for username,role,name,store in [('manager','manager','Alex Morgan',1),('employee','employee','Jordan Lee',1),('customer','customer','Demo Customer',1)]:
            c.execute(insert(users).values(username=username,password_hash=password_hash('DemoPass123!'),role=role,name=name,email=username+'@example.com',phone='940-555-0100',address='123 Oak St, Denton, TX',vehicle='1999 Ford Mustang GT',store_id=store,department='Sales' if role!='customer' else ''))
        products=[('BRK-101','Ceramic brake pads','Brakes','Low-dust ceramic front brake pad set. Verify vehicle fitment before purchase.','new','49.99',1),('OIL-205','Synthetic oil 5W-30','Fluids','Five-quart full synthetic engine oil.','new','32.50',1),('ALT-330','Remanufactured alternator','Electrical','Rebuilt 130-amp alternator; bench tested.','rebuilt','149.95',2),('FLT-120','Engine air filter','Filters','High-flow paper replacement filter.','new','18.75',1),('BAT-650','650 CCA battery','Electrical','12-volt starting battery with 650 cold cranking amps.','new','129.00',1),('SPK-808','Platinum spark plug','Ignition','Single platinum-tip spark plug.','new','8.99',1),('WIP-220','22-inch wiper blade','Accessories','All-weather beam-style windshield wiper.','new','21.00',1),('STR-410','Rebuilt starter motor','Electrical','Quality-tested rebuilt starter assembly.','rebuilt','99.50',2)]
        for i,p in enumerate(products,1):
            c.execute(insert(parts).values(id=i,**dict(zip(['sku','name','category','description','condition','price','supplier_id'],p))))
            for store in (1,2): c.execute(insert(inventory).values(store_id=store,part_id=i,quantity=3 if i==3 else 20,reorder_level=5))
if __name__=='__main__': seed(); print('Schema and demo data ready. Existing data preserved.')
