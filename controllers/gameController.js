const seasonModel = require("../models/seasonModel");
const scoreModel = require("../models/scoreModel");
const answerLogModel = require("../models/answerLogModel");

async function showHome(req, res, next) {
    try {
        res.render("index", { player: req.player });
    } catch (err) {
        next(err);
    }
}

async function showGame(req, res, next) {
    try {
        if (!req.player) return res.redirect("/");
        res.render("game", { player: req.player });
    } catch (err) {
        next(err);
    }
}

async function showRanking(req, res, next) {
    try {
        const season = await seasonModel.getActive();
        const [ranking, previousSeason] = await Promise.all([
            scoreModel.getRankingForSeason(season.id, 50),
            seasonModel.findPrevious(season.id)
        ]);
        const previousWinner = previousSeason
            ? await scoreModel.getWinnerForSeason(previousSeason.id)
            : null;
        res.render("ranking", { player: req.player, season, ranking, previousSeason, previousWinner });
    } catch (err) {
        next(err);
    }
}

async function showStats(req, res, next) {
    try {
        if (!req.player) return res.redirect("/");
        const season = await seasonModel.getActive();

        const [seasonStats, globalStats, position, score, best] = await Promise.all([
            answerLogModel.getPlayerStatsForPlayerInSeason(req.player.id, season.id),
            answerLogModel.getPlayerStatsAllTime(req.player.id),
            scoreModel.getPlayerRankingPosition(req.player.id, season.id),
            scoreModel.findByPlayerAndSeason(req.player.id, season.id),
            scoreModel.getBestHistoricalPosition(req.player.id)
        ]);

        res.render("stats", {
            player: req.player,
            season,
            seasonStats,
            globalStats,
            position,
            score,
            bestPosition: best ? best.position : null,
            bestPositionSeason: best ? best.season_name : null
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { showHome, showGame, showRanking, showStats };