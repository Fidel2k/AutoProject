import React, { useEffect, useState } from "react";
import { api, setToken, getToken } from "./api.js";
const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
function Field({
  name,
  label,
  type = "text",
  value,
  options,
  required = true,
}) {
  return (
    <label>
      {label || name.replaceAll("_", " ")}
      {options ? (
        <select name={name} defaultValue={value ?? ""} required={required}>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value ?? ""}
          required={required}
          step={type === "number" ? "0.01" : undefined}
        />
      )}
    </label>
  );
}
function Form({ children, onSubmit, submit = "Save changes" }) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        setBusy(true);
        try {
          await onSubmit(Object.fromEntries(new FormData(f)));
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <button disabled={busy} type="submit">
        {busy ? "Saving…" : submit}
      </button>
    </form>
  );
}
export default function App() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [page, setPage] = useState("Catalog"),
    [stores, setStores] = useState([]),
    [store, setStore] = useState(1),
    [parts, setParts] = useState([]),
    [q, setQ] = useState(""),
    [cart, setCart] = useState([]),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [modal, setModal] = useState(null),
    [register, setRegister] = useState(false);
  const staff = user && user.role !== "customer",
    manager = user?.role === "manager";
  async function run(fn) {
    setError("");
    setNotice("");
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return null;
    }
  }
  function refresh() {
    setRevision((n) => n + 1);
  }
  useEffect(() => {
    api("/stores")
      .then(setStores)
      .catch((e) => setError(e.message));
    if (getToken())
      api("/me")
        .then((u) => {
          setUser(u);
          if (!ready) setStore(u.store_id || 1);
        })
        .catch(() => {
          setToken("");
        })
        .finally(() => setReady(true));
    else setReady(true);
  }, [revision]);
  useEffect(() => {
    let live = true;
    api("/parts?store_id=" + store + "&q=" + encodeURIComponent(q))
      .then((p) => live && setParts(p))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [store, q, revision]);
  async function login(d) {
    await run(async () => {
      const r = await api("/login", "POST", d);
      setToken(r.token);
      setUser(r.user);
      setStore(r.user.store_id || 1);
      setPage("Catalog");
      setCart([]);
    });
  }
  function add(p) {
    setCart((c) => {
      const old = c.find((x) => x.id === p.id);
      if ((old?.qty || 0) >= p.quantity) {
        setError("No more stock available.");
        return c;
      }
      return old
        ? c.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x))
        : [...c, { ...p, qty: 1 }];
    });
  }
  const nav = staff
    ? [
        "Catalog",
        "Orders",
        "Inventory",
        "Purchasing",
        "Reports",
        ...(manager ? ["Employees", "Stores", "Suppliers"] : []),
        "Profile",
      ]
    : ["Catalog", "Cart", "Orders", "Profile"];
  if (!ready) return <main>Loading AUTO STORE…</main>;
  return (
    <>
      <header>
        <a className="brand" href="#" onClick={() => setPage("Catalog")}>
          <span className="brand-icon">T</span>AUTO PARTS
          <span className="brand-sub">AUTO PARTS</span>
        </a>
        <div className="header-right">
          <span className="status-dot" /> Local demo{" "}
          <span className="muted">/</span>{" "}
          {staff ? "Store mode" : "Customer mode"}
        </div>
      </header>
      <div className="layout">
        <aside>
          <div className="eyebrow">WORKSPACE</div>
          <nav aria-label="Main navigation">
            {nav.map((n) => (
              <button
                className={page === n ? "selected" : ""}
                onClick={() => setPage(n)}
                key={n}
              >
                {n}
                <span>
                  {n === "Cart" ? cart.reduce((s, x) => s + x.qty, 0) : "↗"}
                </span>
              </button>
            ))}
          </nav>
          <div className="side-bottom">
            <div className="avatar">{user?.name?.slice(0, 1) || "G"}</div>
            <strong>{user?.name || "Guest customer"}</strong>
            <small>{user?.role || "Browse, then sign in to order"}</small>
            {user && (
              <button
                className="ghost"
                onClick={() =>
                  run(async () => {
                    await api("/logout", "POST");
                    setToken("");
                    setUser(null);
                    setCart([]);
                    setPage("Catalog");
                  })
                }
              >
                Sign out
              </button>
            )}
          </div>
        </aside>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">AUTO STORE / {page.toUpperCase()}</div>
              <h1>
                {page === "Catalog" ? "The right part. Ready to go." : page}
              </h1>
              <p className="muted">
                {page === "Catalog"
                  ? "Quality parts, local inventory, and a smoother road ahead."
                  : "Manage your auto parts workflow in one place."}
              </p>
            </div>
            <label className="store-picker">
              Your store
              <select
                value={store}
                disabled={user?.role === "employee"}
                onChange={(e) => {
                  if (
                    cart.length &&
                    !window.confirm(
                      "Switching stores clears your cart. Continue?",
                    )
                  )
                    return;
                  setStore(Number(e.target.value));
                  setCart([]);
                }}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="alert" role="status">
              {notice}
            </div>
          )}
          {!user && (
            <section className="login-panel">
              <div>
                <div className="eyebrow">WELCOME TO AUTO STORE</div>
                <h2>
                  {register ? "Create your account" : "Sign in to get started"}
                </h2>
                <p>
                  Demo accounts: <b>customer</b>, <b>employee</b>, or{" "}
                  <b>manager</b>
                  <br />
                  Password: <b>DemoPass123!</b>
                </p>
                <button
                  className="ghost"
                  onClick={() => setRegister(!register)}
                >
                  {register
                    ? "Already registered? Sign in"
                    : "New customer? Create an account"}
                </button>
              </div>
              <Form
                onSubmit={
                  register
                    ? (d) =>
                        run(async () => {
                          await api("/register", "POST", {
                            ...d,
                            store_id: store,
                          });
                          setRegister(false);
                          setNotice("Account created. Sign in to continue.");
                        })
                    : login
                }
                submit={register ? "Create account" : "Sign in"}
              >
                <Field name="username" />
                <Field name="password" type="password" />
                {register && (
                  <>
                    <Field name="name" />
                    <Field name="email" type="email" />
                    <Field name="address" />
                    <Field name="phone" required={false} />
                    <Field name="vehicle" required={false} />
                  </>
                )}
              </Form>
            </section>
          )}
          {page === "Catalog" && (
            <>
              <div className="toolbar">
                <h2>
                  Explore the catalog{" "}
                  <span className="count">{parts.length}</span>
                </h2>
                <input
                  aria-label="Search parts"
                  placeholder="Search name, part number, or category…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="product-grid">
                {parts.map((p) => (
                  <article className="product" key={p.id}>
                    <div className="product-art">
                      <span>
                        {{
                          Brakes: "◎",
                          Fluids: "◩",
                          Electrical: "ϟ",
                          Filters: "▤",
                          Ignition: "⦿",
                          Accessories: "╱",
                        }[p.category] || "⚙"}
                      </span>
                      <small>{p.category}</small>
                    </div>
                    <div className="product-body">
                      <div className="product-meta">
                        <span>{p.sku}</span>
                        <span className="badge">{p.condition}</span>
                      </div>
                      <h3>{p.name}</h3>
                      <p>{p.description}</p>
                      <div className="stock">
                        {p.quantity > 0
                          ? `${p.quantity} available at this store`
                          : "Out of stock"}
                      </div>
                      <div className="product-footer">
                        <strong>{money(p.price)}</strong>
                        <button
                          disabled={!p.quantity || staff}
                          onClick={() => {
                            add(p);
                            setNotice(p.name + " added to cart.");
                          }}
                        >
                          Add to cart +
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!parts.length && (
                <div className="empty">
                  No matching parts. Try another search.
                </div>
              )}
            </>
          )}
          {page === "Cart" && (
            <section className="panel">
              <h2>Your order</h2>
              {!cart.length ? (
                <p>Your cart is empty. Browse the catalog to add parts.</p>
              ) : (
                <>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Part</th>
                          <th>Quantity</th>
                          <th>Subtotal</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((x) => (
                          <tr key={x.id}>
                            <td>{x.name}</td>
                            <td>
                              <input
                                aria-label={"Quantity for " + x.name}
                                type="number"
                                min="1"
                                max={x.quantity}
                                value={x.qty}
                                onChange={(e) =>
                                  setCart(
                                    cart.map((p) =>
                                      p.id === x.id
                                        ? {
                                            ...p,
                                            qty: Math.max(
                                              1,
                                              Math.min(
                                                x.quantity,
                                                Number(e.target.value) || 1,
                                              ),
                                            ),
                                          }
                                        : p,
                                    ),
                                  )
                                }
                              />
                            </td>
                            <td>{money(x.price * x.qty)}</td>
                            <td>
                              <button
                                className="ghost"
                                onClick={() =>
                                  setCart(cart.filter((p) => p.id !== x.id))
                                }
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h2>
                    Total {money(cart.reduce((s, p) => s + p.price * p.qty, 0))}
                  </h2>
                  <p className="muted">
                    Demo pricing: no tax or shipping fees. No real card charges
                    are made.
                  </p>
                  {user ? (
                    <Form
                      onSubmit={(d) =>
                        run(async () => {
                          const r = await api("/orders", "POST", {
                            ...d,
                            store_id: store,
                            items: cart.map((x) => ({
                              part_id: x.id,
                              quantity: x.qty,
                            })),
                          });
                          setCart([]);
                          refresh();
                          setPage("Orders");
                          setNotice(
                            "Order #" +
                              r.id +
                              " created. Total " +
                              money(r.total),
                          );
                        })
                      }
                      submit="Place demo order"
                    >
                      <Field
                        name="shipping_address"
                        value={user.address}
                        label="Billing / delivery address"
                      />
                      <Field
                        name="payment_method"
                        label="Payment method"
                        options={[
                          [
                            "demo_credit_card",
                            "Credit card — simulated payment",
                          ],
                          ["pay_at_store", "Pay at store"],
                        ]}
                      />
                      <Field
                        name="demo_token"
                        label="Demo card outcome (no card data needed)"
                        options={[
                          ["demo_approved", "Approved test card"],
                          ["demo_declined", "Declined test card"],
                        ]}
                      />
                    </Form>
                  ) : (
                    <p>Sign in above to complete your order.</p>
                  )}
                </>
              )}
            </section>
          )}
          {user && page === "Profile" && (
            <section className="panel">
              <h2>Personal information</h2>
              <Form
                key={user.id}
                onSubmit={(d) =>
                  run(async () => {
                    await api("/me", "PUT", {
                      ...d,
                      store_id: Number(d.store_id || store),
                    });
                    refresh();
                    setNotice("Profile saved.");
                  })
                }
              >
                {["name", "email", "phone", "address", "vehicle"].map((n) => (
                  <Field
                    key={n}
                    name={n}
                    value={user[n]}
                    required={["name", "email"].includes(n)}
                  />
                ))}
                {!staff && (
                  <Field
                    name="store_id"
                    label="Preferred branch"
                    value={user.store_id}
                    options={stores.map((s) => [s.id, s.name])}
                  />
                )}
              </Form>
            </section>
          )}
          {user && page === "Orders" && (
            <Orders {...{ run, revision, refresh, staff, setNotice }} />
          )}
          {staff && page === "Inventory" && (
            <section className="panel">
              <div className="toolbar">
                <h2>Stock & parts</h2>
                {manager && (
                  <button onClick={() => setModal({ kind: "part" })}>
                    + Add part
                  </button>
                )}
              </div>
              <Table
                columns={["Part", "Price", "On hand", "Reorder at", "Actions"]}
                rows={parts.map((p) => [
                  p.name,
                  money(p.price),
                  p.quantity,
                  p.reorder_level,
                  <div className="actions">
                    <button
                      onClick={() => setModal({ kind: "stock", data: p })}
                    >
                      Adjust stock
                    </button>
                    {manager && (
                      <button
                        className="ghost"
                        onClick={() => setModal({ kind: "part", data: p })}
                      >
                        Edit part
                      </button>
                    )}
                  </div>,
                ])}
              />
            </section>
          )}
          {staff && page === "Purchasing" && (
            <Purchasing
              {...{ parts, store, run, revision, refresh, setNotice }}
            />
          )}
          {staff && page === "Reports" && (
            <Reports {...{ store, run, revision }} />
          )}
          {manager && ["Employees", "Stores", "Suppliers"].includes(page) && (
            <Management
              key={page}
              {...{ page, stores, run, refresh, revision, setModal }}
            />
          )}
          {!user && page !== "Catalog" && page !== "Cart" && (
            <section className="panel">
              Sign in to access {page.toLowerCase()}.
            </section>
          )}
        </main>
      </div>
      {modal && (
        <EditModal
          {...{
            modal,
            setModal,
            run,
            refresh,
            store,
            stores,
            setNotice,
            error,
          }}
        />
      )}
    </>
  );
}
function Table({ columns, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="empty">No records yet.</p>}
    </div>
  );
}
function Orders({ run, revision, refresh, staff, setNotice }) {
  const [rows, setRows] = useState([]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    run(async () => setRows(await api("/orders")));
  }, [revision]);
  async function change(o, status) {
    setBusy(true);
    await run(async () => {
      let delivery_date = null;
      if (status === "shipped") {
        delivery_date = window.prompt(
          "Expected delivery date (YYYY-MM-DD)",
          new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        );
        if (!delivery_date) return;
      }
      if (
        ["returned", "cancelled"].includes(status) &&
        !window.confirm("Confirm " + status + " for order #" + o.id + "?")
      )
        return;
      await api("/orders/" + o.id, "PATCH", { status, delivery_date });
      refresh();
      setNotice("Order updated.");
    });
    setBusy(false);
  }
  return (
    <div className="orders">
      {!rows.length && <section className="panel">No orders yet.</section>}
      {rows.map((o) => (
        <section className="panel" key={o.id}>
          <div className="toolbar">
            <div>
              <h2>
                Order #{o.id} <span className="badge">{o.status}</span>
              </h2>
              <p className="muted">
                {o.customer_name} · Store {o.store_id} ·{" "}
                {new Date(o.created_at + "Z").toLocaleString()}
              </p>
            </div>
            <strong>{money(o.amount)}</strong>
          </div>
          <p>{o.shipping_address}</p>
          <p className="muted">
            Payment: {o.method} / {o.payment_status} · Expected:{" "}
            {o.delivery_date || "Not scheduled"} · Delivered:{" "}
            {o.delivered_at
              ? new Date(o.delivered_at + "Z").toLocaleString()
              : "—"}
          </p>
          <Table
            columns={["Part", "Qty", "Unit price"]}
            rows={o.items.map((i) => [i.name, i.quantity, money(i.unit_price)])}
          />
          <div className="actions">
            {o.status === "placed" && (
              <>
                <button
                  disabled={busy}
                  className="ghost"
                  onClick={() => change(o, "cancelled")}
                >
                  Cancel order
                </button>
                {staff && (
                  <button disabled={busy} onClick={() => change(o, "shipped")}>
                    Ship order
                  </button>
                )}
              </>
            )}
            {staff && o.status === "shipped" && (
              <button disabled={busy} onClick={() => change(o, "delivered")}>
                Mark delivered / collect payment
              </button>
            )}
            {o.status === "delivered" && (
              <button
                disabled={busy}
                className="ghost"
                onClick={() => change(o, "returned")}
              >
                Return full order
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
function Purchasing({ parts, store, run, revision, refresh, setNotice }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    run(async () => setRows(await api("/purchases")));
  }, [revision]);
  return (
    <>
      <section className="panel">
        <h2>Order from supplier</h2>
        <p className="muted">
          Create a new order or reorder a part. Receiving adds inventory once;
          stopping an order leaves stock unchanged.
        </p>
        <Form
          onSubmit={(d) =>
            run(async () => {
              await api("/purchases", "POST", {
                store_id: store,
                part_id: Number(d.part_id),
                quantity: Number(d.quantity),
              });
              refresh();
              setNotice("Supplier order created.");
            })
          }
          submit="Place supplier order"
        >
          <Field
            name="part_id"
            label="Part"
            options={parts.map((p) => [p.id, p.name])}
          />
          <Field name="quantity" type="number" value="10" />
        </Form>
      </section>
      <section className="panel">
        <h2>Supplier orders</h2>
        <Table
          columns={[
            "ID",
            "Part / supplier",
            "Store",
            "Quantity",
            "Status",
            "Actions",
          ]}
          rows={rows.map((p) => [
            p.id,
            p.name + " / " + p.supplier_name,
            p.store_id,
            p.quantity,
            p.status,
            p.status === "ordered" ? (
              <div className="actions">
                {["received", "cancelled"].map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      run(async () => {
                        await api("/purchases/" + p.id, "PATCH", { status: s });
                        refresh();
                      })
                    }
                  >
                    {s === "received" ? "Receive stock" : "Stop order"}
                  </button>
                ))}
              </div>
            ) : (
              <button
                className="ghost"
                onClick={() =>
                  run(async () => {
                    await api("/purchases", "POST", {
                      store_id: p.store_id,
                      part_id: p.part_id,
                      quantity: p.quantity,
                    });
                    refresh();
                  })
                }
              >
                Reorder
              </button>
            ),
          ])}
        />
      </section>
    </>
  );
}
function Reports({ store, run, revision }) {
  const [period, setPeriod] = useState("daily"),
    [r, setR] = useState(null);
  useEffect(() => {
    run(async () =>
      setR(await api("/reports?period=" + period + "&store_id=" + store)),
    );
  }, [store, period, revision]);
  function download() {
    const rows = [
      ["Period", r.period],
      ["Orders", r.order_count],
      ["Net booked sales", r.net_sales],
      ["Cancelled or returned", r.cancelled_or_returned],
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([rows.map((x) => x.join(",")).join("\n")], { type: "text/csv" }),
    );
    a.download = "torque-" + period + "-report.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <>
      <div className="toolbar">
        <div className="actions">
          {["daily", "weekly", "monthly"].map((p) => (
            <button
              className={p === period ? "" : "ghost"}
              key={p}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
        {r && <button onClick={download}>Export summary CSV ↓</button>}
      </div>
      <p className="muted">
        Rolling last 24 hours / 7 days / 30 days. Net booked sales excludes
        cancelled and returned orders; includes unpaid orders.
      </p>
      {r && (
        <>
          <div className="stats">
            <article>
              <small>Orders placed</small>
              <strong>{r.order_count}</strong>
            </article>
            <article>
              <small>Net booked sales</small>
              <strong>{money(r.net_sales)}</strong>
            </article>
            <article>
              <small>Cancelled / returned</small>
              <strong>{r.cancelled_or_returned}</strong>
            </article>
          </div>
          <section className="panel">
            <h2>Low-stock parts</h2>
            <Table
              columns={["Part", "Quantity", "Threshold"]}
              rows={r.low_stock.map((x) => [
                x.name,
                x.quantity,
                x.reorder_level,
              ])}
            />
          </section>
          <section className="panel">
            <h2>Employee status</h2>
            <Table
              columns={["Name", "Department", "Status"]}
              rows={r.employees.map((x) => [
                x.name,
                x.department,
                x.active ? "Active" : "Inactive",
              ])}
            />
          </section>
        </>
      )}
    </>
  );
}
function Management({ page, stores, run, refresh, revision, setModal }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    run(async () => setRows(await api("/" + page.toLowerCase())));
  }, [revision, page]);
  const kind =
    page === "Employees"
      ? "employee"
      : page === "Stores"
        ? "store"
        : "supplier";
  return (
    <section className="panel">
      <div className="toolbar">
        <h2>{page}</h2>
        <button onClick={() => setModal({ kind })}>+ Add {kind}</button>
      </div>
      <Table
        columns={["ID", "Name", "Details", "Actions"]}
        rows={rows.map((r) => [
          r.id,
          r.name,
          page === "Employees"
            ? `${r.username} · ${r.department} · ${r.active ? "Active" : "Inactive"}`
            : r.address || r.email,
          <div className="actions">
            {page !== "Suppliers" && (
              <button onClick={() => setModal({ kind, data: r })}>Edit</button>
            )}
            {page === "Employees" && r.active && (
              <button
                className="ghost"
                onClick={() =>
                  run(async () => {
                    if (!window.confirm("Deactivate " + r.name + "?")) return;
                    await api("/employees/" + r.id, "DELETE");
                    refresh();
                  })
                }
              >
                Deactivate
              </button>
            )}
          </div>,
        ])}
      />
    </section>
  );
}
function EditModal({
  modal,
  setModal,
  run,
  refresh,
  store,
  stores,
  setNotice,
  error,
}) {
  const { kind, data = {} } = modal;
  const [suppliers, setSuppliers] = useState([]);
  const ref = React.useRef(null);
  useEffect(() => {
    ref.current.showModal();
    if (kind === "part") run(async () => setSuppliers(await api("/suppliers")));
  }, []);
  async function save(d) {
    await run(async () => {
      let path = "";
      if (kind === "stock") {
        path = "/inventory/" + store + "/" + data.id;
        d.quantity = Number(d.quantity);
        d.reorder_level = Number(d.reorder_level);
      }
      if (kind === "part") {
        path = "/parts" + (data.id ? "/" + data.id : "");
        d.supplier_id = Number(d.supplier_id);
        d.active = d.active === "true";
      }
      if (kind === "store") path = "/stores" + (data.id ? "/" + data.id : "");
      if (kind === "supplier") path = "/suppliers";
      if (kind === "employee") {
        path = "/employees" + (data.id ? "/" + data.id : "");
        d.store_id = Number(d.store_id);
        if (data.id) d.active = d.active === "true";
      }
      await api(path, data.id ? "PUT" : "POST", d);
      setModal(null);
      refresh();
      setNotice("Saved successfully.");
    });
  }
  return (
    <dialog
      ref={ref}
      onCancel={() => setModal(null)}
      aria-labelledby="edit-title"
    >
      <div className="toolbar">
        <h2 id="edit-title">
          {data.id ? "Edit" : "Add"} {kind}
        </h2>
        <button
          className="ghost"
          aria-label="Close dialog"
          onClick={() => setModal(null)}
        >
          ×
        </button>
      </div>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      <Form onSubmit={save}>
        {kind === "stock" && (
          <>
            <Field name="quantity" type="number" value={data.quantity} />
            <Field
              name="reorder_level"
              type="number"
              value={data.reorder_level}
            />
          </>
        )}
        {kind === "part" && (
          <>
            {["sku", "name", "category", "description"].map((n) => (
              <Field name={n} key={n} value={data[n]} />
            ))}
            <Field name="price" type="number" value={data.price} />
            <Field
              name="condition"
              value={data.condition || "new"}
              options={[
                ["new", "New"],
                ["rebuilt", "Rebuilt"],
              ]}
            />
            <Field
              name="supplier_id"
              label="Supplier"
              value={data.supplier_id || suppliers[0]?.id}
              options={suppliers.map((s) => [s.id, s.name])}
            />
            <Field
              name="active"
              value={String(data.active ?? true)}
              options={[
                ["true", "For sale"],
                ["false", "Archive"],
              ]}
            />
          </>
        )}
        {["store", "supplier"].includes(kind) && (
          <>
            <Field name="name" value={data.name} />
            <Field
              name={kind === "store" ? "address" : "email"}
              value={data.address || data.email}
            />
          </>
        )}
        {kind === "employee" && (
          <>
            {!data.id && (
              <>
                <Field name="username" />
                <Field name="password" type="password" />
                <Field
                  name="role"
                  options={[
                    ["employee", "Employee"],
                    ["manager", "Manager"],
                  ]}
                />
              </>
            )}
            {["name", "email", "phone", "address", "vehicle", "department"].map(
              (n) => (
                <Field
                  key={n}
                  name={n}
                  value={data[n]}
                  required={["name", "email", "department"].includes(n)}
                />
              ),
            )}
            <Field
              name="store_id"
              label="Store"
              value={data.store_id || store}
              options={stores.map((s) => [s.id, s.name])}
            />
            {data.id && (
              <Field
                name="active"
                value={String(data.active)}
                options={[
                  ["true", "Active"],
                  ["false", "Inactive"],
                ]}
              />
            )}
          </>
        )}
      </Form>
    </dialog>
  );
}
