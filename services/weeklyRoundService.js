const ARGENTINA_OFFSET_MS = -3 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getWeeklyRound(now = new Date()) {
    const argentinaNow = new Date(now.getTime() + ARGENTINA_OFFSET_MS);
    const daysSinceMonday = (argentinaNow.getUTCDay() + 6) % 7;
    const argentinaMonday = Date.UTC(
        argentinaNow.getUTCFullYear(),
        argentinaNow.getUTCMonth(),
        argentinaNow.getUTCDate() - daysSinceMonday
    );
    const startsAt = argentinaMonday - ARGENTINA_OFFSET_MS;
    const endsAt = startsAt + WEEK_MS;

    return {
        startDate: new Date(argentinaMonday).toISOString().slice(0, 10),
        startsAt,
        endsAt,
        nextMondayAt: endsAt
    };
}

module.exports = { getWeeklyRound };
