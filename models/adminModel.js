const db = require("../database/db");
const bcrypt = require("bcryptjs");

async function findByUsername(username) {
    const [rows] = await db.query("SELECT * FROM admins WHERE username = ?", [username]);
    return rows[0] || null;
}

async function count() {
    const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM admins");
    return total;
}

async function create(username, plainPassword) {
    const hash = await bcrypt.hash(plainPassword, 10);
    await db.query("INSERT INTO admins (username, password_hash) VALUES (?, ?)", [username, hash]);
}

async function verifyPassword(admin, plainPassword) {
    return bcrypt.compare(plainPassword || "", admin.password_hash);
}

module.exports = {
    findByUsername,
    count,
    create,
    verifyPassword
};