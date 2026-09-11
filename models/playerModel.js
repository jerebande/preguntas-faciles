const db = require("../database/db");

const NICKNAME_RE = /^[a-zA-Z0-9_ñÑáéíóúÁÉÍÓÚ]{3,20}$/;

async function findById(id) {
    const [rows] = await db.query("SELECT * FROM players WHERE id = ?", [id]);
    return rows[0] || null;
}

async function findByNickname(nickname) {
    const [rows] = await db.query("SELECT * FROM players WHERE nickname = ?", [nickname]);
    return rows[0] || null;
}

async function create(nickname, deviceToken, passwordHash) {
    const [result] = await db.query(
        "INSERT INTO players (nickname, device_token, password_hash) VALUES (?, ?, ?)",
        [nickname, deviceToken, passwordHash]
    );
    return findById(result.insertId);
}

async function updateAvatar(playerId, avatarData) {
    await db.query(
        "UPDATE players SET avatar_data = ? WHERE id = ?",
        [avatarData, playerId]
    );
    return findById(playerId);
}

async function updateNickname(playerId, nickname) {
    await db.query("UPDATE players SET nickname = ? WHERE id = ?", [nickname, playerId]);
    return findById(playerId);
}

async function ensureAvatarColumn() {
    const [[column]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'players'
           AND column_name = 'avatar_data'`
    );

    if (!column.total) {
        await db.query("ALTER TABLE players ADD COLUMN avatar_data MEDIUMTEXT NULL AFTER avatar_seed");
    }
}

async function ensurePasswordColumn() {
    const [[column]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'players'
           AND column_name = 'password_hash'`
    );

    if (!column.total) {
        await db.query("ALTER TABLE players ADD COLUMN password_hash VARCHAR(255) NULL AFTER device_token");
    }
}

async function countAll() {
    const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM players");
    return total;
}

module.exports = {
    NICKNAME_RE,
    findById,
    findByNickname,
    create,
    updateAvatar,
    updateNickname,
    ensureAvatarColumn,
    ensurePasswordColumn,
    countAll
};
