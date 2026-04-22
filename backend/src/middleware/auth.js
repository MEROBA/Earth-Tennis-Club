import { createRemoteJWKSet, jwtVerify, importSPKI } from "jose";
import { config } from "../config.js";

let publicKey;

async function getPublicKey() {
  if (!publicKey && config.jwt.publicKeyPem) {
    publicKey = await importSPKI(config.jwt.publicKeyPem, "ES256");
  }
  return publicKey;
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing access token" });
  }

  const token = header.slice(7);

  try {
    const key = await getPublicKey();
    if (!key) {
      return res.status(500).json({ code: "INTERNAL_ERROR", message: "JWT key not configured" });
    }

    const { payload } = await jwtVerify(token, key, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    req.user = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sid,
    };

    next();
  } catch {
    return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid or expired access token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Insufficient permissions" });
    }
    next();
  };
}
