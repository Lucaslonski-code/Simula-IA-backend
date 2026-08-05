/**
 * Única responsabilidade: receber texto + parâmetros e retornar um simulado
 * estruturado gerado pelo Gemini (API oficial do Google AI Studio).
 *
 * Este módulo é a ÚNICA parte da aplicação que conhece o provedor de IA
 * utilizado. Para trocar de provedor no futuro, apenas este arquivo precisa
 * ser substituído — o restante do backend depende somente da assinatura
 * de `generateQuizFromText`.
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { QuizDifficulty, QuizInternal } from "../types.js";

const MODEL_NAME = "gemini-3.6-flash";

const MIN_CONTENT_LENGTH = 50;
const GEMINI_TIMEOUT_MS = 90_000; // 90s — geração de simulados grandes pode levar algum tempo

class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError("Tempo limite excedido.")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export class GeminiConfigurationError extends Error {}
export class GeminiGenerationError extends Error {}

interface GenerateQuizParams {
  content: string;
  questionCount: number;
  difficulty: QuizDifficulty;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Título objetivo e profissional para o simulado, baseado no tema principal do conteúdo."
    },
    description: {
      type: Type.STRING,
      description: "Resumo em 1 ou 2 frases sobre os tópicos abordados no simulado."
    },
    estimatedTimeMinutes: {
      type: Type.INTEGER,
      description: "Tempo estimado em minutos para resolver o simulado."
    },
    topics: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Lista de 3 a 6 assuntos/tópicos identificados no conteúdo fornecido."
    },
    questions: {
      type: Type.ARRAY,
      description: "Lista de questões de múltipla escolha.",
      items: {
        type: Type.OBJECT,
        properties: {
          question: {
            type: Type.STRING,
            description: "Enunciado claro, contextualizado e direto da questão."
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Array com EXATAMENTE 4 opções de resposta."
          },
          correctAnswer: {
            type: Type.INTEGER,
            description: "Índice de 0 a 3 da alternativa correta no array de opções."
          },
          explanation: {
            type: Type.STRING,
            description: "Explicação pedagógica objetiva do porquê a alternativa está correta."
          },
          topic: {
            type: Type.STRING,
            description: "Tópico ao qual esta questão pertence."
          }
        },
        required: ["question", "options", "correctAnswer", "explanation", "topic"]
      }
    }
  },
  required: ["title", "description", "estimatedTimeMinutes", "topics", "questions"]
};

function buildSystemInstruction(questionCount: number, difficulty: QuizDifficulty): string {
  return `Você é um professor sênior especialista em elaboração de exames, responsável por gerar simulados de alto nível.
Sua missão é criar um simulado com EXATAMENTE ${questionCount} questões de múltipla escolha.

REGRAS RÍGIDAS E INVIOLÁVEIS:
1. Utilize EXCLUSIVAMENTE o conteúdo fornecido pelo usuário. Nunca invente fatos nem utilize conhecimento externo ao material.
2. Cada questão deve ter EXATAMENTE 4 alternativas.
3. Cada questão deve ter apenas UMA alternativa correta.
4. Toda questão deve incluir uma explicação pedagógica objetiva justificando a resposta correta.
5. Crie distratores plausíveis; nunca use opções genéricas como "Nenhuma das anteriores" ou "Todas as alternativas".
6. Identifique os principais tópicos do conteúdo e distribua as questões entre eles.
7. Nível de dificuldade geral solicitado: ${difficulty}.
8. Responda sempre no mesmo idioma do conteúdo fornecido.`;
}

/**
 * Gera um simulado a partir de texto puro, utilizando a API oficial do Gemini.
 * Lança erro caso a chave não esteja configurada ou a geração falhe.
 */
export async function generateQuizFromText({
  content,
  questionCount,
  difficulty
}: GenerateQuizParams): Promise<QuizInternal> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "coloque_sua_chave_aqui") {
    throw new GeminiConfigurationError(
      "A variável de ambiente GEMINI_API_KEY não foi configurada no backend."
    );
  }

  const trimmedContent = content.trim();
  if (trimmedContent.length < MIN_CONTENT_LENGTH) {
    throw new GeminiGenerationError(
      `O conteúdo fornecido é muito curto para gerar um simulado (mínimo de ${MIN_CONTENT_LENGTH} caracteres).`
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Material de estudo:\n\n---\n${trimmedContent}\n---\n\nGere um simulado com ${questionCount} questões de múltipla escolha com base exclusivamente neste material.`
              }
            ]
          }
        ],
        config: {
          systemInstruction: buildSystemInstruction(questionCount, difficulty),
          responseMimeType: "application/json",
          responseSchema
        }
      }),
      GEMINI_TIMEOUT_MS
    );

    const jsonText = response.text;
    if (!jsonText) {
      throw new GeminiGenerationError("A API do Gemini não retornou conteúdo válido.");
    }

    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new GeminiGenerationError("A resposta do Gemini não contém questões válidas.");
    }

    const questions = parsed.questions.map((q: any, index: number) => {
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        throw new GeminiGenerationError(`A questão ${index + 1} não possui exatamente 4 alternativas.`);
      }
      if (
        typeof q.correctAnswer !== "number" ||
        q.correctAnswer < 0 ||
        q.correctAnswer > 3
      ) {
        throw new GeminiGenerationError(`A questão ${index + 1} não possui um índice de resposta correta válido.`);
      }

      return {
        id: `q-${index + 1}`,
        question: String(q.question),
        options: q.options.map((opt: unknown) => String(opt)),
        correctAnswer: q.correctAnswer,
        explanation: String(q.explanation ?? ""),
        topic: String(q.topic ?? "Geral")
      };
    });

    const quiz: QuizInternal = {
      id: `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: String(parsed.title ?? "Simulado Gerado por IA"),
      description: String(parsed.description ?? ""),
      estimatedTimeMinutes: Number(parsed.estimatedTimeMinutes) || Math.max(10, questionCount * 2),
      difficulty,
      topics: Array.isArray(parsed.topics) ? parsed.topics.map(String) : [],
      questions,
      createdAt: Date.now()
    };

    return quiz;
  } catch (err) {
    if (err instanceof GeminiGenerationError || err instanceof GeminiConfigurationError) {
      throw err;
    }
    if (err instanceof TimeoutError) {
      throw new GeminiGenerationError(
        "O Gemini demorou demais para responder. Tente novamente em instantes."
      );
    }
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    throw new GeminiGenerationError(`Falha ao gerar o simulado com o Gemini: ${message}`);
  }
}
