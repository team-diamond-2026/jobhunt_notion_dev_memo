// ブラウザ検証専用。外部Supabaseへの接続・実データの変更は行わない。
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const userId = "00000000-0000-0000-0000-000000000001";
const companyId = "00000000-0000-0000-0000-000000000008";
const otherCompanyId = "00000000-0000-0000-0000-000000000009";
const companies = [
  { id: companyId, user_id: userId, company_name: "サンプル企業", industry: "IT", motivation_level: 5, selection_status: "1次面接", memo: "企業研究\nメモ", created_at: "2026-11-14T00:00:00Z", updated_at: "2026-11-14T00:00:00Z" },
  { id: otherCompanyId, user_id: userId, company_name: "別の企業", industry: "通信", motivation_level: 3, selection_status: "ES提出", memo: "", created_at: "2026-11-13T00:00:00Z", updated_at: "2026-11-13T00:00:00Z" },
];
let logs = [];
let failNextSave = false;
let companiesEmpty = false;

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:54329");
  const send = (data, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/health") return send({ ok: true });
  if (url.pathname === "/test/reset") { logs = []; failNextSave = false; companiesEmpty = false; return send({ ok: true }); }
  if (url.pathname === "/test/fail-next-save") { failNextSave = true; return send({ ok: true }); }
  if (url.pathname === "/test/no-companies") { companiesEmpty = true; return send({ ok: true }); }
  if (url.pathname === "/auth/v1/user") return send({ id: userId, aud: "authenticated", role: "authenticated", email: "test@example.com", user_metadata: { display_name: "テスト学生" }, created_at: "2026-11-14T00:00:00Z" });
  if (!url.pathname.startsWith("/rest/v1/")) return send({ message: "not found" }, 404);
  const table = url.pathname.split("/").at(-1);
  const matches = (row) => [...url.searchParams].every(([key, value]) => {
    if (!value.startsWith("eq.")) return true;
    return String(key === "companies.user_id" ? companies.find((c) => c.id === row.company_id)?.user_id : row[key]) === value.slice(3);
  });
  if (req.method === "POST" || req.method === "PATCH") {
    if (failNextSave) { failNextSave = false; return send({ code: "XX000", message: "simulated failure" }, 500); }
    let body = "";
    for await (const chunk of req) body += chunk;
    const values = JSON.parse(body);
    let saved;
    if (req.method === "POST") {
      saved = { ...values, id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      logs.push(saved);
    } else {
      saved = logs.find(matches);
      if (saved) Object.assign(saved, values, { updated_at: new Date().toISOString() });
    }
    const rows = saved ? [{ id: saved.id }] : [];
    return send(req.headers.accept?.includes("vnd.pgrst.object+json") ? rows[0] ?? null : rows, req.method === "POST" ? 201 : 200);
  }
  let rows = (table === "companies" ? companiesEmpty ? [] : companies : logs).filter(matches);
  if (table === "interview_logs") rows = rows.map((log) => ({ ...log, companies: companies.find((c) => c.id === log.company_id) }))
    .sort((a, b) => b.interview_date.localeCompare(a.interview_date) || b.created_at.localeCompare(a.created_at));
  return send(req.headers.accept?.includes("vnd.pgrst.object+json") ? rows[0] ?? null : rows);
}).listen(54329, "127.0.0.1");
