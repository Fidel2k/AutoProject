import { JSDOM } from "jsdom";
import fs from "node:fs";
import assert from "node:assert/strict";
const errors = [];
const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  {
    url: "http://localhost:5173",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  },
);
const w = dom.window;
w.addEventListener("error", (e) => errors.push(e.error));
w.confirm = () => true;
w.prompt = () => "2099-01-01";
w.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
const stores = [
  { id: 1, name: "Denton", address: "100 Main St" },
  { id: 2, name: "Coppell", address: "200 Main St" },
];
const parts = [
  {
    id: 1,
    sku: "BRK-101",
    name: "Ceramic brake pads",
    category: "Brakes",
    description: "Front pads",
    condition: "new",
    quantity: 20,
    reorder_level: 5,
    price: "49.99",
    supplier_id: 1,
  },
];
let user = null,
  orders = [],
  requests = [],
  failure = null;
w.fetch = async (url, options = {}) => {
  if (failure === "text") {
    failure = null;
    return {
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    };
  }
  if (failure === "network") {
    failure = null;
    throw new Error("Failed to fetch");
  }
  let data;
  const path = new URL(url, w.location.href).pathname;
  const body = options.body ? JSON.parse(options.body) : null;
  requests.push({ path, body, method: options.method });
  if (path === "/api/stores") data = stores;
  else if (path === "/api/parts") data = parts;
  else if (path === "/api/login") {
    user = {
      id: 1,
      name: "Demo User",
      username: body.username,
      role: body.username === "manager" ? "manager" : "customer",
      store_id: 1,
      address: "123 Test St",
      email: "demo@example.com",
    };
    data = { token: "test-token", user };
  } else if (path === "/api/me") data = user;
  else if (path === "/api/logout") data = { ok: true };
  else if (path === "/api/orders" && options.method === "POST") {
    orders = [
      {
        id: 1,
        customer_name: user.name,
        store_id: 1,
        created_at: "2026-11-12T12:00:00",
        status: "placed",
        shipping_address: body.shipping_address,
        amount: 99.98,
        method: body.payment_method,
        payment_status: "demo_paid",
        items: [{ name: parts[0].name, quantity: 2, unit_price: "49.99" }],
      },
    ];
    data = { id: 1, total: 99.98 };
  } else if (path === "/api/orders") data = orders;
  else if (path === "/api/reports")
    data = {
      period: "daily",
      net_sales: 99.98,
      order_count: 1,
      cancelled_or_returned: 0,
      low_stock: [],
      employees: [{ name: "Employee", department: "Sales", active: true }],
    };
  else if (path === "/api/employees")
    data = [
      {
        id: 2,
        name: "Employee",
        username: "employee",
        department: "Sales",
        active: true,
      },
    ];
  else if (path === "/api/suppliers")
    data = [{ id: 1, name: "Supplier", email: "s@example.com" }];
  else if (path === "/api/purchases") data = [];
  else data = { ok: true };
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
    json: async () => data,
  };
};
const file = fs.readdirSync("dist/assets").find((x) => x.endsWith(".js"));
w.eval(fs.readFileSync("dist/assets/" + file, "utf8"));
const tick = () => new Promise((r) => setTimeout(r, 40));
function button(name) {
  const b = [...w.document.querySelectorAll("button")].find(
    (x) =>
      x.textContent.trim() === name || x.textContent.trim() === name + "↗",
  );
  assert.ok(b, "Missing button " + name);
  return b;
}
function click(name) {
  button(name).click();
}
async function login(name) {
  w.document.querySelector('[name="username"]').value = name;
  w.document.querySelector('[name="password"]').value = "DemoPass123!";
  click("Sign in");
  await tick();
}
await tick();
assert.match(w.document.body.textContent, /Ceramic brake pads/);
failure = "text";
await login("customer");
assert.match(
  w.document.body.textContent,
  /Server returned HTTP 500 instead of JSON/,
);
failure = "network";
await login("customer");
assert.match(w.document.body.textContent, /Cannot reach the backend/);
await login("customer");
assert.match(w.document.body.textContent, /Demo User/);
click("Add to cart +");
await tick();
click("Add to cart +");
await tick();
click("Cart2");
await tick();
assert.match(w.document.body.textContent, /99.98/);
click("Place demo order");
await tick();
await tick();
assert.match(w.document.body.textContent, /Order #1/);
const checkout = requests.find(
  (r) => r.path === "/api/orders" && r.method === "POST",
);
assert.equal(checkout.body.items[0].quantity, 2);
assert.equal(checkout.body.payment_method, "demo_credit_card");
click("Profile");
await tick();
assert.equal(
  w.document.querySelector('[name="email"]').value,
  "demo@example.com",
);
click("Sign out");
await tick();
await login("manager");
for (const page of [
  "Inventory",
  "Purchasing",
  "Reports",
  "Employees",
  "Stores",
  "Suppliers",
]) {
  click(page);
  await tick();
  assert.ok(w.document.querySelector("h1").textContent.includes(page));
}
click("Inventory");
await tick();
click("+ Add part");
await tick();
assert.ok(w.document.querySelector("dialog").open);
assert.ok(w.document.querySelector('[name="sku"]'));
click("×");
await tick();
assert.deepEqual(errors, []);
console.log(
  "PASS: built React bundle renders; customer login/cart/checkout/profile; manager menus and modal; no runtime errors.",
);
dom.window.close();
