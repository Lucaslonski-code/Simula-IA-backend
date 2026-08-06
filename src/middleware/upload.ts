import multer from "multer";

// O corpo de uma Vercel Function é limitado a 4,5MB. Estes limites deixam
// margem para o multipart e preservam o mesmo comportamento local e publicado.
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_FIELD_BYTES = 3 * 1024 * 1024;

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
]);

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

function hasAcceptedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fieldSize: MAX_TEXT_FIELD_BYTES },
  fileFilter: (_req, file, callback) => {
    if (ACCEPTED_MIME_TYPES.has(file.mimetype) || hasAcceptedExtension(file.originalname)) {
      callback(null, true);
      return;
    }
    callback(new Error("Formato de arquivo não suportado. Envie um PDF, DOCX ou TXT."));
  }
});
