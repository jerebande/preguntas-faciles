const db = require("../database/db");
const scoreModel = require("./scoreModel");

async function getActive() {
    const [rows] = await db.query(
        "SELECT * FROM seasons WHERE is_active = 1 ORDER BY starts_at DESC LIMIT 1"
    );
    if (rows[0] && new Date(rows[0].ends_at) > new Date()) return rows[0];
    if (rows[0]) {
        const type = rows[0].type === "mensual" ? "mensual" : "semanal";
        return startNew({
            name: `${type === "mensual" ? "Mes" : "Semana"} del ${new Date().toLocaleDateString("es-AR")}`,
            type,
            days: type === "mensual" ? 30 : 7
        });
    }
    return createDefaultWeekly();
}

// Si no hay ninguna temporada activa, crea una semanal automáticamente
// para que el juego nunca se quede sin temporada corriendo.
async function createDefaultWeekly() {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);

    const name = `Semana del ${now.toLocaleDateString("es-AR")}`;
    const [result] = await db.query(
        `INSERT INTO seasons (name, type, starts_at, ends_at, is_active)
         VALUES (?, 'semanal', ?, ?, 1)`,
        [name, now, end]
    );
    return findById(result.insertId);
}

async function findById(id) {
    const [rows] = await db.query("SELECT * FROM seasons WHERE id = ?", [id]);
    return rows[0] || null;
}

async function findAll() {
    const [rows] = await db.query("SELECT * FROM seasons ORDER BY starts_at DESC");
    return rows;
}

async function findPrevious(currentSeasonId) {
    const [rows] = await db.query(
        `SELECT * FROM seasons
         WHERE id <> ? AND starts_at < (SELECT starts_at FROM seasons WHERE id = ?)
         ORDER BY starts_at DESC
         LIMIT 1`,
        [currentSeasonId, currentSeasonId]
    );
    return rows[0] || null;
}

// Cierra la temporada activa y abre una nueva (esto "reinicia" el ranking).
async function startNew({ name, type, days }) {
    await db.query("UPDATE seasons SET is_active = 0 WHERE is_active = 1");

    const now = new Date();
    const duration = parseInt(days, 10) || (type === "mensual" ? 30 : 7);
    const end = new Date(now);
    end.setDate(end.getDate() + duration);

    const finalName = name || `Temporada del ${now.toLocaleDateString("es-AR")}`;
    const [result] = await db.query(
        `INSERT INTO seasons (name, type, starts_at, ends_at, is_active) VALUES (?, ?, ?, ?, 1)`,
        [finalName, type || "semanal", now, end]
    );
    await scoreModel.initializeSeasonScores(result.insertId);
    return findById(result.insertId);
}

async function advanceCurrent() {
    const current = await getActive();
    const type = current.type === "mensual" ? "mensual" : "semanal";
    const label = type === "mensual" ? "Mes" : "Semana";
    const now = new Date();
    return startNew({
        name: `${label} del ${now.toLocaleDateString("es-AR")}`,
        type,
        days: type === "mensual" ? 30 : 7
    });
}

module.exports = {
    getActive,
    findById,
    findAll,
    findPrevious,
    startNew,
    advanceCurrent
};