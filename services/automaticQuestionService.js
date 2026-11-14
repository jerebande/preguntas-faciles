const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const GENERATED_QUESTION_COUNT = 10;

function createAutomaticQuestionService({
    questions,
    ai,
    logger = console
} = {}) {
    let generating = false;

    async function checkAndGenerate() {
        if (generating) return false;
        generating = true;

        try {
            const questionStore = questions || require("../models/questionModel");
            const questionGenerator = ai || require("./aiQuestionService");
            if (await questionStore.hasRecentQuestion()) return false;

            const generated = await questionGenerator.generateQuestions({
                topic: "cultura general variada",
                count: GENERATED_QUESTION_COUNT,
                difficulty: "",
                includeImages: false
            });

            if (!generated.length) {
                logger.warn("La generación automática no produjo preguntas utilizables.");
                return false;
            }

            const ids = await questionStore.createManyAsDraft(generated, null);
            logger.info(`La generación automática guardó ${ids.length} preguntas como borradores.`);
            return true;
        } finally {
            generating = false;
        }
    }

    function start() {
        const run = () => {
            checkAndGenerate().catch((error) => {
                logger.error("No se pudieron generar preguntas automáticamente:", error);
            });
        };

        run();
        const timer = setInterval(run, CHECK_INTERVAL_MS);
        timer.unref();
        return timer;
    }

    return { checkAndGenerate, start };
}

module.exports = createAutomaticQuestionService();
module.exports.createAutomaticQuestionService = createAutomaticQuestionService;
