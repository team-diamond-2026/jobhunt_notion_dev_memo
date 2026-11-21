import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { companyId, otherCompanyId, logId, userId } from "./interview-fixtures";

const otherUserId = "00000000-0000-0000-0000-000000000002";
const otherLogId = "00000000-0000-0000-0000-000000000090";
let db: PGlite;

async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec("set role authenticated");
}

describe("実際のPostgresで面接ログのRLSを検証", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to authenticated;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz default now());
    `);
    // Supabase固有の認証テーブルと権限のみ補い、実際のMVPマイグレーションを実行する。
    const baseline = await readFile(new URL("../../../supabase/migrations/202606270001_mvp_schema_and_rls.sql", import.meta.url), "utf8");
    // PGliteではpgcrypto拡張が未提供。使用中のgen_random_uuid()はPostgres組み込み。
    await db.exec(baseline.replace('create extension if not exists "pgcrypto";', ""));
    await db.exec("grant all on all tables in schema public to authenticated");
    await db.query("insert into auth.users (id) values ($1), ($2)", [userId, otherUserId]);
    const sql = await readFile(new URL("../../../supabase/migrations/20261114000000_interview_log_access.sql", import.meta.url), "utf8");
    await db.exec(sql);
  }, 30_000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec("reset role; truncate public.companies cascade");
    await db.query("insert into public.companies (id, user_id, company_name) values ($1, $2, '自分の企業'), ($3, $4, '別ユーザーの企業')", [companyId, userId, otherCompanyId, otherUserId]);
    await db.query(`insert into public.interview_logs (id, company_id, interview_date, format, updated_at)
      values ($1, $2, '2026-11-14', 'オンライン', '2020-01-01'), ($3, $4, '2026-11-13', '対面', '2020-01-01')`, [logId, companyId, otherLogId, otherCompanyId]);
    await asUser(userId);
  });

  it("既存MVPの企業・ワークスペースRLSと併用して自分のログだけを読める", async () => {
    expect((await db.query("select id from public.interview_logs")).rows).toEqual([{ id: logId }]);
    await asUser(otherUserId);
    expect((await db.query("select id from public.interview_logs")).rows).toEqual([{ id: otherLogId }]);
  });

  it("自分の企業にのみ作成できる", async () => {
    const sql = "insert into public.interview_logs (company_id, interview_date, format) values ($1, '2026-11-14', '電話') returning id";
    expect((await db.query(sql, [companyId])).rows).toHaveLength(1);
    await expect(db.query(sql, [otherCompanyId])).rejects.toThrow(/row-level security/);
  });

  it("自分のログの更新日時を更新し、他人のログは更新しない", async () => {
    const result = await db.query<{ updated_at: Date }>("update public.interview_logs set reflection = '改善点' where id = $1 returning updated_at", [logId]);
    expect(new Date(result.rows[0].updated_at).getTime()).toBeGreaterThan(new Date("2020-01-01").getTime());
    expect((await db.query("update public.interview_logs set reflection = '改ざん' where id = $1 returning id", [otherLogId])).rows).toHaveLength(0);
  });

  it("既存ログを他人の企業に移すことも拒否する", async () => {
    await expect(db.query("update public.interview_logs set company_id = $1 where id = $2", [otherCompanyId, logId])).rejects.toThrow(/row-level security/);
  });

  it("自分の別企業への変更を受け入れる", async () => {
    await db.exec("reset role");
    const anotherOwnCompanyId = "00000000-0000-0000-0000-00000000000a";
    await db.query("insert into public.companies (id, user_id, company_name) values ($1, $2, '自分の別企業')", [anotherOwnCompanyId, userId]);
    await asUser(userId);
    expect((await db.query("update public.interview_logs set company_id = $1 where id = $2 returning id", [anotherOwnCompanyId, logId])).rows).toHaveLength(1);
  });

  it("匿名ユーザーに読み取り・書き込みを許可しない", async () => {
    await db.exec("reset role; set role anon");
    await expect(db.query("select * from public.interview_logs")).rejects.toThrow(/permission denied/);
    await expect(db.query("insert into public.interview_logs (company_id, interview_date, format) values ($1, '2026-11-14', '対面')", [companyId])).rejects.toThrow(/permission denied/);
  });

  it("システム列への書き込み・ログ削除を拒否する", async () => {
    await expect(db.query("update public.interview_logs set created_at = now() where id = $1", [logId])).rejects.toThrow(/permission denied/);
    await expect(db.query("delete from public.interview_logs where id = $1", [logId])).rejects.toThrow(/permission denied/);
  });

  it("既存のJSON配列と日時・NULLの記録を変更せず、新しい記録も同じ型で保存する", async () => {
    await db.query("update public.interview_logs set questions = $1::jsonb, answers = $2::jsonb, reflection = null, interview_date = $3 where id = $4", [JSON.stringify(["自己紹介", "志望理由"]), JSON.stringify(["開発経験", "事業への関心"]), "2026-11-14T00:00:00+09:00", logId]);
    const result = await db.query<{ questions: string[]; answers: string[]; reflection: string | null; interview_date: Date }>("select questions, answers, reflection, interview_date from public.interview_logs where id = $1", [logId]);
    expect(result.rows[0].questions).toEqual(["自己紹介", "志望理由"]);
    expect(result.rows[0].answers).toEqual(["開発経験", "事業への関心"]);
    expect(result.rows[0].reflection).toBeNull();
    expect(new Date(result.rows[0].interview_date).toISOString()).toBe("2026-11-13T15:00:00.000Z");
  });
});
