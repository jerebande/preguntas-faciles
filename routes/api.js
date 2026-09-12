const express = require("express");
const router = express.Router();

const playerController = require("../controllers/api/playerController");
const questionController = require("../controllers/api/questionController");
const answerController = require("../controllers/api/answerController");
const captchaService = require("../services/captchaService");
const { authLimiter } = require("../middleware/rateLimit");

// Altcha hace GET para pedir el desafío y POST para verificar la solución.
// Tienen que apuntar al MISMO endpoint.
router.all("/captcha-challenge", async (req, res, next) => {
    try {
        if (req.method === "GET") {
            const challenge = await captchaService.generateChallenge();
            return res.json(challenge);
        }

        if (req.method === "POST") {
            console.log("[altcha] body crudo:", JSON.stringify(req.body).slice(0, 500));
            const payload = req.body?.altcha || req.body?.payload || req.body;
            const ok = await captchaService.verifyCaptcha(payload);
            if (!ok) {
                return res.status(400).json({ error: "Verificación fallida." });
            }
            return res.json({ verified: true });
        }

        return res.status(405).end();
    } catch (err) {
        next(err);
    }
});

router.post("/register", authLimiter, playerController.register);
router.post("/login", authLimiter, playerController.login);
router.post("/claim-account", authLimiter, playerController.claimAccount);
router.post("/logout", playerController.logout);
router.get("/me", playerController.me);
router.post("/profile/avatar", playerController.updateAvatar);
router.post("/profile", playerController.updateProfile);

router.get("/question", questionController.getRandomQuestion);
router.post("/answer", answerController.submitAnswer);
router.post("/game/new", (req, res) => {
    if (!req.player) return res.status(401).json({ error: "Necesitás iniciar sesión para jugar." });
    req.session.gameQuestionsAnswered = 0;
    req.session.pendingQuestionId = null;
    req.session.pendingSeasonId = null;
    req.session.pendingQuestionStartedAt = null;
    res.json({ ok: true });
});

module.exports = router;