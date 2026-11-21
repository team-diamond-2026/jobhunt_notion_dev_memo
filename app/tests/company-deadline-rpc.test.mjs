import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import typescript from "typescript";

const OWNER = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-000000000002";

function migration(name) {
  return readFileSync(
    new URL(`../../supabase/migrations/${name}`, import.meta.url),
    "utf8",
  );
}

function loadTaskModule() {
  const compile = (path) => typescript.transpileModule(
    readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"),
    { compilerOptions: { module: typescript.ModuleKind.CommonJS } },
  ).outputText;
  const calendar = {};
  vm.runInNewContext(compile("../src/lib/calendar.ts"), {
    exports: calendar,
    Date,
    Intl,
  });
  const task = {};
  vm.runInNewContext(compile("../src/lib/task.ts"), {
    exports: task,
    require: (id) => {
      assert.equal(id, "./calendar");
      return calendar;
    },
    Date,
  });
  return task;
}

async function asUser(db, userId) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec("set role authenticated");
}

test("締切日はcalendar.tsのJST日付境界を使う", () => {
  const task = loadTaskModule();
  assert.equal(task.deadlineDateKeyToIso("2026-11-21"), "2026-11-21T14:59:59.000Z");
  assert.equal(task.deadlineDateInputValue("2026-11-21T14:59:59Z"), "2026-11-21");
  assert.equal(task.deadlineDateKeyToIso("2026-02-30"), null);
});

test("企業と締切のRPCはRLSを保ったまま原子的に保存する", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon noinherit;
    create role authenticated noinherit;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb default '{}',
      created_at timestamptz default now()
    );
  `);
  await db.exec(
    migration("202606270001_mvp_schema_and_rls.sql")
      .replace('create extension if not exists "pgcrypto";', ""),
  );
  await db.exec(migration("202610030001_add_industry_category.sql"));
  await db.exec(`
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on public.users, public.workspaces,
      public.companies, public.tasks to authenticated;
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@example.test'),
      ('${OTHER}', 'other@example.test');
  `);
  const rpcMigration = migration("202611210001_company_deadline_atomic_rpc.sql");
  await db.exec(rpcMigration);
  await db.exec(rpcMigration);

  await t.test("関数はsecurity invoker・固定search_pathでauthenticatedだけが実行できる", async () => {
    const rows = (await db.query(`
      select proname, prosecdef, proconfig
        from pg_proc
        join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
       where pg_namespace.nspname = 'public'
         and proname in ('create_company_with_deadline', 'update_company_with_deadline')
       order by proname
    `)).rows;
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.prosecdef === false));
    assert.ok(rows.every((row) => row.proconfig.includes("search_path=\"\"")));
    const privileges = (await db.query(`
      select
        has_function_privilege(
          'authenticated',
          'public.create_company_with_deadline(text,text,text,integer,text,text,text,timestamp with time zone,text)',
          'EXECUTE'
        ) as authenticated_create,
        has_function_privilege(
          'anon',
          'public.create_company_with_deadline(text,text,text,integer,text,text,text,timestamp with time zone,text)',
          'EXECUTE'
        ) as anon_create,
        has_function_privilege(
          'authenticated',
          'public.update_company_with_deadline(uuid,timestamp with time zone,text,text,text,text,integer,text,text,text,timestamp with time zone,text)',
          'EXECUTE'
        ) as authenticated_update,
        has_function_privilege(
          'anon',
          'public.update_company_with_deadline(uuid,timestamp with time zone,text,text,text,text,integer,text,text,text,timestamp with time zone,text)',
          'EXECUTE'
        ) as anon_update
    `)).rows[0];
    assert.deepEqual(privileges, {
      authenticated_create: true,
      anon_create: false,
      authenticated_update: true,
      anon_update: false,
    });
  });

  await asUser(db, OWNER);
  const companyCountBeforeFailedCreate = (await db.query(
    "select count(*)::int as count from public.companies",
  )).rows[0].count;
  await assert.rejects(db.query(`
    select public.create_company_with_deadline(
      '作成されない企業', null, 'IT', 4, '未応募', null,
      '作成されない締切', '2026-12-01T14:59:59Z', 'invalid'
    )
  `), /tasks_priority_check/);
  assert.equal((await db.query(
    "select count(*)::int as count from public.companies",
  )).rows[0].count, companyCountBeforeFailedCreate);

  const created = (await db.query(`
    select public.create_company_with_deadline(
      '原子保存企業', null, 'IT', 4, '未応募', '作成時メモ',
      '初回締切', '2026-12-01T14:59:59Z', 'medium'
    ) as id
  `)).rows[0];
  const companyId = created.id;
  assert.ok(companyId);
  const company = (await db.query(
    "select id, workspace_id, company_name, selection_status, updated_at from public.companies where id = $1",
    [companyId],
  )).rows[0];
  assert.equal(company.company_name, "原子保存企業");
  assert.equal((await db.query(
    "select count(*)::int as count from public.tasks where related_company_id = $1",
    [companyId],
  )).rows[0].count, 1);

  await db.exec("reset role");
  const otherWorkspace = (await db.query(
    "insert into public.workspaces (user_id, name) values ($1, '別workspace') returning id",
    [OWNER],
  )).rows[0].id;
  const lowerTaskId = "00000000-0000-0000-0000-000000000010";
  const higherTaskId = "00000000-0000-0000-0000-000000000020";
  const wrongWorkspaceTaskId = "00000000-0000-0000-0000-000000000005";
  await db.query(`
    insert into public.tasks (id, workspace_id, title, due_date, status, related_company_id)
    values
      ($1, $2, '同日先頭', '2026-11-25T14:59:59Z', 'doing', $3),
      ($4, $2, '同日後続', '2026-11-25T14:59:59Z', 'todo', $3),
      ($5, $6, 'workspace不一致', '2026-11-01T14:59:59Z', 'todo', $3)
  `, [lowerTaskId, company.workspace_id, companyId, higherTaskId, wrongWorkspaceTaskId, otherWorkspace]);
  await asUser(db, OWNER);
  const updated = (await db.query(`
    select public.update_company_with_deadline(
      $1, $2, $3, '更新企業', null, 'IT', 5, '応募済み', '更新メモ',
      '更新締切', '2026-12-15T14:59:59Z', 'high'
    ) as id
  `, [companyId, company.updated_at, company.selection_status])).rows[0];
  assert.equal(updated.id, companyId);
  const selectedTasks = (await db.query(
    "select id, title, status from public.tasks where id in ($1, $2, $3) order by id",
    [wrongWorkspaceTaskId, lowerTaskId, higherTaskId],
  )).rows;
  assert.deepEqual(selectedTasks, [
    { id: wrongWorkspaceTaskId, title: "workspace不一致", status: "todo" },
    { id: lowerTaskId, title: "更新締切", status: "doing" },
    { id: higherTaskId, title: "同日後続", status: "todo" },
  ]);

  const beforeFailure = (await db.query(
    "select company_name, selection_status, memo, updated_at from public.companies where id = $1",
    [companyId],
  )).rows[0];
  for (const [expectedUpdatedAt, currentStatus] of [
    ["2000-01-01T00:00:00Z", beforeFailure.selection_status],
    [beforeFailure.updated_at, "未応募"],
  ]) {
    const conflict = (await db.query(`
      select public.update_company_with_deadline(
        $1, $2, $3, '競合で保存されない企業名', null, 'IT', 5, '書類選考中', null,
        '競合で保存されない締切', '2026-12-20T14:59:59Z', 'medium'
      ) as id
    `, [companyId, expectedUpdatedAt, currentStatus])).rows[0];
    assert.equal(conflict.id, null);
  }
  assert.equal((await db.query(
    "select company_name from public.companies where id = $1",
    [companyId],
  )).rows[0].company_name, "更新企業");

  const taskBeforeFailure = (await db.query(
    "select title, status, priority, due_date from public.tasks where id = $1",
    [lowerTaskId],
  )).rows[0];
  await assert.rejects(db.query(`
    select public.update_company_with_deadline(
      $1, $2, $3, '保存されない企業名', null, 'IT', 5, '書類選考中', null,
      '保存されない締切', '2026-12-20T14:59:59Z', 'invalid'
    )
  `, [companyId, beforeFailure.updated_at, beforeFailure.selection_status]), /tasks_priority_check/);
  assert.deepEqual((await db.query(
    "select company_name, selection_status, memo, updated_at from public.companies where id = $1",
    [companyId],
  )).rows[0], beforeFailure);
  assert.deepEqual((await db.query(
    "select title, status, priority, due_date from public.tasks where id = $1",
    [lowerTaskId],
  )).rows[0], taskBeforeFailure);

  await asUser(db, OTHER);
  const rejected = (await db.query(`
    select public.update_company_with_deadline(
      $1, $2, $3, '他人の更新', null, 'IT', 0, '未応募', null,
      '他人の締切', '2026-12-31T14:59:59Z', 'low'
    ) as id
  `, [companyId, beforeFailure.updated_at, beforeFailure.selection_status])).rows[0];
  assert.equal(rejected.id, null);
  await asUser(db, OWNER);
  assert.equal((await db.query(
    "select company_name from public.companies where id = $1",
    [companyId],
  )).rows[0].company_name, "更新企業");
});
