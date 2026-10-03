require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");
const db = require("./database/db");
const adminModel = require("./models/adminModel");
const playerModel = require("./models/playerModel");
const answerLogModel = require("./models/answerLogModel");
const questionModel = require("./models/questionModel");
const settingsModel = require("./models/settingsModel");
const { loadPlayer } = require("./middleware/player");

const gameRoutes = require("./routes/game");
const apiRoutes = require("./routes/api");
const adminRoutes = require("./routes/admin");

const app = express();

if (process.env.NODE_ENV === "production" && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    throw new Error("En producción SESSION_SECRET debe tener al menos 32 caracteres.");
}

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : false);
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const sessionStore = new MySQLStore({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "preguntas_faciles",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "preguntas_faciles",
    port: process.env.DB_PORT || 3306,
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000, // limpia sesiones vencidas cada 15 min
    expiration: 1000 * 60 * 60 * 24 * 90 // debe coincidir con cookie.maxAge
});

sessionStore.on("error", (err) => {
    console.error("Error en el store de sesiones (MySQL):", err.message);
});

app.use(session({
    secret: process.env.SESSION_SECRET || "dev-secret-cambiame",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 90,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    }
}));

app.use(loadPlayer);

app.use("/", gameRoutes);
app.use("/api", apiRoutes);
app.use("/admin", adminRoutes);

app.use((req, res) => {
    res.status(404).render("404");
});

async function ensureAdmin() {
    const total = await adminModel.count();
    if (total > 0) return;

    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "cambiar123";
    await adminModel.create(username, password);
    console.log(`Admin inicial creado -> usuario: ${username}`);
}

const PORT = process.env.PORT || 3000;

ensureAdmin()
    .then(() => playerModel.ensureAvatarColumn())
    .then(() => playerModel.ensurePasswordColumn())
    .then(() => playerModel.ensureContactColumns())
    .then(() => answerLogModel.ensureSelectedOptionNullable())
    .then(() => answerLogModel.ensureResponseTimeColumn())
    .then(() => questionModel.ensureImageUrlColumn())
    .then(() => settingsModel.ensureTable())
    .catch((err) => console.error("No se pudo crear el admin inicial:", err.message))
    .finally(() => {
        const server = app.listen(PORT, () => console.log(`preguntas.faciles corriendo en http://localhost:${PORT}`));
        server.on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                console.error(`El puerto ${PORT} ya está en uso. El servidor probablemente ya está corriendo en http://localhost:${PORT}`);
                process.exitCode = 0;
                return;
            }
            console.error("No se pudo iniciar el servidor:", err.message);
            process.exitCode = 1;
        });
    });