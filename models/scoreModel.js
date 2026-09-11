const db = require("../database/db");

async function findByPlayerAndSeason(playerId, seasonId) {
    const [rows] = await db.query(
        `SELECT s.points, s.correct_answers, s.wrong_answers, t.avg_response_time_ms
         FROM scores s
         LEFT JOIN (
             SELECT player_id, AVG(response_time_ms) AS avg_response_time_ms
             FROM answer_logs
             WHERE season_id = ? AND response_time_ms IS NOT NULL
             GROUP BY player_id
         ) t ON t.player_id = s.player_id
         WHERE s.player_id = ? AND s.season_id = ?`,
        [seasonId, playerId, seasonId]
    );
    return rows[0] || { points: 0, correct_answers: 0, wrong_answers: 0, avg_response_time_ms: null };
}

async function getRankingForSeason(seasonId, limit = 50) {
    const [rows] = await db.query(
        `SELECT p.nickname, p.avatar_data, s.points, s.correct_answers, s.wrong_answers,
                t.avg_response_time_ms
         FROM scores s
         JOIN players p ON p.id = s.player_id
         LEFT JOIN (
             SELECT player_id, AVG(response_time_ms) AS avg_response_time_ms
             FROM answer_logs
             WHERE season_id = ? AND response_time_ms IS NOT NULL
             GROUP BY player_id
         ) t ON t.player_id = s.player_id
         WHERE s.season_id = ?
         ORDER BY s.points DESC, s.correct_answers DESC,
                  (t.avg_response_time_ms IS NULL) ASC, t.avg_response_time_ms ASC
         LIMIT ?`,
        [seasonId, seasonId, limit]
    );
    return rows;
}

async function getWinnerForSeason(seasonId) {
    const [rows] = await db.query(
        `SELECT p.nickname, p.avatar_data, s.points, s.correct_answers, s.wrong_answers,
                t.avg_response_time_ms
         FROM scores s
         JOIN players p ON p.id = s.player_id
         LEFT JOIN (
             SELECT player_id, AVG(response_time_ms) AS avg_response_time_ms
             FROM answer_logs
             WHERE season_id = ? AND response_time_ms IS NOT NULL
             GROUP BY player_id
         ) t ON t.player_id = s.player_id
         WHERE s.season_id = ?
           AND (s.correct_answers + s.wrong_answers) > 0
         ORDER BY s.points DESC, s.correct_answers DESC,
                  (t.avg_response_time_ms IS NULL) ASC, t.avg_response_time_ms ASC,
                  p.nickname ASC
         LIMIT 1`,
        [seasonId, seasonId]
    );
    return rows[0] || null;
}

async function initializeSeasonScores(seasonId) {
    await db.query(
        `INSERT IGNORE INTO scores
         (player_id, season_id, points, correct_answers, wrong_answers, best_streak, current_streak)
         SELECT id, ?, 0, 0, 0, 0, 0 FROM players`,
        [seasonId]
    );
}

async function applyAnswerResult({ playerId, seasonId, isCorrect, pointsEarned }) {
    await db.query(
        `INSERT INTO scores (player_id, season_id, points, correct_answers, wrong_answers, best_streak, current_streak)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           points = points + VALUES(points),
           correct_answers = correct_answers + VALUES(correct_answers),
           wrong_answers = wrong_answers + VALUES(wrong_answers),
           current_streak = IF(VALUES(correct_answers) = 1, current_streak + 1, 0),
           best_streak = GREATEST(best_streak, IF(VALUES(correct_answers) = 1, current_streak + 1, 0))`,
        [
            playerId, seasonId, pointsEarned,
            isCorrect ? 1 : 0, isCorrect ? 0 : 1,
            isCorrect ? 1 : 0, isCorrect ? 1 : 0
        ]
    );
}

async function countAnswersForSeason(seasonId) {
    const [[{ total }]] = await db.query(
        "SELECT COUNT(*) AS total FROM answer_logs WHERE season_id = ?",
        [seasonId]
    );
    return total;
}

async function getPlayerRankingPosition(playerId, seasonId) {
    const [[row]] = await db.query(
        `SELECT CASE WHEN target.id IS NULL OR (target.correct_answers + target.wrong_answers) = 0 THEN NULL
                     ELSE (
                       SELECT COUNT(*) + 1
                       FROM scores challenger
                       JOIN players challenger_player ON challenger_player.id = challenger.player_id
                       LEFT JOIN (
                           SELECT player_id, AVG(response_time_ms) AS avg_response_time_ms
                           FROM answer_logs
                           WHERE season_id = ? AND response_time_ms IS NOT NULL
                           GROUP BY player_id
                       ) challenger_time ON challenger_time.player_id = challenger.player_id
                       WHERE challenger.season_id = target.season_id
                         AND (challenger.correct_answers + challenger.wrong_answers) > 0
                         AND (
                           challenger.points > target.points
                           OR (challenger.points = target.points AND challenger.correct_answers > target.correct_answers)
                           OR (challenger.points = target.points AND challenger.correct_answers = target.correct_answers
                               AND COALESCE(challenger_time.avg_response_time_ms, 999999999) < COALESCE(target_time.avg_response_time_ms, 999999999))
                           OR (challenger.points = target.points AND challenger.correct_answers = target.correct_answers
                               AND COALESCE(challenger_time.avg_response_time_ms, 999999999) = COALESCE(target_time.avg_response_time_ms, 999999999)
                               AND challenger_player.nickname < target_player.nickname)
                         )
                     ) END AS position
         FROM players target_player
         LEFT JOIN scores target ON target.player_id = target_player.id AND target.season_id = ?
         LEFT JOIN (
             SELECT player_id, AVG(response_time_ms) AS avg_response_time_ms
             FROM answer_logs
             WHERE season_id = ? AND response_time_ms IS NOT NULL
             GROUP BY player_id
         ) target_time ON target_time.player_id = target_player.id
         WHERE target_player.id = ?`,
        [seasonId, seasonId, seasonId, playerId]
    );
    return row.position === null ? null : Number(row.position);
}

// Mejor posición histórica del jugador: recorre todas las temporadas donde
// haya jugado al menos una pregunta y calcula en cuál quedó mejor rankeado.
async function getBestHistoricalPosition(playerId) {
    const [seasons] = await db.query(
        `SELECT DISTINCT season_id FROM scores
         WHERE player_id = ? AND (correct_answers + wrong_answers) > 0
         ORDER BY season_id DESC`,
        [playerId]
    );

    if (!seasons.length) return null;

    let best = null;
    for (const { season_id: seasonId } of seasons) {
        const [rows] = await db.query(
            `SELECT s.name AS season_name,
                    (
                        SELECT COUNT(*) + 1
                        FROM scores challenger
                        JOIN players challenger_player ON challenger_player.id = challenger.player_id
                        LEFT JOIN (
                            SELECT player_id, AVG(response_time_ms) AS avg_response_time_ms
                            FROM answer_logs
                            WHERE season_id = ? AND response_time_ms IS NOT NULL
                            GROUP BY player_id
                        ) challenger_time ON challenger_time.player_id = challenger.player_id
                        WHERE challenger.season_id = target.season_id
                          AND (challenger.correct_answers + challenger.wrong_answers) > 0
                          AND (
                            challenger.points > target.points
                            OR (challenger.points = target.points AND challenger.correct_answers > target.correct_answers)
                            OR (challenger.points = target.points AND challenger.correct_answers = target.correct_answers
                                AND COALESCE(challenger_time.avg_response_time_ms, 999999999) < COALESCE(target_time.avg_response_time_ms, 999999999))
                            OR (challenger.points = target.points AND challenger.correct_answers = target.correct_answers
                                AND COALESCE(challenger_time.avg_response_time_ms, 999999999) = COALESCE(target_time.avg_response_time_ms, 999999999)
                                AND challenger_player.nickname < target_player.nickname)
                          )
                    ) AS position
             FROM scores target
             JOIN players target_player ON target_player.id = target.player_id
             JOIN seasons s ON s.id = target.season_id
             LEFT JOIN (
                 SELECT player_id, AVG(response_time_ms) AS avg_response_time_ms
                 FROM answer_logs
                 WHERE season_id = ? AND response_time_ms IS NOT NULL
                 GROUP BY player_id
             ) target_time ON target_time.player_id = target.player_id
             WHERE target.player_id = ? AND target.season_id = ?`,
            [seasonId, seasonId, playerId, seasonId]
        );

        const row = rows[0];
        if (row && (best === null || row.position < best.position)) {
            best = row;
        }
    }

    return best;
}

module.exports = {
    findByPlayerAndSeason,
    getRankingForSeason,
    getWinnerForSeason,
    initializeSeasonScores,
    applyAnswerResult,
    countAnswersForSeason,
    getPlayerRankingPosition,
    getBestHistoricalPosition
};