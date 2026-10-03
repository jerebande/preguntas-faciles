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

async function findByEmail(email) {
    const [rows] = await db.query("SELECT id FROM players WHERE email = ?", [email]);
    return rows[0] || null;
}

async function findByPhone(phone) {
    const [rows] = await db.query("SELECT id FROM players WHERE phone = ?", [phone]);
    return rows[0] || null;
}

async function create(nickname, deviceToken, passwordHash, email = null, phone = null) {
    const [result] = await db.query(
        "INSERT INTO players (nickname, device_token, password_hash, email, phone) VALUES (?, ?, ?, ?, ?)",
        [nickname, deviceToken, passwordHash, email, phone]
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

// Le pone contraseña por primera vez a una cuenta vieja que nunca tuvo
// (password_hash NULL). Si ya tenía, no hace nada y devuelve false —
// así queda a prueba de carreras (dos requests al mismo tiempo, doble click, etc).
async function claimAccount(nickname, passwordHash) {
    const [result] = await db.query(
        "UPDATE players SET password_hash = ? WHERE nickname = ? AND password_hash IS NULL",
        [passwordHash, nickname]
    );
    return result.affectedRows > 0;
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

async function ensureEmailColumn() {
    const [[column]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'players'
           AND column_name = 'email'`
    );

    if (!column.total) {
        await db.query("ALTER TABLE players ADD COLUMN email VARCHAR(255) NULL AFTER password_hash");
    }
}

async function ensurePhoneColumn() {
    const [[column]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'players'
           AND column_name = 'phone'`
    );

    if (!column.total) {
        await db.query("ALTER TABLE players ADD COLUMN phone VARCHAR(50) NULL AFTER email");
    }
}

async function ensureContactColumns() {
    await ensureEmailColumn();
    await ensurePhoneColumn();

    const phoneKey = "REPLACE(REPLACE(REPLACE(REPLACE(TRIM(phone), ' ', ''), '-', ''), '(', ''), ')', '')";
    const [[emailDuplicates]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM (
             SELECT LOWER(TRIM(email))
             FROM players
             WHERE email IS NOT NULL AND TRIM(email) <> ''
             GROUP BY LOWER(TRIM(email))
             HAVING COUNT(*) > 1
         ) AS duplicate_emails`
    );
    const [[phoneDuplicates]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM (
             SELECT ${phoneKey}
             FROM players
             WHERE phone IS NOT NULL AND TRIM(phone) <> ''
             GROUP BY ${phoneKey}
             HAVING COUNT(*) > 1
         ) AS duplicate_phones`
    );

    if (emailDuplicates.total || phoneDuplicates.total) {
        throw new Error(
            `No se pudieron activar los contactos únicos: hay ${emailDuplicates.total} emails y ${phoneDuplicates.total} teléfonos duplicados en players.`
        );
    }

    await db.query(
        "UPDATE players SET email = NULLIF(LOWER(TRIM(email)), ''), phone = NULLIF(" + phoneKey + ", '')"
    );

    const [[emailIndex]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM information_schema.statistics
         WHERE table_schema = DATABASE()
           AND table_name = 'players'
           AND index_name = 'uq_players_email'`
    );
    if (!emailIndex.total) {
        await db.query("ALTER TABLE players ADD UNIQUE INDEX uq_players_email (email)");
    }

    const [[phoneIndex]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM information_schema.statistics
         WHERE table_schema = DATABASE()
           AND table_name = 'players'
           AND index_name = 'uq_players_phone'`
    );
    if (!phoneIndex.total) {
        await db.query("ALTER TABLE players ADD UNIQUE INDEX uq_players_phone (phone)");
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
    findByEmail,
    findByPhone,
    create,
    claimAccount,
    updateAvatar,
    updateNickname,
    ensureAvatarColumn,
    ensurePasswordColumn,
    ensureEmailColumn,
    ensurePhoneColumn,
    ensureContactColumns,
    countAll
};