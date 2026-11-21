import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import typescript from "typescript";

const source = fs.readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const compiled = typescript.transpileModule(source, {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    jsx: typescript.JsxEmit.ReactJSX,
  },
}).outputText;

const companies = [
  "未応募",
  "応募済み",
  "書類選考中",
  "一次面接",
  "二次面接",
  "最終面接",
  "内定",
].map((selection_status, index) => ({
  id: String(index),
  company_name: `企業${index}`,
  industry: null,
  motivation_level: 3,
  selection_status,
  memo: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
}));

function loadPage(records = companies) {
  const dependencies = {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": { redirect(url) { throw new Error(`REDIRECT:${url}`); } },
    "../lib/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "user@example.com" } } }) },
        from(table) {
          const result = table === "companies" ? records : [];
          const query = {
            select() { return query; },
            order() { return query; },
            gte() { return query; },
            lt() { return query; },
            limit() { return query; },
            then(resolve) { return Promise.resolve({ data: result, error: null }).then(resolve); },
          };
          return query;
        },
      }),
    },
    "../lib/selection-status": { SELECTION_STATUS_OPTIONS: ["未応募"] },
    "@/components/calendar/upcoming-events": { UpcomingEvents: () => null },
    "@/lib/calendar": {},
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => dependencies[name], Date });
  return exports.default;
}

test("KPIは正規化済みの選考ステータスを集計し、0件も表示する", async () => {
  const html = renderToStaticMarkup(await loadPage()());

  for (const [label, value] of [
    ["登録企業数", 7],
    ["未応募", 1],
    ["応募済み", 1],
    ["書類選考中", 1],
    ["面接中", 3],
    ["内定", 1],
  ]) {
    assert.match(html, new RegExp(`${label}</p><p[^>]*>${value}</p>`));
  }

  const emptyHtml = renderToStaticMarkup(await loadPage([])());
  assert.equal((emptyHtml.match(/>0<\/p>/g) ?? []).length, 6);
  assert.doesNotMatch(emptyHtml, /ES提出|Webテスト/);
});
