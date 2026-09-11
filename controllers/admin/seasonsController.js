const seasonModel = require("../../models/seasonModel");

async function list(req, res, next) {
    try {
        const seasons = await seasonModel.findAll();
        const activeSeason = seasons.find(s => s.is_active) || null;
        res.render("admin/seasons", {
            admin: { username: req.session.adminUsername },
            seasons,
            activeSeason,
            advanced: req.query.advanced === "1"
        });
    } catch (err) {
        next(err);
    }
}

async function startNew(req, res, next) {
    try {
        const { name, type, days } = req.body;
        await seasonModel.startNew({ name, type, days });
        res.redirect("/admin/seasons");
    } catch (err) {
        next(err);
    }
}

async function advanceCurrent(req, res, next) {
    try {
        await seasonModel.advanceCurrent();
        res.redirect("/admin/seasons?advanced=1");
    } catch (err) {
        next(err);
    }
}

module.exports = { list, startNew, advanceCurrent };