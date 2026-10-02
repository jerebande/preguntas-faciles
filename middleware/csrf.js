const crypto = require("crypto");
const fs = require("fs");

const INVALID_CSRF_MESSAGE = "La solicitud venció o no es válida. Recargá la página e intentá de nuevo.";

function issueCsrfToken(req, res, next) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
}

function verifyCsrfToken(req, res, next) {
    const expected = req.session && req.session.csrfToken;
    const submitted = req.body && req.body._csrf;
    const valid = typeof expected === "string"
        && typeof submitted === "string"
        && expected.length === submitted.length
        && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(submitted));

    if (valid) return next();

    const rejectRequest = () => res.status(403).send(INVALID_CSRF_MESSAGE);
    if (!req.file) return rejectRequest();

    fs.unlink(req.file.path, (err) => {
        if (err && err.code !== "ENOENT") {
            console.error("No se pudo eliminar una carga rechazada por CSRF:", err);
        }
        rejectRequest();
    });
}

module.exports = { issueCsrfToken, verifyCsrfToken };
