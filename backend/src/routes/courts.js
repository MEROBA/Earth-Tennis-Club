import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(180),
});

router.get("/", async (req, res, next) => {
  try {
    const city = req.query.city || null;
    const surface = req.query.surface || null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const conditions = [];
    const params = [];
    let i = 1;

    if (city) {
      conditions.push(`c.city = $${i++}`);
      params.push(city);
    }
    if (surface) {
      conditions.push(`c.surface = $${i++}`);
      params.push(surface);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(
      `SELECT count(*) FROM courts c ${where}`,
      params
    );

    const dataRes = await query(
      `SELECT c.*,
         COALESCE(AVG(cr.rating), NULL) AS avg_rating,
         COUNT(cr.id) AS review_count
       FROM courts c
       LEFT JOIN court_reviews cr ON cr.court_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.city, c.name
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, pageSize, offset]
    );

    const items = dataRes.rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      city: r.city,
      district: r.district || null,
      address: r.address,
      lat: Number(r.lat),
      lng: Number(r.lng),
      surface: r.surface,
      courtCount: r.court_count,
      hasLights: r.has_lights,
      feeNote: r.fee_note || null,
      rating: r.avg_rating ? Number(Number(r.avg_rating).toFixed(1)) : null,
      reviewCount: Number(r.review_count),
    }));

    return res.json({ items, page, pageSize, total: Number(countRes.rows[0].count) });
  } catch (err) {
    next(err);
  }
});

router.get("/:courtId/reviews", async (req, res, next) => {
  try {
    const { courtId } = req.params;
    const result = await query(
      `SELECT cr.*, mp.display_name AS author_name
       FROM court_reviews cr
       JOIN member_profiles mp ON mp.user_id = cr.user_id
       WHERE cr.court_id = $1
       ORDER BY cr.created_at DESC`,
      [courtId]
    );

    return res.json({
      items: result.rows.map((r) => ({
        id: r.id,
        courtId: r.court_id,
        userId: r.user_id,
        authorName: r.author_name,
        rating: r.rating,
        comment: r.comment_text,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:courtId/reviews", requireAuth, async (req, res, next) => {
  try {
    const { courtId } = req.params;
    const parsed = ReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() });
    }

    const { rating, comment } = parsed.data;

    const result = await query(
      `INSERT INTO court_reviews (court_id, user_id, rating, comment_text)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (court_id, user_id) DO UPDATE
         SET rating = EXCLUDED.rating,
             comment_text = EXCLUDED.comment_text,
             updated_at = now()
       RETURNING *`,
      [courtId, req.user.userId, rating, comment]
    );

    const r = result.rows[0];
    const profileRes = await query(
      `SELECT display_name FROM member_profiles WHERE user_id = $1`,
      [req.user.userId]
    );

    return res.status(201).json({
      id: r.id,
      courtId: r.court_id,
      userId: r.user_id,
      authorName: profileRes.rows[0]?.display_name || "Unknown",
      rating: r.rating,
      comment: r.comment_text,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
