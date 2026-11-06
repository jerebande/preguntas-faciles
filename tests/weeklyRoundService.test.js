const test = require("node:test");
const assert = require("node:assert/strict");
const { getWeeklyRound } = require("../services/weeklyRoundService");

test("the weekly round starts on Monday at midnight in Argentina", () => {
    const round = getWeeklyRound(new Date("2026-11-04T19:00:00.000Z"));

    assert.equal(round.startDate, "2026-11-02");
    assert.equal(new Date(round.startsAt).toISOString(), "2026-11-02T03:00:00.000Z");
    assert.equal(new Date(round.nextMondayAt).toISOString(), "2026-11-09T03:00:00.000Z");
});

test("the round changes exactly at Argentina's Monday midnight", () => {
    const before = getWeeklyRound(new Date("2026-11-09T02:59:59.999Z"));
    const after = getWeeklyRound(new Date("2026-11-09T03:00:00.000Z"));

    assert.equal(before.startDate, "2026-11-02");
    assert.equal(after.startDate, "2026-11-09");
});
