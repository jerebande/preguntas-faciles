const adminModel = require("../../models/adminModel");

function showLogin(req, res) {
    if (req.session.adminId) return res.redirect("/admin");
    res.render("admin/login", { error: null });
}

async function login(req, res, next) {
    try {
        const { username, password } = req.body;
        const admin = await adminModel.findByUsername(username);

        if (!admin || !(await adminModel.verifyPassword(admin, password))) {
            return res.render("admin/login", { error: "Usuario o contraseña incorrectos." });
        }

        const playerId = req.session.playerId;
        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => err ? reject(err) : resolve());
        });
        if (playerId) req.session.playerId = playerId;
        req.session.adminId = admin.id;
        req.session.adminUsername = admin.username;
        res.redirect("/admin");
    } catch (err) {
        next(err);
    }
}

function logout(req, res) {
    req.session.destroy(() => res.redirect("/"));
}

module.exports = { showLogin, login, logout };
