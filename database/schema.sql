-- MySQL 8.4 schema. Choose USE autoparts before executing.
-- Alternatively npm run db:seed creates this schema and demo data.


CREATE TABLE stores (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(100) NOT NULL, 
	address VARCHAR(255) NOT NULL, 
	PRIMARY KEY (id)
)

;


CREATE TABLE suppliers (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(100) NOT NULL, 
	email VARCHAR(150) NOT NULL, 
	PRIMARY KEY (id)
)

;


CREATE TABLE parts (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	sku VARCHAR(50) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	category VARCHAR(80) NOT NULL, 
	description VARCHAR(1000) NOT NULL, 
	`condition` VARCHAR(20) NOT NULL, 
	price NUMERIC(10, 2) NOT NULL, 
	supplier_id INTEGER NOT NULL, 
	active BOOL NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (price >= 0), 
	CHECK (`condition` IN ('new','rebuilt')), 
	UNIQUE (sku), 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id)
)

;


CREATE TABLE users (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	username VARCHAR(80) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	`role` VARCHAR(20) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	email VARCHAR(150) NOT NULL, 
	phone VARCHAR(30) NOT NULL, 
	address VARCHAR(255) NOT NULL, 
	vehicle VARCHAR(100) NOT NULL, 
	store_id INTEGER, 
	department VARCHAR(80) NOT NULL, 
	active BOOL NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (role IN ('customer','employee','manager')), 
	UNIQUE (username), 
	FOREIGN KEY(store_id) REFERENCES stores (id)
)

;


CREATE TABLE inventory (
	store_id INTEGER NOT NULL, 
	part_id INTEGER NOT NULL, 
	quantity INTEGER NOT NULL, 
	reorder_level INTEGER NOT NULL, 
	PRIMARY KEY (store_id, part_id), 
	CHECK (quantity >= 0), 
	CHECK (reorder_level >= 0), 
	FOREIGN KEY(store_id) REFERENCES stores (id), 
	FOREIGN KEY(part_id) REFERENCES parts (id)
)

;


CREATE TABLE orders (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	customer_id INTEGER NOT NULL, 
	store_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	status VARCHAR(25) NOT NULL, 
	delivery_date DATE, 
	delivered_at DATETIME, 
	shipping_address VARCHAR(255) NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (status IN ('placed','shipped','delivered','cancelled','returned')), 
	FOREIGN KEY(customer_id) REFERENCES users (id), 
	FOREIGN KEY(store_id) REFERENCES stores (id)
)

;


CREATE TABLE purchases (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	store_id INTEGER NOT NULL, 
	part_id INTEGER NOT NULL, 
	supplier_id INTEGER NOT NULL, 
	employee_id INTEGER NOT NULL, 
	quantity INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (quantity > 0), 
	CHECK (status IN ('ordered','received','cancelled')), 
	FOREIGN KEY(store_id) REFERENCES stores (id), 
	FOREIGN KEY(part_id) REFERENCES parts (id), 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id), 
	FOREIGN KEY(employee_id) REFERENCES users (id)
)

;


CREATE TABLE sessions (
	token_hash VARCHAR(64) NOT NULL, 
	user_id INTEGER NOT NULL, 
	expires DATETIME NOT NULL, 
	PRIMARY KEY (token_hash), 
	FOREIGN KEY(user_id) REFERENCES users (id)
)

;


CREATE TABLE order_items (
	order_id INTEGER NOT NULL, 
	part_id INTEGER NOT NULL, 
	quantity INTEGER NOT NULL, 
	unit_price NUMERIC(10, 2) NOT NULL, 
	PRIMARY KEY (order_id, part_id), 
	CHECK (quantity > 0), 
	CHECK (unit_price >= 0), 
	FOREIGN KEY(order_id) REFERENCES orders (id), 
	FOREIGN KEY(part_id) REFERENCES parts (id)
)

;


CREATE TABLE payments (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	order_id INTEGER NOT NULL, 
	method VARCHAR(30) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	amount NUMERIC(12, 2) NOT NULL, 
	reference VARCHAR(100) NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (amount >= 0), 
	UNIQUE (order_id), 
	FOREIGN KEY(order_id) REFERENCES orders (id)
)

;

CREATE INDEX ix_orders_customer ON orders (customer_id);
CREATE INDEX ix_orders_date ON orders (created_at);
