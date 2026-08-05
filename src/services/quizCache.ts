/**
 * Cache em memória, temporário, usado exclusivamente para permitir a
 * correção do simulado após o envio das respostas pelo usuário.
 *
 * Isto NÃO é um histórico nem um banco de questões: cada simulado é
 * removido do cache assim que é corrigido, e entradas não utilizadas
 * expiram automaticamente. Nada aqui é exposto ao usuário como recurso
 * de navegação — é apenas o estado necessário para o backend saber
 * o gabarito no momento da correção.
 */

import type { QuizInternal } from "../types.js";

const TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

const store = new Map<string, QuizInternal>();

export function saveQuiz(quiz: QuizInternal): void {
  store.set(quiz.id, quiz);
}

export function getQuiz(id: string): QuizInternal | undefined {
  return store.get(id);
}

export function removeQuiz(id: string): void {
  store.delete(id);
}

function cleanupExpiredQuizzes(): void {
  const now = Date.now();
  for (const [id, quiz] of store) {
    if (now - quiz.createdAt > TTL_MS) {
      store.delete(id);
    }
  }
}

setInterval(cleanupExpiredQuizzes, 15 * 60 * 1000).unref();
