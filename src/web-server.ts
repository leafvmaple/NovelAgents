import "dotenv/config";
import { loadConfig } from "./config.js";
import { buildWebApp } from "./web-app.js";

const config = loadConfig();
const app = buildWebApp(config);

app
  .listen({ host: config.webHost, port: config.webPort })
  .then((address) => console.log(`NovelAgents Web: ${address}`))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
