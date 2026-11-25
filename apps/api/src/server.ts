import { buildApp } from "./app.js";

async function start(): Promise<void> {
  const port = Number(process.env.PORT ?? 3333);
  const host = process.env.HOST ?? "0.0.0.0";

  const app = await buildApp({
    logger: process.env.NODE_ENV !== "test",
  });

  try {
    await app.listen({ port, host });
    console.log(`FinFlow API running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
