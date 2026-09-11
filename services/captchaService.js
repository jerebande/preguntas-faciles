const { createChallenge, verifySolution } = require("altcha-lib");

const HMAC_KEY = process.env.ALTCHA_HMAC_KEY || process.env.SESSION_SECRET || "dev-altcha-key-cambiame";

async function generateChallenge() {
    const challenge = await createChallenge({
        hmacKey: HMAC_KEY,
        maxNumber: 100000
    });
    console.log("[altcha] challenge generado:", JSON.stringify(challenge).slice(0, 200));
    return challenge;
}

async function verifyCaptcha(payload) {
    console.log("[altcha] payload recibido:", typeof payload, JSON.stringify(payload).slice(0, 300));
    if (!payload) return false;
    try {
        const result = await verifySolution(payload, HMAC_KEY);
        console.log("[altcha] verifySolution ->", result);
        return result;
    } catch (err) {
        console.error("[altcha] verifySolution ERROR:", err);
        return false;
    }
}

module.exports = { generateChallenge, verifyCaptcha };