import { Router } from "express";
import { z } from "zod";
import argon2 from "argon2";
import { SignJWT, importPKCS8 } from "jose";
import { randomBytes, createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(30),
  city: z.string().max(20),
  gender: z.enum(["female", "male", "non_binary", "prefer_not_to_say"]),
  age: z.number().int().min(10).max(90),
  yearsPlaying: z.number().int().min(0).max(70),
  preferredSurface: z.enum(["hard", "clay", "grass", "synthetic"]),
  availabilityText: z.string().max(80).optional(),
  utr: z.number().min(1).max(16.5).default(1),
  ntrp: z.number().min(1.5).max(7).default(1.5),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72),
});

async function signAccessToken(user) {
  const privateKey = await importPKCS8(config.jwt.privateKeyPem, "ES256");
  return new SignJWT({
    email: user.email,
    role: user.role,
    sid: user.sessionId,
  })
    .setProtectedHeader({ alg: "ES256" })
    .setSubject(user.userId)
    .setIssuer(config.jwt.issuer)
    .setAudience(config.jwt.audience)
    .setIssuedAt()
    .setExpirationTime(`${config.jwt.accessTtlSeconds}s`)
    .sign(privateKey);
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function createRefreshSession(userId, { userAgent, ipAddress }) {
  const token = randomBytes(40).toString("hex");
  const tokenHash = hashToken(token);
  const familyId = uuidv4();
  const expiresAt = new Date(Date.now() + config.jwt.refreshTtlSeconds * 1000);

  await query(
    `INSERT INTO auth_refresh_sessions
       (user_id, session_family_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, familyId, tokenHash, userAgent || null, ipAddress || null, expiresAt]
  );

  return token;
}

function setRefreshCookie(res, token) {
  res.cookie(config.cookie.name, token, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    maxAge: config.jwt.refreshTtlSeconds * 1000,
    path: "/",
  });
}

async function auditLog(userId, eventType, req, details = null) {
  await query(
    `INSERT INTO auth_audit_logs (user_id, event_type, ip_address, user_agent, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId || null, eventType, req.ip || null, req.headers["user-agent"] || null, details ? JSON.stringify(details) : null]
  ).catch(() => {});
}

function buildProfileResponse(user, profile) {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    displayName: profile.display_name,
    city: profile.city,
    gender: profile.gender,
    age: profile.age,
    yearsPlaying: profile.years_playing,
    preferredSurface: profile.preferred_surface,
    availabilityText: profile.availability_text || null,
    utr: Number(profile.utr),
    ntrp: Number(profile.ntrp),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

router.post("/register", async (req, res, next) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const passwordHash = await argon2.hash(data.password, {
      type: argon2.argon2id,
      memoryCost: config.argon2.memoryCost,
      timeCost: config.argon2.timeCost,
      parallelism: config.argon2.parallelism,
    });

    const client = await (await import("../db.js")).pool.connect();
    try {
      await client.query("BEGIN");

      const userRes = await client.query(
        `INSERT INTO app_users (email, password_hash) VALUES (lower($1), $2) RETURNING id, email, role`,
        [data.email, passwordHash]
      );
      const user = userRes.rows[0];

      await client.query(
        `INSERT INTO member_profiles
           (user_id, display_name, city, gender, age, years_playing, preferred_surface, availability_text, utr, ntrp)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [user.id, data.displayName, data.city, data.gender, data.age, data.yearsPlaying,
         data.preferredSurface, data.availabilityText || null, data.utr, data.ntrp]
      );

      await client.query("COMMIT");

      const profileRes = await query(`SELECT * FROM member_profiles WHERE user_id = $1`, [user.id]);
      const profile = profileRes.rows[0];

      const refreshToken = await createRefreshSession(user.id, {
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      });

      const sessionRes = await query(
        `SELECT id FROM auth_refresh_sessions WHERE token_hash = $1`,
        [hashToken(refreshToken)]
      );

      const accessToken = await signAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionRes.rows[0]?.id,
      });

      setRefreshCookie(res, refreshToken);
      await auditLog(user.id, "register", req);

      return res.status(201).json({
        accessToken,
        tokenType: "Bearer",
        expiresIn: config.jwt.accessTtlSeconds,
        user: buildProfileResponse(user, profile),
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.constraint === "uq_app_users_email_lower") {
        return res.status(409).json({ code: "EMAIL_TAKEN", message: "Email already exists", details: null });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;
    const userRes = await query(
      `SELECT u.*, mp.* FROM app_users u
       LEFT JOIN member_profiles mp ON mp.user_id = u.id
       WHERE lower(u.email) = lower($1) AND u.is_active = true`,
      [email]
    );

    const row = userRes.rows[0];
    const valid = row && await argon2.verify(row.password_hash, password).catch(() => false);

    if (!valid) {
      await auditLog(null, "login_fail", req, { email });
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid credentials", details: null });
    }

    const refreshToken = await createRefreshSession(row.id, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });

    const sessionRes = await query(
      `SELECT id FROM auth_refresh_sessions WHERE token_hash = $1`,
      [hashToken(refreshToken)]
    );

    const accessToken = await signAccessToken({
      userId: row.id,
      email: row.email,
      role: row.role,
      sessionId: sessionRes.rows[0]?.id,
    });

    await query(`UPDATE app_users SET last_login_at = now() WHERE id = $1`, [row.id]);
    setRefreshCookie(res, refreshToken);
    await auditLog(row.id, "login_success", req);

    const profile = {
      display_name: row.display_name,
      city: row.city,
      gender: row.gender,
      age: row.age,
      years_playing: row.years_playing,
      preferred_surface: row.preferred_surface,
      availability_text: row.availability_text,
      utr: row.utr,
      ntrp: row.ntrp,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    return res.json({
      accessToken,
      tokenType: "Bearer",
      expiresIn: config.jwt.accessTtlSeconds,
      user: buildProfileResponse({ id: row.id, email: row.email, role: row.role }, profile),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.[config.cookie.name];
    if (!token) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing refresh token", details: null });
    }

    const tokenHash = hashToken(token);
    const sessionRes = await query(
      `SELECT * FROM auth_refresh_sessions WHERE token_hash = $1`,
      [tokenHash]
    );
    const session = sessionRes.rows[0];

    if (!session) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid refresh token", details: null });
    }

    if (session.revoked_at || session.compromised_at) {
      await query(
        `UPDATE auth_refresh_sessions SET compromised_at = now()
         WHERE session_family_id = $1 AND revoked_at IS NULL`,
        [session.session_family_id]
      );
      await auditLog(session.user_id, "refresh_reuse_detected", req);
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Token reuse detected", details: null });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Refresh token expired", details: null });
    }

    await query(`UPDATE auth_refresh_sessions SET rotated_at = now() WHERE id = $1`, [session.id]);

    const newToken = randomBytes(40).toString("hex");
    const newHash = hashToken(newToken);
    const expiresAt = new Date(Date.now() + config.jwt.refreshTtlSeconds * 1000);

    await query(
      `INSERT INTO auth_refresh_sessions
         (user_id, session_family_id, token_hash, user_agent, ip_address, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [session.user_id, session.session_family_id, newHash,
       req.headers["user-agent"] || null, req.ip || null, expiresAt]
    );

    const newSessionRes = await query(`SELECT id FROM auth_refresh_sessions WHERE token_hash = $1`, [newHash]);
    const userRes = await query(`SELECT id, email, role FROM app_users WHERE id = $1`, [session.user_id]);
    const user = userRes.rows[0];

    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: newSessionRes.rows[0]?.id,
    });

    setRefreshCookie(res, newToken);
    await auditLog(user.id, "token_refreshed", req);

    return res.json({
      accessToken,
      tokenType: "Bearer",
      expiresIn: config.jwt.accessTtlSeconds,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const token = req.cookies?.[config.cookie.name];
    if (token) {
      await query(
        `UPDATE auth_refresh_sessions SET revoked_at = now() WHERE token_hash = $1`,
        [hashToken(token)]
      );
    }
    res.clearCookie(config.cookie.name, { path: "/" });
    await auditLog(req.user.userId, "logout", req);
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
