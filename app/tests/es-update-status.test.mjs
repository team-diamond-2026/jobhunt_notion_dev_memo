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

const OWNER = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000002";
const COMPANY = "20000000-0000-4000-8000-000000000001";
const OTHER_COMPANY = "20000000-0000-4000-8000-000000000002";
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
    auth: { getUser: async () => ({ data: { user: { id: getUser() } } }) },
    from(table) {
      assert.ok(table in tables);
      const column = (key) => { assert.ok(tables[table].has(key), key); return `"${key}"`; };
      let fields = "*", method = "select", values, single = false, order;
      const filters = [];
      const query = {
        select(value) { fields = value.split(",").map(column).join(","); return query; },
        insert(value) { method = "insert"; values = value; return query; },
        update(value) { method = "update"; values = value; return query; },
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
                : `select ${fields} from ${table}`;
              if (filters.length) sql += ` where ${filters.map(([k, v]) => `${column(k)} = ${parameter(v)}`).join(" and ")}`;
              if (method === "update") sql += ` returning ${fields}`;
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
    grant select, insert, update, delete on all tables in schema public to authenticated;
    insert into auth.users (id,email) values ('${OWNER}','owner@example.test'),('${OTHER}','other@example.test');
    insert into companies (id,user_id,company_name) values
      ('${COMPANY}','${OWNER}','ES検証企業'),('${OTHER_COMPANY}','${OTHER}','別利用者の企業');
    set role authenticated;
  `);
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
    "react/jsx-runtime": jsxRuntime,
  };
  const actions = loadTsx("../src/app/es/actions.ts", dependencies);
  const list = loadTsx("../src/app/es/page.tsx", dependencies).default;
  const detail = loadTsx("../src/app/es/[id]/page.tsx", { ...dependencies, "../actions": actions }).default;
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
  const listHtml = async () => renderToStaticMarkup(await list({ searchParams: Promise.resolve({ company: COMPANY }) }));
  let id, created;

  await t.test("new documents start at v1 with matching list/detail timestamps", async () => {
    await assert.rejects(actions.createEsDocument(form("before")), /redirect:\/es\/.+\?saved=created/);
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
      await assert.rejects(actions.updateEsDocument(form(content, id)), /redirect:.*saved=updated/);
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
    await assert.rejects(actions.updateEsDocument(bad), /redirect:.*error=/);
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
});
