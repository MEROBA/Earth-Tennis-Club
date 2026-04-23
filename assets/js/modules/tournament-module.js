import { TOURNAMENT_TOURS } from "../data/tournaments.js";
import { qs } from "../ui/dom.js";

export function initTournamentModule({ tournamentService, notify }) {
  /* ── DOM 參考 ── */
  const filterBarEl      = qs("#tn-filter-bar");
  const tournamentGridEl = qs("#tn-tournament-grid");
  const overlayEl        = qs("#tn-detail-overlay");
  const overlayBack      = qs("#tn-overlay-back");
  const overlayTitle     = qs("#tn-overlay-title");
  const overlayBody      = qs("#tn-overlay-body");

  /* ── 狀態 ── */
  let currentTour = "all";
  let liveCleanup = null;

  /* ─────────────────── 篩選器 ─────────────────── */
  function buildFilters() {
    filterBarEl.innerHTML = TOURNAMENT_TOURS.map((t) => `
      <button class="tour-filter-btn ${t.id === currentTour ? "is-active" : ""}"
              data-tour="${t.id}" type="button">
        ${t.label}
      </button>
    `).join("");
    filterBarEl.querySelectorAll(".tour-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentTour = btn.dataset.tour;
        buildFilters();
        renderGrid();
      });
    });
  }

  /* ─────────────────── 賽事格線 ─────────────────── */
  async function renderGrid() {
    tournamentGridEl.innerHTML = '<p class="hint">載入中…</p>';
    try {
      const tournaments = await tournamentService.fetchTournaments({ tour: currentTour });
      if (tournaments.length === 0) {
        tournamentGridEl.innerHTML = '<p class="hint">此分類目前無賽事資料。</p>';
        return;
      }
      tournamentGridEl.innerHTML = tournaments.map((t) => tournamentCardHTML(t)).join("");
      tournamentGridEl.querySelectorAll(".tournament-card").forEach((card) => {
        card.addEventListener("click", () => openDetail(card.dataset.tid));
        card.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") openDetail(card.dataset.tid);
        });
      });
    } catch (err) {
      tournamentGridEl.innerHTML = `<p class="hint" style="color:#c0392b;">載入失敗：${err.message}</p>`;
    }
  }

  function tournamentCardHTML(t) {
    return `
      <article class="tournament-card" data-tid="${t.id}" tabindex="0" role="button"
               aria-label="查看 ${t.name} 詳情">
        <div class="tournament-card__banner">
          <div class="tournament-card__banner-bg" style="background: ${t.gradient};"></div>
          <div class="tournament-card__banner-overlay"></div>
          <span class="tournament-card__tier ${t.tier.includes("Grand Slam") ? "is-grand-slam" : ""}">
            ${t.tier.includes("Grand Slam") ? "★ " : ""}${t.tier.split("/")[0].trim()}
          </span>
        </div>
        <div class="tournament-card__body">
          <h3 class="tournament-card__name">${t.emoji} ${t.name}</h3>
          <div class="tournament-card__sub">
            <span>📍 ${t.location}</span>
            <span>🎾 ${t.surface}</span>
            <span>📅 ${t.dates}</span>
          </div>
          <div class="tournament-card__status">
            ${statusBadgeHTML(t.status)}
            <span class="badge" style="font-size:0.72rem;">💰 ${t.prize}</span>
          </div>
        </div>
      </article>
    `;
  }

  /* ─────────────────── 詳情 Overlay ─────────────────── */
  async function openDetail(tournamentId) {
    overlayTitle.textContent = "載入中…";
    overlayBody.innerHTML = `<div style="text-align:center; padding:3rem;"><p class="hint">載入賽事詳情中…</p></div>`;
    overlayEl.classList.add("is-open");
    overlayEl.scrollTop = 0;
    document.body.style.overflow = "hidden";

    try {
      const t = await tournamentService.fetchTournamentDetail(tournamentId);
      if (!t) {
        overlayBody.innerHTML = `<p class="hint">找不到賽事資訊。</p>`;
        return;
      }
      overlayTitle.textContent = t.name;
      renderDetail(t);
    } catch (err) {
      overlayBody.innerHTML = `<p class="hint" style="color:#c0392b;">載入失敗：${err.message}</p>`;
    }
  }

  function closeDetail() {
    liveCleanup?.();
    liveCleanup = null;
    overlayEl.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function renderDetail(t) {
    overlayBody.innerHTML = `
      <!-- Banner -->
      <div class="tournament-detail__banner" style="background: ${t.gradient};">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,10,30,0.15) 0%,rgba(0,20,60,0.72) 100%);"></div>
        <div class="tournament-detail__content">
          <h2 class="tournament-detail__title">${t.emoji} ${t.nameFull}</h2>
          <p class="tournament-detail__subtitle">${t.location} &nbsp;·&nbsp; ${t.surface}</p>
          ${statusBadgeHTML(t.status)}
        </div>
      </div>

      <!-- 資訊格線 -->
      <div class="card" style="margin-top:1.2rem;">
        <dl class="tournament-info-grid">
          <div class="tournament-info-block"><dt>日期</dt><dd>${t.dates}</dd></div>
          <div class="tournament-info-block"><dt>場地</dt><dd>${t.surface}</dd></div>
          <div class="tournament-info-block"><dt>獎金</dt><dd>${t.prize}</dd></div>
          <div class="tournament-info-block"><dt>賽事層級</dt><dd>${t.tier}</dd></div>
          ${t.draws.ms ? `<div class="tournament-info-block"><dt>男單籤位</dt><dd>${t.draws.ms} 籤</dd></div>` : ""}
          ${t.draws.ws ? `<div class="tournament-info-block"><dt>女單籤位</dt><dd>${t.draws.ws} 籤</dd></div>` : ""}
        </dl>
        <p style="line-height:1.65;color:var(--ink);margin-top:0.8rem;">${t.description}</p>
      </div>

      <!-- 冠軍 -->
      ${t.status !== "upcoming" ? `
      <div class="card">
        <h3 style="margin-bottom:0.8rem;">🏆 冠軍</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem;">
          <div class="gear-spec-item"><dt>男子單打</dt><dd>${escHtml(t.champions.ms)}</dd></div>
          <div class="gear-spec-item"><dt>女子單打</dt><dd>${escHtml(t.champions.ws)}</dd></div>
        </div>
      </div>
      ` : ""}

      <!-- 對戰 / 比分 -->
      <div class="card">
        <h3 style="margin-bottom:0.8rem;">${t.status === "live" ? "🔴 即時賽況" : t.status === "completed" ? "📋 對戰結果" : "📋 預計對戰"}</h3>
        ${matchesHTML(t)}
      </div>

      <!-- Live scores container -->
      ${t.liveEnabled ? `<div id="tn-live-scores"></div>` : ""}
    `;

    if (t.liveEnabled) {
      liveCleanup?.();
      liveCleanup = tournamentService.subscribeLiveScores(t.id, (scores) => {
        const el = qs("#tn-live-scores");
        if (el) {
          el.innerHTML = scores
            .map((s) => `<div class="list-item">${escHtml(JSON.stringify(s))}</div>`)
            .join("") || "";
        }
      });
    }
  }

  /* ─────────────────── 對戰卡片 ─────────────────── */
  function matchesHTML(t) {
    const matches = t.matches ?? [];
    if (matches.length === 0) {
      return `<p class="hint" style="text-align:center;padding:1rem;">籤表資料尚未公布</p>`;
    }

    /* 依 round 分組 */
    const groups = {};
    matches.forEach((m) => {
      if (!groups[m.round]) groups[m.round] = [];
      groups[m.round].push(m);
    });

    return Object.entries(groups).map(([round, ms]) => `
      <div class="match-group">
        <div class="match-group__label">${round}</div>
        ${ms.map((m) => matchCardHTML(m)).join("")}
      </div>
    `).join("");
  }

  function matchCardHTML(m) {
    const isLive      = m.status === "live";
    const isCompleted = m.status === "completed";
    const isScheduled = m.status === "scheduled";

    const p1Win = m.winner === "p1";
    const p2Win = m.winner === "p2";

    const setsScore = isScheduled ? "—" : m.sets.map((s, i) => {
      const p1score = s.p1 ?? "—";
      const p2score = s.p2 ?? "—";
      return `<span class="match-set ${i === m.sets.length - 1 && isLive ? "is-current" : ""}">${p1score}—${p2score}</span>`;
    }).join(" ");

    return `
      <div class="match-card ${isLive ? "is-live" : ""}">
        ${isLive ? `<div class="match-live-badge"><span class="badge-live">LIVE</span></div>` : ""}
        ${isScheduled ? `<div class="match-time-label">🕐 ${m.time}</div>` : ""}

        <div class="match-players">
          <div class="match-player ${p1Win ? "is-winner" : ""}">
            ${avatarHTML(m.player1, p1Win)}
            <div class="match-player__info">
              <span class="match-player__name">${escHtml(m.player1.name)}</span>
              <span class="match-player__nat">${m.player1.flag} ${escHtml(m.player1.nationality)}</span>
            </div>
            ${p1Win ? `<span class="match-winner-crown">🏆</span>` : ""}
          </div>

          <div class="match-vs-col">
            <span class="match-vs">VS</span>
            <div class="match-score-col">
              ${isScheduled ? `<span class="match-tbd">待賽</span>` :
                isLive ? `<div class="match-live-score">
                  <div>${escHtml(m.liveScore?.p1 ?? "—")}</div>
                  <div>${escHtml(m.liveScore?.p2 ?? "—")}</div>
                </div>` : ""}
            </div>
          </div>

          <div class="match-player ${p2Win ? "is-winner" : ""} is-right">
            ${p2Win ? `<span class="match-winner-crown">🏆</span>` : ""}
            <div class="match-player__info is-right">
              <span class="match-player__name">${escHtml(m.player2.name)}</span>
              <span class="match-player__nat">${m.player2.flag} ${escHtml(m.player2.nationality)}</span>
            </div>
            ${avatarHTML(m.player2, p2Win)}
          </div>
        </div>

        ${!isScheduled ? `<div class="match-sets">${setsScore}</div>` : ""}
        ${isLive && m.liveScore?.currentGame ? `
          <div class="match-current-game">
            目前局分：${escHtml(m.liveScore.currentGame.p1)} — ${escHtml(m.liveScore.currentGame.p2)}
          </div>` : ""}
        <div class="match-court">🏟️ ${escHtml(m.court)}</div>
      </div>
    `;
  }

  function avatarHTML(player, isWinner) {
    return `
      <div class="player-avatar" style="background:${player.color};" title="${escHtml(player.name)}">
        ${escHtml(player.initials)}
      </div>
    `;
  }

  /* ─────────────────── Helpers ─────────────────── */
  function statusBadgeHTML(status) {
    if (status === "live")      return '<span class="badge-live">LIVE</span>';
    if (status === "upcoming")  return '<span class="badge-upcoming">即將開賽</span>';
    if (status === "scheduled") return '<span class="badge-upcoming">待賽</span>';
    return '<span class="badge-completed">已結束</span>';
  }

  function escHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ─────────────────── 初始化 ─────────────────── */
  overlayBack.addEventListener("click", closeDetail);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlayEl.classList.contains("is-open")) closeDetail();
  });

  buildFilters();
  renderGrid();

  return {
    refresh() { renderGrid(); },
  };
}
