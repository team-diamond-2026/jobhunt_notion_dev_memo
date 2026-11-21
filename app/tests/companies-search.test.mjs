import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import typescript from "typescript";

const source = fs.readFileSync(
  new URL("../src/app/companies/page.tsx", import.meta.url),
  "utf8",
);
const compiled = typescript.transpileModule(source, {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    jsx: typescript.JsxEmit.ReactJSX,
  },
}).outputText;
const companies = [
  { company_name: "トヨタ自動車", industry: "自動車", selection_status: "未エントリー" },
  { company_name: "トヨタ紡織", industry: "自動車", selection_status: "内定" },
  { company_name: "Sample Inc.", industry: "IT", selection_status: "未エントリー" },
].map((company, index) => ({
  ...company,
  id: String(index),
  motivation_level: 3,
  memo: null,
  updated_at: "2026-11-14T00:00:00Z",
}));

function loadPage({ records = companies, user = { id: "user-1" }, error = null } = {}) {
  const calls = [];
  const predicates = [];
  const query = {
    select() { return query; },
    order(column, options) {
      calls.push(["order", column, options.ascending]);
      return query;
    },
    ilike(column, pattern) {
      calls.push(["ilike", column, pattern]);
      const keyword = pattern.slice(1, -1).toLowerCase();
      predicates.push((company) => company[column].toLowerCase().includes(keyword));
      return query;
    },
    eq(column, value) {
      calls.push(["eq", column, value]);
      predicates.push((company) => company[column] === value);
      return query;
    },
    then(resolve) {
      return Promise.resolve({
        data: records?.filter((company) => predicates.every((matches) => matches(company))) ?? null,
        error,
      }).then(resolve);
    },
  };
  const dependencies = {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": { redirect(url) { throw new Error(`REDIRECT:${url}`); } },
    "../../lib/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user } }) },
        from(table) { calls.push(["from", table]); return query; },
      }),
    },
    "./actions": { createCompany: "/create-company", deleteCompany: "/delete-company" },
    "./industry-fields": { IndustryFields: () => null },
    "../../lib/selection-status": { SELECTION_STATUS_OPTIONS: ["未エントリー", "内定"] },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => dependencies[name], Date });
  return { page: exports.default, calls };
}

async function render(params = {}, options) {
  const { page, calls } = loadPage(options);
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve(params) }));
  const names = [...html.matchAll(/href="\/companies\/\d"[^>]*>(.*?)<\/a>/g)]
    .map((match) => match[1]).filter((name) => name !== "詳細");
  return { html, names, calls };
}

for (const [label, params, expected] of [
  ["no keyword", {}, companies.map((company) => company.company_name)],
  ["empty keyword", { keyword: "" }, companies.map((company) => company.company_name)],
  ["whitespace keyword", { keyword: " 　\t " }, companies.map((company) => company.company_name)],
  ["partial match", { keyword: "トヨタ" }, ["トヨタ自動車", "トヨタ紡織"]],
  ["full name", { keyword: "トヨタ自動車" }, ["トヨタ自動車"]],
  ["case insensitive", { keyword: "sAmPlE" }, ["Sample Inc."]],
  ["trimmed keyword", { keyword: " トヨタ　" }, ["トヨタ自動車", "トヨタ紡織"]],
  ["q alias", { q: "Sample" }, ["Sample Inc."]],
  ["repeated keyword", { keyword: ["Sample", "トヨタ"] }, ["Sample Inc."]],
  ["repeated q", { q: ["Sample", "トヨタ"] }, ["Sample Inc."]],
  ["keyword takes priority", { keyword: "Sample", q: "トヨタ" }, ["Sample Inc."]],
  ["no match", { keyword: "存在しない企業" }, []],
]) {
  test(label, async () => assert.deepEqual((await render(params)).names, expected));
}

test("search form retains the keyword, displays the count and links to reset", async () => {
  const { html, calls } = await render({ keyword: "トヨタ" });
  const form = html.match(/<form\b(?=[^>]*role="search")[^>]*>/)?.[0];
  assert.ok(form);
  assert.match(form, /action="\/companies"/);
  assert.match(form, /method="get"/);
  assert.match(html, /name="keyword"[^>]*value="トヨタ"/);
  assert.match(html, /「トヨタ」の検索結果: 2 件/);
  assert.match(html, /href="\/companies"[^>]*>リセット<\/a>/);
  assert.ok(calls.some((call) => call.join() === "ilike,company_name,%トヨタ%"));
});

test("an empty keyword does not add a company name filter", async () => {
  const { calls } = await render({ keyword: "　 " });
  assert.ok(!calls.some((call) => call[0] === "ilike"));
});

test("industry, status and sorting continue to work with company search", async () => {
  const { names, calls } = await render({ keyword: "トヨタ", industry: "自動車", status: "内定", sort: "name_asc" });
  assert.deepEqual(names, ["トヨタ紡織"]);
  assert.ok(calls.some((call) => call.join() === "ilike,industry,%自動車%"));
  assert.ok(calls.some((call) => call.join() === "eq,selection_status,内定"));
  assert.ok(calls.some((call) => call.join() === "order,company_name,true"));
});

test("zero matches display a distinct message", async () => {
  const { html } = await render({ keyword: "存在しない企業" });
  assert.match(html, /検索結果: 0 件/);
  assert.match(html, /条件に一致する企業がありません/);
  assert.doesNotMatch(html, /まだ企業が登録されていません/);
});

test("no registered companies display the initial empty state", async () => {
  assert.match((await render({}, { records: [] })).html, /まだ企業が登録されていません/);
});

test("search text is escaped in HTML", async () => {
  const { html } = await render({ keyword: "<script>alert(1)</script>" });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test("unauthenticated users redirect before querying companies", async () => {
  const { page, calls } = loadPage({ user: null });
  await assert.rejects(page({ searchParams: Promise.resolve({}) }), /REDIRECT:\/login/);
  assert.deepEqual(calls, []);
});

test("database errors propagate", async () => {
  const { page } = loadPage({ error: { message: "test database error" } });
  await assert.rejects(page({ searchParams: Promise.resolve({}) }), /企業一覧の取得に失敗しました: test database error/);
});
