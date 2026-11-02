// Test-only local stand-in for a Supabase project: PostgREST behind /rest/v1 on http://127.0.0.1:54321
// Needs a Postgres on /tmp:54329 with tests/local/supabase-stub.sql + supabase/schema.sql loaded,
// and the PostgREST binary path in $POSTGREST_BIN.
// Prints the env vars for tests/rpc.test.js (anon key + admin/non-admin JWTs signed with a throwaway secret).
const http = require("http"), crypto = require("crypto"), { spawn, execFileSync } = require("child_process");
const SECRET = crypto.randomBytes(32).toString("hex");
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = p => { const h = b64({ alg: "HS256", typ: "JWT" }), b = b64(p); return `${h}.${b}.${crypto.createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url")}`; };
const exp = Math.floor(Date.now() / 1000) + 86400;
const psql = sql => execFileSync("psql", ["-h", "/tmp", "-p", "54329", "-U", "postgres", "-tAqc", sql]).toString().trim();

const adminId = psql("insert into auth.users(email) values ('admin@test.local') on conflict (email) do update set email = excluded.email returning id");
psql(`insert into public.admins(user_id, email) values ('${adminId}', 'admin@test.local') on conflict do nothing`);
const anon = jwt({ role: "anon", iss: "supabase", exp });
const admin = jwt({ role: "authenticated", sub: adminId, exp });
const nonadmin = jwt({ role: "authenticated", sub: crypto.randomUUID(), exp });

const pg = spawn(process.env.POSTGREST_BIN, [], { env: { ...process.env,
  PGRST_DB_URI: "postgres://authenticator@/postgres?host=/tmp&port=54329", PGRST_DB_SCHEMAS: "public",
  PGRST_DB_ANON_ROLE: "anon", PGRST_JWT_SECRET: SECRET, PGRST_SERVER_PORT: "54320", PGRST_LOG_LEVEL: "error" }, stdio: "inherit" });
process.on("exit", () => pg.kill());

http.createServer((req, res) => {
  if (!req.url.startsWith("/rest/v1/")) { res.writeHead(404); return res.end(); }
  const headers = { ...req.headers }; delete headers.host;
  if (!headers.authorization && headers.apikey) headers.authorization = "Bearer " + headers.apikey;
  const up = http.request({ host: "127.0.0.1", port: 54320, path: req.url.slice(8), method: req.method, headers }, r => {
    res.writeHead(r.statusCode, r.headers); r.pipe(res);
  });
  up.on("error", e => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).listen(54321, "127.0.0.1", () => {
  require("fs").writeFileSync(process.argv[2] || "/dev/stdout",
    `SUPABASE_URL=http://127.0.0.1:54321\nSUPABASE_ANON_KEY=${anon}\nADMIN_JWT=${admin}\nNONADMIN_JWT=${nonadmin}\n`);
});
