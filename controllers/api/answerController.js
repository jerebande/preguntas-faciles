const questionModel = require("../../models/questionModel");
const seasonModel = require("../../models/seasonModel");
const scoreModel = require("../../models/scoreModel");
const answerLogModel = require("../../models/answerLogModel");
const settingsModel = require("../../models/settingsModel");

async function submitAnswer(req, res, next) {
    try {
        if (!req.player) return res.status(401).json({ error: "Necesitás un nickname para jugar." });

        const { questionId: rawQuestionId, selectedOption } = req.body;
        const questionId = Number(rawQuestionId);
        if (!Number.isInteger(questionId) || questionId <= 0) {
            return res.status(400).json({ error: "Pregunta inválida." });
        }
        if (Number(req.session.pendingQuestionId) !== questionId) {
            return res.status(409).json({ error: "Esta pregunta ya no está activa." });
        }
        if (selectedOption !== null && !["a", "b", "c", "d"].includes(selectedOption)) {
            return res.status(400).json({ error: "Opción inválida." });
        }

        const season = await seasonModel.getActive();
        const questionTimeSeconds = await settingsModel.getQuestionTimeSeconds();
        const questionTimeLimitMs = questionTimeSeconds * 1000;
        const answeredInSeason = await answerLogModel.countForPlayerInSeason(req.player.id, season.id);

        const question = await questionModel.findActiveById(questionId);
        if (!question) return res.status(404).json({ error: "Pregunta no encontrada." });

        const already = await answerLogModel.hasAnswered(req.player.id, questionId);
        if (already) return res.status(409).json({ error: "Ya respondiste esta pregunta." });

        if (answeredInSeason >= 10) {
            return res.status(409).json({ error: "Tu partida ya terminó." });
        }

        const startedAt = req.session.pendingQuestionStartedAt || Date.now();
        const elapsedMs = Date.now() - startedAt;
        const timedOut = selectedOption === null || elapsedMs >= questionTimeLimitMs;
        if (timedOut) {
            await answerLogModel.record({ playerId: req.player.id, questionId, seasonId: season.id, selectedOption: null, isCorrect: false, responseTimeMs: null });
            req.session.pendingQuestionId = null;
            req.session.pendingSeasonId = null;
            req.session.pendingQuestionStartedAt = null;
            req.session.gameQuestionsAnswered = (req.session.gameQuestionsAnswered || 0) + 1;
            return res.status(408).json({ timedOut: true, error: "Se terminó el tiempo. La pregunta no vuelve a aparecer." });
        }

        const isCorrect = selectedOption === question.correct_option;
        const pointsEarned = isCorrect ? question.points_value : 0;

        await answerLogModel.record({
            playerId: req.player.id,
            questionId,
            seasonId: season.id,
            selectedOption,
            isCorrect,
            responseTimeMs: elapsedMs
        });

        await scoreModel.applyAnswerResult({
            playerId: req.player.id,
            seasonId: season.id,
            isCorrect,
            pointsEarned
        });

        req.session.pendingQuestionId = null;
        req.session.pendingSeasonId = null;
        req.session.pendingQuestionStartedAt = null;
        req.session.gameQuestionsAnswered = (req.session.gameQuestionsAnswered || 0) + 1;

        res.json({
            correct: isCorrect,
            correctOption: question.correct_option,
            pointsEarned,
            responseTimeMs: elapsedMs
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { submitAnswer };