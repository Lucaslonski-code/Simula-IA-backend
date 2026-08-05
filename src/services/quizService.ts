/**
 * Orquestra o fluxo de geração e correção de simulados, isolando as rotas
 * Express de qualquer detalhe sobre o Gemini, extração de texto ou cache.
 */

import { generateQuizFromText } from "./geminiService.js";
import { getQuiz, removeQuiz, saveQuiz } from "./quizCache.js";
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
  saveQuiz(quiz);
  return toPublicQuiz(quiz);
}

export function correctQuiz(
  quizId: string,
  userAnswers: Record<string, number>
): QuizResult {
  const quiz = getQuiz(quizId);
  if (!quiz) {
    throw new QuizNotFoundError(quizId);
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

  // O simulado foi concluído: não há necessidade de mantê-lo em cache
  // (o produto não armazena histórico de simulados).
  removeQuiz(quizId);

  return result;
}
