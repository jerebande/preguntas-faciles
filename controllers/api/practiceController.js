const settingsModel = require("../../models/settingsModel");

const PRACTICE_QUESTIONS = [
    {
        question_text: "¿Cuál es el planeta más grande del sistema solar?",
        option_a: "Saturno",
        option_b: "Júpiter",
        option_c: "Neptuno",
        option_d: "Marte",
        correct_option: "b"
    },
    {
        question_text: "¿En qué continente se encuentra Egipto?",
        option_a: "Asia",
        option_b: "Europa",
        option_c: "África",
        option_d: "Oceanía",
        correct_option: "c"
    },
    {
        question_text: "¿Quién escribió Don Quijote de la Mancha?",
        option_a: "Miguel de Cervantes",
        option_b: "Federico García Lorca",
        option_c: "Gabriel García Márquez",
        option_d: "Lope de Vega",
        correct_option: "a"
    },
    {
        question_text: "¿Cuál es la capital de Japón?",
        option_a: "Kioto",
        option_b: "Osaka",
        option_c: "Seúl",
        option_d: "Tokio",
        correct_option: "d"
    },
    {
        question_text: "¿Cuántos lados tiene un hexágono?",
        option_a: "Cinco",
        option_b: "Seis",
        option_c: "Siete",
        option_d: "Ocho",
        correct_option: "b"
    },
    {
        question_text: "¿Qué gas absorben principalmente las plantas durante la fotosíntesis?",
        option_a: "Oxígeno",
        option_b: "Nitrógeno",
        option_c: "Dióxido de carbono",
        option_d: "Hidrógeno",
        correct_option: "c"
    },
    {
        question_text: "¿En qué año llegó el ser humano a la Luna por primera vez?",
        option_a: "1969",
        option_b: "1959",
        option_c: "1979",
        option_d: "1989",
        correct_option: "a"
    },
    {
        question_text: "¿Cuál es el océano más grande del planeta?",
        option_a: "Atlántico",
        option_b: "Índico",
        option_c: "Ártico",
        option_d: "Pacífico",
        correct_option: "d"
    },
    {
        question_text: "¿Qué instrumento musical tiene teclas, pedales y cuerdas?",
        option_a: "Violín",
        option_b: "Piano",
        option_c: "Flauta",
        option_d: "Trompeta",
        correct_option: "b"
    },
    {
        question_text: "¿Cuál es el símbolo químico del oro?",
        option_a: "Ag",
        option_b: "Fe",
        option_c: "Au",
        option_d: "O",
        correct_option: "c"
    },
    {
        question_text: "¿Qué país tiene forma de bota en el mapa?",
        option_a: "Italia",
        option_b: "Grecia",
        option_c: "Portugal",
        option_d: "Croacia",
        correct_option: "a"
    },
    {
        question_text: "¿Cuál es el mamífero más grande del mundo?",
        option_a: "Elefante africano",
        option_b: "Jirafa",
        option_c: "Tiburón ballena",
        option_d: "Ballena azul",
        correct_option: "d"
    },
    {
        question_text: "¿Cuántos minutos tiene una hora?",
        option_a: "50",
        option_b: "60",
        option_c: "70",
        option_d: "100",
        correct_option: "b"
    },
    {
        question_text: "¿Qué artista pintó La noche estrellada?",
        option_a: "Pablo Picasso",
        option_b: "Claude Monet",
        option_c: "Vincent van Gogh",
        option_d: "Salvador Dalí",
        correct_option: "c"
    },
    {
        question_text: "¿Cuál es el idioma con más hablantes nativos del mundo?",
        option_a: "Chino mandarín",
        option_b: "Inglés",
        option_c: "Español",
        option_d: "Hindi",
        correct_option: "a"
    }
];

function parseQuestionNumber(value) {
    const questionNumber = Number(value);
    return Number.isInteger(questionNumber) ? questionNumber : null;
}

async function getQuestion(req, res, next) {
    try {
        const questionNumber = parseQuestionNumber(req.query.number);
        if (!questionNumber || questionNumber < 1 || questionNumber > PRACTICE_QUESTIONS.length) {
            if (questionNumber === PRACTICE_QUESTIONS.length + 1) {
                return res.json({
                    done: true,
                    gameComplete: true,
                    message: "¡Terminaste las 15 preguntas de prueba!"
                });
            }
            return res.status(400).json({ error: "Número de pregunta inválido." });
        }

        const questionTimeSeconds = await settingsModel.getQuestionTimeSeconds();
        const question = PRACTICE_QUESTIONS[questionNumber - 1];
        res.json({
            done: false,
            questionNumber,
            timeRemainingMs: questionTimeSeconds * 1000,
            question: {
                id: questionNumber,
                question_text: question.question_text,
                option_a: question.option_a,
                option_b: question.option_b,
                option_c: question.option_c,
                option_d: question.option_d,
                points_value: 10,
                image_url: null
            }
        });
    } catch (err) {
        next(err);
    }
}

function submitAnswer(req, res) {
    const body = req.body || {};
    const questionNumber = parseQuestionNumber(body.questionNumber);
    const { selectedOption } = body;
    if (!questionNumber || questionNumber < 1 || questionNumber > PRACTICE_QUESTIONS.length) {
        return res.status(400).json({ error: "Pregunta inválida." });
    }
    if (selectedOption !== null && !["a", "b", "c", "d"].includes(selectedOption)) {
        return res.status(400).json({ error: "Opción inválida." });
    }

    const question = PRACTICE_QUESTIONS[questionNumber - 1];
    const correct = selectedOption !== null && selectedOption === question.correct_option;
    res.json({
        correct,
        correctOption: question.correct_option,
        pointsEarned: correct ? 10 : 0,
        timedOut: selectedOption === null
    });
}

module.exports = { getQuestion, submitAnswer };
