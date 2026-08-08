
/**
 * Entrypoint da Vercel Serverless Function.
 *
 * A Vercel trata qualquer arquivo em /api que exporte um handler
 * (req, res) => void como uma função serverless — um app Express
 * exportado diretamente serve exatamente esse papel. Nenhum app.listen()
 * é chamado aqui: a plataforma controla o ciclo de vida da requisição.
 *
 * vercel.json reescreve todas as requisições para esta função.
 */
import app from "../src/app.js";

export default app;

