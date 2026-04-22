import { createNode } from "../ui/dom.js";

export function initAssessmentModule({ questionnaireItems, evaluate, onResult, notify }) {
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

  return {
    setLatestResult(result) {
      renderResult(result);
    },
  };
}
