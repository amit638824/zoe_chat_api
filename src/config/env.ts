import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface UserAccessApiConfig {
  url: string;
  apiKey: string;
}

export interface EnvConfig {
  nodeEnv: string;
  port: number;
  db: DatabaseConfig;
  encryptionSecret: string;
  userAccessApi: UserAccessApiConfig;
  uploadBaseUrl: string;
}

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key];
  if (value !== undefined && value !== "") {
    return value.trim();
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Missing required environment variable: ${key}`);
};

const getEnvNumber = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
};

export const env: EnvConfig = {
  nodeEnv: getEnv("NODE_ENV", "development"),
  port: getEnvNumber("PORT", 5000),

  db: {
    host: getEnv("DB_HOST", "s12078.use1.stableserver.net"),
    port: getEnvNumber("DB_PORT", 3306),
    user: getEnv("DB_USER", "root"),
    password: getEnv("DB_PASSWORD", ""),
    database: getEnv("DB_NAME", "techwagger_zoe_chat"),
  },

  encryptionSecret: getEnv(
    "ENCRYPTION_SECRET",
    "fallback-secret-key-32-chars-long"
  ),

  userAccessApi: {
    url: getEnv(
      "USER_ACCESS_API_URL",
      "https://www.zoeblueprint.com/api/user-access.php"
    ),
    apiKey: getEnv("USER_ACCESS_API_KEY", "1234"),
  },

  uploadBaseUrl: getEnv("UPLOAD_BASE_URL", "http://localhost:5000/uploads"),
};

export default env;
