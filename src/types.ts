/**
 * Tipos internos do backend.
 *
 * `QuizQuestionInternal` contém a resposta correta e a explicação — esses
 * dados NUNCA são enviados ao frontend antes da correção. O backend é o
 * único responsável por conhecer o gabarito enquanto o simulado está em
 * andamento.
 */

export type QuizDifficulty = "facil" | "medio" | "dificil" | "misto";

export interface QuizQuestionInternal {
  id: string;
  question: string;
  options: string[]; // sempre 4 alternativas
  correctAnswer: number; // índice 0-3
  explanation: string;
  topic: string;
}

export interface QuizInternal {
  id: string;
  title: string;
  description: string;
  estimatedTimeMinutes: number;
  difficulty: QuizDifficulty;
  topics: string[];
  questions: QuizQuestionInternal[];
  createdAt: number;
}

/** Versão do simulado enviada ao frontend antes da correção (sem gabarito). */
export interface QuizPublic {
  id: string;
  title: string;
  description: string;
  estimatedTimeMinutes: number;
  difficulty: QuizDifficulty;
  topics: string[];
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    topic: string;
  }>;
}

export interface GenerateQuizRequestBody {
  text?: string;
  questionCount: number;
  difficulty: QuizDifficulty;
}

export interface QuestionResult {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  userAnswer: number | null;
  isCorrect: boolean;
  topic: string;
}

export interface QuizResult {
  quizId: string;
  quizTitle: string;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  scorePercentage: number;
  questions: QuestionResult[];
}
