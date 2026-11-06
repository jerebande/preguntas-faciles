const db = require("../database/db");

const MAX_ACCOUNTS_PER_IP = 4;

async function ensureTable() {
    await db.query(
        `CREATE TABLE IF NOT EXISTS registration_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            ip_hash CHAR(64) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY ix_registration_ip_created (ip_hash, created_at)
        ) ENGINE=InnoDB`
    );
}

async function createWithinLimit(ipHash, createPlayer) {
    const connection = await db.getConnection();
    const lockName = `pf_reg_${ipHash.slice(0, 48)}`;
    let lockAcquired = false;
    let transactionStarted = false;

    try {
        const [[lock]] = await connection.query("SELECT GET_LOCK(?, 10) AS acquired", [lockName]);
        if (Number(lock.acquired) !== 1) {
            throw new Error("No se pudo verificar el límite de registros para esta IP.");
        }
        lockAcquired = true;

        await connection.beginTransaction();
        transactionStarted = true;

        const [[{ total }]] = await connection.query(
            `SELECT COUNT(*) AS total
             FROM registration_events
             WHERE ip_hash = ?`,
            [ipHash]
        );
        if (Number(total) >= MAX_ACCOUNTS_PER_IP) {
            await connection.rollback();
            transactionStarted = false;
            return { limited: true };
        }

        const player = await createPlayer(connection);
        await connection.query("INSERT INTO registration_events (ip_hash) VALUES (?)", [ipHash]);
        await connection.commit();
        transactionStarted = false;
        return { limited: false, player };
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

module.exports = { ensureTable, createWithinLimit };
