import { sanitizeText } from "./security-service.js";

export function createInviteService(storage) {
  function getInvites(userId) {
    return storage
      .get("playInvites", [])
      .filter((i) => i.proposerId === userId || i.inviteeId === userId)
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
  }

  function addInvite(payload) {
    const invite = {
      id: `inv_${crypto.randomUUID().slice(0, 8)}`,
      proposerId: payload.proposerId,
      inviteeId: payload.inviteeId,
      dateTime: payload.dateTime,
      courtName: sanitizeText(payload.courtName, 60),
      note: sanitizeText(payload.note || "", 150),
      status: "proposed",
      createdAt: Date.now(),
    };
    storage.update("playInvites", [], (list) => [...list, invite]);
    return invite;
  }

  function updateStatus(inviteId, status) {
    const VALID = ["proposed", "accepted", "rejected", "cancelled", "completed"];
    if (!VALID.includes(status)) throw new Error("無效的邀約狀態");
    storage.update("playInvites", [], (list) =>
      list.map((i) => (i.id === inviteId ? { ...i, status } : i))
    );
  }

  return { getInvites, addInvite, updateStatus };
}
