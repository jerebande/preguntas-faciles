const db = require("../database/db");

async function ensureTable() {
    await db.query(
        `CREATE TABLE IF NOT EXISTS weekly_questions (
            week_start DATE NOT NULL,
            slot TINYINT UNSIGNED NOT NULL,
            question_id INT UNSIGNED NOT NULL,
            PRIMARY KEY (week_start, slot),
            UNIQUE KEY uq_weekly_questions_question (week_start, question_id),
            KEY ix_weekly_questions_id (question_id)
        ) ENGINE=InnoDB`
    );
}

async function ensureForWeek(weekStart) {
    const [available] = await db.query(
        "SELECT question_id FROM weekly_questions WHERE week_start = ? ORDER BY slot",
        [weekStart]
    );
    if (available.length) return available.map((row) => row.question_id);

    const connection = await db.getConnection();
    const lockName = `pf_week_${weekStart}`;
    let lockAcquired = false;
    let transactionStarted = false;

    try {
        const [[lock]] = await connection.query("SELECT GET_LOCK(?, 10) AS acquired", [lockName]);
        if (Number(lock.acquired) !== 1) {
            throw new Error("No se pudo preparar la tanda semanal de preguntas.");
        }
        lockAcquired = true;

        await connection.beginTransaction();
        transactionStarted = true;

        const [existing] = await connection.query(
            "SELECT question_id FROM weekly_questions WHERE week_start = ? ORDER BY slot",
            [weekStart]
        );
        if (!existing.length) {
            const [questions] = await connection.query(
                "SELECT id FROM questions WHERE active = 1 ORDER BY RAND() LIMIT 10"
            );
            for (let index = 0; index < questions.length; index += 1) {
                await connection.query(
                    "INSERT INTO weekly_questions (week_start, slot, question_id) VALUES (?, ?, ?)",
                    [weekStart, index + 1, questions[index].id]
                );
            }
        }

        const [rows] = await connection.query(
            "SELECT question_id FROM weekly_questions WHERE week_start = ? ORDER BY slot",
            [weekStart]
        );
        await connection.commit();
        transactionStarted = false;
        return rows.map((row) => row.question_id);
    } catch (error) {
        if (transactionStarted) await connection.rollback();
        throw error;
    } finally {
        try {
            if (lockAcquired) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
            connection.release();
        } catch (error) {
            connection.destroy();
            throw error;
        }
    }
}

module.exports = { ensureTable, ensureForWeek };
