const apiBase = import.meta.env.VITE_API_URL || "";
let token = sessionStorage.getItem("token") || "";
export const getToken = () => token;
export function setToken(value) {
  token = value;
  if (value) sessionStorage.setItem("token", value);
  else sessionStorage.removeItem("token");
}
export async function api(path, method = "GET", data) {
  let response;
  try {
    response = await fetch(apiBase + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  } catch {
    throw new Error(
      "Cannot reach the backend. Check the api terminal and start npm run dev.",
    );
  }
  const raw = await response.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(
      `Server returned HTTP ${response.status} instead of JSON. Check the api terminal; run npm run db:check if MySQL is unavailable.`,
    );
  }
  if (!response.ok) {
    const detail = body?.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((x) => x.loc.join(".") + ": " + x.msg).join("; ")
          : `Request failed (HTTP ${response.status}).`,
    );
  }
  return body;
}
