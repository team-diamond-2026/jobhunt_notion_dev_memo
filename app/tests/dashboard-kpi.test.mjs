import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import typescript from "typescript";
import * as calendar from "../src/lib/calendar.ts";
import * as selectionStatus from "../src/lib/selection-status.ts";

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
  "ES提出",
  "Webテスト",
  "1次面接",
  "辞退",
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

function loadPage(records = companies, { events = [], todayTasks = [], weeklyTasks = [] } = {}) {
  let taskQueryCount = 0;
  const dependencies = {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": { redirect(url) { throw new Error(`REDIRECT:${url}`); } },
    "../lib/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "user@example.com" } } }) },
        from(table) {
          const result = table === "companies"
            ? records
            : table === "workspaces"
              ? [{ id: "workspace-1" }]
              : table === "events"
                ? events
                : table === "tasks"
                  ? (taskQueryCount++ === 0 ? todayTasks : weeklyTasks)
              : [];
          const query = {
            select() { return query; },
            order() { return query; },
            eq() { return query; },
            in() { return query; },
            not() { return query; },
            gte() { return query; },
            lt() { return query; },
            limit() { return query; },
            then(resolve) { return Promise.resolve({ data: result, error: null }).then(resolve); },
          };
          return query;
        },
      }),
    },
    "../lib/selection-status": selectionStatus,
    "@/components/calendar/upcoming-events": { UpcomingEvents: () => null },
    "@/components/page-heading": { PageHeading: ({ title }) => React.createElement("h1", null, title) },
    "@/components/status-badge": { StatusBadge: ({ status }) => React.createElement("span", null, status) },
    "@/lib/calendar": calendar,
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => dependencies[name], Date });
  return exports.default;
}

test("KPIは正規化済みの選考ステータスを集計し、0件も表示する", async () => {
  const html = renderToStaticMarkup(await loadPage()());

  for (const [label, value] of [
    ["登録企業数", 11],
    ["未応募", 1],
    ["応募済み", 2],
    ["書類選考中", 2],
    ["面接中", 4],
    ["内定", 1],
  ]) {
    assert.match(html, new RegExp(`${label}</p><p[^>]*>${value}</p>`));
  }

  const emptyHtml = renderToStaticMarkup(await loadPage([])());
  assert.equal((emptyHtml.match(/>0<\/p>/g) ?? []).length, 6);
  assert.doesNotMatch(emptyHtml, /ES提出|Webテスト/);
});

test("今日の予定と今週の締切は、今日の締切を重複表示しない", async () => {
  const today = calendar.todayDateKey();
  const tomorrow = calendar.shiftDateKey(today, 1);
  const todayStart = calendar.dateKeyToStartIso(today);
  const tomorrowStart = calendar.dateKeyToStartIso(tomorrow);
  const html = renderToStaticMarkup(await loadPage([], {
    events: [{
      id: "today-event",
      title: "今日の面接",
      event_type: "interview",
      start_at: todayStart,
      end_at: null,
      related_company_id: null,
    }],
    todayTasks: [{
      id: "today-task",
      title: "今日のES提出",
      due_date: todayStart,
      status: "todo",
      priority: "high",
      related_company_id: null,
    }],
    weeklyTasks: [{
      id: "weekly-task",
      title: "明日のWebテスト",
      due_date: tomorrowStart,
      status: "doing",
      priority: "medium",
      related_company_id: null,
    }],
  })());

  assert.match(html, /今日の予定[\s\S]*?2件/);
  assert.match(html, /今週の締切[\s\S]*?1件/);
  assert.match(html, /今日のES提出/);
  assert.match(html, /明日のWebテスト/);
  assert.equal((html.match(/今日のES提出/g) ?? []).length, 1);
});
