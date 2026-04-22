import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const CreatePostSchema = z.object({
  title: z.string().min(1).max(70),
  category: z.enum(["strategy", "equipment", "training", "general"]),
  content: z.string().min(1).max(500),
});

const CreateCommentSchema = z.object({
  parentCommentId: z.string().uuid().nullable().optional(),
  content: z.string().min(1).max(220),
});

router.get("/posts", async (req, res, next) => {
  try {
    const category = req.query.category || null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const conditions = ["fp.deleted_at IS NULL"];
    const params = [];
    let i = 1;

    if (category) {
      conditions.push(`fp.category = $${i++}`);
      params.push(category);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const countRes = await query(
      `SELECT count(*) FROM forum_posts fp ${where}`,
      params
    );

    const dataRes = await query(
      `SELECT fp.*, mp.display_name AS author_name
       FROM forum_posts fp
       JOIN member_profiles mp ON mp.user_id = fp.user_id
       ${where}
       ORDER BY fp.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, pageSize, offset]
    );

    return res.json({
      items: dataRes.rows.map((p) => ({
        id: p.id,
        userId: p.user_id,
        authorName: p.author_name,
        title: p.title,
        category: p.category,
        content: p.content,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
      page,
      pageSize,
      total: Number(countRes.rows[0].count),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/posts", requireAuth, async (req, res, next) => {
  try {
    const parsed = CreatePostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() });
    }

    const { title, category, content } = parsed.data;
    const result = await query(
      `INSERT INTO forum_posts (user_id, title, category, content) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.userId, title, category, content]
    );

    const p = result.rows[0];
    const profileRes = await query(
      `SELECT display_name FROM member_profiles WHERE user_id = $1`,
      [req.user.userId]
    );

    return res.status(201).json({
      id: p.id,
      userId: p.user_id,
      authorName: profileRes.rows[0]?.display_name || "Unknown",
      title: p.title,
      category: p.category,
      content: p.content,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/posts/:postId/comments", async (req, res, next) => {
  try {
    const { postId } = req.params;
    const result = await query(
      `SELECT fc.*, mp.display_name AS author_name
       FROM forum_comments fc
       JOIN member_profiles mp ON mp.user_id = fc.user_id
       WHERE fc.post_id = $1 AND fc.deleted_at IS NULL
       ORDER BY fc.created_at ASC`,
      [postId]
    );

    return res.json({
      items: result.rows.map((c) => ({
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        parentCommentId: c.parent_comment_id || null,
        authorName: c.author_name,
        content: c.content,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/posts/:postId/comments", requireAuth, async (req, res, next) => {
  try {
    const { postId } = req.params;

    const postExists = await query(
      `SELECT 1 FROM forum_posts WHERE id = $1 AND deleted_at IS NULL`,
      [postId]
    );
    if (!postExists.rows.length) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Post not found", details: null });
    }

    const parsed = CreateCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() });
    }

    const { parentCommentId, content } = parsed.data;
    const result = await query(
      `INSERT INTO forum_comments (post_id, user_id, parent_comment_id, content)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [postId, req.user.userId, parentCommentId || null, content]
    );

    const c = result.rows[0];
    const profileRes = await query(
      `SELECT display_name FROM member_profiles WHERE user_id = $1`,
      [req.user.userId]
    );

    return res.status(201).json({
      id: c.id,
      postId: c.post_id,
      userId: c.user_id,
      parentCommentId: c.parent_comment_id || null,
      authorName: profileRes.rows[0]?.display_name || "Unknown",
      content: c.content,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
