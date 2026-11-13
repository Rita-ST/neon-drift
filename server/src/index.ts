import { loadEnv } from "./env.js";
import { startServer } from "./server.js";

loadEnv();
startServer().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
