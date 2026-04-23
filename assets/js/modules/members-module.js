import { createNode, renderList } from "../ui/dom.js";
import { QUESTIONNAIRE_ITEMS } from "../data/questionnaire.js";
import { evaluateTennisLevel } from "../services/scoring-service.js";

const PLAY_STYLE_LABELS = {
  baseline: "底線型",
  serve_volley: "上網型",
  all_court: "全場型",
  defensive: "防守型",
  aggressive: "進攻型",
};

const SURFACE_LABELS = {
  hard: "硬地",
  clay: "紅土",
  grass: "草地",
  synthetic: "合成地",
};

const GENDER_LABELS = {
  female: "女",
  male: "男",
  non_binary: "非二元",
  prefer_not_to_say: "不透露",
};

function fillCitySelect(select, cities, includeAll = false) {
  select.innerHTML = "";
  if (includeAll) {
    const opt = document.createElement("option");
    opt.value = "all";
    opt.textContent = "全部";
    select.append(opt);
  }
  cities.forEach((city) => {
    const opt = document.createElement("option");
    opt.value = city;
    opt.textContent = city;
    select.append(opt);
  });
}

export function buildPlayerCard(member, { isCurrentUser = false, onSchedule = null, onClick = null } = {}) {
  const card = createNode("article", `player-card${isCurrentUser ? " is-self" : ""}${onClick ? " is-clickable" : ""}`);
  if (onClick) {
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      onClick(member);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") onClick(member);
    });
  }

  const photoWrap = createNode("div", "player-card__photo");
  if (member.photo) {
    const img = document.createElement("img");
    img.src = member.photo;
    img.alt = member.name;
    photoWrap.append(img);
  } else {
    const placeholder = createNode("div", "player-card__photo-placeholder");
    placeholder.textContent = member.name.charAt(0).toUpperCase();
    photoWrap.append(placeholder);
  }

  const body = createNode("div", "player-card__body");

  const nameRow = createNode("div", "player-card__name-row");
  nameRow.append(createNode("h4", "player-card__name", member.name));
  const ntrpBadge = createNode("span", "player-card__ntrp", `NTRP ${Number(member.ntrp).toFixed(1)}`);
  nameRow.append(ntrpBadge);

  const meta = createNode("div", "player-card__meta");
  const citySpan = createNode("span", null, `📍 ${member.city}`);
  const genderSpan = createNode("span", null, `${GENDER_LABELS[member.gender] || member.gender}`);
  const heightSpan = member.height ? createNode("span", null, `${member.height} cm`) : null;
  const ageSpan = createNode("span", null, `${member.age} 歲`);
  const yearsSpan = createNode("span", null, `球齡 ${member.yearsPlaying} 年`);
  meta.append(citySpan, genderSpan);
  if (heightSpan) meta.append(heightSpan);
  meta.append(ageSpan, yearsSpan);

  const badges = createNode("div", "player-card__badges");
  [
    PLAY_STYLE_LABELS[member.playStyle] || member.playStyle,
    SURFACE_LABELS[member.preferredSurface] || member.preferredSurface,
    member.availability || "時段待補",
  ].forEach((label) => {
    badges.append(createNode("span", "badge", label));
  });

  body.append(nameRow, meta, badges);

  if (onSchedule && !isCurrentUser) {
    const btn = createNode("button", "btn-primary player-card__schedule-btn", "約打球");
    btn.type = "button";
    btn.addEventListener("click", () => onSchedule(member));
    body.append(btn);
  }

  if (onClick && !isCurrentUser) {
    const hint = createNode("span", "player-card__view-hint", "查看詳情 →");
    body.append(hint);
  }

  card.append(photoWrap, body);
  return card;
}

export function initMembersModule({ memberService, matchRecordService, cities, notify, onCurrentUserChange }) {
  /* ── 球員詳情 Overlay ── */
  const memberOverlayEl    = document.querySelector("#member-detail-overlay");
  const memberOverlayBack  = document.querySelector("#member-overlay-back");
  const memberOverlayBody  = document.querySelector("#member-overlay-body");
  const memberOverlayTitle = document.querySelector("#member-overlay-title");
  const navMemberArea      = document.querySelector("#nav-member-area");
  const loginOverlayEl     = document.querySelector("#login-overlay");
  const loginOverlayBack   = document.querySelector("#login-overlay-back");
  const loginMemberList    = document.querySelector("#login-member-list");

  /* showHidden state per member */
  const showHiddenMap = new Map();

  function openMemberDetail(member) {
    const isSelf = member.id === memberService.getCurrentUserId();
    memberOverlayTitle.textContent = isSelf ? `👤 ${member.name}（我）` : member.name;
    memberOverlayBody.innerHTML = memberDetailHTML(member, isSelf);

    /* Score-recording buttons */
    memberOverlayBody.querySelectorAll("[data-score-btn]").forEach((btn) => {
      btn.addEventListener("click", () => showScoreForm(member, btn.dataset.scoreBtn));
    });

    /* Hide a record */
    memberOverlayBody.querySelectorAll("[data-hide-record]").forEach((btn) => {
      btn.addEventListener("click", () => {
        matchRecordService.updateRecord(btn.dataset.hideRecord, { hidden: true });
        notify("已隱藏此對戰紀錄");
        openMemberDetail(member);
      });
    });

    /* Unhide a record */
    memberOverlayBody.querySelectorAll("[data-unhide-record]").forEach((btn) => {
      btn.addEventListener("click", () => {
        matchRecordService.updateRecord(btn.dataset.unhideRecord, { hidden: false });
        notify("已恢復顯示");
        openMemberDetail(member);
      });
    });

    /* Toggle show-hidden */
    memberOverlayBody.querySelector("#toggle-hidden-records")?.addEventListener("click", () => {
      showHiddenMap.set(member.id, !showHiddenMap.get(member.id));
      openMemberDetail(member);
    });

    /* Edit button (self only) */
    memberOverlayBody.querySelector("#overlay-edit-btn")?.addEventListener("click", () => {
      closeMemberDetail();
      document.querySelector('[data-view="members"]')?.click();
      if (formCard) {
        formCard.style.display = "block";
        if (editToggleBtn) editToggleBtn.textContent = "收起編輯";
        prefillForm(member);
      }
    });

    memberOverlayEl.classList.add("is-open");
    memberOverlayEl.scrollTop = 0;
    document.body.style.overflow = "hidden";
  }

  function showScoreForm(member, recordId) {
    const record = matchRecordService?.getRecordById(recordId);
    if (!record) return;
    const isP1 = record.player1Id === member.id;
    const opponentName = isP1 ? record.player2Name : record.player1Name;

    const container = memberOverlayBody.querySelector(`[data-score-form-for="${recordId}"]`);
    if (!container) return;

    container.innerHTML = `
      <div class="score-form">
        <p style="font-weight:600;margin-bottom:0.6rem;">記錄比分 vs ${escHtml(opponentName)}</p>
        <div class="set-rows" id="set-rows-${recordId}">
          ${[1, 2, 3].map((n) => `
            <div class="set-row">
              <span class="set-row__label">第 ${n} 局</span>
              <input class="set-input" type="number" data-set="${n - 1}" data-side="p1" min="0" max="99" placeholder="${escHtml(member.name)}" />
              <span class="set-row__sep">:</span>
              <input class="set-input" type="number" data-set="${n - 1}" data-side="p2" min="0" max="99" placeholder="${escHtml(opponentName)}" />
            </div>
          `).join("")}
        </div>
        <button type="button" class="btn-secondary add-set-btn" data-for="${recordId}" style="font-size:0.78rem;margin-top:0.4rem;">+ 加局</button>
        <div class="score-form__winner" style="margin-top:0.7rem;">
          <p style="font-size:0.85rem;font-weight:600;margin-bottom:0.4rem;">勝者</p>
          <label style="margin-right:0.8rem;"><input type="radio" name="winner-${recordId}" value="self" /> ${escHtml(member.name)}（我）</label>
          <label style="margin-right:0.8rem;"><input type="radio" name="winner-${recordId}" value="opponent" /> ${escHtml(opponentName)}</label>
          <label><input type="radio" name="winner-${recordId}" value="draw" /> 平局</label>
        </div>
        <div class="actions" style="margin-top:0.7rem;">
          <button type="button" class="btn-primary confirm-score-btn" data-record="${recordId}" data-is-p1="${isP1}">✓ 確認比分</button>
          <button type="button" class="btn-secondary cancel-score-btn">取消</button>
        </div>
      </div>
    `;

    container.querySelector(".add-set-btn").addEventListener("click", () => {
      const rows = container.querySelectorAll(".set-row");
      const n = rows.length + 1;
      const row = document.createElement("div");
      row.className = "set-row";
      row.innerHTML = `
        <span class="set-row__label">第 ${n} 局</span>
        <input class="set-input" type="number" data-set="${n - 1}" data-side="p1" min="0" max="99" placeholder="${escHtml(member.name)}" />
        <span class="set-row__sep">:</span>
        <input class="set-input" type="number" data-set="${n - 1}" data-side="p2" min="0" max="99" placeholder="${escHtml(opponentName)}" />
      `;
      container.querySelector(".set-rows").append(row);
    });

    container.querySelector(".cancel-score-btn").addEventListener("click", () => {
      container.innerHTML = "";
    });

    container.querySelector(".confirm-score-btn").addEventListener("click", (e) => {
      const rid   = e.currentTarget.dataset.record;
      const selfIsP1 = e.currentTarget.dataset.isP1 === "true";
      const rows  = container.querySelectorAll(".set-row");
      const sets  = [];
      rows.forEach((row) => {
        const p1v = Number(row.querySelector("[data-side='p1']")?.value || 0);
        const p2v = Number(row.querySelector("[data-side='p2']")?.value || 0);
        if (p1v > 0 || p2v > 0) sets.push({ p1: p1v, p2: p2v });
      });
      const winnerRadio = container.querySelector(`[name="winner-${rid}"]:checked`);
      if (!winnerRadio) { notify("請選擇勝者"); return; }
      let winner;
      if (winnerRadio.value === "self")     winner = selfIsP1 ? "p1" : "p2";
      else if (winnerRadio.value === "opponent") winner = selfIsP1 ? "p2" : "p1";
      else winner = "draw";
      matchRecordService.updateRecord(rid, { sets, winner, status: "completed" });
      notify("比分已記錄！");
      openMemberDetail(member);
    });
  }

  function closeMemberDetail() {
    memberOverlayEl.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function memberDetailHTML(m, isSelf = false) {
    const ntrpLevel = ntrpLevelLabel(Number(m.ntrp));
    const genderLabel = GENDER_LABELS[m.gender] || m.gender;
    const surfaceLabel = SURFACE_LABELS[m.preferredSurface] || m.preferredSurface;
    const styleLabel = PLAY_STYLE_LABELS[m.playStyle] || m.playStyle;

    return `
      <div class="member-profile">
        <!-- 頂部 Banner -->
        <div class="member-profile__banner">
          <div class="member-profile__avatar">
            ${m.photo
              ? `<img src="${m.photo}" alt="${escHtml(m.name)}" />`
              : `<span>${m.name.charAt(0).toUpperCase()}</span>`}
          </div>
          <div class="member-profile__hero-info">
            <h2 class="member-profile__name">${escHtml(m.name)}</h2>
            <div class="member-profile__ntrp">
              <span class="player-card__ntrp" style="font-size:1rem;">NTRP ${Number(m.ntrp).toFixed(1)}</span>
              <span class="member-profile__level-label">${ntrpLevel}</span>
            </div>
            <div class="member-profile__location">📍 ${escHtml(m.city)}</div>
          </div>
          ${isSelf ? `
          <div class="member-profile__self-actions">
            <span class="badge member-profile__self-badge">👤 我的球員卡</span>
            <button id="overlay-edit-btn" class="btn-secondary" type="button" style="font-size:0.82rem;margin-top:0.45rem;">✏️ 編輯資料</button>
          </div>` : ""}
        </div>

        <!-- 統計格線 -->
        <div class="card member-profile__stats-card">
          <h3 style="margin-bottom:0.9rem;">球員資料</h3>
          <dl class="member-stats-grid">
            <div class="member-stat-item">
              <dt>性別</dt><dd>${genderLabel}</dd>
            </div>
            <div class="member-stat-item">
              <dt>年齡</dt><dd>${m.age} 歲</dd>
            </div>
            ${m.height ? `
            <div class="member-stat-item">
              <dt>身高</dt><dd>${m.height} cm</dd>
            </div>` : ""}
            <div class="member-stat-item">
              <dt>球齡</dt><dd>${m.yearsPlaying} 年</dd>
            </div>
            <div class="member-stat-item">
              <dt>NTRP 等級</dt><dd>${Number(m.ntrp).toFixed(1)} — ${ntrpLevel}</dd>
            </div>
            <div class="member-stat-item">
              <dt>慣用場地</dt><dd>${surfaceLabel}</dd>
            </div>
            <div class="member-stat-item">
              <dt>打法風格</dt><dd>${styleLabel}</dd>
            </div>
            <div class="member-stat-item">
              <dt>所在縣市</dt><dd>📍 ${escHtml(m.city)}</dd>
            </div>
          </dl>
        </div>

        <!-- 可打球時段 -->
        <div class="card">
          <h3 style="margin-bottom:0.6rem;">⏰ 可打球時段</h3>
          <p style="color:var(--ink);font-size:0.95rem; line-height:1.6;">
            ${m.availability ? escHtml(m.availability) : '<span style="color:var(--ink-muted);">尚未填寫</span>'}
          </p>
        </div>

        <!-- NTRP 說明 -->
        <div class="card member-ntrp-card">
          <h3 style="margin-bottom:0.8rem;">🎾 NTRP 等級說明</h3>
          <div class="ntrp-meter">
            <div class="ntrp-meter__bar">
              <div class="ntrp-meter__fill" style="width:${((Number(m.ntrp) - 1.5) / 5.5) * 100}%;"></div>
              <div class="ntrp-meter__marker" style="left:${((Number(m.ntrp) - 1.5) / 5.5) * 100}%;"></div>
            </div>
            <div class="ntrp-meter__labels">
              <span>1.5</span><span>3.0</span><span>4.5</span><span>7.0</span>
            </div>
          </div>
          <p style="font-size:0.88rem; color:var(--ink-secondary); margin-top:0.7rem; line-height:1.65;">
            ${ntrpDescription(Number(m.ntrp))}
          </p>
        </div>

        <!-- 對戰紀錄 -->
        <div class="card">
          <h3 style="margin-bottom:0.8rem;">⚔️ 對戰紀錄</h3>
          ${matchRecordsHTML(m, isSelf)}
        </div>
      </div>
    `;
  }

  function matchRecordsHTML(m, isSelf = false) {
    const records = matchRecordService?.getRecordsForMember(m.id) ?? [];
    if (!records.length) {
      return `<p class="hint" style="text-align:center;padding:0.8rem;">尚無對戰紀錄</p>`;
    }
    const currentId = memberService.getCurrentUserId();
    const showHidden = showHiddenMap.get(m.id) ?? false;
    const hiddenCount = records.filter((r) => r.hidden).length;

    const visible = isSelf && !showHidden ? records.filter((r) => !r.hidden) : records;

    const toggleBtn = isSelf && hiddenCount > 0 ? `
      <button id="toggle-hidden-records" class="btn-secondary" type="button"
              style="font-size:0.78rem;margin-bottom:0.8rem;">
        ${showHidden ? `👁 隱藏已隱藏紀錄 (${hiddenCount})` : `👁 顯示已隱藏紀錄 (${hiddenCount})`}
      </button>
    ` : "";

    if (!visible.length) {
      return toggleBtn + `<p class="hint" style="text-align:center;padding:0.8rem;">所有紀錄已隱藏</p>`;
    }

    return toggleBtn + visible.map((r) => {
      const isP1 = r.player1Id === m.id;
      const opponentName = isP1 ? r.player2Name : r.player1Name;
      const opponentId   = isP1 ? r.player2Id   : r.player1Id;
      const didWin = r.winner === (isP1 ? "p1" : "p2");
      const isDraw = r.winner === "draw";
      const setsStr = (r.sets || []).map((s) => `${s.p1}–${s.p2}`).join("  ");
      const canRecord = r.status === "scheduled" &&
        (currentId === m.id || currentId === opponentId);

      let badge;
      if (r.status === "scheduled") badge = `<span class="badge-upcoming">待對戰</span>`;
      else if (isDraw)              badge = `<span class="badge">平局</span>`;
      else if (didWin)              badge = `<span class="badge-live">勝</span>`;
      else                          badge = `<span class="badge-completed">負</span>`;

      const hideBtn = isSelf && !r.hidden ? `
        <button class="btn-secondary" data-hide-record="${r.id}"
                style="font-size:0.75rem;margin-top:0.45rem;" type="button">🚫 不顯示</button>
      ` : "";
      const unhideBtn = isSelf && r.hidden ? `
        <button class="btn-secondary" data-unhide-record="${r.id}"
                style="font-size:0.75rem;margin-top:0.45rem;" type="button">↩ 恢復顯示</button>
      ` : "";

      return `
        <div class="match-record-item${r.hidden ? " is-hidden-record" : ""}">
          <div class="match-record-header">
            ${badge}
            <span class="match-record-opponent">vs <strong>${escHtml(opponentName)}</strong></span>
            <span class="match-record-date">${r.date}</span>
            ${r.hidden ? `<span style="font-size:0.68rem;color:var(--ink-muted);">[已隱藏]</span>` : ""}
          </div>
          ${setsStr ? `<div class="match-record-sets">${setsStr}</div>` : ""}
          ${r.venue ? `<div class="match-record-venue">🏟️ ${escHtml(r.venue)}</div>` : ""}
          ${canRecord ? `
            <button class="btn-secondary" data-score-btn="${r.id}"
                    style="margin-top:0.5rem;font-size:0.8rem;" type="button">✏️ 記錄比分</button>
            <div data-score-form-for="${r.id}"></div>
          ` : ""}
          ${hideBtn}${unhideBtn}
        </div>
      `;
    }).join("");
  }

  function ntrpLevelLabel(n) {
    if (n <= 2.0) return "初學者";
    if (n <= 2.5) return "入門級";
    if (n <= 3.0) return "初中級";
    if (n <= 3.5) return "中級";
    if (n <= 4.0) return "中高級";
    if (n <= 4.5) return "高級";
    if (n <= 5.0) return "精英級";
    return "職業級";
  }

  function ntrpDescription(n) {
    if (n <= 2.0) return "初次接觸網球，正在學習基本握拍、站位與發球方式。";
    if (n <= 2.5) return "能維持穩定的對打，正在建立正拍與反拍的基礎。";
    if (n <= 3.0) return "具備基本的正反拍底線控球能力，開始發展方向性打法。";
    if (n <= 3.5) return "能打出有方向感的底線球，發球、截擊初步掌握，賽事中開始形成策略。";
    if (n <= 4.0) return "控球穩定、發球有力，上網截擊流暢，能在業餘賽事中保持競爭力。";
    if (n <= 4.5) return "高度一致性與戰術意識，具備不同場地的適應能力，接近省市代表水準。";
    if (n <= 5.0) return "能打出有威脅的上旋、切片與快速截擊，接近全國業餘頂尖或半職業水準。";
    return "職業或準職業球員，具備完整的技術體系與比賽心理素質。";
  }

  function escHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  memberOverlayBack?.addEventListener("click", closeMemberDetail);
  loginOverlayBack?.addEventListener("click", closeLoginOverlay);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (memberOverlayEl?.classList.contains("is-open")) closeMemberDetail();
      else if (loginOverlayEl?.classList.contains("is-open")) closeLoginOverlay();
    }
  });

  const formCard = document.querySelector("#member-form-card");
  const form = document.querySelector("#member-form");
  const photoInput = document.querySelector("#member-photo-input");
  const photoPreview = document.querySelector("#member-photo-preview");
  const editToggleBtn = document.querySelector("#member-edit-toggle");
  const filterCity = document.querySelector("#member-filter-city");
  const filterLevel = document.querySelector("#member-filter-level");
  const filterRun = document.querySelector("#member-filter-run");
  const list = document.querySelector("#member-list");
  const currentUserSelect = document.querySelector("#current-user-select");
  const currentCardWrap = document.querySelector("#current-user-card");

  // NTRP inline assessment elements
  const ntrpToggleBtn = document.querySelector("#ntrp-assess-toggle");
  const ntrpPanel = document.querySelector("#ntrp-assess-panel");
  const ntrpForm = document.querySelector("#ntrp-assess-form");
  const ntrpSubmitBtn = document.querySelector("#ntrp-assess-submit");
  const ntrpResultEl = document.querySelector("#ntrp-assess-result");

  fillCitySelect(document.querySelector("#member-city"), cities);
  fillCitySelect(filterCity, cities, true);

  // Photo upload
  let pendingPhoto = null;
  photoInput?.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify("照片大小請勿超過 2MB");
      photoInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      pendingPhoto = e.target.result;
      if (photoPreview) {
        photoPreview.src = pendingPhoto;
        photoPreview.style.display = "block";
      }
    };
    reader.readAsDataURL(file);
  });

  // NTRP inline assessment
  if (ntrpToggleBtn && ntrpPanel && ntrpForm) {
    QUESTIONNAIRE_ITEMS.forEach((item) => {
      const label = createNode("label", "ntrp-item");
      label.append(
        createNode("span", "ntrp-item__title", item.title),
        createNode("small", "hint", item.description)
      );
      const input = document.createElement("input");
      input.type = "range";
      input.min = "1";
      input.max = "7";
      input.step = "1";
      input.value = "4";
      input.name = item.id;
      const valueText = createNode("span", "hint ntrp-item__val", "4");
      input.addEventListener("input", () => { valueText.textContent = input.value; });
      label.append(input, valueText);
      ntrpForm.append(label);
    });

    ntrpToggleBtn.addEventListener("click", () => {
      const hidden = ntrpPanel.style.display === "none" || !ntrpPanel.style.display;
      ntrpPanel.style.display = hidden ? "block" : "none";
      ntrpToggleBtn.textContent = hidden ? "收起 NTRP 評估" : "展開 NTRP 自我評估";
    });

    ntrpSubmitBtn?.addEventListener("click", () => {
      const data = Object.fromEntries(new FormData(ntrpForm).entries());
      const answers = {};
      for (const [k, v] of Object.entries(data)) answers[k] = Number(v);
      try {
        const result = evaluateTennisLevel(answers);
        const ntrpInput = form.querySelector('[name="ntrp"]');
        if (ntrpInput) ntrpInput.value = result.ntrp;
        if (ntrpResultEl) {
          ntrpResultEl.textContent = `評估結果：NTRP ${result.ntrp.toFixed(1)} — ${result.summary}`;
          ntrpResultEl.style.display = "block";
        }
        memberService.saveAssessment(result);
        notify(`NTRP 評估完成：${result.ntrp.toFixed(1)}`);
      } catch (e) {
        notify(e.message);
      }
    });
  }

  // Edit toggle
  editToggleBtn?.addEventListener("click", () => {
    const hidden = formCard.style.display === "none" || !formCard.style.display;
    formCard.style.display = hidden ? "block" : "none";
    editToggleBtn.textContent = hidden ? "收起編輯" : "編輯球員卡";

    if (hidden) {
      const user = memberService.getCurrentUser();
      if (user) prefillForm(user);
    }
  });

  function prefillForm(member) {
    if (!form) return;
    const set = (name, val) => { if (form.elements[name]) form.elements[name].value = val ?? ""; };
    set("name", member.name);
    set("city", member.city);
    set("gender", member.gender);
    set("height", member.height || "");
    set("age", member.age);
    set("yearsPlaying", member.yearsPlaying);
    set("preferredSurface", member.preferredSurface);
    set("playStyle", member.playStyle || "all_court");
    set("availability", member.availability || "");
    set("ntrp", member.ntrp);
    if (form.elements["id"]) form.elements["id"].value = member.id;
    if (member.photo && photoPreview) {
      photoPreview.src = member.photo;
      photoPreview.style.display = "block";
      pendingPhoto = member.photo;
    }
  }

  function renderCurrentCard() {
    if (!currentCardWrap) return;
    const user = memberService.getCurrentUser();
    currentCardWrap.innerHTML = "";
    if (!user) {
      currentCardWrap.innerHTML = "<p class='hint'>尚未選擇會員。</p>";
      return;
    }
    currentCardWrap.append(buildPlayerCard(user, {
      isCurrentUser: true,
      onClick: () => openMemberDetail(user),
    }));
  }

  function renderCurrentUserSelect() {
    const members = memberService.getMembers();
    const currentId = memberService.getCurrentUserId();
    currentUserSelect.innerHTML = "";
    members.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.name} (${m.city})`;
      if (m.id === currentId) opt.selected = true;
      currentUserSelect.append(opt);
    });
    renderCurrentCard();
  }

  function renderMembers(filtered = null) {
    const members = filtered || memberService.getMembers();
    if (!members.length) {
      list.innerHTML = "<p class='hint'>目前沒有會員資料。</p>";
      return;
    }
    renderList(list, members.map((m) => buildPlayerCard(m, { onClick: openMemberDetail })));
  }

  function updateNavMemberBtn() {
    if (!navMemberArea) return;
    const user = memberService.getCurrentUser();
    if (!user) {
      navMemberArea.innerHTML = `
        <button class="nav-auth-btn" id="nav-login-btn" type="button">登入</button>
        <button class="nav-auth-btn nav-auth-btn--primary" id="nav-register-btn" type="button">+ 註冊</button>
      `;
      navMemberArea.querySelector("#nav-login-btn")?.addEventListener("click", openLoginOverlay);
      navMemberArea.querySelector("#nav-register-btn")?.addEventListener("click", () => {
        document.querySelector('[data-view="members"]')?.click();
        if (formCard) {
          formCard.style.display = "block";
          if (editToggleBtn) editToggleBtn.textContent = "收起編輯";
        }
      });
    } else {
      navMemberArea.innerHTML = `
        <button class="nav-member-chip" id="nav-member-chip-btn" type="button">
          <span class="nav-member-avatar">${escHtml(user.name.charAt(0).toUpperCase())}</span>
          <span class="nav-member-name">${escHtml(user.name)}</span>
          <span class="nav-member-ntrp">NTRP ${Number(user.ntrp).toFixed(1)}</span>
        </button>
      `;
      navMemberArea.querySelector("#nav-member-chip-btn")?.addEventListener("click", () => openMemberDetail(user));
    }
  }

  function openLoginOverlay() {
    if (!loginOverlayEl || !loginMemberList) return;
    const members = memberService.getMembers();
    loginMemberList.innerHTML = members.map((m) => `
      <div class="login-member-item" data-login-id="${escHtml(m.id)}" role="button" tabindex="0">
        <div class="login-member-avatar">${escHtml(m.name.charAt(0).toUpperCase())}</div>
        <div class="login-member-info">
          <div class="login-member-name">${escHtml(m.name)}</div>
          <div class="login-member-meta">${escHtml(m.city)} · NTRP ${Number(m.ntrp).toFixed(1)}</div>
        </div>
      </div>
    `).join("");

    loginMemberList.querySelectorAll("[data-login-id]").forEach((el) => {
      const handler = () => {
        const id = el.dataset.loginId;
        const chosen = members.find((m) => m.id === id);
        memberService.setCurrentUserId(id);
        closeLoginOverlay();
        refreshAll();
        notify(`已登入為 ${chosen?.name ?? id}`);
      };
      el.addEventListener("click", handler);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") handler(); });
    });

    loginOverlayEl.classList.add("is-open");
    loginOverlayEl.scrollTop = 0;
    document.body.style.overflow = "hidden";
  }

  function closeLoginOverlay() {
    loginOverlayEl?.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function refreshAll() {
    renderMembers();
    renderCurrentUserSelect();
    updateNavMemberBtn();
    onCurrentUserChange();
  }

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (pendingPhoto) data.photo = pendingPhoto;
    try {
      memberService.saveMember(data);
      notify(`球員卡「${data.name}」已儲存`);
      pendingPhoto = null;
      formCard.style.display = "none";
      editToggleBtn.textContent = "編輯球員卡";
      refreshAll();
    } catch (err) {
      notify(err.message);
    }
  });

  filterRun?.addEventListener("click", () => {
    renderMembers(memberService.filterMembers({ city: filterCity.value, minNtrp: filterLevel.value }));
  });

  currentUserSelect?.addEventListener("change", () => {
    memberService.setCurrentUserId(currentUserSelect.value);
    renderCurrentCard();
    onCurrentUserChange();
    notify("已切換目前使用者");
  });

  refreshAll();

  return {
    refresh() { refreshAll(); },
  };
}
