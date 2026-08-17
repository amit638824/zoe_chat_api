/**
 * Integration test — run: npm run test:api
 */
import dotenv from "dotenv";
import path from "path";
import mysql from "mysql2/promise";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const TEST_USER = "V20230621TeDAzf6TeqE";
const TEST_USER_2 = "TEST_USER_2";

const headers = {
  "Content-Type": "application/json",
  "x-user-id": TEST_USER,
  "x-user-type": "VOL",
};

async function request(method: string, url: string, body?: unknown) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
}

async function testDatabase() {
  console.log("\n📦 DATABASE");
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "3306", 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const [tables] = await conn.query("SHOW TABLES");
    const tableNames = (tables as Record<string, string>[]).map(
      (r) => Object.values(r)[0]
    );
    console.log("  ✅ Connected to", process.env.DB_HOST);
    console.log("  Tables:", tableNames.join(", ") || "(none — run schema.sql)");
    await conn.end();
    return { ok: true, tables: tableNames };
  } catch (err) {
    console.log("  ❌", (err as Error).message);
    return { ok: false, tables: [] as string[] };
  }
}

async function runTests() {
  console.log("🧪 ZOE Chat API Test Report");
  console.log("============================");

  const db = await testDatabase();
  const results: Array<{ name: string; ok: boolean; detail: string }> = [];

  try {
    const health = await request("GET", "/health");
    results.push({
      name: "GET /health",
      ok: health.status === 200 && health.json.success,
      detail: health.json.message,
    });
  } catch (e) {
    results.push({ name: "GET /health", ok: false, detail: "Server not running" });
  }

  try {
    const noAuth = await fetch(`${BASE}/api/chat/users`);
    const noAuthJson = await noAuth.json();
    results.push({
      name: "Auth middleware",
      ok: noAuth.status === 401,
      detail: noAuthJson.message,
    });
  } catch (e) {
    results.push({ name: "Auth middleware", ok: false, detail: String(e) });
  }

  try {
    const users = await request("GET", "/api/chat/users");
    results.push({
      name: "GET /api/chat/users",
      ok: users.status === 200,
      detail: users.json.message + ` (${Array.isArray(users.json.data) ? users.json.data.length : 0} users)`,
    });
  } catch (e) {
    results.push({ name: "GET /api/chat/users", ok: false, detail: String(e) });
  }

  if (db.ok) {
    try {
      const convs = await request("GET", "/api/chat/conversations");
      results.push({
        name: "GET /api/chat/conversations",
        ok: convs.status === 200,
        detail: convs.json.message,
      });
    } catch (e) {
      results.push({ name: "GET /api/chat/conversations", ok: false, detail: String(e) });
    }

    try {
      const room = await request("POST", "/api/chat/rooms", { recipientId: TEST_USER_2 });
      const roomId = room.json?.data?.id;
      results.push({
        name: "POST /api/chat/rooms",
        ok: room.status === 201 && !!roomId,
        detail: roomId || room.json.message,
      });

      if (roomId) {
        const msg = await request("POST", "/api/chat/messages", {
          roomId,
          content: "Test message " + Date.now(),
        });
        results.push({
          name: "POST /api/chat/messages",
          ok: msg.status === 201,
          detail: msg.json.data?.content || msg.json.message,
        });

        const msgs = await request("GET", `/api/chat/rooms/${roomId}/messages`);
        results.push({
          name: "GET /api/chat/rooms/:id/messages",
          ok: msgs.status === 200 && Array.isArray(msgs.json.data),
          detail: `${msgs.json.data?.length || 0} messages`,
        });
      }
    } catch (e) {
      results.push({ name: "Chat flow", ok: false, detail: String(e) });
    }
  } else {
    results.push({
      name: "DB-dependent APIs",
      ok: false,
      detail: "Skipped — fix DB connection first",
    });
  }

  console.log("\n🌐 REST API");
  for (const r of results) {
    console.log(`  ${r.ok ? "✅" : "❌"} ${r.name} — ${r.detail}`);
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;

  console.log("\n============================");
  console.log(`Result: ${passed}/${total} passed`);
  if (!db.ok) {
    console.log("\n⚠️  FIX REQUIRED:");
    console.log("   MySQL access denied — check:");
    console.log("   1. DB_PASSWORD in .env is correct");
    console.log("   2. Your IP is whitelisted on stableserver.net");
    console.log("   3. database/schema.sql has been run");
  }
  console.log("============================\n");

  process.exit(passed === total ? 0 : 1);
}

runTests();
