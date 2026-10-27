import mongoose from "mongoose";

/** Connects to MongoDB using `MONGO_URI`. Safe to call more than once. */
export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGO_URI?.trim();
  if (!uri) {
    throw new Error("Missing required environment variable: MONGO_URI");
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5_000,
    maxPoolSize: 200,
    minPoolSize: 10,
    socketTimeoutMS: 45_000,
  });
  console.log(`Connected to MongoDB database "${mongoose.connection.name}".`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
