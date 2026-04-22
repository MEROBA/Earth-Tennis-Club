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

export function buildPlayerCard(member, { isCurrentUser = false, onSchedule = null } = {}) {
  const card = createNode("article", `player-card${isCurrentUser ? " is-self" : ""}`);

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

  card.append(photoWrap, body);
  return card;
}

export function initMembersModule({ memberService, cities, notify, onCurrentUserChange }) {
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
    currentCardWrap.append(buildPlayerCard(user, { isCurrentUser: true }));
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
    renderList(list, members.map((m) => buildPlayerCard(m)));
  }

  function refreshAll() {
    renderMembers();
    renderCurrentUserSelect();
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
