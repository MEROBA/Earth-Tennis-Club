import { createNode, formatDateTime, renderList } from "../ui/dom.js";

export function initChatModule({ memberService, chatService, rateLimiter, chatLimit, notify }) {
  const peerSelect = document.querySelector("#chat-peer-select");
  const openRoomBtn = document.querySelector("#open-chat-room");
  const roomInfo = document.querySelector("#chat-room-info");
  const messagesBox = document.querySelector("#chat-messages");
  const chatForm = document.querySelector("#chat-form");
  const bookingForm = document.querySelector("#booking-form");
  const bookingList = document.querySelector("#booking-list");

  let activeRoomId = null;
  let activePeerId = null;

  function renderPeerSelect() {
    const currentUserId = memberService.getCurrentUserId();
    const members = memberService.getMembers().filter((member) => member.id !== currentUserId);
    peerSelect.innerHTML = "";

    if (!members.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "請先新增其他會員";
      peerSelect.append(option);
      return;
    }

    members.forEach((member) => {
      const option = document.createElement("option");
      option.value = member.id;
      option.textContent = `${member.name} (${member.city})`;
      peerSelect.append(option);
    });

    if (!members.some((member) => member.id === activePeerId)) {
      activePeerId = members[0]?.id || null;
    }
    if (activePeerId) {
      peerSelect.value = activePeerId;
    }
  }

  function renderRoom() {
    const currentUserId = memberService.getCurrentUserId();
    if (!currentUserId || !activePeerId) {
      messagesBox.innerHTML = "";
      bookingList.innerHTML = "";
      roomInfo.textContent = "請先選擇對象。";
      return;
    }

    const room = chatService.getRoom(currentUserId, activePeerId);
    activeRoomId = room.id;

    const peer = memberService.getMembers().find((member) => member.id === activePeerId);
    roomInfo.textContent = `已開啟與 ${peer ? peer.name : "球友"} 的聊天室`;

    const messageNodes = room.messages.map((item) => {
      const node = createNode(
        "article",
        `chat-message${item.senderId === currentUserId ? " is-own" : ""}`,
        item.message
      );
      node.append(createNode("small", null, formatDateTime(item.createdAt)));
      return node;
    });

    renderList(messagesBox, messageNodes);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    const statusLabels = {
      proposed: "待確認",
      accepted: "已接受",
      rejected: "已拒絕",
      cancelled: "已取消",
      completed: "已完成",
    };

    const bookingNodes = room.bookings
      .slice()
      .reverse()
      .map((booking) => {
        const node = createNode("article", "list-item");
        node.append(
          createNode("h4", null, `${formatDateTime(booking.dateTime)}｜${booking.courtName}`),
          createNode("p", null, `狀態: ${statusLabels[booking.status] || booking.status}`),
          createNode("p", "hint", booking.note || "無備註")
        );

        if (booking.status === "proposed") {
          const actions = createNode("div", "actions");
          const accept = createNode("button", "btn-primary", "接受");
          accept.type = "button";
          accept.dataset.bookingId = booking.id;
          accept.dataset.action = "accepted";

          const reject = createNode("button", "btn-secondary", "拒絕");
          reject.type = "button";
          reject.dataset.bookingId = booking.id;
          reject.dataset.action = "rejected";

          actions.append(accept, reject);
          node.append(actions);
        } else if (booking.status === "accepted") {
          const actions = createNode("div", "actions");
          const cancel = createNode("button", "btn-secondary", "取消");
          cancel.type = "button";
          cancel.dataset.bookingId = booking.id;
          cancel.dataset.action = "cancelled";

          const complete = createNode("button", "btn-primary", "完成");
          complete.type = "button";
          complete.dataset.bookingId = booking.id;
          complete.dataset.action = "completed";

          actions.append(cancel, complete);
          node.append(actions);
        }

        return node;
      });

    if (!bookingNodes.length) {
      bookingList.innerHTML = "<p class='hint'>尚無邀約紀錄。</p>";
    } else {
      renderList(bookingList, bookingNodes);
    }
  }

  openRoomBtn.addEventListener("click", () => {
    const currentUserId = memberService.getCurrentUserId();
    if (!currentUserId) {
      notify("請先在會員系統選擇目前使用者");
      return;
    }

    activePeerId = peerSelect.value;
    if (!activePeerId) {
      notify("請先選擇對話對象");
      return;
    }

    renderRoom();
  });

  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!activeRoomId) {
      notify("請先開啟聊天室");
      return;
    }

    const currentUser = memberService.getCurrentUser();
    if (!currentUser) {
      notify("找不到目前使用者");
      return;
    }

    if (!rateLimiter.hit(`chat:${currentUser.id}`, chatLimit, 60_000)) {
      notify("訊息過於頻繁，請稍後再試");
      return;
    }

    const data = Object.fromEntries(new FormData(chatForm).entries());
    chatService.sendMessage(activeRoomId, currentUser.id, data.message);
    chatForm.reset();
    renderRoom();
  });

  bookingList.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-booking-id]");
    if (!btn || !activeRoomId) return;
    try {
      chatService.updateBookingStatus(activeRoomId, btn.dataset.bookingId, btn.dataset.action);
      renderRoom();
      notify("邀約狀態已更新");
    } catch (error) {
      notify(error.message);
    }
  });

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!activeRoomId) {
      notify("請先開啟聊天室");
      return;
    }

    const data = Object.fromEntries(new FormData(bookingForm).entries());
    chatService.addBooking(activeRoomId, data);
    bookingForm.reset();
    renderRoom();
    notify("邀約已送出");
  });

  renderPeerSelect();
  renderRoom();

  return {
    refresh() {
      renderPeerSelect();
      renderRoom();
    },
  };
}
