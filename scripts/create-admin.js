// Script para crear (o resetear) un admin a mano, sin depender del arranque del servidor.
//
// Uso:
//   node scripts/create-admin.js usuario contraseña
//
// Si ya existe un admin con ese username, lo borra y lo vuelve a crear con la
// contraseña nueva. Si no existe, lo crea directamente.

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const db = require("../database/db");
const bcrypt = require("bcryptjs");

async function main() {
    const username = process.argv[2];
    const password = process.argv[3];

    if (!username || !password) {
        console.log("Uso: node scripts/create-admin.js usuario contraseña");
        process.exit(1);
    }

    try {
        const [existing] = await db.query("SELECT id FROM admins WHERE username = ?", [username]);
        if (existing.length) {
            await db.query("DELETE FROM admins WHERE username = ?", [username]);
            console.log(`Admin existente "${username}" borrado.`);
        }

        const hash = await bcrypt.hash(password, 10);
        await db.query("INSERT INTO admins (username, password_hash) VALUES (?, ?)", [username, hash]);

        console.log(`Admin "${username}" creado con éxito. Ya podés entrar en /admin/login.`);
    } catch (err) {
        console.error("Error creando el admin:", err.message);
    } finally {
        process.exit(0);
    }
}

main();