const settingsModel = require("../../models/settingsModel");

async function show(req, res, next) {
    try {
        const questionTimeSeconds = await settingsModel.getQuestionTimeSeconds();
        res.render("admin/settings", {
            admin: { username: req.session.adminUsername },
            questionTimeSeconds,
            saved: req.query.saved === "1"
        });
    } catch (err) {
        next(err);
    }
}

async function update(req, res, next) {
    try {
        await settingsModel.setQuestionTimeSeconds(req.body.question_time_seconds);
        res.redirect("/admin/settings?saved=1");
    } catch (err) {
        next(err);
    }
}

module.exports = { show, update };
