const questionModel = require("../../models/questionModel");
const seasonModel = require("../../models/seasonModel");
const scoreModel = require("../../models/scoreModel");
const answerLogModel = require("../../models/answerLogModel");
const settingsModel = require("../../models/settingsModel");
const { getWeeklyRound } = require("../../services/weeklyRoundService");
const weeklyQuestionModel = require("../../models/weeklyQuestionModel");

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
        const weeklyRound = getWeeklyRound();
        const weeklyQuestions = await weeklyQuestionModel.ensureForWeek(weeklyRound.startDate);
        const questionTimeSeconds = await settingsModel.getQuestionTimeSeconds();
        const questionTimeLimitMs = questionTimeSeconds * 1000;
        const answeredInGame = await answerLogModel.countForPlayerInWeek(req.player.id, weeklyRound.startDate);

        if (answeredInGame >= 10) {
            req.session.pendingQuestionId = null;
            req.session.pendingSeasonId = null;
            req.session.pendingWeekStart = null;
            req.session.pendingQuestionStartedAt = null;
            const [{ avg_response_time_ms: avgResponseTimeMs }, rankingPosition] = await Promise.all([
                answerLogModel.getPlayerStatsForPlayerInSeason(req.player.id, season.id),
                scoreModel.getPlayerRankingPosition(req.player.id, season.id)
            ]);
            return res.json({
                done: true,
                gameComplete: true,
                weeklyComplete: true,
                avgResponseTimeMs,
                rankingPosition,
                nextMondayAt: weeklyRound.nextMondayAt,
                message: "¡Completaste las 10 preguntas de esta semana! Volvé el lunes para la próxima tanda."
            });
        }

        if (req.session.pendingQuestionId
            && req.session.pendingSeasonId === season.id
            && req.session.pendingWeekStart === weeklyRound.startDate) {
            const questionStartedAt = req.session.pendingQuestionStartedAt || Date.now();
            const timeRemainingMs = questionTimeLimitMs - (Date.now() - questionStartedAt);
            if (timeRemainingMs <= 0) {
                const timedOut = await answerLogModel.hasAnswered(req.player.id, req.session.pendingQuestionId, weeklyRound.startDate);
                if (!timedOut) {
                    await answerLogModel.record({
                        playerId: req.player.id,
                        questionId: req.session.pendingQuestionId,
                        seasonId: season.id,
                        weekStart: weeklyRound.startDate,
                        selectedOption: null,
                        isCorrect: false,
                        responseTimeMs: null
                    });
                    await scoreModel.applyAnswerResult({
                        playerId: req.player.id,
                        seasonId: season.id,
                        isCorrect: false,
                        pointsEarned: 0
                    });
                }
                req.session.gameQuestionsAnswered = answeredInGame + 1;
                req.session.pendingQuestionId = null;
                req.session.pendingWeekStart = null;
                req.session.pendingQuestionStartedAt = null;
                return res.json({
                    done: false,
                    timedOut: true,
                    questionNumber: answeredInGame + 1,
                    nextMondayAt: weeklyRound.nextMondayAt,
                    message: "Se terminó el tiempo. La pregunta no vuelve a aparecer esta semana."
                });
            }
            const alreadyAnswered = await answerLogModel.hasAnswered(req.player.id, req.session.pendingQuestionId, weeklyRound.startDate);
            if (!alreadyAnswered) {
                const pending = await questionModel.findActiveById(req.session.pendingQuestionId);
                if (pending) {
                    return res.json({
                        done: false,
                        questionNumber: answeredInGame + 1,
                        timeRemainingMs,
                        nextMondayAt: weeklyRound.nextMondayAt,
                        question: toPublicQuestion(pending)
                    });
                }
            }
        }

        if (req.session.pendingSeasonId !== season.id || req.session.pendingWeekStart !== weeklyRound.startDate) {
            req.session.pendingQuestionId = null;
            req.session.pendingSeasonId = null;
            req.session.pendingWeekStart = null;
            req.session.pendingQuestionStartedAt = null;
        }

        const question = await questionModel.findNextUnanswered(req.player.id, weeklyRound.startDate);

        if (!question) {
            req.session.pendingQuestionId = null;
            const weeklyComplete = answeredInGame > 0 && answeredInGame >= weeklyQuestions.length;
            if (weeklyComplete) {
                const [{ avg_response_time_ms: avgResponseTimeMs }, rankingPosition] = await Promise.all([
                    answerLogModel.getPlayerStatsForPlayerInSeason(req.player.id, season.id),
                    scoreModel.getPlayerRankingPosition(req.player.id, season.id)
                ]);
                return res.json({
                    done: true,
                    gameComplete: true,
                    weeklyComplete: true,
                    avgResponseTimeMs,
                    rankingPosition,
                    nextMondayAt: weeklyRound.nextMondayAt,
                    message: "Completaste la tanda de esta semana. Volvé el lunes para las próximas preguntas."
                });
            }
            return res.json({
                done: true,
                gameComplete: false,
                weeklyComplete: true,
                nextMondayAt: weeklyRound.nextMondayAt,
                message: "No quedan preguntas nuevas disponibles. Volvé más tarde."
            });
        }

        req.session.pendingQuestionId = question.id;
        req.session.pendingSeasonId = season.id;
        req.session.pendingWeekStart = weeklyRound.startDate;
        req.session.pendingQuestionStartedAt = Date.now();

        res.json({
            done: false,
            questionNumber: answeredInGame + 1,
            timeRemainingMs: questionTimeLimitMs,
            nextMondayAt: weeklyRound.nextMondayAt,
            question: toPublicQuestion(question)
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { getRandomQuestion };