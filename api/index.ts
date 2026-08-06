import { app } from "../src/app.ts";

// Entry point da Vercel Function. O Express é exportado sem chamar listen(),
// pois o runtime da Vercel gerencia o servidor HTTP.
export const config = { maxDuration: 90 };

export default app;
