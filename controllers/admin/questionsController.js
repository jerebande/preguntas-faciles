const questionModel = require("../../models/questionModel");
const categoryModel = require("../../models/categoryModel");
const { validateQuestion } = require("../../services/questionQualityService");

async function list(req, res, next) {
    try {
        const questions = await questionModel.findAllWithCategory();
        res.render("admin/questions", { admin: { username: req.session.adminUsername }, questions });
    } catch (err) {
        next(err);
    }
}

async function showCreateForm(req, res, next) {
    try {
        const categories = await categoryModel.findAllActive();
        res.render("admin/question-form", {
            admin: { username: req.session.adminUsername },
            question: null,
            formData: null,
            errors: [],
            categories
        });
    } catch (err) {
        next(err);
    }
}

async function create(req, res, next) {
    try {
        const data = {
            ...req.body,
            image_url: req.file ? `/uploads/questions/${req.file.filename}` : req.body.image_url
        };
        data.correct_option = String(data.correct_option || "").toLowerCase();
        const validation = validateQuestion(data);
        if (validation.errors.length) {
            const categories = await categoryModel.findAllActive();
            return res.status(400).render("admin/question-form", {
                admin: { username: req.session.adminUsername },
                question: null,
                formData: data,
                categories,
                errors: validation.errors
            });
        }
        await questionModel.create(data);
        res.redirect("/admin/questions");
    } catch (err) {
        next(err);
    }
}

async function showEditForm(req, res, next) {
    try {
        const question = await questionModel.findById(req.params.id);
        if (!question) return res.redirect("/admin/questions");

        const categories = await categoryModel.findAllActive();
        res.render("admin/question-form", {
            admin: { username: req.session.adminUsername },
            question,
            formData: null,
            errors: [],
            categories
        });
    } catch (err) {
        next(err);
    }
}

async function update(req, res, next) {
    try {
        const currentQuestion = await questionModel.findById(req.params.id);
        if (!currentQuestion) return res.redirect("/admin/questions");
        const data = {
            ...req.body,
            image_url: req.file
                ? `/uploads/questions/${req.file.filename}`
                : (req.body.image_url || currentQuestion.image_url || null),
            active: req.body.active
        };
        data.correct_option = String(data.correct_option || "").toLowerCase();
        const validation = validateQuestion(data);
        if (validation.errors.length) {
            const categories = await categoryModel.findAllActive();
            return res.status(400).render("admin/question-form", {
                admin: { username: req.session.adminUsername },
                question: { ...currentQuestion, ...data },
                formData: data,
                categories,
                errors: validation.errors
            });
        }
        await questionModel.update(req.params.id, data);
        res.redirect("/admin/questions");
    } catch (err) {
        next(err);
    }
}

async function remove(req, res, next) {
    try {
        await questionModel.remove(req.params.id);
        res.redirect("/admin/questions");
    } catch (err) {
        next(err);
    }
}

async function toggleActive(req, res, next) {
    try {
        const toggled = await questionModel.toggleActive(req.params.id);
        if (!toggled) return res.redirect("/admin/questions");
        res.redirect("/admin/questions");
    } catch (err) {
        next(err);
    }
}

async function setAllActive(req, res, next) {
    try {
        if (req.body.active !== "0" && req.body.active !== "1") {
            return res.status(400).send("El estado seleccionado no es válido.");
        }
        await questionModel.setAllActive(req.body.active === "1");
        res.redirect("/admin/questions");
    } catch (err) {
        next(err);
    }
}

module.exports = { list, showCreateForm, create, showEditForm, update, remove, toggleActive, setAllActive };