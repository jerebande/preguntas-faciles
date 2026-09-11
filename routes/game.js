const express = require("express");
const router = express.Router();
const gameController = require("../controllers/gameController");

router.get("/", gameController.showHome);
router.get("/game", gameController.showGame);
router.get("/ranking", gameController.showRanking);
router.get("/stats", gameController.showStats);

module.exports = router;
