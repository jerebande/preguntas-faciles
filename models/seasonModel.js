const db = require("../database/db");
const scoreModel = require("./scoreModel");
const seasonWinnerModel = require("./seasonWinnerModel");

function getYearEnd(now = new Date()) {
    return new Date(now.getFullYear() + 1, 0, 1);
}

function getYearEndName(now = new Date()) {
    return `Ranking de fin de año ${now.getFullYear()}`;
}

function isCurrentYearEndSeason(season, now = new Date()) {
    const yearEnd = getYearEnd(now);
    const endsAt = new Date(season.ends_at);
    return season.type === "especial"
        && season.name === getYearEndName(now)
        && endsAt.getTime() === yearEnd.getTime();
}

async function findActive(connection = db) {
    const [rows] = await connection.query(
        "SELECT * FROM seasons WHERE is_active = 1 ORDER BY starts_at DESC LIMIT 1"
    );
    return rows[0] || null;
}

async function getActive() {
    const active = await findActive();
    const now = new Date();
    if (active && new Date(active.ends_at) > now && isCurrentYearEndSeason(active, now)) return active;

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
        const renewedAt = new Date();
        const yearEnd = getYearEnd(renewedAt);
        const name = getYearEndName(renewedAt);

        if (current && new Date(current.ends_at) > renewedAt) {
            await connection.query(
                "UPDATE seasons SET name = ?, type = 'especial', ends_at = ? WHERE id = ? AND is_active = 1",
                [name, yearEnd, current.id]
            );
            const season = await findById(current.id, connection);
            await connection.commit();
            transactionStarted = false;
            return season;
        }

        const season = await startNew({ name, type: "especial", endsAt: yearEnd }, connection);
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

async function findById(id, connection = db) {
    const [rows] = await connection.query("SELECT * FROM seasons WHERE id = ?", [id]);
    return rows[0] || null;
}

async function findAll() {
    const [rows] = await db.query(
        `SELECT seasons.*, season_winners.nickname AS winner_nickname,
                season_winners.points AS winner_points
         FROM seasons
         LEFT JOIN season_winners ON season_winners.season_id = seasons.id
         ORDER BY seasons.starts_at DESC`
    );
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
async function startNew(options, connection) {
    if (connection) return startNewInConnection(options, connection);

    const transaction = await db.getConnection();
    try {
        await transaction.beginTransaction();
        const season = await startNewInConnection(options, transaction);
        await transaction.commit();
        return season;
    } catch (err) {
        await transaction.rollback();
        throw err;
    } finally {
        transaction.release();
    }
}

async function startNewInConnection({ name, type, days, endsAt }, connection) {
    const current = await findActive(connection);
    if (current) await seasonWinnerModel.archiveSeason(current.id, connection);
    await connection.query("UPDATE seasons SET is_active = 0 WHERE is_active = 1");

    const now = new Date();
    const duration = parseInt(days, 10) || (type === "mensual" ? 30 : 7);
    const end = endsAt || new Date(now);
    if (!endsAt) end.setDate(end.getDate() + duration);

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
    if (current.type === "especial" && current.name === getYearEndName()) {
        const now = new Date();
        return startNew({
            name: getYearEndName(now),
            type: "especial",
            endsAt: getYearEnd(now)
        });
    }

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