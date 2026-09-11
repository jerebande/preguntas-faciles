const aiQuestionService = require("../../services/aiQuestionService");
const questionModel = require("../../models/questionModel");
const categoryModel = require("../../models/categoryModel");

async function showForm(req, res, next) {
    try {
        const categories = await categoryModel.findAllActive();
        res.render("admin/generate-ai", {
            admin: { username: req.session.adminUsername },
            categories,
            error: null,
            generated: null
        });
    } catch (err) {
        next(err);
    }
}

// Genera las preguntas con IA y las guarda como borrador (inactivas).
// El admin las termina de revisar y activar desde /admin/questions.
async function generate(req, res, next) {
    try {
        const { topic, count, difficulty, category_id } = req.body;
        const categories = await categoryModel.findAllActive();

        const questions = await aiQuestionService.generateQuestions({
            topic,
            count: Math.min(Math.max(parseInt(count, 10) || 10, 1), 15),
            difficulty,
            includeImages: req.body.include_images === "1"
        });

        if (!questions.length) {
            return res.render("admin/generate-ai", {
                admin: { username: req.session.adminUsername },
                categories,
                error: "La IA no devolvió preguntas utilizables. Probá de nuevo o cambiá el tema.",
                generated: null
            });
        }

        await questionModel.createManyAsDraft(questions, category_id);

        res.render("admin/generate-ai", {
            admin: { username: req.session.adminUsername },
            categories,
            error: null,
            generated: questions
        });
    } catch (err) {
        const categories = await categoryModel.findAllActive();
        res.render("admin/generate-ai", {
            admin: { username: req.session.adminUsername },
            categories,
            error: err.message,
            generated: null
        });
    }
}

module.exports = { showForm, generate };
