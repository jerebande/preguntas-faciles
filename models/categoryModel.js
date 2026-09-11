const db = require("../database/db");

async function findAllActive() {
    const [rows] = await db.query("SELECT * FROM categories WHERE active = 1 ORDER BY name");
    return rows;
}

module.exports = { findAllActive };
