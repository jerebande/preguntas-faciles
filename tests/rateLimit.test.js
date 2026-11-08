const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const test = require("node:test");
const { authLimiter, clearAuthAttempts } = require("../middleware/rateLimit");

function request(ip, nickname) {
    return { ip, body: { nickname }, socket: {} };
}

function runLimiter(req) {
    let passed = false;
    let statusCode = 200;
    const res = {
        setHeader() {},
        status(code) {
            statusCode = code;
            return this;
        },
        json() {}
    };

    authLimiter(req, res, () => {
        passed = true;
    });

    return { passed, statusCode };
}

test("auth attempt limit is independent for nicknames sharing an IP", () => {
    const ip = `test-${randomUUID()}`;
    const firstUser = request(ip, "JugadorA");
    const otherUser = request(ip, "JugadorB");

    for (let i = 0; i < 10; i += 1) {
        assert.equal(runLimiter(firstUser).passed, true);
    }

    assert.deepEqual(runLimiter(firstUser), { passed: false, statusCode: 429 });
    assert.deepEqual(runLimiter(otherUser), { passed: true, statusCode: 200 });
});

test("clearing auth attempts resets only the matching IP and nickname", () => {
    const ip = `test-${randomUUID()}`;
    const firstUser = request(ip, "JugadorA");
    const otherUser = request(ip, "JugadorB");

    for (let i = 0; i < 10; i += 1) {
        runLimiter(firstUser);
        runLimiter(otherUser);
    }

    clearAuthAttempts(firstUser);

    assert.deepEqual(runLimiter(firstUser), { passed: true, statusCode: 200 });
    assert.deepEqual(runLimiter(otherUser), { passed: false, statusCode: 429 });
});
