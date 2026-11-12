import concurrently from "concurrently";
// Explicit preview choice; never fall back silently after a MySQL failure.
process.env.DATABASE_URL = "sqlite:///torque_demo.db";
console.log(
  "\nSQLITE PREVIEW: data is saved in backend/torque_demo.db. MySQL data is untouched.\n",
);
const { result } = concurrently(
  [
    { command: "npm run dev:backend", name: "api", prefixColor: "blue" },
    { command: "npm run dev:frontend", name: "web", prefixColor: "green" },
  ],
  { killOthersOn: ["failure", "success"] },
);
result.then(
  () => {
    process.exitCode = 0;
  },
  () => {
    process.exitCode = 1;
  },
);
