import { TOURNAMENT_TOURS } from "../data/tournaments.js";
import { qs } from "../ui/dom.js";

/**
 * 初始化「賽事資訊」頁面模組。
 */
export function initTournamentModule({ tournamentService, notify }) {
  /* ── DOM 參考 ── */
  const filterBarEl      = qs("#tn-filter-bar");
  const tournamentGridEl = qs("#tn-tournament-grid");
  const listViewEl       = qs("#tn-list-view");
  const detailViewEl     = qs("#tn-detail-view");
  const backBtn          = qs("#tn-back-btn");

  /* ── 狀態 ── */
  let currentTour     = "all";
  let liveCleanup     = null;

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
    const statusBadge = statusBadgeHTML(t.status);
    return `
      <article class="tournament-card" data-tid="${t.id}" tabindex="0" role="button"
               aria-label="查看 ${t.name} 詳情">
        <div class="tournament-card__banner">
          <div class="tournament-card__banner-bg"
               style="background: ${t.gradient};"></div>
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
            ${statusBadge}
            <span class="badge" style="font-size:0.72rem;">💰 ${t.prize}</span>
          </div>
        </div>
      </article>
    `;
  }

  function statusBadgeHTML(status) {
    if (status === "live")      return '<span class="badge-live">LIVE</span>';
    if (status === "upcoming")  return '<span class="badge-upcoming">即將開賽</span>';
    return '<span class="badge-completed">已結束</span>';
  }

  /* ─────────────────── 詳情頁 ─────────────────── */
  async function openDetail(tournamentId) {
    listViewEl.classList.remove("is-active");
    detailViewEl.classList.add("is-open");
    detailViewEl.innerHTML = `
      <div class="card" style="text-align:center; padding:2rem;">
        <p class="hint">載入賽事詳情中…</p>
      </div>`;

    try {
      const t = await tournamentService.fetchTournamentDetail(tournamentId);
      if (!t) {
        detailViewEl.innerHTML = `<div class="card"><p class="hint">找不到賽事資訊。</p></div>`;
        return;
      }
      renderDetail(t);
    } catch (err) {
      detailViewEl.innerHTML = `<div class="card"><p class="hint" style="color:#c0392b;">載入失敗：${err.message}</p></div>`;
    }
  }

  function renderDetail(t) {
    detailViewEl.innerHTML = `
      <!-- 返回按鈕 -->
      <div class="gear-detail-header" style="margin-bottom:0.5rem;">
        <button class="btn-secondary gear-back-btn" id="tn-back-btn-inner" type="button">← 返回賽事列表</button>
        <span class="badge ${t.status === "live" ? "" : ""}">${statusBadgeHTML(t.status)}</span>
      </div>

      <!-- Banner -->
      <div class="tournament-detail__banner" style="background: ${t.gradient};">
        <div style="position:absolute; inset:0; background: linear-gradient(180deg, rgba(0,10,30,0.15) 0%, rgba(0,20,60,0.70) 100%);"></div>
        <div class="tournament-detail__content">
          <h2 class="tournament-detail__title">${t.emoji} ${t.nameFull}</h2>
          <p class="tournament-detail__subtitle">${t.location} &nbsp;·&nbsp; ${t.surface}</p>
        </div>
      </div>

      <!-- 資訊格線 -->
      <div class="card">
        <dl class="tournament-info-grid">
          <div class="tournament-info-block"><dt>日期</dt><dd>${t.dates}</dd></div>
          <div class="tournament-info-block"><dt>場地</dt><dd>${t.surface}</dd></div>
          <div class="tournament-info-block"><dt>獎金</dt><dd>${t.prize}</dd></div>
          <div class="tournament-info-block"><dt>賽事層級</dt><dd>${t.tier}</dd></div>
          ${t.draws.ms ? `<div class="tournament-info-block"><dt>男單籤位</dt><dd>${t.draws.ms} 籤</dd></div>` : ""}
          ${t.draws.ws ? `<div class="tournament-info-block"><dt>女單籤位</dt><dd>${t.draws.ws} 籤</dd></div>` : ""}
        </dl>
        <p style="line-height:1.65; color:var(--ink); margin:0.6rem 0 0;">${t.description}</p>
      </div>

      <!-- 冠軍區塊 -->
      <div class="card">
        <h3 style="margin-bottom:0.7rem;">🏆 冠軍</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.7rem;">
          <div class="gear-spec-item">
            <dt>男子單打</dt>
            <dd>${t.champions.ms}</dd>
          </div>
          <div class="gear-spec-item">
            <dt>女子單打</dt>
            <dd>${t.champions.ws}</dd>
          </div>
        </div>
      </div>

      <!-- 實況 / 分數區塊（API/SCRAPER STUB） -->
      ${liveStubHTML(t)}
    `;

    qs("#tn-back-btn-inner").addEventListener("click", closeDetail);

    /* 如果此賽事啟用 live，訂閱即時分數 */
    if (t.liveEnabled) {
      liveCleanup?.();
      liveCleanup = tournamentService.subscribeLiveScores(t.id, (scores) => {
        /* [API HOOK] 收到即時分數後更新 #tn-live-scores */
        const liveContainer = qs("#tn-live-scores");
        if (liveContainer) {
          liveContainer.innerHTML = scores
            .map((s) => `<div class="list-item">${escHtml(JSON.stringify(s))}</div>`)
            .join("") || "<p class='hint'>暫無進行中比賽</p>";
        }
      });
    }
  }

  function liveStubHTML(t) {
    if (t.status === "upcoming") {
      return `
        <div class="live-stub-banner">
          <div class="live-stub-title">📡 實況與籤表</div>
          <p class="live-stub-desc">
            此賽事尚未開賽（${t.dates}）。開賽後系統將自動串接即時比分與籤表資料。
          </p>
          <div class="live-stub-hooks">
            <span class="hook-tag">fetchTournaments()</span>
            <span class="hook-tag">fetchTournamentDetail()</span>
            <span class="hook-tag">subscribeLiveScores()</span>
          </div>
        </div>
      `;
    }
    if (t.status === "completed") {
      return `
        <div class="live-stub-banner" style="background: linear-gradient(120deg, #1a2a1a 0%, #2a4a2a 50%, #3a6a3a 100%);">
          <div class="live-stub-title">✅ 賽事已結束</div>
          <p class="live-stub-desc">
            可串接官方 API 或歷史資料庫取得完整對戰記錄、統計數據與籤表。
          </p>
          <div class="live-stub-hooks">
            <span class="hook-tag">fetchTournamentDetail()</span>
            <span class="hook-tag">ATP/WTA Historical API</span>
            <span class="hook-tag">triggerScrape()</span>
          </div>
        </div>
      `;
    }
    /* status === "live" */
    return `
      <div class="live-stub-banner">
        <div class="live-stub-title">
          <span class="badge-live" style="font-size:0.9rem;">LIVE</span>
          即時比分
        </div>
        <p class="live-stub-desc">
          即時比分功能已預留 API 接口（subscribeLiveScores）。串接 WebSocket 或輪詢 API 後，
          比分將自動更新顯示於下方區塊。
        </p>
        <div class="live-stub-hooks">
          <span class="hook-tag">subscribeLiveScores(id, callback)</span>
          <span class="hook-tag">WebSocket / 30s polling</span>
          <span class="hook-tag">flashscore API</span>
        </div>
        <div id="tn-live-scores" style="margin-top:0.8rem;">
          <p style="color:rgba(255,255,255,0.6); font-size:0.85rem;">等待即時資料連線中…</p>
        </div>
      </div>
    `;
  }

  function closeDetail() {
    liveCleanup?.();
    liveCleanup = null;
    detailViewEl.classList.remove("is-open");
    detailViewEl.innerHTML = "";
    listViewEl.classList.add("is-active");
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ─────────────────── 初始化 ─────────────────── */
  backBtn.addEventListener("click", closeDetail);

  buildFilters();
  renderGrid();
  listViewEl.classList.add("is-active");

  return {
    refresh() {
      if (!detailViewEl.classList.contains("is-open")) {
        renderGrid();
      }
    },
  };
}
