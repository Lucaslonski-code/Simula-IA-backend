/**
 * Estado temporário e opaco do simulado para execução serverless.
 * O navegador recebe apenas um valor cifrado que não consegue interpretar.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { QuizInternal } from "../types.js";

const TOKEN_VERSION = 1;
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const IV_BYTES = 12;
// O endpoint JSON do Express aceita 1 MB; este teto deixa ampla margem para
// o envelope da requisição e impede que um token exceda o payload da Function.
const MAX_TOKEN_LENGTH = 750_000;
const MAX_PAYLOAD_BYTES = 500_000;

export class QuizTokenError extends Error {
  constructor(message = "A sessão deste simulado expirou ou é inválida. Gere um novo simulado.") {
    super(message);
    this.name = "QuizTokenError";
  }
}

export class QuizTokenTooLargeError extends Error {
  constructor() {
    super("O simulado gerado é grande demais para ser corrigido com segurança. Tente gerar menos questões ou outro material.");
    this.name = "QuizTokenTooLargeError";
  }
}

interface TokenPayload {
  version: number;
  expiresAt: number;
  quiz: QuizInternal;
}

function getEncryptionKey(): Buffer {
  const secret = process.env.GEMINI_API_KEY;
  if (!secret || secret === "coloque_sua_chave_aqui") {
    throw new QuizTokenError("O servidor não está configurado para processar o simulado.");
  }
  return createHash("sha256").update(secret).digest();
}

function toBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function createQuizToken(quiz: QuizInternal): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const payload: TokenPayload = { version: TOKEN_VERSION, expiresAt: Date.now() + TOKEN_TTL_MS, quiz };
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, "utf8") > MAX_PAYLOAD_BYTES) {
    throw new QuizTokenTooLargeError();
  }
  const encrypted = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
  const token = [toBase64Url(iv), toBase64Url(cipher.getAuthTag()), toBase64Url(encrypted)].join(".");
  if (token.length > MAX_TOKEN_LENGTH) throw new QuizTokenTooLargeError();
  return token;
}

export function readQuizToken(token: unknown): QuizInternal {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    throw new QuizTokenError();
  }
  const parts = token.split(".");
  if (parts.length !== 3) throw new QuizTokenError();

  try {
    const [iv, tag, encrypted] = parts.map(fromBase64Url);
    if (iv.length !== IV_BYTES || tag.length !== 16 || encrypted.length === 0) throw new QuizTokenError();
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const payload = JSON.parse(plaintext.toString("utf8")) as TokenPayload;
    if (
      payload.version !== TOKEN_VERSION ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt < Date.now() ||
      !payload.quiz || typeof payload.quiz.id !== "string" || !Array.isArray(payload.quiz.questions)
    ) throw new QuizTokenError();
    return payload.quiz;
  } catch (error) {
    if (error instanceof QuizTokenError) throw error;
    throw new QuizTokenError();
  }
}
