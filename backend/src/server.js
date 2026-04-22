import app from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";

async function start() {
  try {
    await pool.query("SELECT 1");
    console.log("[db] PostgreSQL connected");
  } catch (err) {
    console.error("[db] Failed to connect:", err.message);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`[server] Earth Tennis Club API running on port ${config.port} (${config.env})`);
  });

  function shutdown() {
    console.log("[server] Shutting down...");
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start();
