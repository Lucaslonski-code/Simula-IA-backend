/**
 * Responsável por transformar qualquer arquivo enviado pelo usuário
 * (PDF, DOCX ou TXT) em texto puro.
 *
 * O Gemini nunca recebe arquivos diretamente — apenas texto extraído aqui.
 */

import mammoth from "mammoth";

export class UnsupportedFileTypeError extends Error {
  constructor(mimeType: string, fileName: string) {
    super(
      `Tipo de arquivo não suportado: "${fileName}" (${mimeType}). Envie um arquivo PDF, DOCX ou TXT.`
    );
    this.name = "UnsupportedFileTypeError";
  }
}

export class TextExtractionError extends Error {
  constructor(fileName: string) {
    super(
      `Não foi possível ler o conteúdo de "${fileName}". Verifique se o arquivo não está corrompido, vazio ou protegido por senha.`
    );
    this.name = "TextExtractionError";
  }
}

async function extractFromPdf(buffer: Buffer, fileName: string): Promise<string> {
  try {
    // Import dinâmico evita que a lib tente carregar um PDF de teste no import estático.
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text;
  } catch (err) {
    console.error(`Falha ao extrair texto de PDF (${fileName}):`, err);
    throw new TextExtractionError(fileName);
  }
}

async function extractFromDocx(buffer: Buffer, fileName: string): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (err) {
    console.error(`Falha ao extrair texto de DOCX (${fileName}):`, err);
    throw new TextExtractionError(fileName);
  }
}

function extractFromTxt(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

/**
 * Extrai o texto de um arquivo enviado, com base em seu mimetype/extensão.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const lowerName = fileName.toLowerCase();

  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return extractFromPdf(buffer, fileName);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return extractFromDocx(buffer, fileName);
  }

  if (mimeType === "text/plain" || lowerName.endsWith(".txt")) {
    return extractFromTxt(buffer);
  }

  throw new UnsupportedFileTypeError(mimeType, fileName);
}
