/**
 * 賽事資訊服務 (Tournament Service)
 *
 * 目前使用 Mock 靜態資料。以下所有帶有 [API HOOK] 或 [SCRAPER HOOK]
 * 標記的位置，是未來串接真實資料源的接口。
 *
 * ── 未來串接方案（擇一）──
 *   A. 官方 API：ATP API / WTA DataHub / ITF Open Data
 *   B. 爬蟲：tennisabstract.com, flashscore.com, atptour.com
 *   C. 第三方聚合 API：RapidAPI Tennis Scores / SportsRadar Tennis
 */

import { TOURNAMENT_MOCK } from "../data/tournaments.js";

export function createTournamentService() {

  /* ══════════════════════════════════════════════
     靜態 Mock 資料層（目前使用）
     ══════════════════════════════════════════════ */

  function getMockTournaments(filter = "all") {
    if (filter === "all") return [...TOURNAMENT_MOCK];
    return TOURNAMENT_MOCK.filter((t) => t.tour.includes(filter));
  }

  function getMockTournamentById(id) {
    return TOURNAMENT_MOCK.find((t) => t.id === id) ?? null;
  }

  /* ══════════════════════════════════════════════
     [API HOOK] 主要資料取得介面
     ══════════════════════════════════════════════
     切換為真實 API 時，替換下方 fetchTournaments / fetchTournamentDetail
     的實作即可，呼叫端 (tournament-module.js) 不需修改。
     ═══════════════════════════════════════════════ */

  /**
   * [API HOOK] 取得賽事列表。
   *
   * 真實實作範例（REST API）：
   * ```js
   * const res = await fetch(`${BASE_URL}/tournaments?tour=${tour}&year=${year}`);
   * return res.json();
   * ```
   *
   * 真實實作範例（爬蟲後端）：
   * ```js
   * const res = await fetch(`${SCRAPER_URL}/api/tournaments?source=atptour`);
   * return res.json();
   * ```
   *
   * @param {{ tour?: string, year?: number }} options
   * @returns {Promise<Tournament[]>}
   */
  async function fetchTournaments({ tour = "all", year = new Date().getFullYear() } = {}) {
    // [API HOOK] — 目前回傳靜態 Mock 資料
    return getMockTournaments(tour);
  }

  /**
   * [API HOOK] 取得賽事詳情（含分組籤表、賽程）。
   *
   * @param {string} tournamentId
   * @returns {Promise<TournamentDetail|null>}
   */
  async function fetchTournamentDetail(tournamentId) {
    // [API HOOK] — 目前回傳靜態 Mock 資料
    return getMockTournamentById(tournamentId);
  }

  /**
   * [API HOOK] 取得即時比分。
   *
   * 真實實作範例（WebSocket）：
   * ```js
   * const ws = new WebSocket(`${WS_URL}/live-scores/${tournamentId}`);
   * ws.onmessage = (e) => callback(JSON.parse(e.data));
   * return () => ws.close(); // cleanup
   * ```
   *
   * 真實實作範例（輪詢 API）：
   * ```js
   * const id = setInterval(async () => {
   *   const res = await fetch(`${BASE_URL}/live/${tournamentId}`);
   *   callback(await res.json());
   * }, 30_000);
   * return () => clearInterval(id); // cleanup
   * ```
   *
   * @param {string} tournamentId
   * @param {(scores: LiveScore[]) => void} callback
   * @returns {() => void} cleanup 函式
   */
  function subscribeLiveScores(tournamentId, callback) {
    // [API HOOK] — Stub：不做任何事，回傳空的 cleanup
    console.info(
      `[TournamentService] subscribeLiveScores stub called for tournament: ${tournamentId}. ` +
      `Replace with WebSocket / polling implementation.`
    );
    return () => {};
  }

  /**
   * [SCRAPER HOOK] 觸發後端爬蟲更新賽事資料。
   *
   * 真實實作範例：
   * ```js
   * await fetch(`${SCRAPER_URL}/api/scrape`, {
   *   method: "POST",
   *   body: JSON.stringify({ source: "flashscore", tournament: tournamentId }),
   *   headers: { "Content-Type": "application/json" },
   * });
   * ```
   *
   * @param {string} tournamentId
   * @param {string} source - 爬蟲來源標識 (e.g. "flashscore", "atptour")
   */
  async function triggerScrape(tournamentId, source = "flashscore") {
    // [SCRAPER HOOK] — Stub
    console.info(
      `[TournamentService] triggerScrape stub: would scrape "${source}" for tournament ${tournamentId}`
    );
  }

  return {
    fetchTournaments,
    fetchTournamentDetail,
    subscribeLiveScores,
    triggerScrape,
  };
}
