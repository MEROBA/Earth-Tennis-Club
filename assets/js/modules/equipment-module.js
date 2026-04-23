import { EQUIPMENT_CATEGORIES } from "../data/equipment.js";
import { qs } from "../ui/dom.js";

export function initEquipmentModule({ equipmentService, memberService, notify }) {
  /* ── DOM 參考 ── */
  const categoryTabsEl = qs("#eq-category-tabs");
  const gearGridEl     = qs("#eq-gear-grid");
  const overlayEl      = qs("#eq-detail-overlay");
  const overlayBack    = qs("#eq-overlay-back");
  const overlayTitle   = qs("#eq-overlay-title");
  const overlayBody    = qs("#eq-overlay-body");

  /* ── 狀態 ── */
  let currentCategory = "all";
  let selectedRating  = 0;
  let currentGearId   = null;

  /* ─────────────────── 分類 Tabs ─────────────────── */
  function buildCategoryTabs() {
    categoryTabsEl.innerHTML = EQUIPMENT_CATEGORIES.map((cat) => `
      <button class="gear-cat-btn ${cat.id === currentCategory ? "is-active" : ""}"
              data-cat="${cat.id}" type="button">
        ${cat.label}
      </button>
    `).join("");

    categoryTabsEl.querySelectorAll(".gear-cat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentCategory = btn.dataset.cat;
        buildCategoryTabs();
        renderGrid();
      });
    });
  }

  /* ─────────────────── 星評顯示 ─────────────────── */
  function starsHTML(rating, count = null) {
    const filled = Math.round(rating * 2) / 2;
    let html = '<span class="stars">';
    for (let i = 1; i <= 5; i++) {
      if (i <= filled) html += '<span class="star is-filled">★</span>';
      else html += '<span class="star">★</span>';
    }
    html += "</span>";
    if (count !== null) {
      const label = rating > 0 ? `${rating.toFixed(1)}（${count} 則評論）` : "尚無評論";
      html += `<span class="rating-count">${label}</span>`;
    }
    return html;
  }

  /* ─────────────────── 裝備卡格線 ─────────────────── */
  function renderGrid() {
    const items = equipmentService.getEquipment(currentCategory);

    if (items.length === 0) {
      gearGridEl.innerHTML = '<p class="hint">此分類目前無裝備資料。</p>';
      return;
    }

    gearGridEl.innerHTML = items.map((gear) => {
      const { avgRating, count } = equipmentService.getReviews(gear.id);
      return `
        <article class="gear-card" data-gear-id="${gear.id}" tabindex="0" role="button"
                 aria-label="查看 ${gear.brand} ${gear.name} 詳情">
          <div class="gear-card__img" style="background: ${gear.gradient};">
            <span>${gear.emoji}</span>
          </div>
          <div class="gear-card__body">
            <p class="gear-card__category">${categoryLabel(gear.category)}</p>
            <h3 class="gear-card__name">${gear.brand} ${gear.name}</h3>
            <p class="gear-card__tagline">${gear.tagline}</p>
            <div class="gear-card__rating-row">
              ${starsHTML(avgRating, count)}
            </div>
          </div>
        </article>
      `;
    }).join("");

    gearGridEl.querySelectorAll(".gear-card").forEach((card) => {
      card.addEventListener("click", () => openDetail(card.dataset.gearId));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") openDetail(card.dataset.gearId);
      });
    });
  }

  function categoryLabel(cat) {
    const map = { racket: "🎾 網球拍", shoes: "👟 球鞋", bag: "🎒 球包" };
    return map[cat] ?? cat;
  }

  /* ─────────────────── 詳情頁 Overlay ─────────────────── */
  function openDetail(gearId) {
    const gear = equipmentService.getEquipmentById(gearId);
    if (!gear) return;

    currentGearId  = gearId;
    selectedRating = 0;

    overlayTitle.textContent = `${gear.brand} ${gear.name}`;
    overlayBody.innerHTML = `
      <div class="overlay-two-col">
        <div class="overlay-left">
          <div class="gear-detail-hero" style="background: ${gear.gradient};">
            <span>${gear.emoji}</span>
          </div>
          <div class="gear-detail-meta-pills">
            <span class="badge">${categoryLabel(gear.category)}</span>
            <span class="badge">${gear.brand}</span>
            ${gear.price ? `<span class="badge gear-price-badge">${gear.price}</span>` : ""}
          </div>
          <h2 class="gear-detail-name">${gear.brand} ${gear.name}</h2>
          <p class="gear-detail-tagline">${gear.tagline}</p>
          <p class="gear-detail-desc">${gear.description}</p>
          <dl class="gear-spec-grid">
            ${gear.specs.map((s) => `
              <div class="gear-spec-item">
                <dt>${s.label}</dt>
                <dd>${s.value}</dd>
              </div>
            `).join("")}
          </dl>
        </div>
        <div class="overlay-right" id="eq-review-section"></div>
      </div>
    `;

    renderReviews(gear);
    overlayEl.classList.add("is-open");
    overlayEl.scrollTop = 0;
    document.body.style.overflow = "hidden";
  }

  function closeDetail() {
    overlayEl.classList.remove("is-open");
    document.body.style.overflow = "";
    currentGearId  = null;
    selectedRating = 0;
  }

  /* ─────────────────── 評論列表 + 留言表單 ─────────────────── */
  function renderReviews(gear) {
    const reviewWrap = qs("#eq-review-section");
    const { reviews, avgRating, count } = equipmentService.getReviews(gear.id);

    const currentMember = memberService.getCurrentMember?.();
    const authorName    = currentMember?.name ?? "匿名球員";

    reviewWrap.innerHTML = `
      <div class="review-section">
        <h3>使用心得評論
          <span style="font-size:0.9rem; font-weight:400; color:var(--muted); margin-left:0.5rem;">
            ${starsHTML(avgRating, count)}
          </span>
        </h3>

        <div class="review-form-wrap">
          <h4>留下你的評論</h4>
          <p style="font-size:0.85rem; color:var(--muted); margin-bottom:0.3rem;">點選星星給評分</p>
          <div class="star-picker" id="eq-star-picker">
            ${[1,2,3,4,5].map((n) =>
              `<button class="star-btn" type="button" data-star="${n}" aria-label="${n} 星">★</button>`
            ).join("")}
          </div>
          <p id="eq-star-label" style="font-size:0.8rem; color:var(--muted); margin-bottom:0.5rem;">請點選星星評分</p>
          <form id="eq-review-form" class="stack">
            <label>評論內容
              <textarea name="comment" required maxlength="300"
                        placeholder="分享你使用 ${gear.brand} ${gear.name} 的實際心得…"></textarea>
            </label>
            <div class="actions">
              <button class="btn-primary" type="submit">送出評論</button>
            </div>
          </form>
        </div>

        <div id="eq-review-list" class="list">
          ${reviews.length === 0
            ? '<p class="hint" style="text-align:center; padding:1.2rem;">成為第一個留言的人！</p>'
            : reviews.map((r) => reviewItemHTML(r)).join("")}
        </div>
      </div>
    `;

    const starPicker = qs("#eq-star-picker");
    const starLabel  = qs("#eq-star-label");
    const starLabels = ["", "不推薦", "待改善", "普通", "良好", "極佳！"];

    starPicker.querySelectorAll(".star-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedRating = Number(btn.dataset.star);
        updateStarPicker(starPicker, selectedRating);
        starLabel.textContent = `${selectedRating} 星 — ${starLabels[selectedRating]}`;
        starLabel.style.color = "var(--primary)";
      });
    });

    qs("#eq-review-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (selectedRating === 0) { notify("請先選擇星級評分"); return; }
      const comment = new FormData(e.target).get("comment");
      try {
        equipmentService.addReview(gear.id, { authorName, rating: selectedRating, comment });
        notify(`評論已送出 ${"★".repeat(selectedRating)}`);
        renderReviews(gear);
      } catch (err) {
        notify(`錯誤：${err.message}`);
      }
    });
  }

  function updateStarPicker(container, rating) {
    container.querySelectorAll(".star-btn").forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.star) <= rating);
    });
  }

  function reviewItemHTML(review) {
    const date = new Date(review.createdAt).toLocaleDateString("zh-TW");
    return `
      <div class="review-item list-item">
        <div class="review-item__header">
          <span class="review-item__author">${escHtml(review.authorName)}</span>
          <span class="stars" style="font-size:0.85rem;">
            ${"★".repeat(review.rating)}<span style="color:var(--star-empty);">${"★".repeat(5 - review.rating)}</span>
          </span>
          <span class="review-item__date">${date}</span>
        </div>
        <p class="review-item__body">${escHtml(review.comment)}</p>
      </div>
    `;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ─────────────────── 初始化 ─────────────────── */
  overlayBack.addEventListener("click", closeDetail);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlayEl.classList.contains("is-open")) closeDetail();
  });

  buildCategoryTabs();
  renderGrid();

  return {
    refresh() {
      if (currentGearId) {
        const gear = equipmentService.getEquipmentById(currentGearId);
        if (gear) renderReviews(gear);
      } else {
        renderGrid();
      }
    },
  };
}
