import "dotenv/config";

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  db: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/earth_tennis_club",
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  jwt: {
    issuer: process.env.JWT_ISSUER || "earth-tennis-club",
    audience: process.env.JWT_AUDIENCE || "earth-tennis-club-web",
    accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS) || 900,
    refreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS) || 2592000,
    privateKeyPem: process.env.JWT_PRIVATE_KEY_PEM || "",
    publicKeyPem: process.env.JWT_PUBLIC_KEY_PEM || "",
  },
  cookie: {
    name: process.env.REFRESH_COOKIE_NAME || "etc_refresh",
    domain: process.env.COOKIE_DOMAIN || "localhost",
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: process.env.COOKIE_SAMESITE || "strict",
  },
  argon2: {
    memoryCost: Number(process.env.ARGON2_MEMORY_KB) || 19456,
    timeCost: Number(process.env.ARGON2_TIME_COST) || 2,
    parallelism: Number(process.env.ARGON2_PARALLELISM) || 1,
  },
  rateLimit: {
    perMinute: Number(process.env.RATE_LIMIT_PER_MINUTE) || 120,
  },
};
