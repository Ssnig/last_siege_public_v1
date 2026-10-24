import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI?.trim();

if (!uri) {
  console.error("MONGO_URI is not set.");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });

try {
  await client.connect();
  await client.db().command({ ping: 1 });
  console.log("MongoDB ping succeeded.");
} catch (error) {
  console.error("MongoDB ping failed:", error);
  process.exitCode = 1;
} finally {
  await client.close();
}
