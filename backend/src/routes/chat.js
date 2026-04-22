import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const CreateInviteSchema = z.object({
  inviteeUserId: z.string().uuid(),
  courtId: z.string().uuid().nullable().optional(),
  courtName: z.string().min(1).max(120),
  dateTime: z.string().datetime(),
  note: z.string().max(200).optional(),
});

async function assertRoomParticipant(roomId, userId) {
  const result = await query(
    `SELECT 1 FROM chat_room_participants WHERE room_id = $1 AND user_id = $2`,
    [roomId, userId]
  );
  return result.rows.length > 0;
}

router.get("/rooms", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT cr.*, crp.joined_at,
         (SELECT created_at FROM chat_messages WHERE room_id = cr.id ORDER BY created_at DESC LIMIT 1) AS last_message_at
       FROM chat_rooms cr
       JOIN chat_room_participants crp ON crp.room_id = cr.id
       WHERE crp.user_id = $1
       ORDER BY last_message_at DESC NULLS LAST`,
      [req.user.userId]
    );

    const rooms = await Promise.all(
      result.rows.map(async (room) => {
        const participantsRes = await query(
          `SELECT mp.*, u.id AS uid FROM chat_room_participants crp
           JOIN app_users u ON u.id = crp.user_id
           JOIN member_profiles mp ON mp.user_id = u.id
           WHERE crp.room_id = $1`,
          [room.id]
        );
        return {
          id: room.id,
          type: room.type,
          participants: participantsRes.rows.map((p) => ({
            userId: p.uid,
            displayName: p.display_name,
            city: p.city,
            age: p.age,
            yearsPlaying: p.years_playing,
            preferredSurface: p.preferred_surface,
            availabilityText: p.availability_text || null,
            utr: Number(p.utr),
            ntrp: Number(p.ntrp),
          })),
          lastMessageAt: room.last_message_at || null,
          createdAt: room.created_at,
        };
      })
    );

    return res.json({ items: rooms });
  } catch (err) {
    next(err);
  }
});

router.post("/rooms", requireAuth, async (req, res, next) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId || typeof targetUserId !== "string") {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "targetUserId required", details: null });
    }
    if (targetUserId === req.user.userId) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Cannot create room with yourself", details: null });
    }

    const existing = await query(
      `SELECT cr.id FROM chat_rooms cr
       JOIN chat_room_participants a ON a.room_id = cr.id AND a.user_id = $1
       JOIN chat_room_participants b ON b.room_id = cr.id AND b.user_id = $2
       WHERE cr.type = 'direct'`,
      [req.user.userId, targetUserId]
    );
    if (existing.rows.length) {
      return res.status(201).json({ id: existing.rows[0].id });
    }

    const roomRes = await query(
      `INSERT INTO chat_rooms (type, created_by_user_id) VALUES ('direct', $1) RETURNING id, type, created_at`,
      [req.user.userId]
    );
    const room = roomRes.rows[0];

    await query(
      `INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1,$2),($1,$3)`,
      [room.id, req.user.userId, targetUserId]
    );

    return res.status(201).json({ id: room.id, type: room.type, participants: [], lastMessageAt: null, createdAt: room.created_at });
  } catch (err) {
    next(err);
  }
});

router.get("/rooms/:roomId/messages", requireAuth, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const allowed = await assertRoomParticipant(roomId, req.user.userId);
    if (!allowed) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Not a room participant", details: null });
    }

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const cursor = req.query.cursor ? new Date(req.query.cursor) : null;

    const params = [roomId];
    let cursorClause = "";
    if (cursor && !Number.isNaN(cursor.getTime())) {
      cursorClause = `AND created_at < $${params.length + 1}`;
      params.push(cursor);
    }

    const result = await query(
      `SELECT * FROM chat_messages
       WHERE room_id = $1 AND deleted_at IS NULL ${cursorClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );

    const items = result.rows.reverse().map((m) => ({
      id: m.id,
      roomId: m.room_id,
      senderUserId: m.sender_user_id,
      message: m.message_text,
      createdAt: m.created_at,
    }));

    const nextCursor = items.length === limit ? items[0]?.createdAt || null : null;
    return res.json({ items, nextCursor });
  } catch (err) {
    next(err);
  }
});

router.post("/rooms/:roomId/messages", requireAuth, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const allowed = await assertRoomParticipant(roomId, req.user.userId);
    if (!allowed) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Not a room participant", details: null });
    }

    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "message required", details: null });
    }
    if (message.length > 500) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "message too long", details: null });
    }

    const result = await query(
      `INSERT INTO chat_messages (room_id, sender_user_id, message_text) VALUES ($1,$2,$3) RETURNING *`,
      [roomId, req.user.userId, message.trim()]
    );
    const m = result.rows[0];
    return res.status(201).json({
      id: m.id,
      roomId: m.room_id,
      senderUserId: m.sender_user_id,
      message: m.message_text,
      createdAt: m.created_at,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/rooms/:roomId/invites", requireAuth, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const allowed = await assertRoomParticipant(roomId, req.user.userId);
    if (!allowed) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Not a room participant", details: null });
    }

    const result = await query(
      `SELECT * FROM play_invites WHERE room_id = $1 ORDER BY created_at DESC`,
      [roomId]
    );

    return res.json({
      items: result.rows.map((i) => ({
        id: i.id,
        roomId: i.room_id,
        proposerUserId: i.proposer_user_id,
        inviteeUserId: i.invitee_user_id,
        courtId: i.court_id || null,
        courtName: i.court_name,
        dateTime: i.scheduled_at,
        note: i.note || null,
        status: i.status,
        createdAt: i.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/rooms/:roomId/invites", requireAuth, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const allowed = await assertRoomParticipant(roomId, req.user.userId);
    if (!allowed) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Not a room participant", details: null });
    }

    const parsed = CreateInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const result = await query(
      `INSERT INTO play_invites
         (room_id, proposer_user_id, invitee_user_id, court_id, court_name, scheduled_at, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [roomId, req.user.userId, data.inviteeUserId, data.courtId || null,
       data.courtName, data.dateTime, data.note || null]
    );

    const i = result.rows[0];
    return res.status(201).json({
      id: i.id,
      roomId: i.room_id,
      proposerUserId: i.proposer_user_id,
      inviteeUserId: i.invitee_user_id,
      courtId: i.court_id || null,
      courtName: i.court_name,
      dateTime: i.scheduled_at,
      note: i.note || null,
      status: i.status,
      createdAt: i.created_at,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
