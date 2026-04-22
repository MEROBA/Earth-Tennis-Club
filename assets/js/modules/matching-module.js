import { createNode, renderList } from "../ui/dom.js";
import { buildPlayerCard } from "./members-module.js";

export function initMatchingModule({ memberService, onScheduleRequest, notify }) {
  const runBtn = document.querySelector("#run-matching");
  const container = document.querySelector("#matching-results");
  const emptyMsg = document.querySelector("#matching-empty");

  function renderMatches() {
    const currentUserId = memberService.getCurrentUserId();
    if (!currentUserId) {
      container.innerHTML = "";
      if (emptyMsg) emptyMsg.textContent = "請先在會員頁面選擇目前使用者。";
      return;
    }

    const matches = memberService.findMatches(currentUserId);
    if (!matches.length) {
      container.innerHTML = "";
      if (emptyMsg) emptyMsg.textContent = "沒有可用配對，請先新增更多會員。";
      return;
    }
    if (emptyMsg) emptyMsg.textContent = "";

    const cards = matches.map(({ member, score, reason }) => {
      const wrap = createNode("div", "match-result-item");
      const scoreBar = createNode("div", "match-score-bar");
      scoreBar.append(
        createNode("span", "match-score-value", `配對分數 ${score}`),
        createNode("span", "match-score-reason hint", reason)
      );
      const card = buildPlayerCard(member, {
        onSchedule: (m) => {
          if (onScheduleRequest) onScheduleRequest(m);
        },
      });
      wrap.append(scoreBar, card);
      return wrap;
    });

    renderList(container, cards);
  }

  runBtn?.addEventListener("click", () => {
    renderMatches();
    notify("已產生球友推薦");
  });

  renderMatches();

  return {
    refresh() { renderMatches(); },
  };
}
