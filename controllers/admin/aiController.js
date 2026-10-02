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
        const categoryId = category_id === undefined || String(category_id).trim() === ""
            ? null
            : Number(category_id);
        const categoryIsValid = categoryId === null
            || (Number.isSafeInteger(categoryId) && categories.some((category) => Number(category.id) === categoryId));

        if (!categoryIsValid) {
            return res.render("admin/generate-ai", {
                admin: { username: req.session.adminUsername },
                categories,
                error: "La categoría seleccionada no es válida.",
                generated: null
            });
        }

        let questions;
        try {
            questions = await aiQuestionService.generateQuestions({
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

            await questionModel.createManyAsDraft(questions, categoryId);
        } catch (err) {
            console.error("No se pudieron generar o guardar preguntas con IA:", err);
            return res.render("admin/generate-ai", {
                admin: { username: req.session.adminUsername },
                categories,
                error: "No se pudieron generar las preguntas. Revisá la configuración e intentá de nuevo.",
                generated: null
            });
        }

        res.render("admin/generate-ai", {
            admin: { username: req.session.adminUsername },
            categories,
            error: null,
            generated: questions
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { showForm, generate };
