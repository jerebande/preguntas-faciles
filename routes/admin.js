const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { authLimiter } = require("../middleware/rateLimit");
const { issueCsrfToken, verifyCsrfToken } = require("../middleware/csrf");

const authController = require("../controllers/admin/authController");
const dashboardController = require("../controllers/admin/dashboardController");
const questionsController = require("../controllers/admin/questionsController");
const aiController = require("../controllers/admin/aiController");
const seasonsController = require("../controllers/admin/seasonsController");
const statsController = require("../controllers/admin/statsController");
const settingsController = require("../controllers/admin/settingsController");

function handleImageUpload(req, res, next) {
	upload.single("image_file")(req, res, (err) => {
		if (!err) return next();
		if (err.code === "LIMIT_FILE_SIZE") {
			return res.status(400).send("La imagen es demasiado grande. El máximo permitido es 5 MB.");
		}
		return res.status(400).send("El archivo seleccionado no es una imagen válida.");
	});
}

router.use(issueCsrfToken);

// Login (sin proteger)
router.get("/login", authController.showLogin);
router.post("/login", authLimiter, verifyCsrfToken, authController.login);
router.post("/logout", verifyCsrfToken, authController.logout);

// A partir de acá, todo requiere sesión de administrador.
router.use(requireAdmin);

router.get("/", dashboardController.showDashboard);

router.get("/questions", questionsController.list);
router.post("/questions/set-active", verifyCsrfToken, questionsController.setAllActive);
router.get("/questions/new", questionsController.showCreateForm);
router.post("/questions/new", handleImageUpload, verifyCsrfToken, questionsController.create);
router.get("/questions/generate-ai", aiController.showForm);
router.post("/questions/generate-ai", verifyCsrfToken, aiController.generate);
router.get("/questions/:id/edit", questionsController.showEditForm);
router.post("/questions/:id/edit", handleImageUpload, verifyCsrfToken, questionsController.update);
router.post("/questions/:id/toggle", verifyCsrfToken, questionsController.toggleActive);
router.post("/questions/:id/delete", verifyCsrfToken, questionsController.remove);

router.get("/seasons", seasonsController.list);
router.post("/seasons/new", verifyCsrfToken, seasonsController.startNew);
router.post("/seasons/advance-current", verifyCsrfToken, seasonsController.advanceCurrent);

router.get("/stats", statsController.show);
router.get("/settings", settingsController.show);
router.post("/settings", verifyCsrfToken, settingsController.update);

module.exports = router;