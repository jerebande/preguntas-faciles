const questionModel = require("../../models/questionModel");
const seasonModel = require("../../models/seasonModel");
const answerLogModel = require("../../models/answerLogModel");
const settingsModel = require("../../models/settingsModel");

function toPublicQuestion(row) {
    return {
        id: row.id,
        question_text: row.question_text,
        option_a: row.option_a,
        option_b: row.option_b,
        option_c: row.option_c,
        option_d: row.option_d,
        points_value: row.points_value,
        image_url: row.image_url
    };
}

async function getRandomQuestion(req, res, next) {
    try {
        if (!req.player) return res.status(401).json({ error: "Necesitás un nickname para jugar." });

        const season = await seasonModel.getActive();
        const questionTimeSeconds = await settingsModel.getQuestionTimeSeconds();
        const questionTimeLimitMs = questionTimeSeconds * 1000;
        const answeredInGame = Number(req.session.gameQuestionsAnswered) || 0;

        if (answeredInGame >= 10) {
            req.session.pendingQuestionId = null;
            const { avg_response_time_ms: avgResponseTimeMs } = await answerLogModel.getPlayerStatsForPlayerInSeason(req.player.id, season.id);
            return res.json({
                done: true,
                gameComplete: true,
                avgResponseTimeMs,
                message: "Partida terminada. ¡Completaste las 10 preguntas! Podés empezar otra tanda ahora."
            });
        }

        if (req.session.pendingQuestionId && req.session.pendingSeasonId === season.id) {
            const questionStartedAt = req.session.pendingQuestionStartedAt || Date.now();
            const timeRemainingMs = questionTimeLimitMs - (Date.now() - questionStartedAt);
            if (timeRemainingMs <= 0) {
                const timedOut = await answerLogModel.hasAnswered(req.player.id, req.session.pendingQuestionId);
                if (!timedOut) {
                    await answerLogModel.record({
                        playerId: req.player.id,
                        questionId: req.session.pendingQuestionId,
                        seasonId: season.id,
                        selectedOption: null,
                        isCorrect: false,
                        responseTimeMs: null
                    });
                }
                req.session.gameQuestionsAnswered = answeredInGame + 1;
                req.session.pendingQuestionId = null;
                req.session.pendingQuestionStartedAt = null;
                return res.json({ done: false, timedOut: true, questionNumber: answeredInGame + 1, message: "Se terminó el tiempo. La pregunta no vuelve a aparecer." });
            }
            const alreadyAnswered = await answerLogModel.hasAnswered(req.player.id, req.session.pendingQuestionId);
            if (!alreadyAnswered) {
                const pending = await questionModel.findActiveById(req.session.pendingQuestionId);
                if (pending) {
                    return res.json({ done: false, questionNumber: answeredInGame + 1, timeRemainingMs, question: toPublicQuestion(pending) });
                }
            }
        }

        const question = await questionModel.findRandomUnanswered(req.player.id, season.id);

        if (!question) {
            req.session.pendingQuestionId = null;
            return res.json({
                done: true,
                gameComplete: false,
                message: "Ya respondiste todas las preguntas disponibles. Agregaremos más pronto."
            });
        }

        req.session.pendingQuestionId = question.id;
        req.session.pendingSeasonId = season.id;
        req.session.pendingQuestionStartedAt = Date.now();

        res.json({ done: false, questionNumber: answeredInGame + 1, timeRemainingMs: questionTimeLimitMs, question: toPublicQuestion(question) });
    } catch (err) {
        next(err);
    }
}

module.exports = { getRandomQuestion };