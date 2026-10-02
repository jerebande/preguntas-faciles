const db = require("../database/db");
const scoreModel = require("./scoreModel");

async function findActive(connection = db) {
    const [rows] = await connection.query(
        "SELECT * FROM seasons WHERE is_active = 1 ORDER BY starts_at DESC LIMIT 1"
    );
    return rows[0] || null;
}

async function getActive() {
    const active = await findActive();
    if (active && new Date(active.ends_at) > new Date()) return active;

    const connection = await db.getConnection();
    let lockAcquired = false;
    let transactionStarted = false;
    try {
        const [[lock]] = await connection.query(
            "SELECT GET_LOCK('preguntas_faciles_active_season', 10) AS acquired"
        );
        if (Number(lock.acquired) !== 1) {
            throw new Error("No se pudo obtener el bloqueo para renovar la temporada.");
        }
        lockAcquired = true;

        await connection.beginTransaction();
        transactionStarted = true;
        const current = await findActive(connection);
        if (current && new Date(current.ends_at) > new Date()) {
            await connection.commit();
            transactionStarted = false;
            return current;
        }

        let season;
        if (current) {
            const type = current.type === "mensual" ? "mensual" : "semanal";
            season = await startNew({
                name: `${type === "mensual" ? "Mes" : "Semana"} del ${new Date().toLocaleDateString("es-AR")}`,
                type,
                days: type === "mensual" ? 30 : 7
            }, connection);
        } else {
            season = await createDefaultWeekly(connection);
        }
        await connection.commit();
        transactionStarted = false;
        return season;
    } catch (err) {
        if (transactionStarted) await connection.rollback();
        throw err;
    } finally {
        try {
            if (lockAcquired) {
                await connection.query("SELECT RELEASE_LOCK('preguntas_faciles_active_season')");
            }
            connection.release();
        } catch (err) {
            connection.destroy();
            throw err;
        }
    }
}

// Si no hay ninguna temporada activa, crea una semanal automáticamente
// para que el juego nunca se quede sin temporada corriendo.
async function createDefaultWeekly(connection = db) {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);

    const name = `Semana del ${now.toLocaleDateString("es-AR")}`;
    const [result] = await connection.query(
        `INSERT INTO seasons (name, type, starts_at, ends_at, is_active)
         VALUES (?, 'semanal', ?, ?, 1)`,
        [name, now, end]
    );
    return findById(result.insertId, connection);
}

async function findById(id, connection = db) {
    const [rows] = await connection.query("SELECT * FROM seasons WHERE id = ?", [id]);
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
async function startNew({ name, type, days }, connection = db) {
    await connection.query("UPDATE seasons SET is_active = 0 WHERE is_active = 1");

    const now = new Date();
    const duration = parseInt(days, 10) || (type === "mensual" ? 30 : 7);
    const end = new Date(now);
    end.setDate(end.getDate() + duration);

    const finalName = name || `Temporada del ${now.toLocaleDateString("es-AR")}`;
    const [result] = await connection.query(
        `INSERT INTO seasons (name, type, starts_at, ends_at, is_active) VALUES (?, ?, ?, ?, 1)`,
        [finalName, type || "semanal", now, end]
    );
    await scoreModel.initializeSeasonScores(result.insertId, connection);
    return findById(result.insertId, connection);
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