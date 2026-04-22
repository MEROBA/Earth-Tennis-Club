import { createNode, renderList } from "../ui/dom.js";

export function initMatchingModule({ memberService, notify }) {
  const runBtn = document.querySelector("#run-matching");
  const container = document.querySelector("#matching-results");

  function renderMatches() {
    const currentUserId = memberService.getCurrentUserId();
    if (!currentUserId) {
      container.innerHTML = "<p class='hint'>請先在會員系統選擇目前使用者。</p>";
      return;
    }

    const matches = memberService.findMatches(currentUserId);
    if (!matches.length) {
      container.innerHTML = "<p class='hint'>沒有可用配對，請先新增更多會員。</p>";
      return;
    }

    const cards = matches.map(({ member, score, reason }) => {
      const node = createNode("article", "list-item");
      node.append(
        createNode("h4", null, `${member.name}｜配對分數 ${score}`),
        createNode("p", null, `${member.city}｜NTRP ${member.ntrp} / UTR ${member.utr}`),
        createNode("p", "hint", reason),
      );
      return node;
    });

    renderList(container, cards);
  }

  runBtn.addEventListener("click", () => {
    renderMatches();
    notify("已產生配對建議");
  });

  renderMatches();

  return {
    refresh() {
      renderMatches();
    },
  };
}
