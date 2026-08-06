import express from "express";
import cors from "cors";
import multer from "multer";
import { quizRouter } from "./routes/quiz.js";

const app = express();
const configuredOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",").map((origin) => origin.trim()).filter(Boolean);

app.use(cors({ origin: configuredOrigins }));
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/quiz", quizRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    const messages: Partial<Record<string, string>> = {
      LIMIT_FILE_SIZE: "O arquivo enviado ultrapassa o limite permitido de 4MB.",
      LIMIT_FILE_COUNT: "Envie apenas um arquivo por vez.",
      LIMIT_FIELD_VALUE: "O texto enviado ultrapassa o limite permitido de 3MB.",
      LIMIT_UNEXPECTED_FILE: "Campo de arquivo inesperado no envio."
    };
    res.status(413).json({ error: messages[err.code] ?? "Falha no upload do arquivo." });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
});

export { app };
