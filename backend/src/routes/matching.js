import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const tokenSet = (text) =>
  new Set(
    String(text || "")
      .toLowerCase()
      .split(/[\s,，、/]+/)
      .filter(Boolean)
  );

function availabilitySimilarity(a, b) {
  const aTokens = tokenSet(a);
  const bTokens = tokenSet(b);
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  aTokens.forEach((t) => { if (bTokens.has(t)) overlap++; });
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function computeScore(current, candidate) {
  const ntrpGap = Math.abs(Number(candidate.ntrp) - Number(current.ntrp));
  const ageGap = Math.abs(Number(candidate.age) - Number(current.age));
  const yearsGap = Math.abs(Number(candidate.years_playing) - Number(current.years_playing));
  const cityScore = candidate.city === current.city ? 30 : 10;
  const levelScore = Math.max(0, 28 - ntrpGap * 10);
  const ageScore = Math.max(0, 18 - ageGap * 1.2);
  const yearsScore = Math.max(0, 12 - yearsGap * 1.5);
  const availScore = availabilitySimilarity(candidate.availability_text, current.availability_text) * 12;
  return Number((cityScore + levelScore + ageScore + yearsScore + availScore).toFixed(1));
}

router.get("/recommendations", requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 8));

    const currentRes = await query(
      `SELECT mp.* FROM member_profiles mp WHERE mp.user_id = $1`,
      [req.user.userId]
    );

    if (!currentRes.rows.length) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Profile not found", details: null });
    }

    const current = currentRes.rows[0];

    const candidatesRes = await query(
      `SELECT u.is_active, mp.*
       FROM app_users u
       JOIN member_profiles mp ON mp.user_id = u.id
       WHERE u.is_active = true AND mp.user_id <> $1`,
      [req.user.userId]
    );

    const scored = candidatesRes.rows
      .map((candidate) => ({
        user: {
          userId: candidate.user_id,
          displayName: candidate.display_name,
          city: candidate.city,
          age: candidate.age,
          yearsPlaying: candidate.years_playing,
          preferredSurface: candidate.preferred_surface,
          availabilityText: candidate.availability_text || null,
          utr: Number(candidate.utr),
          ntrp: Number(candidate.ntrp),
        },
        score: computeScore(current, candidate),
        reason: `地區${candidate.city === current.city ? "相同" : "相近"}、NTRP差 ${Math.abs(Number(candidate.ntrp) - Number(current.ntrp)).toFixed(1)}`,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return res.json({ items: scored });
  } catch (err) {
    next(err);
  }
});

export default router;
