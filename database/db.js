// Cargar variables de entorno desde .env
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const envPath = path.join(__dirname, "..", ".env"); // db.js está en /database, .env debería estar un nivel arriba
console.log("=== DIAGNÓSTICO .env (db.js) ===");
console.log("__dirname de db.js:", __dirname);
console.log("Ruta de .env que voy a intentar:", envPath);
console.log("¿Existe ese archivo?:", fs.existsSync(envPath));

const dotenvResult = dotenv.config({ path: envPath });
console.log("Error de dotenv:", dotenvResult.error ? dotenvResult.error.message : "ninguno");
console.log("Claves cargadas:", dotenvResult.parsed ? Object.keys(dotenvResult.parsed) : []);
console.log("=================================");

const mysql = require("mysql2/promise");

// Crear pool de conexiones
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "preguntas_faciles",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "preguntas_faciles",
    port: process.env.DB_PORT || 3306,

    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,

    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,

    dateStrings: true
});

// Probar la conexión al arrancar
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log("¡Conectado exitosamente a la base de datos!");
        console.log("Base de datos:", process.env.DB_NAME);
        connection.release();
    } catch (error) {
        console.error("Error detallado de conexión:", error.message);
        console.error("Host usado:", process.env.DB_HOST);
        console.error("Usuario usado:", process.env.DB_USER);
    }
})();

// Exportar el pool
module.exports = pool;
