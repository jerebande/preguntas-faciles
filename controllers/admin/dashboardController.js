const seasonModel = require("../../models/seasonModel");
const playerModel = require("../../models/playerModel");
const questionModel = require("../../models/questionModel");
const scoreModel = require("../../models/scoreModel");

async function showDashboard(req, res, next) {
    try {
        const season = await seasonModel.getActive();
        const totalPlayers = await playerModel.countAll();
        const totalQuestions = await questionModel.countActive();
        const totalAnswers = await scoreModel.countAnswersForSeason(season.id);
        const draftQuestions = await questionModel.countDrafts();

        res.render("admin/dashboard", {
            admin: { username: req.session.adminUsername },
            season, totalPlayers, totalQuestions, totalAnswers, draftQuestions
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { showDashboard };
