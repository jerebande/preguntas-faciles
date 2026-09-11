const playerModel = require("../models/playerModel");

// Adjunta req.player si la sesión ya tiene un jugador registrado (por nickname).
async function loadPlayer(req, res, next) {
    try {
        if (req.session && req.session.playerId) {
            req.player = await playerModel.findById(req.session.playerId);
        } else {
            req.player = null;
        }
        next();
    } catch (err) {
        next(err);
    }
}

module.exports = { loadPlayer };
