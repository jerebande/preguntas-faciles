const db = require("../database/db");
const scoreModel = require("./scoreModel");

async function ensureTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS season_winners (
            season_id BIGINT UNSIGNED PRIMARY KEY,
            player_id BIGINT UNSIGNED NOT NULL,
            nickname VARCHAR(80) NOT NULL,
            avatar_data LONGTEXT NULL,
            points INT NOT NULL,
            correct_answers INT NOT NULL,
            wrong_answers INT NOT NULL,
            avg_response_time_ms DECIMAL(12, 2) NULL,
            archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const [seasons] = await db.query(
        "SELECT id FROM seasons WHERE is_active = 0 ORDER BY starts_at"
    );
    for (const season of seasons) {
        await archiveSeason(season.id);
    }
}

async function archiveSeason(seasonId, connection = db) {
    const winner = await scoreModel.getWinnerForSeason(seasonId, connection);
    if (!winner) return null;

    await connection.query(
        `INSERT IGNORE INTO season_winners
         (season_id, player_id, nickname, avatar_data, points, correct_answers,
          wrong_answers, avg_response_time_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            seasonId,
            winner.player_id,
            winner.nickname,
            winner.avatar_data,
            winner.points,
            winner.correct_answers,
            winner.wrong_answers,
            winner.avg_response_time_ms
        ]
    );

    return getForSeason(seasonId, connection);
}

async function getForSeason(seasonId, connection = db) {
    const [rows] = await connection.query(
        "SELECT * FROM season_winners WHERE season_id = ?",
        [seasonId]
    );
    return rows[0] || scoreModel.getWinnerForSeason(seasonId, connection);
}

module.exports = { ensureTable, archiveSeason, getForSeason };
