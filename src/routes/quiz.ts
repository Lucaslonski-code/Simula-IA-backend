import { Router } from "express";
import { upload } from "../middleware/upload.js";
import { extractTextFromFile, UnsupportedFileTypeError, TextExtractionError } from "../services/textExtraction.js";
import {
  createQuiz,
  correctQuiz,
  InvalidQuizSubmissionError,
  QuizNotFoundError,
  QuizTooLargeError,
  QUESTION_COUNT_MIN,
  QUESTION_COUNT_MAX
} from "../services/quizService.js";
import { GeminiConfigurationError, GeminiGenerationError } from "../services/geminiService.js";
import type { QuizDifficulty } from "../types.js";

export const quizRouter = Router();

const VALID_DIFFICULTIES: QuizDifficulty[] = ["facil", "medio", "dificil", "misto"];

function parseQuestionCount(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < QUESTION_COUNT_MIN || value > QUESTION_COUNT_MAX) {
    throw new Error(
      `A quantidade de questões deve ser um número inteiro entre ${QUESTION_COUNT_MIN} e ${QUESTION_COUNT_MAX}.`
    );
  }
  return value;
}

function parseDifficulty(raw: unknown): QuizDifficulty {
  if (typeof raw === "string" && VALID_DIFFICULTIES.includes(raw as QuizDifficulty)) {
    return raw as QuizDifficulty;
  }
  throw new Error("Nível de dificuldade inválido.");
}

/**
 * POST /api/quiz/generate
 * multipart/form-data:
 *   - file: (opcional) arquivo PDF, DOCX ou TXT
 *   - text: (opcional) texto colado diretamente
 *   - questionCount: número entre 10 e 30
 *   - difficulty: 'facil' | 'medio' | 'dificil' | 'misto'
 *
 * Exatamente uma origem de conteúdo (file OU text) deve ser enviada.
 */
quizRouter.post("/generate", upload.single("file"), async (req, res) => {
  try {
    const questionCount = parseQuestionCount(req.body.questionCount);
    const difficulty = parseDifficulty(req.body.difficulty);

    const pastedText = typeof req.body.text === "string" ? req.body.text.trim() : "";
    const file = req.file;

    if ((!file && !pastedText) || (file && pastedText)) {
      return res.status(400).json({
        error: "Envie exatamente um arquivo (PDF, DOCX ou TXT) ou um texto colado para gerar o simulado."
      });
    }

    const extractedText = file
      ? await extractTextFromFile(file.buffer, file.mimetype, file.originalname)
      : pastedText;

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(422).json({
        error: "Não foi possível extrair texto do conteúdo enviado. Verifique se o arquivo não está vazio ou protegido."
      });
    }

    const quiz = await createQuiz({ content: extractedText, questionCount, difficulty });
    return res.json(quiz);
  } catch (err) {
    return handleQuizError(err, res);
  }
});

/**
 * POST /api/quiz/:id/submit
 * body: { answers: Record<questionId, optionIndex>, correctionToken: string }
 *
 * Corrige o simulado usando o gabarito cifrado pelo backend e retorna o
 * resultado final. Nenhuma nova chamada ao Gemini é necessária.
 */
quizRouter.post("/:id/submit", (req, res) => {
  try {
    const { id } = req.params;
    const answers = req.body?.answers;
    const correctionToken = req.body?.correctionToken;

    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ error: "As respostas enviadas são inválidas." });
    }

    const result = correctQuiz(id, answers, correctionToken);
    return res.json(result);
  } catch (err) {
    return handleQuizError(err, res);
  }
});

function handleQuizError(err: unknown, res: import("express").Response) {
  if (err instanceof QuizNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof InvalidQuizSubmissionError) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof QuizTooLargeError) {
    return res.status(422).json({ error: err.message });
  }
  if (err instanceof UnsupportedFileTypeError) {
    return res.status(415).json({ error: err.message });
  }
  if (err instanceof TextExtractionError) {
    return res.status(422).json({ error: err.message });
  }
  if (err instanceof GeminiConfigurationError) {
    console.error("Erro de configuração do Gemini:", err.message);
    return res.status(500).json({
      error: "O servidor não está configurado corretamente para gerar simulados. Contate o administrador."
    });
  }
  if (err instanceof GeminiGenerationError) {
    return res.status(502).json({ error: err.message });
  }
  if (err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }
  console.error("Erro inesperado:", err);
  return res.status(500).json({ error: "Erro interno ao processar a solicitação." });
}
