// Genera preguntas de opción múltiple usando la API de Groq (la misma que usa
// el Parribot de La Vieja Esquina). No agrega una base de datos nueva: solo
// arma texto y lo devuelve para que el controller lo guarde en la misma tabla
// `questions` de siempre.

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

function buildImageUrl(question, topic) {
    const prompt = [
        "editorial trivia illustration",
        topic || "general culture",
        String(question.question_text).slice(0, 240),
        "colorful, clean, no text, wide background"
    ].join(", ");
    const seed = Array.from(String(question.question_text)).reduce(
        (hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0,
        7
    );

    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=700&nologo=true&seed=${seed}`;
}

function buildPrompt({ topic, count, difficulty }) {
    return `Generá ${count} preguntas de trivia de opción múltiple en español rioplatense.
Tema: ${topic || "cultura general variada"}.
Dificultad: ${difficulty || "variada (mezclá facil, media y dificil)"}.

Reglas:
- Cada pregunta debe tener exactamente 4 opciones (a, b, c, d), todas plausibles.
- Una sola opción correcta.
- Preguntas cortas, pensadas para responder en celular en pocos segundos.
- No repitas preguntas ni temas entre sí dentro de la misma tanda.

Respondé ÚNICAMENTE con un array JSON válido, sin texto adicional, con este formato exacto:
[
  {
    "question_text": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_option": "a",
    "difficulty": "facil"
  }
]`;
}

async function generateQuestions({ topic, count, difficulty, includeImages = false }) {
    if (!process.env.GROQ_API_KEY) {
        throw new Error("Falta configurar GROQ_API_KEY en el .env para poder generar preguntas con IA.");
    }

    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                { role: "user", content: buildPrompt({ topic, count, difficulty }) }
            ],
            temperature: 0.8
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Error de la API de Groq (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawText = (data.choices?.[0]?.message?.content || "").trim();

    const cleaned = rawText.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

    let questions;
    try {
        questions = JSON.parse(cleaned);
    } catch (err) {
        throw new Error("La IA no devolvió un JSON válido. Probá de nuevo.");
    }

    if (!Array.isArray(questions)) {
        throw new Error("La respuesta de la IA no tiene el formato esperado.");
    }

    return questions
        .filter((q) =>
            q.question_text && q.option_a && q.option_b && q.option_c && q.option_d &&
            ["a", "b", "c", "d"].includes(q.correct_option)
        )
        .map((q) => ({
            ...q,
            image_url: includeImages ? (q.image_url || buildImageUrl(q, topic)) : null
        }));
}

module.exports = { generateQuestions };