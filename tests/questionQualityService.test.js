const test = require("node:test");
const assert = require("node:assert/strict");
const { filterGeneratedQuestions, validateQuestion } = require("../services/questionQualityService");

const validQuestion = {
    question_text: "¿Cuál es la capital de Francia?",
    option_a: "Madrid",
    option_b: "París",
    option_c: "Roma",
    option_d: "Lisboa",
    correct_option: "b",
    difficulty: "facil",
    points_value: 10
};

test("question validation catches duplicate options", () => {
    const result = validateQuestion({ ...validQuestion, option_d: " PARÍS " });

    assert.ok(result.errors.some((error) => error.includes("distintas")));
});

test("a question can be published without a source URL", () => {
    assert.deepEqual(validateQuestion(validQuestion).errors, []);
});

test("generated questions with invalid options or duplicate wording are discarded", () => {
    const result = filterGeneratedQuestions([
        validQuestion,
        { ...validQuestion, question_text: "¿Cuál es la capital de Francia?" },
        { ...validQuestion, question_text: "¿Qué color tiene el cielo?", option_c: "PARÍS" }
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0].correct_option, "b");
});
