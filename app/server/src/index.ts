/**
 * IMPORTANT:
 * ---------
 * Do not manually edit this file if you'd like to host your server on Colyseus Cloud
 *
 * If you're self-hosting, you can see "Raw usage" from the documentation.
 *
 * See: https://docs.colyseus.io/server
 */
import { listen } from "@colyseus/tools";

// Load .env before anything reads configuration.
import { jwtSecret } from "./auth/config.js";
import { connectDatabase } from "./db.js";

// Import Colyseus config
import app from "./app.config.js";

async function main(): Promise<void> {
  const mongoUri = process.env.MONGO_URI?.trim();
  const jwt = process.env.JWT_SECRET?.trim();

  if (mongoUri && jwt) {
    try {
      jwtSecret();
      await connectDatabase();
    } catch (error) {
      console.warn(
        "⚠️  MongoDB connection failed. Continuing in guest mode without account persistence:",
        error,
      );
    }
  } else {
    console.warn(
      "ℹ️  MONGO_URI or JWT_SECRET not configured. Server starting in guest mode.",
    );
  }

  // Create and listen on 2567 (or PORT environment variable.)
  listen(app);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
