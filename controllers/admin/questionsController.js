const questionModel = require("../../models/questionModel");
const categoryModel = require("../../models/categoryModel");

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
        res.render("admin/question-form", { admin: { username: req.session.adminUsername }, question: null, categories });
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
        res.render("admin/question-form", { admin: { username: req.session.adminUsername }, question, categories });
    } catch (err) {
        next(err);
    }
}

async function update(req, res, next) {
    try {
        const currentQuestion = await questionModel.findById(req.params.id);
        const data = {
            ...req.body,
            image_url: req.file
                ? `/uploads/questions/${req.file.filename}`
                : (req.body.image_url || currentQuestion?.image_url || null)
        };
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
        await questionModel.toggleActive(req.params.id);
        res.redirect("/admin/questions");
    } catch (err) {
        next(err);
    }
}

async function setAllActive(req, res, next) {
    try {
        await questionModel.setAllActive(req.body.active === "1");
        res.redirect("/admin/questions");
    } catch (err) {
        next(err);
    }
}

module.exports = { list, showCreateForm, create, showEditForm, update, remove, toggleActive, setAllActive };