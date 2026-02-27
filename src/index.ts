import { app } from "./app.js";
import { config } from "./config.js";

app.listen({ port: config.port, hostname: config.host });

console.log(`Relay listening on http://${config.host}:${config.port}`);
console.log(`OpenAPI docs at http://localhost:${config.port}/openapi`);
