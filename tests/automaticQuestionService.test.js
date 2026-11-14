const test = require("node:test");
const assert = require("node:assert/strict");
const { createAutomaticQuestionService } = require("../services/automaticQuestionService");

test("automatically generates drafts after a week without new questions", async () => {
    let generatedOptions;
    let savedDrafts;
    const service = createAutomaticQuestionService({
        questions: {
            hasRecentQuestion: async () => false,
            createManyAsDraft: async (questions, categoryId) => {
                savedDrafts = { questions, categoryId };
                return [1, 2];
            }
        },
        ai: {
            generateQuestions: async (options) => {
                generatedOptions = options;
                return [{ question_text: "Pregunta generada" }, { question_text: "Otra pregunta" }];
            }
        },
        logger: { info() {}, warn() {}, error() {} }
    });

    assert.equal(await service.checkAndGenerate(), true);
    assert.deepEqual(generatedOptions, {
        topic: "cultura general variada",
        count: 10,
        difficulty: "",
        includeImages: false
    });
    assert.deepEqual(savedDrafts, {
        questions: [{ question_text: "Pregunta generada" }, { question_text: "Otra pregunta" }],
        categoryId: null
    });
});

test("does not generate questions when an admin added a recent question", async () => {
    let generated = false;
    const service = createAutomaticQuestionService({
        questions: {
            hasRecentQuestion: async () => true,
            createManyAsDraft: async () => {
                throw new Error("Should not save questions");
            }
        },
        ai: {
            generateQuestions: async () => {
                generated = true;
                return [];
            }
        },
        logger: { info() {}, warn() {}, error() {} }
    });

    assert.equal(await service.checkAndGenerate(), false);
    assert.equal(generated, false);
});
