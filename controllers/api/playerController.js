const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const playerModel = require("../../models/playerModel");
const seasonModel = require("../../models/seasonModel");
const scoreModel = require("../../models/scoreModel");
const captchaService = require("../../services/captchaService");

async function register(req, res, next) {
    try {
        const captchaOk = await captchaService.verifyCaptcha(req.body.altcha);
        if (!captchaOk) {
            return res.status(400).json({ error: "No pudimos verificar que sos una persona. Recargá la página e intentá de nuevo." });
        }

        const nickname = (req.body.nickname || "").trim();
        const password = req.body.password || "";
        if (!playerModel.NICKNAME_RE.test(nickname)) {
            return res.status(400).json({ error: "El nickname debe tener entre 3 y 20 caracteres (letras, números o guión bajo)." });
        }

        if (password.length < 6 || password.length > 72) {
            return res.status(400).json({ error: "La contraseña debe tener entre 6 y 72 caracteres." });
        }

        const existing = await playerModel.findByNickname(nickname);
        if (existing) {
            return res.status(409).json({ error: "Ese nickname ya está en uso. Probá con otro." });
        }

        const deviceToken = crypto.randomBytes(16).toString("hex");
        const passwordHash = await bcrypt.hash(password, 10);
        const player = await playerModel.create(nickname, deviceToken, passwordHash);

        req.session.playerId = player.id;
        req.session.gameQuestionsAnswered = 0;
        req.session.pendingQuestionId = null;
        req.session.pendingQuestionStartedAt = null;
        res.json({ ok: true, nickname: player.nickname });
    } catch (err) {
        next(err);
    }
}

async function login(req, res, next) {
    try {
        const captchaOk = await captchaService.verifyCaptcha(req.body.altcha);
        if (!captchaOk) {
            return res.status(400).json({ error: "No pudimos verificar que sos una persona. Recargá la página e intentá de nuevo." });
        }

        const nickname = (req.body.nickname || "").trim();
        const password = req.body.password || "";
        const player = await playerModel.findByNickname(nickname);

        if (!player || !player.password_hash || !(await bcrypt.compare(password, player.password_hash))) {
            return res.status(401).json({ error: "Nickname o contraseña incorrectos." });
        }

        req.session.playerId = player.id;
        req.session.gameQuestionsAnswered = 0;
        req.session.pendingQuestionId = null;
        req.session.pendingQuestionStartedAt = null;
        res.json({ ok: true, nickname: player.nickname });
    } catch (err) {
        next(err);
    }
}

function logout(req, res) {
    req.session.destroy(() => res.json({ ok: true }));
}

async function me(req, res, next) {
    try {
        if (!req.player) return res.json({ player: null });

        const season = await seasonModel.getActive();
        const score = await scoreModel.findByPlayerAndSeason(req.player.id, season.id);

        res.json({
            player: { nickname: req.player.nickname, avatarData: req.player.avatar_data },
            season: { id: season.id, name: season.name, type: season.type },
            score
        });
    } catch (err) {
        next(err);
    }
}

async function updateAvatar(req, res, next) {
    try {
        if (!req.player) return res.status(401).json({ error: "Tenés que iniciar sesión como jugador." });

        const avatarData = req.body.avatarData;
        const validImage = typeof avatarData === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatarData);
        if (!validImage) {
            return res.status(400).json({ error: "La foto debe ser JPG, PNG o WebP." });
        }

        const base64Payload = avatarData.split(",")[1];
        if (Buffer.byteLength(base64Payload, "base64") > 2 * 1024 * 1024) {
            return res.status(413).json({ error: "La foto no puede superar los 2 MB." });
        }

        const player = await playerModel.updateAvatar(req.player.id, avatarData);
        res.json({ ok: true, avatarData: player.avatar_data });
    } catch (err) {
        next(err);
    }
}

async function updateProfile(req, res, next) {
    try {
        if (!req.player) return res.status(401).json({ error: "Tenés que iniciar sesión." });

        const nickname = (req.body.nickname || "").trim();
        if (!playerModel.NICKNAME_RE.test(nickname)) {
            return res.status(400).json({ error: "El nickname debe tener entre 3 y 20 caracteres (letras, números o guión bajo)." });
        }

        const existing = await playerModel.findByNickname(nickname);
        if (existing && existing.id !== req.player.id) {
            return res.status(409).json({ error: "Ese nickname ya pertenece a otro jugador." });
        }

        const player = await playerModel.updateNickname(req.player.id, nickname);
        res.json({ ok: true, nickname: player.nickname });
    } catch (err) {
        next(err);
    }
}

module.exports = { register, login, logout, me, updateAvatar, updateProfile };