/**
 * Orquestra o fluxo de geração e correção de simulados, isolando as rotas
 * Express de qualquer detalhe sobre o Gemini, extração de texto ou cache.
 */

import { generateQuizFromText } from "./geminiService.js";
import { createQuizToken, readQuizToken, QuizTokenError, QuizTokenTooLargeError } from "./quizToken.js";
import type {
  QuizDifficulty,
  QuizInternal,
  QuizPublic,
  QuizResult
} from "../types.js";

export class QuizNotFoundError extends Error {
  constructor(id: string) {
    super(`Simulado não encontrado ou expirado: ${id}`);
    this.name = "QuizNotFoundError";
  }
}

export class InvalidQuizSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQuizSubmissionError";
  }
}

export class QuizTooLargeError extends Error {
  constructor() {
    super("O simulado gerado é grande demais para ser corrigido com segurança. Tente gerar menos questões ou outro material.");
    this.name = "QuizTooLargeError";
  }
}

export const QUESTION_COUNT_MIN = 10;
export const QUESTION_COUNT_MAX = 30;

function toPublicQuiz(quiz: QuizInternal): QuizPublic {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    estimatedTimeMinutes: quiz.estimatedTimeMinutes,
    difficulty: quiz.difficulty,
    topics: quiz.topics,
    correctionToken: createQuizToken(quiz),
    questions: quiz.questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      topic: q.topic
    }))
  };
}

export async function createQuiz(params: {
  content: string;
  questionCount: number;
  difficulty: QuizDifficulty;
}): Promise<QuizPublic> {
  const quiz = await generateQuizFromText(params);
  try {
    return toPublicQuiz(quiz);
  } catch (error) {
    if (error instanceof QuizTokenTooLargeError) throw new QuizTooLargeError();
    throw error;
  }
}

export function correctQuiz(
  quizId: string,
  userAnswers: Record<string, number>,
  correctionToken: unknown
): QuizResult {
  let quiz: QuizInternal;
  try {
    quiz = readQuizToken(correctionToken);
  } catch (error) {
    if (error instanceof QuizTokenError) throw new QuizNotFoundError(error.message);
    throw error;
  }
  if (quiz.id !== quizId) {
    throw new QuizNotFoundError(quizId);
  }

  const expectedIds = new Set(quiz.questions.map((question) => question.id));
  if (Object.keys(userAnswers).length !== quiz.questions.length) {
    throw new InvalidQuizSubmissionError("Responda todas as questões antes de finalizar o simulado.");
  }
  for (const [questionId, answer] of Object.entries(userAnswers)) {
    if (!expectedIds.has(questionId) || !Number.isInteger(answer) || answer < 0 || answer > 3) {
      throw new InvalidQuizSubmissionError("As respostas enviadas são inválidas.");
    }
  }

  let correctCount = 0;

  const questions = quiz.questions.map((q) => {
    const userAnswer = userAnswers?.[q.id];
    const hasAnswer = typeof userAnswer === "number";
    const isCorrect = hasAnswer && userAnswer === q.correctAnswer;
    if (isCorrect) correctCount += 1;

    return {
      id: q.id,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      userAnswer: hasAnswer ? userAnswer : null,
      isCorrect,
      topic: q.topic
    };
  });

  const totalQuestions = quiz.questions.length;

  const result: QuizResult = {
    quizId: quiz.id,
    quizTitle: quiz.title,
    totalQuestions,
    correctCount,
    incorrectCount: totalQuestions - correctCount,
    scorePercentage: Math.round((correctCount / totalQuestions) * 100),
    questions
  };

  return result;
}
