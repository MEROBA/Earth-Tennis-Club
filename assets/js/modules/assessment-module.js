import { createNode } from "../ui/dom.js";

export function initAssessmentModule({ questionnaireItems, evaluate, getHistory, onResult, notify }) {
  const form = document.querySelector("#assessment-form");
  const submitBtn = document.querySelector("#assessment-submit");
  const resetBtn = document.querySelector("#assessment-reset");
  const resultBox = document.querySelector("#assessment-result");

  questionnaireItems.forEach((item) => {
    const wrapper = createNode("label");
    wrapper.textContent = item.title;

    const hint = createNode("small", "hint", item.description);
    const input = document.createElement("input");
    input.type = "range";
    input.min = "1";
    input.max = "7";
    input.step = "1";
    input.value = "4";
    input.name = item.id;

    const valueText = createNode("span", "hint", "目前分數：4");
    input.addEventListener("input", () => {
      valueText.textContent = `目前分數：${input.value}`;
    });

    wrapper.append(hint, input, valueText);
    form.append(wrapper);
  });

  function renderResult(result) {
    resultBox.replaceChildren();
    const title = createNode("h3", null, "評估結果");
    const detail = createNode("p");
    const ntrpStrong = createNode("strong", null, `NTRP ${result.ntrp.toFixed(1)}`);
    const separator = document.createTextNode(" / ");
    const utrStrong = createNode("strong", null, `UTR ${result.utr.toFixed(1)}`);
    detail.append(ntrpStrong, separator, utrStrong);
    const score = createNode("p", null, `技術平均分數：${result.averageScore}`);
    const summary = createNode("p", "hint", result.summary);
    resultBox.append(title, detail, score, summary);
  }

  submitBtn.addEventListener("click", () => {
    const formData = new FormData(form);
    const answers = {};
    for (const [key, value] of formData.entries()) {
      answers[key] = Number(value);
    }

    try {
      const result = evaluate(answers);
      renderResult(result);
      onResult(result);
      notify("已更新 NTRP / UTR 評估結果");
    } catch (error) {
      notify(error.message);
    }
  });

  resetBtn.addEventListener("click", () => {
    form.reset();
    form.querySelectorAll('input[type="range"]').forEach((input) => {
      input.value = "4";
    });
    form.querySelectorAll("span.hint").forEach((node) => {
      if (node.textContent.startsWith("目前分數：")) {
        node.textContent = "目前分數：4";
      }
    });
    resultBox.innerHTML = "<h3>評估結果</h3><p>尚未計算。</p>";
  });

  function renderHistory() {
    const history = getHistory ? getHistory() : [];
    const historyBox = document.querySelector("#assessment-history");
    if (!historyBox) return;
    if (!history.length) {
      historyBox.innerHTML = "<p class='hint'>尚無評估紀錄。</p>";
      return;
    }
    historyBox.replaceChildren(
      ...history.slice(0, 10).map((item) => {
        const node = createNode("article", "list-item");
        node.append(
          createNode("p", null, `NTRP ${item.ntrp.toFixed(1)} / UTR ${item.utr.toFixed(1)}  ·  平均分 ${item.averageScore}`),
          createNode("p", "hint", `${item.summary}  ·  ${new Date(item.createdAt).toLocaleDateString("zh-TW")}`)
        );
        return node;
      })
    );
  }

  return {
    setLatestResult(result) {
      renderResult(result);
      renderHistory();
    },
  };
}
