const express = require("express");
const router = express.Router();
const gameController = require("../controllers/gameController");

router.get("/", gameController.showHome);
router.get("/game", gameController.showGame);
router.get("/practice", gameController.showPractice);
router.get("/ranking", gameController.showRanking);
router.get("/stats", gameController.showStats);
router.get("/privacidad", (req, res) => {
    res.render("privacy");
});

module.exports = router;
