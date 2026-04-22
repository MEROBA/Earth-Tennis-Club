import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(30).optional(),
  city: z.string().max(20).optional(),
  gender: z.enum(["female", "male", "non_binary", "prefer_not_to_say"]).optional(),
  age: z.number().int().min(10).max(90).optional(),
  yearsPlaying: z.number().int().min(0).max(70).optional(),
  preferredSurface: z.enum(["hard", "clay", "grass", "synthetic"]).optional(),
  availabilityText: z.string().max(80).nullable().optional(),
  utr: z.number().min(1).max(16.5).optional(),
  ntrp: z.number().min(1.5).max(7).optional(),
});

function buildPublicProfile(row) {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    city: row.city,
    age: row.age,
    yearsPlaying: row.years_playing,
    preferredSurface: row.preferred_surface,
    availabilityText: row.availability_text || null,
    utr: Number(row.utr),
    ntrp: Number(row.ntrp),
  };
}

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.role, mp.*
       FROM app_users u
       JOIN member_profiles mp ON mp.user_id = u.id
       WHERE u.id = $1`,
      [req.user.userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Profile not found", details: null });
    }
    const row = result.rows[0];
    return res.json({
      userId: row.id,
      email: row.email,
      role: row.role,
      displayName: row.display_name,
      city: row.city,
      gender: row.gender,
      age: row.age,
      yearsPlaying: row.years_playing,
      preferredSurface: row.preferred_surface,
      availabilityText: row.availability_text || null,
      utr: Number(row.utr),
      ntrp: Number(row.ntrp),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const fields = [];
    const values = [];
    let i = 1;

    const map = {
      displayName: "display_name",
      city: "city",
      gender: "gender",
      age: "age",
      yearsPlaying: "years_playing",
      preferredSurface: "preferred_surface",
      availabilityText: "availability_text",
      utr: "utr",
      ntrp: "ntrp",
    };

    for (const [key, col] of Object.entries(map)) {
      if (key in data) {
        fields.push(`${col} = $${i++}`);
        values.push(data[key]);
      }
    }

    if (!fields.length) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "No fields to update", details: null });
    }

    values.push(req.user.userId);
    const result = await query(
      `UPDATE member_profiles SET ${fields.join(", ")} WHERE user_id = $${i} RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Profile not found", details: null });
    }

    const userRes = await query(`SELECT id, email, role FROM app_users WHERE id = $1`, [req.user.userId]);
    const user = userRes.rows[0];
    const profile = result.rows[0];

    return res.json({
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
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const city = req.query.city || null;
    const minNtrp = req.query.minNtrp ? Number(req.query.minNtrp) : null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const conditions = ["u.is_active = true"];
    const params = [];
    let i = 1;

    if (city) {
      conditions.push(`mp.city = $${i++}`);
      params.push(city);
    }
    if (minNtrp !== null && !Number.isNaN(minNtrp)) {
      conditions.push(`mp.ntrp >= $${i++}`);
      params.push(minNtrp);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await query(
      `SELECT count(*) FROM app_users u JOIN member_profiles mp ON mp.user_id = u.id ${where}`,
      params
    );

    const dataRes = await query(
      `SELECT mp.* FROM app_users u
       JOIN member_profiles mp ON mp.user_id = u.id
       ${where}
       ORDER BY mp.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, pageSize, offset]
    );

    return res.json({
      items: dataRes.rows.map(buildPublicProfile),
      page,
      pageSize,
      total: Number(countRes.rows[0].count),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
