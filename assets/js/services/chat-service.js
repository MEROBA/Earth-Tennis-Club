import { assertRequired, sanitizeText } from "./security-service.js";

const roomId = (a, b) => [a, b].sort().join("__");

function getRooms(storage) {
  return storage.get("chatRooms", {});
}

function setRooms(storage, rooms) {
  storage.set("chatRooms", rooms);
}

export function createChatService(storage) {
  function ensureRoom(memberA, memberB) {
    assertRequired({ memberA, memberB }, ["memberA", "memberB"]);
    const rooms = getRooms(storage);
    const id = roomId(memberA, memberB);
    if (!rooms[id]) {
      rooms[id] = {
        id,
        participants: [memberA, memberB],
        messages: [],
        bookings: [],
      };
      setRooms(storage, rooms);
    }
    return rooms[id];
  }

  function getRoom(memberA, memberB) {
    return ensureRoom(memberA, memberB);
  }

  function sendMessage(room, senderId, message) {
    const rooms = getRooms(storage);
    if (!rooms[room]) {
      throw new Error("聊天室不存在");
    }

    const payload = {
      id: `msg_${crypto.randomUUID().slice(0, 8)}`,
      senderId,
      message: sanitizeText(message, 200),
      createdAt: Date.now(),
    };

    rooms[room].messages.push(payload);
    setRooms(storage, rooms);
    return payload;
  }

  function addBooking(room, payload) {
    const rooms = getRooms(storage);
    if (!rooms[room]) {
      throw new Error("聊天室不存在");
    }

    const booking = {
      id: `book_${crypto.randomUUID().slice(0, 8)}`,
      dateTime: payload.dateTime,
      courtName: sanitizeText(payload.courtName, 60),
      note: sanitizeText(payload.note || "", 150),
      createdAt: Date.now(),
      status: "proposed",
    };
    rooms[room].bookings.push(booking);
    setRooms(storage, rooms);
    return booking;
  }

  function updateBookingStatus(roomId, bookingId, status) {
    const VALID = ["proposed", "accepted", "rejected", "cancelled", "completed"];
    if (!VALID.includes(status)) {
      throw new Error("無效的邀約狀態");
    }
    const rooms = getRooms(storage);
    if (!rooms[roomId]) {
      throw new Error("聊天室不存在");
    }
    const booking = rooms[roomId].bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error("找不到邀約紀錄");
    }
    booking.status = status;
    setRooms(storage, rooms);
    return booking;
  }

  return {
    getRoom,
    sendMessage,
    addBooking,
    updateBookingStatus,
  };
}
