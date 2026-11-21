import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import typescript from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as es from "../src/lib/es.ts";
import * as templates from "../src/lib/es-templates.ts";

const OWNER = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000002";
const COMPANY = "20000000-0000-4000-8000-000000000001";
const OTHER_COMPANY = "20000000-0000-4000-8000-000000000002";
const SECOND_COMPANY = "20000000-0000-4000-8000-000000000003";
const migration = (name) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");

function loadTsx(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, jsx: typescript.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    Date,
    Intl,
    URLSearchParams,
  });
  return exports;
}

// Supabase's transport is replaced, but SQL, version/timestamp triggers and RLS
// below are the repository's actual migrations, executed in PostgreSQL/PGlite.
function createTestClient(db, getUser) {
  const tables = {
    companies: new Set(["id", "user_id", "company_name"]),
    es_documents: new Set(["id", "company_id", "title", "doc_type", "content", "version", "created_at", "updated_at"]),
  };
  return {
    auth: { getUser: async () => ({ data: { user: getUser() ? { id: getUser() } : null } }) },
    from(table) {
      assert.ok(table in tables);
      const column = (key) => { assert.ok(tables[table].has(key), key); return `"${key}"`; };
      let fields = "*", method = "select", values, single = false, order;
      const filters = [];
      const query = {
        select(value) { fields = value.split(",").map(column).join(","); return query; },
        insert(value) { method = "insert"; values = value; return query; },
        update(value) { method = "update"; values = value; return query; },
        delete() { method = "delete"; return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        order(key, options) { order = `${column(key)} ${options.ascending ? "asc" : "desc"}`; return query; },
        single() { single = true; return query; },
        maybeSingle() { single = true; return query; },
        then(resolve, reject) {
          return (async () => {
            const params = [];
            const parameter = (value) => { params.push(value); return `$${params.length}`; };
            const keys = Object.keys(values ?? {});
            let sql;
            if (method === "insert") {
              sql = `insert into ${table} (${keys.map(column).join(",")}) values (${keys.map((k) => parameter(values[k])).join(",")}) returning ${fields}`;
            } else {
              sql = method === "update"
                ? `update ${table} set ${keys.map((k) => `${column(k)} = ${parameter(values[k])}`).join(",")}`
                : method === "delete" ? `delete from ${table}` : `select ${fields} from ${table}`;
              if (filters.length) sql += ` where ${filters.map(([k, v]) => `${column(k)} = ${parameter(v)}`).join(" and ")}`;
              if (method === "update" || method === "delete") sql += ` returning ${fields}`;
              else if (order) sql += ` order by ${order}`;
            }
            try {
              const { rows } = await db.query(sql, params);
              // JSON wire format, matching the public SDK's timestamp strings.
              const data = JSON.parse(JSON.stringify(rows));
              return { data: single ? data[0] ?? null : data, error: null };
            } catch (error) {
              return { data: null, error: { message: error.message } };
            }
          })().then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test("ES dates include JST seconds and use 00 at midnight", () => {
  assert.match(es.formatEsUpdatedAt("2026-11-13T15:00:05Z"), /2026.*11.*14.*00:00:05/);
  assert.notEqual(es.formatEsUpdatedAt("2026-11-13T15:00:05Z"), es.formatEsUpdatedAt("2026-11-13T15:00:06Z"));
});

test("real migrations, ES actions and rendered list/detail agree after saves", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  // Only Supabase-managed auth objects/privileges are supplied by the test.
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role authenticated noinherit;
  `);
  // PGlite has gen_random_uuid() built in, but not the pgcrypto extension.
  await db.exec(migration("202606270001_mvp_schema_and_rls.sql").replace('create extension if not exists "pgcrypto";', ""));
  const versioning = migration("202610170001_es_document_versioning.sql");
  await db.exec(versioning);
  await db.exec(versioning);
  await db.exec(`
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on users, workspaces, companies to authenticated;
    insert into auth.users (id,email) values ('${OWNER}','owner@example.test'),('${OTHER}','other@example.test');
    insert into companies (id,user_id,company_name) values
      ('${COMPANY}','${OWNER}','ES検証企業'),('${OTHER_COMPANY}','${OTHER}','別利用者の企業'),('${SECOND_COMPANY}','${OWNER}','別の応募先');
  `);
  const accessMigration = migration("202611140001_es_document_authenticated_access.sql");
  await t.test("missing authenticated ES privileges reproduce 42501; the migration fixes only ES access", async () => {
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select id from es_documents"), { code: "42501" });
    await db.exec("reset role");
    await db.exec(accessMigration);
    await db.exec(accessMigration);
    const result = (await db.query("select has_table_privilege('authenticated', 'public.es_documents', 'SELECT') as read, has_table_privilege('authenticated', 'public.es_documents', 'TRUNCATE') as truncate")).rows[0];
    assert.equal(result.read, true);
    assert.equal(result.truncate, false);
  });
  await t.test("the access migration refuses a missing RLS prerequisite", async () => {
    await db.exec("alter table es_documents disable row level security");
    await assert.rejects(db.exec(accessMigration), /Apply the MVP schema\/RLS migration/);
    await db.exec("alter table es_documents enable row level security");
  });
  await db.exec("set role authenticated");
  const deploymentCheck = readFileSync(new URL("../../supabase/checks/es_update_status.sql", import.meta.url), "utf8");
  const checkRows = (await db.query(deploymentCheck)).rows;
  assert.equal(checkRows.length, 8);
  assert.ok(checkRows.every((row) => row.ok), JSON.stringify(checkRows));
  let userId = OWNER;
  const setUser = async (id) => { userId = id; await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]); };
  await setUser(OWNER);
  const client = createTestClient(db, () => userId);
  const invalidated = [];
  const dependencies = {
    "@/lib/es": es,
    "@/lib/supabase/server": { createClient: async () => client },
    "next/cache": { revalidatePath: (path) => invalidated.push(path) },
    "next/navigation": {
      redirect: (url) => { throw new Error(`redirect:${url}`); },
      notFound: () => { throw new Error("not-found"); },
    },
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@/components/page-heading": { PageHeading: ({ title, description }) => React.createElement("header", null, title, description) },
    "react/jsx-runtime": jsxRuntime,
    react: React,
    "@/lib/es-templates": templates,
  };
  const actions = loadTsx("../src/app/es/actions.ts", dependencies);
  const list = loadTsx("../src/app/es/page.tsx", dependencies).default;
  const detail = loadTsx("../src/app/es/[id]/page.tsx", { ...dependencies, "../actions": actions }).default;
  const formComponent = loadTsx("../src/components/es/es-form.tsx", dependencies);
  const newForm = loadTsx("../src/components/es/new-es-form.tsx", {
    ...dependencies, "./es-form": formComponent, "@/app/es/actions": actions,
  });
  const newPage = loadTsx("../src/app/es/new/page.tsx", {
    ...dependencies, "@/components/es/new-es-form": newForm,
  }).default;
  const editForm = loadTsx("../src/components/es/edit-es-form.tsx", {
    ...dependencies, "./es-form": formComponent, "@/app/es/actions": actions,
  });
  const editPage = loadTsx("../src/app/es/[id]/edit/page.tsx", {
    ...dependencies, "@/components/es/edit-es-form": editForm,
  }).default;
  const editHtml = async (id) => renderToStaticMarkup(await editPage({ params: Promise.resolve({ id }) }));
  const newHtml = async (params = {}) => renderToStaticMarkup(await newPage({ searchParams: Promise.resolve(params) }));
  const form = (content, id) => {
    const data = new FormData();
    data.set("company_id", COMPANY);
    data.set("title", "更新確認ES");
    data.set("doc_type", "self_pr");
    data.set("content", content);
    if (id) data.set("document_id", id);
    return data;
  };
  const read = async (id) => (await client.from("es_documents").select("id,company_id,title,doc_type,content,version,created_at,updated_at").eq("id", id).single()).data;
  const detailHtml = async (id) => renderToStaticMarkup(await detail({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }));
  const listHtml = async (company = COMPANY) => renderToStaticMarkup(await list({ searchParams: Promise.resolve({ company }) }));
  let id, created;

  await t.test("new documents start at v1 with matching list/detail timestamps", async () => {
    await assert.rejects(actions.createEsDocument(undefined, form("before")), /redirect:\/es\/.+\?saved=created/);
    const rows = (await client.from("es_documents").select("id")).data;
    assert.equal(rows.length, 1);
    id = rows[0].id;
    created = await read(id);
    assert.equal(created.version, 1);
    assert.equal(created.created_at, created.updated_at);
    for (const html of [await listHtml(), await detailHtml(id)]) {
      assert.match(html, /v1/);
      assert.ok(html.includes(`dateTime="${created.updated_at}"`));
      assert.ok(html.includes(es.formatEsUpdatedAt(created.updated_at)));
      assert.ok(html.includes("日本時間"));
    }
  });

  await t.test("two real saves advance v1 → v2 → v3 and survive refetch/rerender", async () => {
    let previous = created;
    for (const [version, content] of [[2, "after-1"], [3, "after-2"]]) {
      await assert.rejects(actions.updateEsDocument(undefined, form(content, id)), /redirect:.*saved=updated/);
      const row = await read(id);
      assert.equal(row.version, version);
      assert.equal(row.content, content);
      assert.equal(row.created_at, created.created_at);
      assert.ok(Date.parse(row.updated_at) > Date.parse(previous.updated_at));
      t.diagnostic(JSON.stringify({ version: row.version, content: row.content, created_at: row.created_at, updated_at: row.updated_at }));
      for (const html of [await listHtml(), await detailHtml(id), await detailHtml(id)]) {
        assert.ok(html.includes(`v${version}`));
        assert.ok(html.includes(content));
        assert.ok(html.includes(`dateTime="${row.updated_at}"`));
      }
      previous = row;
    }
    assert.ok(invalidated.includes("/es"));
    assert.ok(invalidated.includes(`/es/${id}`));
    assert.ok(invalidated.includes(`/companies/${COMPANY}`));
  });

  await t.test("failed validation changes neither version nor persisted content", async () => {
    const before = await read(id);
    const bad = form("not-saved", id);
    bad.set("title", "");
    const result = await actions.updateEsDocument(undefined, bad);
    assert.equal(result.error, "ESタイトルを入力してください");
    assert.equal(result.values.content, "not-saved");
    assert.deepEqual(await read(id), before);
  });

  await t.test("RLS hides another user's document and prevents an update", async () => {
    await setUser(OTHER);
    assert.equal(await read(id), null);
    await assert.rejects(detailHtml(id), /not-found/);
    const result = await client.from("es_documents").update({ content: "unauthorized" }).eq("id", id).select("id").maybeSingle();
    assert.equal(result.data, null);
    await setUser(OWNER);
    const row = await read(id);
    assert.equal(row.version, 3);
    assert.equal(row.content, "after-2");
  });

  await t.test("the DB owns version increments even if a client supplies a version", async () => {
    await db.query("update es_documents set version=99 where id=$1", [id]);
    assert.equal((await read(id)).version, 4);
    await db.query("update es_documents set content=content where id=$1", [id]);
    assert.equal((await read(id)).version, 5);
  });

  await t.test("template chooser preserves the owned company and handles blank/unknown templates", async () => {
    const chooser = await newHtml({ company: COMPANY });
    for (const template of templates.ES_TEMPLATES) {
      assert.ok(chooser.includes(`/es/new?company=${COMPANY}&amp;template=${template.id}`));
      const html = await newHtml({ company: COMPANY, template: template.id });
      assert.ok(html.includes(template.title));
      assert.ok(html.includes(template.content));
      assert.ok(html.includes(`value="${COMPANY}" selected=""`));
      assert.ok(html.includes(`value="${template.doc_type}" selected=""`));
    }
    const blank = await newHtml({ template: "blank" });
    assert.ok(blank.includes('value="entry_sheet" selected=""'));
    assert.ok(!blank.includes(templates.ES_TEMPLATES[0].content));
    const unknown = await newHtml({ template: "unknown" });
    assert.ok(unknown.includes('role="alert"'));
    assert.ok(!unknown.includes('<textarea'));
    const unowned = await newHtml({ company: OTHER_COMPANY, template: "self_pr" });
    assert.ok(!unowned.includes(OTHER_COMPANY));
    assert.equal(templates.getEsTemplate("unknown"), undefined);
  });

  await t.test("all three templates save independently, edit and rerender without mutating their source", async () => {
    const source = JSON.stringify(templates.ES_TEMPLATES);
    for (const template of templates.ES_TEMPLATES) {
      const data = form(template.content);
      data.set("title", template.title);
      data.set("doc_type", template.doc_type);
      const create = async () => {
        let savedId;
        await assert.rejects(actions.createEsDocument(undefined, data), (error) => {
          savedId = error.message.match(/^redirect:\/es\/([^?]+)\?saved=created$/)?.[1];
          return Boolean(savedId);
        });
        return savedId;
      };
      const first = await create();
      const second = await create();
      assert.notEqual(first, second);
      const row = await read(first);
      assert.equal(row.company_id, COMPANY);
      assert.equal(row.doc_type, template.doc_type);
      assert.equal(row.content, template.content);
      assert.equal(row.version, 1);
      assert.ok((await detailHtml(first)).includes(template.content));
      data.set("document_id", first);
      data.set("content", `${template.name}を自分の経験で編集`);
      await assert.rejects(actions.updateEsDocument(undefined, data), /saved=updated/);
      assert.equal((await read(first)).version, 2);
      assert.equal((await read(second)).content, template.content);
      assert.ok((await detailHtml(first)).includes(`${template.name}を自分の経験で編集`));
      assert.ok((await listHtml()).includes(template.title));
      assert.ok((await newHtml({ template: template.id })).includes(template.content));
    }
    assert.equal(JSON.stringify(templates.ES_TEMPLATES), source);
  });

  await t.test("invalid input, foreign companies and failed inserts preserve the entered draft without writing", async () => {
    const count = async () => (await db.query("select count(*)::int as n from es_documents")).rows[0].n;
    const before = await count();
    const data = form("  推敲中の本文\n改行も保持  ");
    data.set("title", "");
    const invalid = await actions.createEsDocument(undefined, data);
    assert.equal(invalid.error, "ESタイトルを入力してください");
    assert.equal(invalid.values.content, data.get("content"));
    data.set("title", "下書き");
    data.set("doc_type", "invalid");
    assert.equal((await actions.createEsDocument(undefined, data)).error, "文書種別を選択してください");
    data.set("doc_type", "self_pr");
    data.set("company_id", OTHER_COMPANY);
    assert.equal((await actions.createEsDocument(undefined, data)).error, "選択した企業を確認できません");
    data.set("company_id", COMPANY);
    await db.exec("reset role; revoke insert on es_documents from authenticated; set role authenticated");
    try {
      const failed = await actions.createEsDocument(undefined, data);
      assert.equal(failed.error, "ESを保存できませんでした");
      assert.equal(failed.values.content, data.get("content"));
      assert.equal(failed.values.company_id, COMPANY);
      assert.equal(failed.values.doc_type, "self_pr");
      assert.equal(await count(), before);
    } finally {
      await db.exec("reset role; grant insert on es_documents to authenticated; set role authenticated");
    }
  });

  await t.test("blank ES creation, company filtering and reassignment persist across page reads", async () => {
    const data = form("");
    data.set("title", "CRUD検証下書き");
    data.set("doc_type", "entry_sheet");
    let draftId;
    await assert.rejects(actions.createEsDocument(undefined, data), error => {
      draftId = error.message.match(/^redirect:\/es\/([^?]+)\?saved=created$/)?.[1];
      return Boolean(draftId);
    });
    assert.equal((await read(draftId)).content, "");
    assert.ok((await listHtml()).includes(draftId));
    assert.ok(!(await listHtml(SECOND_COMPANY)).includes(draftId));
    assert.ok((await editHtml(draftId)).includes('value="entry_sheet" selected=""'));
    data.set("document_id", draftId);
    data.set("company_id", SECOND_COMPANY);
    data.set("content", "企業変更後の本文");
    await assert.rejects(actions.updateEsDocument(undefined, data), /saved=updated/);
    assert.equal((await read(draftId)).company_id, SECOND_COMPANY);
    assert.equal((await read(draftId)).version, 2);
    for (let refresh = 0; refresh < 2; refresh++) {
      assert.ok(!(await listHtml()).includes(draftId));
      assert.ok((await listHtml(SECOND_COMPANY)).includes(draftId));
      assert.ok((await detailHtml(draftId)).includes("別の応募先"));
      assert.ok((await editHtml(draftId)).includes("企業変更後の本文"));
    }
  });

  await t.test("update failures retain all edits and leave the saved row unchanged", async () => {
    const before = await read(id);
    const data = form("  保存したい推敲文\n2行目  ", id);
    data.set("title", "編集後タイトル");
    data.set("company_id", SECOND_COMPANY);
    data.set("doc_type", "other");
    await db.exec("reset role; revoke update on es_documents from authenticated; set role authenticated");
    try {
      const failed = await actions.updateEsDocument(undefined, data);
      assert.equal(failed.error, "ESを更新できませんでした");
      assert.deepEqual(JSON.parse(JSON.stringify(failed.values)), {
        company_id: SECOND_COMPANY, title: "編集後タイトル", doc_type: "other", content: data.get("content"),
      });
      assert.equal((await actions.updateEsDocument(failed, data)).attempt, 2);
      assert.deepEqual(await read(id), before);
    } finally {
      await db.exec("reset role; grant update on es_documents to authenticated; set role authenticated");
    }
    data.set("company_id", OTHER_COMPANY);
    assert.equal((await actions.updateEsDocument(undefined, data)).error, "選択した企業を確認できません");
    assert.deepEqual(await read(id), before);
  });

  await t.test("other users cannot list, edit, reassign or delete an owner's ES through the actual actions", async () => {
    const before = await read(id);
    await setUser(OTHER);
    try {
      assert.ok(!(await listHtml("")).includes(id));
      await assert.rejects(detailHtml(id), /not-found/);
      await assert.rejects(editHtml(id), /not-found/);
      const data = form("乗っ取り不可", id);
      data.set("company_id", OTHER_COMPANY);
      assert.equal((await actions.updateEsDocument(undefined, data)).error, "ESを更新できませんでした");
      await assert.rejects(actions.deleteEsDocument(data), /redirect:.*error=/);
    } finally {
      await setUser(OWNER);
    }
    assert.deepEqual(await read(id), before);
  });

  await t.test("delete failures preserve the ES; successful deletion removes it from refetched pages", async () => {
    const before = await read(id);
    const allBefore = (await client.from("es_documents").select("id")).data.length;
    const data = form("", id);
    await db.exec("reset role; revoke delete on es_documents from authenticated; set role authenticated");
    try {
      await assert.rejects(actions.deleteEsDocument(data), /redirect:.*error=/);
      assert.deepEqual(await read(id), before);
    } finally {
      await db.exec("reset role; grant delete on es_documents to authenticated; set role authenticated");
    }
    await assert.rejects(actions.deleteEsDocument(data), /^Error: redirect:\/es\?deleted=1$/);
    assert.equal(await read(id), null);
    assert.equal((await client.from("es_documents").select("id")).data.length, allBefore - 1);
    for (let refresh = 0; refresh < 2; refresh++) {
      assert.ok(!(await listHtml()).includes(id));
      await assert.rejects(detailHtml(id), /not-found/);
      await assert.rejects(editHtml(id), /not-found/);
    }
    const resultHtml = renderToStaticMarkup(await list({ searchParams: Promise.resolve({ deleted: "1" }) }));
    assert.ok(resultHtml.includes("ESを削除しました。"));
    assert.ok(invalidated.includes(`/es/${id}/edit`));
    await assert.rejects(actions.deleteEsDocument(data), /redirect:.*error=/);
  });

  await t.test("signed-out users are redirected before all CRUD operations and page reads", async () => {
    await setUser("");
    try {
      const data = form("未認証", id);
      for (const operation of [
        () => actions.createEsDocument(undefined, data),
        () => actions.updateEsDocument(undefined, data),
        () => actions.deleteEsDocument(data),
        () => listHtml(), () => detailHtml(id), () => editHtml(id), () => newHtml(),
      ]) await assert.rejects(operation(), /redirect:\/login/);
    } finally {
      await setUser(OWNER);
    }
  });
});
