import { createNode, formatDateTime, renderList } from "../ui/dom.js";
import { buildPlayerCard } from "./members-module.js";

const STATUS_LABELS = {
  proposed: "待確認",
  accepted: "已接受",
  rejected: "已拒絕",
  cancelled: "已取消",
  completed: "已完成",
};

const PLAY_STYLE_LABELS = {
  baseline: "底線型",
  serve_volley: "上網型",
  all_court: "全場型",
  defensive: "防守型",
  aggressive: "進攻型",
};

export function initInviteModule({ memberService, inviteService, buddyService, matchRecordService, rateLimiter, inviteLimit, notify }) {
  const targetSelect    = document.querySelector("#invite-target-select");
  const targetCardWrap  = document.querySelector("#invite-target-card");
  const form            = document.querySelector("#invite-form");
  const list            = document.querySelector("#invite-list");

  // Buddy list elements
  const addBuddyBtn     = document.querySelector("#add-buddy-btn");
  const addBuddyPanel   = document.querySelector("#add-buddy-panel");
  const buddyAddSelect  = document.querySelector("#buddy-add-select");
  const confirmAddBtn   = document.querySelector("#confirm-add-buddy");
  const cancelAddBtn    = document.querySelector("#cancel-add-buddy");
  const buddyListEl     = document.querySelector("#buddy-list");

  /* ── Buddy list ── */

  function fillAddSelect() {
    if (!buddyAddSelect || !buddyService) return;
    const currentId = memberService.getCurrentUserId();
    const buddies = buddyService.getBuddies(currentId);
    const buddyIds = new Set(buddies.map((b) => b.buddyMemberId));
    const available = memberService.getMembers().filter((m) => m.id !== currentId && !buddyIds.has(m.id));
    buddyAddSelect.innerHTML = "";
    if (!available.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "所有球員已加入球友清單";
      buddyAddSelect.append(opt);
      return;
    }
    available.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.name} (${m.city} · NTRP ${Number(m.ntrp).toFixed(1)})`;
      buddyAddSelect.append(opt);
    });
  }

  function renderBuddyList() {
    if (!buddyListEl || !buddyService) return;
    const currentUser = memberService.getCurrentUser();
    if (!currentUser) {
      buddyListEl.innerHTML = "<p class='hint'>請先選擇目前使用者。</p>";
      return;
    }
    const buddies = buddyService.getBuddies(currentUser.id);
    if (!buddies.length) {
      buddyListEl.innerHTML =
        "<p class='hint' style='text-align:center;padding:1.2rem 0;'>尚未新增任何球友。點擊「+ 新增球友」開始建立你的球友清單！</p>";
      return;
    }

    const members = memberService.getMembers();
    const nodes = buddies.map((buddy) => {
      const member = members.find((m) => m.id === buddy.buddyMemberId);
      if (!member) return null;

      // Compute match stats against this buddy
      const allRecords = matchRecordService
        ? matchRecordService.getRecordsForMember(currentUser.id).filter((r) =>
            r.player1Id === buddy.buddyMemberId || r.player2Id === buddy.buddyMemberId
          )
        : [];
      const completed = allRecords.filter((r) => r.status === "completed");
      const wins = completed.filter((r) => {
        const isP1 = r.player1Id === currentUser.id;
        return r.winner === (isP1 ? "p1" : "p2");
      }).length;
      const losses = completed.filter((r) => {
        const isP1 = r.player1Id === currentUser.id;
        return r.winner === (isP1 ? "p2" : "p1");
      }).length;

      const card = document.createElement("div");
      card.className = "buddy-card";

      // Avatar
      const avatarEl = document.createElement("div");
      avatarEl.className = "buddy-card__avatar";
      if (member.photo) {
        const img = document.createElement("img");
        img.src = member.photo;
        img.alt = member.name;
        avatarEl.append(img);
      } else {
        avatarEl.textContent = member.name.charAt(0).toUpperCase();
      }

      // Info section
      const infoEl = document.createElement("div");
      infoEl.className = "buddy-card__info";

      const nameRow = document.createElement("div");
      nameRow.className = "buddy-card__name-row";
      const nameSpan = document.createElement("span");
      nameSpan.className = "buddy-card__name";
      nameSpan.textContent = member.name;
      const ntrpBadge = document.createElement("span");
      ntrpBadge.className = "player-card__ntrp";
      ntrpBadge.textContent = `NTRP ${Number(member.ntrp).toFixed(1)}`;
      nameRow.append(nameSpan, ntrpBadge);

      const metaDiv = document.createElement("div");
      metaDiv.className = "buddy-card__meta";
      metaDiv.textContent = `📍 ${member.city}　${PLAY_STYLE_LABELS[member.playStyle] || member.playStyle}`;

      const statsDiv = document.createElement("div");
      statsDiv.className = "buddy-stats";

      const totalSpan = document.createElement("span");
      totalSpan.className = "buddy-stat";
      totalSpan.textContent = `${completed.length} 場`;

      const winSpan = document.createElement("span");
      winSpan.className = "buddy-stat buddy-stat--win";
      winSpan.textContent = `${wins} 勝`;

      const lossSpan = document.createElement("span");
      lossSpan.className = "buddy-stat buddy-stat--loss";
      lossSpan.textContent = `${losses} 負`;

      statsDiv.append(totalSpan, winSpan, lossSpan);
      infoEl.append(nameRow, metaDiv, statsDiv);

      // Action buttons
      const actionsEl = document.createElement("div");
      actionsEl.className = "buddy-card__actions";

      const scheduleBtn = document.createElement("button");
      scheduleBtn.className = "btn-primary";
      scheduleBtn.type = "button";
      scheduleBtn.textContent = "約打球";
      scheduleBtn.addEventListener("click", () => {
        document.querySelector("#invite-create-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
        prefillTarget(member);
        notify(`已選擇 ${member.name} 為約球對象`);
      });

      const removeBtn = document.createElement("button");
      removeBtn.className = "btn-secondary";
      removeBtn.type = "button";
      removeBtn.textContent = "移除";
      removeBtn.addEventListener("click", () => {
        buddyService.removeBuddy(currentUser.id, buddy.buddyMemberId);
        renderBuddyList();
        fillAddSelect();
        notify(`已將 ${member.name} 從球友清單移除`);
      });

      actionsEl.append(scheduleBtn, removeBtn);
      card.append(avatarEl, infoEl, actionsEl);
      return card;
    }).filter(Boolean);

    buddyListEl.innerHTML = "";
    nodes.forEach((n) => buddyListEl.append(n));
  }

  // Add buddy panel toggle
  addBuddyBtn?.addEventListener("click", () => {
    const hidden = addBuddyPanel.style.display === "none" || !addBuddyPanel.style.display;
    addBuddyPanel.style.display = hidden ? "block" : "none";
    if (hidden) fillAddSelect();
  });

  cancelAddBtn?.addEventListener("click", () => {
    if (addBuddyPanel) addBuddyPanel.style.display = "none";
  });

  confirmAddBtn?.addEventListener("click", () => {
    const currentUser = memberService.getCurrentUser();
    if (!currentUser || !buddyService) return;
    const selectedId = buddyAddSelect?.value;
    if (!selectedId) { notify("沒有可加入的球員"); return; }
    const result = buddyService.addBuddy(currentUser.id, selectedId);
    if (!result) { notify("此球員已在球友清單中"); return; }
    const member = memberService.getMembers().find((m) => m.id === selectedId);
    notify(`已將 ${member?.name ?? selectedId} 加入球友清單！`);
    if (addBuddyPanel) addBuddyPanel.style.display = "none";
    renderBuddyList();
    fillAddSelect();
  });

  /* ── Invite form ── */

  function fillTargetSelect() {
    const currentId = memberService.getCurrentUserId();
    const members = memberService.getMembers().filter((m) => m.id !== currentId);
    targetSelect.innerHTML = "";
    if (!members.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "請先新增其他會員";
      targetSelect.append(opt);
      return;
    }
    members.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.name} (${m.city} · NTRP ${Number(m.ntrp).toFixed(1)})`;
      targetSelect.append(opt);
    });
    updateTargetCard();
  }

  function updateTargetCard() {
    if (!targetCardWrap) return;
    const id = targetSelect.value;
    const member = memberService.getMembers().find((m) => m.id === id);
    targetCardWrap.innerHTML = "";
    if (member) targetCardWrap.append(buildPlayerCard(member));
  }

  targetSelect?.addEventListener("change", updateTargetCard);

  function renderInvites() {
    const currentUser = memberService.getCurrentUser();
    if (!currentUser) {
      list.innerHTML = "<p class='hint'>請先選擇目前使用者。</p>";
      return;
    }
    const invites = inviteService.getInvites(currentUser.id);
    if (!invites.length) {
      list.innerHTML = "<p class='hint'>尚無約球記錄。</p>";
      return;
    }

    const members = memberService.getMembers();
    const nodes = invites.map((invite) => {
      const other = members.find((m) => m.id === (invite.proposerId === currentUser.id ? invite.inviteeId : invite.proposerId));
      const node = createNode("article", "list-item invite-item");
      const role = invite.proposerId === currentUser.id ? "我發出" : "對方邀請";
      node.append(
        createNode("h4", null, `${formatDateTime(invite.dateTime)} ｜ ${invite.courtName}`),
        createNode("p", null, `對象：${other?.name || "未知"} · ${role} · 狀態：${STATUS_LABELS[invite.status] || invite.status}`),
        createNode("p", "hint", invite.note || "無備註")
      );

      const actions = createNode("div", "actions");
      if (invite.status === "proposed" && invite.inviteeId === currentUser.id) {
        const accept = createNode("button", "btn-primary", "接受");
        accept.type = "button";
        accept.addEventListener("click", () => {
          inviteService.updateStatus(invite.id, "accepted");
          renderInvites();
          notify("已接受約球邀請");
        });
        const reject = createNode("button", "btn-secondary", "拒絕");
        reject.type = "button";
        reject.addEventListener("click", () => {
          inviteService.updateStatus(invite.id, "rejected");
          renderInvites();
          notify("已拒絕約球邀請");
        });
        actions.append(accept, reject);
      } else if (invite.status === "accepted") {
        const cancel = createNode("button", "btn-secondary", "取消");
        cancel.type = "button";
        cancel.addEventListener("click", () => {
          inviteService.updateStatus(invite.id, "cancelled");
          renderInvites();
          notify("已取消約球");
        });
        const complete = createNode("button", "btn-primary", "完成");
        complete.type = "button";
        complete.addEventListener("click", () => {
          inviteService.updateStatus(invite.id, "completed");
          renderInvites();
          notify("已完成約球！");
        });
        actions.append(cancel, complete);
      } else if (invite.status === "proposed" && invite.proposerId === currentUser.id) {
        const cancel = createNode("button", "btn-secondary", "取消邀約");
        cancel.type = "button";
        cancel.addEventListener("click", () => {
          inviteService.updateStatus(invite.id, "cancelled");
          renderInvites();
          notify("邀約已取消");
        });
        actions.append(cancel);
      }

      if (actions.children.length) node.append(actions);
      return node;
    });

    renderList(list, nodes);
  }

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const currentUser = memberService.getCurrentUser();
    if (!currentUser) {
      notify("請先選擇目前使用者");
      return;
    }
    const inviteeId = targetSelect.value;
    if (!inviteeId) {
      notify("請選擇邀請對象");
      return;
    }
    if (!rateLimiter.hit(`invite:${currentUser.id}`, inviteLimit, 60_000)) {
      notify("發送過於頻繁，請稍後再試");
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    inviteService.addInvite({
      proposerId: currentUser.id,
      inviteeId,
      dateTime: data.dateTime,
      courtName: data.courtName,
      note: data.note || "",
    });
    form.reset();
    renderInvites();
    notify("約球邀約已送出");
  });

  function prefillTarget(member) {
    if (!member) return;
    targetSelect.value = member.id;
    updateTargetCard();
  }

  fillTargetSelect();
  renderInvites();
  renderBuddyList();

  return {
    refresh() {
      fillTargetSelect();
      renderInvites();
      renderBuddyList();
      fillAddSelect();
    },
    prefillTarget,
  };
}
