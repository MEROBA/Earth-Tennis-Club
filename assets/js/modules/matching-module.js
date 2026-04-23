import { createNode, renderList } from "../ui/dom.js";
import { buildPlayerCard } from "./members-module.js";

const GENDER_LABELS = { male: "男", female: "女", non_binary: "非二元", all: "不限" };
const SURFACE_LABELS = { hard: "硬地", clay: "紅土", grass: "草地", synthetic: "合成地", all: "不限" };
const STYLE_LABELS = { baseline: "底線型", serve_volley: "上網型", all_court: "全場型", defensive: "防守型", aggressive: "進攻型", all: "不限" };

export function initMatchingModule({
  memberService,
  lookingForService,
  cities,
  onScheduleRequest,
  notify,
}) {
  /* ── DOM 參考 ── */
  const modeButtons   = document.querySelectorAll(".matching-mode-btn");
  const smartPanel    = document.querySelector("#matching-smart-panel");
  const manualPanel   = document.querySelector("#matching-manual-panel");
  const resultsEl     = document.querySelector("#matching-results");
  const emptyEl       = document.querySelector("#matching-empty");
  const runSmartBtn   = document.querySelector("#run-matching");
  const filterForm    = document.querySelector("#matching-filter-form");
  const runFilterBtn  = document.querySelector("#run-manual-filter");
  const resetBtn      = document.querySelector("#reset-manual-filter");
  const cityFilterSel = document.querySelector("#matching-city-filter");

  const createLfBtn   = document.querySelector("#create-lf-btn");
  const lfCreateWrap  = document.querySelector("#lf-create-wrap");
  const lfCreateForm  = document.querySelector("#lf-create-form");
  const lfCancelBtn   = document.querySelector("#lf-cancel-btn");
  const lfCitySel     = document.querySelector("#lf-city-select");
  const lfListEl      = document.querySelector("#lf-list");

  /* ── 填入城市選單 ── */
  function fillCitySelect(sel, includeAll = true) {
    sel.innerHTML = "";
    if (includeAll) sel.innerHTML = `<option value="all">不限</option>`;
    cities.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c; opt.textContent = c;
      sel.append(opt);
    });
  }
  fillCitySelect(cityFilterSel);
  fillCitySelect(lfCitySel);

  /* ─────────────────── 模式切換 ─────────────────── */
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
      const mode = btn.dataset.mode;
      smartPanel.style.display  = mode === "smart"  ? "" : "none";
      manualPanel.style.display = mode === "manual" ? "" : "none";
      resultsEl.innerHTML = "";
      emptyEl.textContent = "";
    });
  });

  /* ─────────────────── 智慧配對 ─────────────────── */
  function renderSmartMatches() {
    const currentId = memberService.getCurrentUserId();
    if (!currentId) {
      resultsEl.innerHTML = "";
      emptyEl.textContent = "請先在球員管理頁面選擇目前使用者。";
      return;
    }
    const matches = memberService.findMatches(currentId);
    if (!matches.length) {
      resultsEl.innerHTML = "";
      emptyEl.textContent = "沒有可用配對，請先新增更多會員。";
      return;
    }
    emptyEl.textContent = "";
    renderList(
      resultsEl,
      matches.map(({ member, score, reason }) => {
        const wrap = createNode("div", "match-result-item");
        const bar  = createNode("div", "match-score-bar");
        bar.append(
          createNode("span", "match-score-value", `配對分數 ${score}`),
          createNode("span", "match-score-reason hint", reason)
        );
        const card = buildPlayerCard(member, {
          onSchedule: (m) => onScheduleRequest?.(m),
        });
        wrap.append(bar, card);
        return wrap;
      })
    );
  }

  runSmartBtn?.addEventListener("click", () => {
    renderSmartMatches();
    notify("已產生球友推薦");
  });

  /* ─────────────────── 手動篩選 ─────────────────── */
  function runManualFilter() {
    const currentId = memberService.getCurrentUserId();
    const fd = new FormData(filterForm);
    const gender   = fd.get("gender");
    const city     = fd.get("city");
    const minNtrp  = Number(fd.get("minNtrp") || 0);
    const maxNtrp  = Number(fd.get("maxNtrp") || 7);
    const minAge   = Number(fd.get("minAge") || 0);
    const maxAge   = Number(fd.get("maxAge") || 999);
    const minYears = Number(fd.get("minYears") || 0);
    const maxYears = fd.get("maxYears") ? Number(fd.get("maxYears")) : 999;
    const surface  = fd.get("surface");
    const style    = fd.get("playStyle");

    const filtered = memberService.getMembers().filter((m) => {
      if (m.id === currentId) return false;
      if (gender !== "all" && m.gender !== gender) return false;
      if (city !== "all" && m.city !== city) return false;
      if (Number(m.ntrp) < minNtrp || Number(m.ntrp) > maxNtrp) return false;
      if (minAge && Number(m.age) < minAge) return false;
      if (maxAge < 999 && Number(m.age) > maxAge) return false;
      if (minYears && Number(m.yearsPlaying) < minYears) return false;
      if (maxYears < 999 && Number(m.yearsPlaying) > maxYears) return false;
      if (surface !== "all" && m.preferredSurface !== surface) return false;
      if (style !== "all" && m.playStyle !== style) return false;
      return true;
    });

    if (!filtered.length) {
      resultsEl.innerHTML = "";
      emptyEl.textContent = "沒有符合條件的球友，請調整篩選條件。";
      return;
    }
    emptyEl.textContent = `找到 ${filtered.length} 位球友`;
    renderList(
      resultsEl,
      filtered.map((m) => buildPlayerCard(m, { onSchedule: (x) => onScheduleRequest?.(x) }))
    );
  }

  runFilterBtn?.addEventListener("click", () => runManualFilter());
  resetBtn?.addEventListener("click", () => {
    filterForm?.reset();
    resultsEl.innerHTML = "";
    emptyEl.textContent = "";
  });

  /* ─────────────────── 正在尋找 ─────────────────── */
  function renderLfPosts() {
    if (!lfListEl) return;
    const currentUser = memberService.getCurrentUser();
    const all = lookingForService.getPosts();
    if (!all.length) {
      lfListEl.innerHTML = `<p class="hint" style="text-align:center;padding:1.2rem;">尚無任何尋找貼文，成為第一個發起的人！</p>`;
      return;
    }
    lfListEl.innerHTML = all.map((p) => lfPostHTML(p, currentUser)).join("");

    /* 事件代理 */
    lfListEl.querySelectorAll("[data-apply-post]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const user = memberService.getCurrentUser();
        if (!user) { notify("請先選擇目前使用者"); return; }
        lookingForService.applyToPost(btn.dataset.applyPost, { memberId: user.id, memberName: user.name });
        notify("已送出報名！等待發文者確認。");
        renderLfPosts();
      });
    });

    lfListEl.querySelectorAll("[data-approve]").forEach((btn) => {
      btn.addEventListener("click", () => {
        lookingForService.approveApplicant(btn.dataset.approve, btn.dataset.memberId);
        notify("已同意報名，對戰已記錄！");
        renderLfPosts();
      });
    });

    lfListEl.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", () => {
        lookingForService.rejectApplicant(btn.dataset.reject, btn.dataset.memberId);
        notify("已婉拒此報名。");
        renderLfPosts();
      });
    });

    lfListEl.querySelectorAll("[data-close-post]").forEach((btn) => {
      btn.addEventListener("click", () => {
        lookingForService.closePost(btn.dataset.closePost);
        notify("尋找貼文已關閉。");
        renderLfPosts();
      });
    });
  }

  function lfPostHTML(post, currentUser) {
    const isAuthor  = currentUser && post.authorId === currentUser.id;
    const expired   = new Date(post.deadline) < new Date();
    const closed    = post.status !== "open" || expired;
    const myApp     = currentUser && post.applicants.find((a) => a.memberId === currentUser.id);
    const meets     = currentUser && !isAuthor && lookingForService.memberMeetsCriteria(currentUser, post.criteria);
    const pending   = post.applicants.filter((a) => a.status === "pending").length;
    const approved  = post.applicants.filter((a) => a.status === "approved").length;

    const c = post.criteria;
    const tags = [];
    if (c.gender !== "all") tags.push(GENDER_LABELS[c.gender] || c.gender);
    if (c.city   !== "all") tags.push(`📍 ${c.city}`);
    if (c.minNtrp || c.maxNtrp) tags.push(`NTRP ${c.minNtrp ?? "不限"}–${c.maxNtrp ?? "不限"}`);
    if (c.minAge  || c.maxAge)  tags.push(`年齡 ${c.minAge ?? "不限"}–${c.maxAge ?? "不限"}`);
    if (c.minYears || c.maxYears) tags.push(`球齡 ${c.minYears ?? 0}–${c.maxYears ?? "不限"} 年`);
    if (!tags.length) tags.push("條件：不限");

    const dl = new Date(post.deadline);
    const dlStr = `${dl.toLocaleDateString("zh-TW")} ${dl.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`;

    let actionHTML = "";
    if (isAuthor) {
      actionHTML = `
        <div class="lf-author-actions">
          ${closed ? '<span class="badge-completed">已關閉</span>' : `<button class="btn-secondary" data-close-post="${post.id}" type="button">關閉貼文</button>`}
        </div>`;
    } else if (myApp) {
      const labels = { pending: "⏳ 審核中", approved: "✅ 已同意", rejected: "❌ 已婉拒" };
      actionHTML = `<span class="badge">${labels[myApp.status] || myApp.status}</span>`;
    } else if (!closed) {
      actionHTML = meets
        ? `<button class="btn-primary" data-apply-post="${post.id}" type="button">🙋 我有意願</button>`
        : `<span class="hint" style="font-size:0.78rem;">不符合此次條件</span>`;
    }

    const applicantsHTML = isAuthor && post.applicants.length > 0 ? `
      <div class="lf-applicants">
        <p class="lf-applicants-title">報名者 (${pending} 待審 / ${approved} 已同意)</p>
        ${post.applicants.map((a) => `
          <div class="lf-applicant-item">
            <div class="player-avatar" style="width:28px;height:28px;font-size:0.7rem;background:var(--ao-royal);">${a.memberName.charAt(0)}</div>
            <span class="lf-applicant-name">${escHtml(a.memberName)}</span>
            <span class="hint" style="font-size:0.72rem;">${new Date(a.appliedAt).toLocaleDateString("zh-TW")}</span>
            ${a.status === "pending" ? `
              <button class="btn-primary" style="font-size:0.75rem;padding:0.2rem 0.55rem;"
                data-approve="${post.id}" data-member-id="${a.memberId}" type="button">同意</button>
              <button class="btn-secondary" style="font-size:0.75rem;padding:0.2rem 0.55rem;"
                data-reject="${post.id}" data-member-id="${a.memberId}" type="button">拒絕</button>
            ` : `<span class="badge" style="font-size:0.72rem;">${a.status === "approved" ? "✓ 已同意" : "✗ 已婉拒"}</span>`}
          </div>
        `).join("")}
      </div>
    ` : "";

    return `
      <div class="lf-post-card ${closed ? "is-closed" : ""}">
        <div class="lf-post-header">
          <div class="lf-post-author-row">
            <div class="player-avatar" style="width:32px;height:32px;font-size:0.78rem;background:var(--ao-royal);">${post.authorName.charAt(0)}</div>
            <span class="lf-author-name">${escHtml(post.authorName)}</span>
            ${isAuthor ? '<span class="badge" style="font-size:0.7rem;">我的</span>' : ""}
          </div>
          <span class="lf-deadline${expired ? " is-expired" : ""}">截止 ${dlStr}${expired ? "（已過期）" : ""}</span>
        </div>

        ${post.note ? `<p class="lf-note">"${escHtml(post.note)}"</p>` : ""}

        <div class="lf-criteria-tags">
          ${tags.map((t) => `<span class="lf-tag">${t}</span>`).join("")}
        </div>

        <div class="lf-post-footer">
          <span class="hint" style="font-size:0.75rem;">👥 ${post.applicants.length} 人報名</span>
          <div class="lf-action">${actionHTML}</div>
        </div>

        ${applicantsHTML}
      </div>
    `;
  }

  /* ─────────────────── 建立貼文表單 ─────────────────── */
  createLfBtn?.addEventListener("click", () => {
    const hidden = lfCreateWrap.style.display === "none";
    lfCreateWrap.style.display = hidden ? "" : "none";
    createLfBtn.textContent = hidden ? "✕ 取消" : "+ 發起尋找";
  });

  lfCancelBtn?.addEventListener("click", () => {
    lfCreateWrap.style.display = "none";
    createLfBtn.textContent = "+ 發起尋找";
    lfCreateForm?.reset();
  });

  lfCreateForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = memberService.getCurrentUser();
    if (!user) { notify("請先選擇目前使用者"); return; }
    const fd = new FormData(lfCreateForm);
    lookingForService.createPost({
      authorId: user.id,
      authorName: user.name,
      note: fd.get("note"),
      deadline: fd.get("deadline"),
      criteria: {
        gender:   fd.get("gender"),
        city:     fd.get("city"),
        minNtrp:  fd.get("minNtrp"),
        maxNtrp:  fd.get("maxNtrp"),
        minAge:   fd.get("minAge"),
        maxAge:   fd.get("maxAge"),
        minYears: fd.get("minYears"),
        maxYears: fd.get("maxYears"),
      },
    });
    notify("尋找貼文已發布！");
    lfCreateForm.reset();
    lfCreateWrap.style.display = "none";
    createLfBtn.textContent = "+ 發起尋找";
    renderLfPosts();
  });

  /* ─────────────────── Helpers ─────────────────── */
  function escHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ─────────────────── 初始化 ─────────────────── */
  renderSmartMatches();
  renderLfPosts();

  return {
    refresh() {
      renderSmartMatches();
      renderLfPosts();
    },
    prefillTarget(member) {
      /* 由 invite 模組呼叫，不需動作 */
    },
  };
}
