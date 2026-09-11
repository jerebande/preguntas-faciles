const seasonModel = require("../../models/seasonModel");
const answerLogModel = require("../../models/answerLogModel");
const playerModel = require("../../models/playerModel");

function buildStats(row) {
    const correct = Number(row.correct_answers) || 0;
    const wrong = Number(row.wrong_answers) || 0;
    const timeout = Number(row.timed_out) || 0;
    const totalAnswers = correct + wrong + timeout;
    return {
        correct,
        wrong,
        timeout,
        totalAnswers,
        correctPct: totalAnswers ? (correct / totalAnswers) * 100 : 0,
        wrongPct: totalAnswers ? (wrong / totalAnswers) * 100 : 0,
        timeoutPct: totalAnswers ? (timeout / totalAnswers) * 100 : 0
    };
}

async function show(req, res, next) {
    try {
        const season = await seasonModel.getActive();
        const topQuestions = await answerLogModel.getTopQuestionsForSeason(season.id, 10);
        const totalPlayers = await playerModel.countAll();
        const activePlayers = await answerLogModel.countActivePlayersForSeason(season.id);

        const [globalRow, seasonRow] = await Promise.all([
            answerLogModel.getGlobalStatsAllTime(),
            answerLogModel.getGlobalStatsForSeason(season.id)
        ]);

        const globalStats = buildStats(globalRow);
        globalStats.totalSeasons = Number(globalRow.total_seasons) || 0;

        const seasonStats = buildStats(seasonRow);

        res.render("admin/stats", {
            admin: { username: req.session.adminUsername },
            season,
            topQuestions,
            totalPlayers,
            activePlayers,
            globalStats,
            seasonStats
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { show };