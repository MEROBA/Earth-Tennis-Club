import { createNode, formatDateTime, renderList } from "../ui/dom.js";
import { buildPlayerCard } from "./members-module.js";

const STATUS_LABELS = {
  proposed: "待確認",
  accepted: "已接受",
  rejected: "已拒絕",
  cancelled: "已取消",
  completed: "已完成",
};

export function initInviteModule({ memberService, inviteService, rateLimiter, inviteLimit, notify }) {
  const targetSelect = document.querySelector("#invite-target-select");
  const targetCardWrap = document.querySelector("#invite-target-card");
  const form = document.querySelector("#invite-form");
  const list = document.querySelector("#invite-list");

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

  fillTargetSelect();
  renderInvites();

  return {
    refresh() {
      fillTargetSelect();
      renderInvites();
    },
    prefillTarget(member) {
      if (!member) return;
      targetSelect.value = member.id;
      updateTargetCard();
    },
  };
}
