const db = require("../database/db");

async function ensureTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(80) PRIMARY KEY,
            setting_value VARCHAR(120) NOT NULL
        )
    `);
    await db.query(
        "INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('question_time_seconds', '10')"
    );
}

async function getQuestionTimeSeconds() {
    const [[row]] = await db.query(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'question_time_seconds'"
    );
    const seconds = Number.parseInt(row?.setting_value, 10);
    return Math.min(Math.max(seconds || 10, 3), 60);
}

async function setQuestionTimeSeconds(seconds) {
    const value = Math.min(Math.max(Number.parseInt(seconds, 10) || 10, 3), 60);
    await db.query(
        `INSERT INTO app_settings (setting_key, setting_value)
         VALUES ('question_time_seconds', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [String(value)]
    );
    return value;
}

module.exports = { ensureTable, getQuestionTimeSeconds, setQuestionTimeSeconds };
