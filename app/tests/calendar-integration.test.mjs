import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_TIME_ZONE,
  CALENDAR_EVENT_COLUMNS,
  UPCOMING_EVENT_DAYS,
  UPCOMING_EVENT_LIMIT,
  buildCalendarHref,
  dateKeyToStartIso,
  eventDateKey,
  formatDateTimeLocal,
  formatEventTime,
  getCalendarPeriod,
  getUpcomingEventRange,
  normalizeDateKey,
  shiftDateKey,
  todayDateKey,
} from "../src/lib/calendar.ts";

test("dashboard and calendar share the event source and upcoming limits", () => {
  assert.equal(APP_TIME_ZONE, "Asia/Tokyo");
  assert.equal(UPCOMING_EVENT_DAYS, 7);
  assert.equal(UPCOMING_EVENT_LIMIT, 5);
  assert.deepEqual(CALENDAR_EVENT_COLUMNS.split(","), [
    "id", "title", "event_type", "start_at", "end_at", "related_company_id",
  ]);
});

test("JST midnight determines the date even while UTC is on the previous day", () => {
  assert.equal(eventDateKey("2026-10-17T14:59:59.999Z"), "2026-10-17");
  assert.equal(eventDateKey("2026-10-17T15:00:00.000Z"), "2026-10-18");
  assert.equal(todayDateKey(new Date("2026-12-31T15:00:00Z")), "2027-01-01");
  assert.equal(dateKeyToStartIso("2027-01-01"), "2026-12-31T15:00:00.000Z");
});

test("date navigation crosses leap days, month ends, and year ends", () => {
  assert.equal(shiftDateKey("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftDateKey("2024-02-29", 1), "2024-03-01");
  assert.equal(shiftDateKey("2026-02-28", 1), "2026-03-01");
  assert.equal(shiftDateKey("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDateKey("2027-01-01", -1), "2026-12-31");
});

test("month view includes the whole Sunday-to-Saturday grid around a leap month", () => {
  const period = getCalendarPeriod("month", "2024-02-29");
  assert.equal(period.startKey, "2024-01-28");
  assert.equal(period.endKeyExclusive, "2024-03-03");
  assert.equal(period.dayKeys.length, 35);
  assert.equal(period.dayKeys[0], "2024-01-28");
  assert.equal(period.dayKeys.at(-1), "2024-03-02");
  assert.ok(period.dayKeys.includes("2024-02-29"));
  assert.ok(!period.dayKeys.includes(period.endKeyExclusive));
  assert.equal(period.previousKey, "2024-01-01");
  assert.equal(period.nextKey, "2024-03-01");
});

test("December month navigation crosses the year without retaining day 31", () => {
  const period = getCalendarPeriod("month", "2026-12-31");
  assert.equal(period.previousKey, "2026-11-01");
  assert.equal(period.nextKey, "2027-01-01");
  assert.equal(period.startKey, "2026-11-29");
  assert.equal(period.endKeyExclusive, "2027-01-03");
  assert.equal(period.dayKeys.at(-1), "2027-01-02");
});

test("Sunday starts a new week and Saturday remains in the previous week", () => {
  const saturday = getCalendarPeriod("week", "2026-10-17");
  const sunday = getCalendarPeriod("week", "2026-10-18");
  assert.equal(saturday.startKey, "2026-10-11");
  assert.equal(saturday.endKeyExclusive, "2026-10-18");
  assert.equal(sunday.startKey, "2026-10-18");
  assert.equal(sunday.endKeyExclusive, "2026-10-25");
  assert.deepEqual(sunday.dayKeys, [
    "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21",
    "2026-10-22", "2026-10-23", "2026-10-24",
  ]);
});

test("week navigation and its exclusive end work across New Year", () => {
  const period = getCalendarPeriod("week", "2026-12-31");
  assert.equal(period.startKey, "2026-12-27");
  assert.equal(period.endKeyExclusive, "2027-01-03");
  assert.equal(period.dayKeys.at(-1), "2027-01-02");
  assert.equal(period.previousKey, "2026-12-24");
  assert.equal(period.nextKey, "2027-01-07");
});

test("upcoming range starts at now and ends exclusively seven days later", () => {
  const now = new Date("2026-12-31T15:00:00.123Z");
  const range = getUpcomingEventRange(now);
  assert.deepEqual(range, {
    startAt: "2026-12-31T15:00:00.123Z",
    endAtExclusive: "2027-01-07T15:00:00.123Z",
  });
  assert.equal(now.toISOString(), "2026-12-31T15:00:00.123Z");
  assert.equal(eventDateKey(range.startAt), "2027-01-01");
  assert.equal(eventDateKey(range.endAtExclusive), "2027-01-08");
});

test("dashboard detail links retain an event's JST date and safely encode its id", () => {
  const id = "event/with ?&日本語";
  const date = eventDateKey("2026-12-31T15:30:00Z");
  const url = new URL(buildCalendarHref("month", date, id), "https://example.test");
  assert.equal(url.pathname, "/calendar");
  assert.equal(url.searchParams.get("view"), "month");
  assert.equal(url.searchParams.get("date"), "2027-01-01");
  assert.equal(url.searchParams.get("event"), id);
  assert.equal([...url.searchParams.keys()].length, 3);
  assert.equal(url.hash, "#event-detail");
});

test("plain week navigation does not select or scroll to an event", () => {
  const url = new URL(buildCalendarHref("week", "2026-10-18"), "https://example.test");
  assert.equal(url.searchParams.get("view"), "week");
  assert.equal(url.searchParams.get("date"), "2026-10-18");
  assert.equal(url.searchParams.has("event"), false);
  assert.equal(url.hash, "");
});

test("invalid calendar query dates are rejected instead of silently rolling over", () => {
  for (const value of [undefined, "", "2026-2-01", "2026-02-29", "2026-02-30", "2026-13-01", "2026-10-00", "not-a-date"]) {
    assert.equal(normalizeDateKey(value), null, String(value));
  }
  assert.equal(normalizeDateKey("2024-02-29"), "2024-02-29");
  assert.throws(() => shiftDateKey("2026-02-30", 1), /Invalid date key/);
  assert.throws(() => getCalendarPeriod("week", "2026-02-30"), /Invalid date key/);
  assert.throws(() => getCalendarPeriod("month", "not-a-date"), /Invalid date key/);
});

test("datetime-local editing uses JST with midnight represented as 00:00", () => {
  assert.equal(formatDateTimeLocal("2026-12-31T15:00:00Z"), "2027-01-01T00:00");
  assert.equal(formatDateTimeLocal("2026-10-17T01:35:42Z"), "2026-10-17T10:35");
  assert.equal(formatDateTimeLocal("2026-10-17T10:35:00+09:00"), "2026-10-17T10:35");
  assert.equal(formatEventTime("2026-10-17T01:35:00Z"), "10:35");
  assert.equal(formatDateTimeLocal(null), "");
  assert.equal(formatDateTimeLocal(undefined), "");
  assert.equal(formatDateTimeLocal(""), "");
});
