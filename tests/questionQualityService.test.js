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
    points_value: 10,
    source_url: "https://example.com/fuente"
};

test("question validation catches duplicate options and requires a verifiable source for publication", () => {
    const result = validateQuestion({
        ...validQuestion,
        option_d: " PARÍS ",
        source_url: ""
    }, { requireSource: true });

    assert.ok(result.errors.some((error) => error.includes("distintas")));
    assert.ok(result.errors.some((error) => error.includes("fuente verificable")));
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
