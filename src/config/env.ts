import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || "5000", 10),
  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "techwagger_zoe_chat",
  },
  encryptionSecret:
    process.env.ENCRYPTION_SECRET || "fallback-secret-key-32-chars-long",
  userAccessApi: {
    url:
      process.env.USER_ACCESS_API_URL ||
      "https://www.zoeblueprint.com/api/user-access.php",
    apiKey: process.env.USER_ACCESS_API_KEY || "1234",
  },
  uploadBaseUrl: process.env.UPLOAD_BASE_URL || "http://localhost:5000/uploads",
};
