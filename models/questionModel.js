const db = require("../database/db");

async function findAllWithCategory() {
    const [rows] = await db.query(
        `SELECT q.*, c.name AS category_name
         FROM questions q LEFT JOIN categories c ON c.id = q.category_id
         ORDER BY q.created_at DESC`
    );
    return rows;
}

async function findById(id) {
    const [rows] = await db.query("SELECT * FROM questions WHERE id = ?", [id]);
    return rows[0] || null;
}

async function findActiveById(id) {
    const [rows] = await db.query("SELECT * FROM questions WHERE id = ? AND active = 1", [id]);
    return rows[0] || null;
}

async function ensureImageUrlColumn() {
    const [[column]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'questions'
           AND column_name = 'image_url'`
    );

    if (!column.total) {
        await db.query("ALTER TABLE questions ADD COLUMN image_url VARCHAR(1000) DEFAULT NULL AFTER points_value");
    }
}

// Pregunta aleatoria activa que el jugador todavía no respondió en esta temporada.
async function findRandomUnanswered(playerId, seasonId) {
    const unansweredCondition = `q.active = 1
         AND NOT EXISTS (
             SELECT 1 FROM answer_logs a
             WHERE a.player_id = ? AND a.season_id = ? AND a.question_id = q.id
         )`;
    const params = [playerId, seasonId];
    const [[{ total }]] = await db.query(
        `SELECT COUNT(*) AS total FROM questions q WHERE ${unansweredCondition}`,
        params
    );
    const unansweredCount = Number(total);
    if (!unansweredCount) return null;

    const offset = Math.floor(Math.random() * unansweredCount);
    const [rows] = await db.query(
        `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.points_value, q.image_url
         FROM questions q
         WHERE ${unansweredCondition}
         ORDER BY q.id
         LIMIT 1 OFFSET ?`,
        [...params, offset]
    );
    return rows[0] || null;
}

async function countActive() {
    const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM questions WHERE active = 1");
    return total;
}

async function create(data) {
    const { category_id, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty, points_value, image_url } = data;
    const [result] = await db.query(
        `INSERT INTO questions (category_id, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty, points_value, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [category_id || null, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty, points_value || 10, normalizeImageUrl(image_url)]
    );
    return findById(result.insertId);
}

async function update(id, data) {
    const { category_id, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty, points_value, image_url, active } = data;
    await db.query(
        `UPDATE questions SET category_id=?, question_text=?, option_a=?, option_b=?, option_c=?, option_d=?,
         correct_option=?, difficulty=?, points_value=?, image_url=?, active=? WHERE id=?`,
        [category_id || null, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty, points_value || 10, normalizeImageUrl(image_url), active ? 1 : 0, id]
    );
    return findById(id);
}

async function remove(id) {
    await db.query("DELETE FROM questions WHERE id = ?", [id]);
}

// Prende/apaga una pregunta con un solo clic, sin pasar por el formulario de edición.
async function toggleActive(id) {
    await db.query("UPDATE questions SET active = IF(active = 1, 0, 1) WHERE id = ?", [id]);
}

async function setAllActive(active) {
    await db.query("UPDATE questions SET active = ?", [active ? 1 : 0]);
}

// Inserta preguntas generadas por IA como INACTIVAS (borrador), para que el
// admin las revise y las active manualmente antes de que aparezcan en el juego.
async function createManyAsDraft(questions, categoryId) {
    const created = [];
    for (const q of questions) {
        const [result] = await db.query(
            `INSERT INTO questions (category_id, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty, points_value, image_url, active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                categoryId || null,
                q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
                q.correct_option, q.difficulty || "facil", q.points_value || 10, normalizeImageUrl(q.image_url)
            ]
        );
        created.push(result.insertId);
    }
    return created;
}

function normalizeImageUrl(value) {
    if (!value) return null;
    const normalized = String(value).trim();
    if (normalized.startsWith("/uploads/questions/") && !normalized.includes("..")) {
        return normalized;
    }
    try {
        const url = new URL(normalized);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        return url.toString().slice(0, 1000);
    } catch (err) {
        return null;
    }
}

async function countDrafts() {
    const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM questions WHERE active = 0");
    return total;
}

module.exports = {
    findAllWithCategory,
    findById,
    findActiveById,
    ensureImageUrlColumn,
    findRandomUnanswered,
    countActive,
    countDrafts,
    create,
    createManyAsDraft,
    update,
    remove,
    toggleActive,
    setAllActive,
};