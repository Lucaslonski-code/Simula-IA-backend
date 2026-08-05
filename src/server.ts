import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { quizRouter } from "./routes/quiz.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "2mb" })); // payloads JSON (ex: respostas do simulado)

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/quiz", quizRouter);

// Tratamento de erros do multer (ex: arquivo acima do limite permitido)
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    const messages: Partial<Record<string, string>> = {
      LIMIT_FILE_SIZE: "O arquivo enviado ultrapassa o limite permitido de 25MB.",
      LIMIT_FILE_COUNT: "Envie apenas um arquivo por vez.",
      LIMIT_UNEXPECTED_FILE: "Campo de arquivo inesperado no envio."
    };
    res.status(413).json({
      error: messages[err.code] ?? `Falha no upload do arquivo: ${err.message}`
    });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Simula-IA backend rodando em http://localhost:${PORT}`);
});
