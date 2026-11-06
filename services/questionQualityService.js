const OPTION_KEYS = ["option_a", "option_b", "option_c", "option_d"];
const DIFFICULTIES = ["facil", "media", "dificil"];

function normalizeText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("es")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

function validateQuestion(question, { requireSource = false } = {}) {
    const errors = [];
    const text = typeof question.question_text === "string" ? question.question_text.trim() : "";

    if (text.length < 10 || text.length > 500) {
        errors.push("La pregunta debe tener entre 10 y 500 caracteres.");
    }

    const options = OPTION_KEYS.map((key) => (
        typeof question[key] === "string" ? question[key].trim() : ""
    ));
    if (options.some((option) => !option || option.length > 180)) {
        errors.push("Cada opción debe tener entre 1 y 180 caracteres.");
    } else if (new Set(options.map(normalizeText)).size !== options.length) {
        errors.push("Las cuatro opciones deben ser distintas.");
    }

    if (!["a", "b", "c", "d"].includes(String(question.correct_option || "").toLowerCase())) {
        errors.push("Elegí cuál de las cuatro opciones es la correcta.");
    }

    if (!DIFFICULTIES.includes(String(question.difficulty || ""))) {
        errors.push("Elegí una dificultad válida.");
    }

    const points = Number(question.points_value);
    if (!Number.isInteger(points) || points < 1 || points > 1000) {
        errors.push("Los puntos deben ser un número entero entre 1 y 1000.");
    }

    const sourceUrl = normalizeSourceUrl(question.source_url);
    if (question.source_url && !sourceUrl) {
        errors.push("La fuente debe ser una URL HTTP o HTTPS válida.");
    }
    if (requireSource && !sourceUrl) {
        errors.push("Agregá una fuente verificable antes de publicar la pregunta.");
    }

    return { errors, sourceUrl };
}

function normalizeSourceUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    if (value.trim().length > 1000) return null;
    try {
        const url = new URL(value.trim());
        if (!["http:", "https:"].includes(url.protocol)) return null;
        return url.toString().slice(0, 1000);
    } catch (error) {
        return null;
    }
}

function filterGeneratedQuestions(questions) {
    const accepted = [];
    const seenQuestions = new Set();

    for (const question of questions) {
        if (!question || typeof question !== "object") continue;
        const normalized = {
            ...question,
            correct_option: String(question.correct_option || "").toLowerCase(),
            difficulty: DIFFICULTIES.includes(question.difficulty) ? question.difficulty : "facil",
            points_value: Number.isInteger(Number(question.points_value)) ? Number(question.points_value) : 10
        };
        if (validateQuestion(normalized).errors.length) continue;

        const key = normalizeText(normalized.question_text);
        if (seenQuestions.has(key)) continue;
        seenQuestions.add(key);
        accepted.push(normalized);
    }

    return accepted;
}

module.exports = { filterGeneratedQuestions, normalizeSourceUrl, validateQuestion };
