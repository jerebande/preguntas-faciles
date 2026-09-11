const db = require("../database/db");

async function hasAnswered(playerId, questionId) {
    const [rows] = await db.query(
        "SELECT id FROM answer_logs WHERE player_id = ? AND question_id = ? LIMIT 1",
        [playerId, questionId]
    );
    return rows.length > 0;
}

async function record({ playerId, questionId, seasonId, selectedOption, isCorrect, responseTimeMs }) {
    await db.query(
        `INSERT INTO answer_logs (player_id, question_id, season_id, selected_option, response_time_ms, is_correct)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [playerId, questionId, seasonId, selectedOption, responseTimeMs ?? null, isCorrect ? 1 : 0]
    );
}

async function getTopQuestionsForSeason(seasonId, limit = 10) {
    const [rows] = await db.query(
        `SELECT q.question_text,
                SUM(a.is_correct = 1) AS correct,
                SUM(a.is_correct = 0) AS wrong,
                COUNT(*) AS total
         FROM answer_logs a JOIN questions q ON q.id = a.question_id
         WHERE a.season_id = ?
         GROUP BY a.question_id
         ORDER BY total DESC
         LIMIT ?`,
        [seasonId, limit]
    );
    return rows;
}

async function countActivePlayersForSeason(seasonId) {
    const [[{ total }]] = await db.query(
        "SELECT COUNT(DISTINCT player_id) AS total FROM answer_logs WHERE season_id = ?",
        [seasonId]
    );
    return total;
}

async function getPlayerStatsForSeason(seasonId) {
    const [rows] = await db.query(
        `SELECT p.id, p.nickname,
                COALESCE(s.points, 0) AS points,
                COALESCE(SUM(a.is_correct = 1), 0) AS correct_answers,
                COALESCE(SUM(a.is_correct = 0 AND a.selected_option IS NOT NULL), 0) AS wrong_answers,
                COALESCE(SUM(a.selected_option IS NULL), 0) AS timed_out,
                COUNT(a.id) AS total_answers,
                AVG(a.response_time_ms) AS avg_response_time_ms
         FROM players p
         LEFT JOIN scores s ON s.player_id = p.id AND s.season_id = ?
         LEFT JOIN answer_logs a ON a.player_id = p.id AND a.season_id = ?
         GROUP BY p.id, p.nickname, s.points
         ORDER BY points DESC, correct_answers DESC,
                  AVG(a.response_time_ms) IS NULL ASC,
                  AVG(a.response_time_ms) ASC`,
        [seasonId, seasonId]
    );
    return rows;
}

async function countForPlayerInSeason(playerId, seasonId) {
    const [[{ total }]] = await db.query(
        "SELECT COUNT(*) AS total FROM answer_logs WHERE player_id = ? AND season_id = ?",
        [playerId, seasonId]
    );
    return Number(total);
}

async function getPlayerStatsForPlayerInSeason(playerId, seasonId) {
    const [[stats]] = await db.query(
        `SELECT COALESCE(SUM(is_correct = 1), 0) AS correct_answers,
                COALESCE(SUM(is_correct = 0 AND selected_option IS NOT NULL), 0) AS wrong_answers,
                COALESCE(SUM(selected_option IS NULL), 0) AS timed_out,
                COUNT(*) AS total_answers,
                AVG(response_time_ms) AS avg_response_time_ms
         FROM answer_logs
         WHERE player_id = ? AND season_id = ?`,
        [playerId, seasonId]
    );
    return stats;
}

async function getGlobalStatsForSeason(seasonId) {
    const [[row]] = await db.query(
        `SELECT
            COALESCE(SUM(is_correct = 1), 0) AS correct_answers,
            COALESCE(SUM(is_correct = 0 AND selected_option IS NOT NULL), 0) AS wrong_answers,
            COALESCE(SUM(selected_option IS NULL), 0) AS timed_out
         FROM answer_logs
         WHERE season_id = ?`,
        [seasonId]
    );
    return row;
}

async function getGlobalStatsAllTime() {
    const [[row]] = await db.query(
        `SELECT
            COALESCE(SUM(is_correct = 1), 0) AS correct_answers,
            COALESCE(SUM(is_correct = 0 AND selected_option IS NOT NULL), 0) AS wrong_answers,
            COALESCE(SUM(selected_option IS NULL), 0) AS timed_out,
            COUNT(DISTINCT season_id) AS total_seasons
         FROM answer_logs`
    );
    return row;
}

async function getPlayerStatsAllTime(playerId) {
    const [[stats]] = await db.query(
        `SELECT COALESCE(SUM(is_correct = 1), 0) AS correct_answers,
                COALESCE(SUM(is_correct = 0 AND selected_option IS NOT NULL), 0) AS wrong_answers,
                COALESCE(SUM(selected_option IS NULL), 0) AS timed_out,
                COUNT(*) AS total_answers,
                AVG(response_time_ms) AS avg_response_time_ms
         FROM answer_logs
         WHERE player_id = ?`,
        [playerId]
    );
    return stats;
}

async function ensureSelectedOptionNullable() {
    const [[column]] = await db.query(
        `SELECT IS_NULLABLE AS isNullable
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'answer_logs'
           AND column_name = 'selected_option'`
    );

    if (column && column.isNullable === "NO") {
        await db.query("ALTER TABLE answer_logs MODIFY selected_option ENUM('a','b','c','d') NULL");
    }
}

async function ensureResponseTimeColumn() {
    const [[column]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'answer_logs'
           AND column_name = 'response_time_ms'`
    );

    if (!column.total) {
        await db.query("ALTER TABLE answer_logs ADD COLUMN response_time_ms INT UNSIGNED NULL AFTER selected_option");
    }
}

module.exports = {
    hasAnswered,
    record,
    getTopQuestionsForSeason,
    countActivePlayersForSeason,
    getPlayerStatsForSeason,
    countForPlayerInSeason,
    getPlayerStatsForPlayerInSeason,
    getGlobalStatsForSeason,
    getGlobalStatsAllTime,
    getPlayerStatsAllTime,
    ensureSelectedOptionNullable,
    ensureResponseTimeColumn
};