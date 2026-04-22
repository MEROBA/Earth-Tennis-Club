import { createNode, renderList } from "../ui/dom.js";

function fillCitySelect(select, cities, includeAll = false) {
  select.innerHTML = "";
  if (includeAll) {
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "全部";
    select.append(allOption);
  }
  cities.forEach((city) => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    select.append(option);
  });
}

function renderMemberCard(member) {
  const node = createNode("article", "list-item");
  const name = createNode("h4", null, `${member.name} (${member.city})`);
  const detail = createNode(
    "p",
    null,
    `性別: ${member.gender}｜年齡: ${member.age}｜球齡: ${member.yearsPlaying} 年`
  );
  const level = createNode("p", null, `NTRP ${Number(member.ntrp).toFixed(1)} / UTR ${Number(member.utr).toFixed(1)}`);
  const badges = createNode("div", "badge-row");
  [member.preferredSurface, member.availability || "時段待補"].forEach((item) => {
    badges.append(createNode("span", "badge", item));
  });

  node.append(name, detail, level, badges);
  return node;
}

export function initMembersModule({ memberService, cities, notify, onCurrentUserChange }) {
  const form = document.querySelector("#member-form");
  const citySelect = document.querySelector("#member-city");
  const filterCity = document.querySelector("#member-filter-city");
  const filterLevel = document.querySelector("#member-filter-level");
  const filterRun = document.querySelector("#member-filter-run");
  const list = document.querySelector("#member-list");
  const currentUserSelect = document.querySelector("#current-user-select");
  const currentSummary = document.querySelector("#current-user-summary");

  fillCitySelect(citySelect, cities);
  fillCitySelect(filterCity, cities, true);

  function renderCurrentSummary() {
    const user = memberService.getCurrentUser();
    if (!user) {
      currentSummary.textContent = "尚未選擇會員。";
      return;
    }

    currentSummary.textContent = `${user.name}｜${user.city}｜NTRP ${Number(user.ntrp).toFixed(
      1
    )} / UTR ${Number(user.utr).toFixed(1)}｜可打球: ${user.availability || "未填寫"}`;
  }

  function renderCurrentUserSelect() {
    const members = memberService.getMembers();
    const currentUserId = memberService.getCurrentUserId();
    currentUserSelect.innerHTML = "";

    members.forEach((member) => {
      const option = document.createElement("option");
      option.value = member.id;
      option.textContent = `${member.name} (${member.city})`;
      if (member.id === currentUserId) {
        option.selected = true;
      }
      currentUserSelect.append(option);
    });

    renderCurrentSummary();
  }

  function renderMembers(filtered = null) {
    const members = filtered || memberService.getMembers();
    if (!members.length) {
      list.innerHTML = "<p class='hint'>目前沒有會員資料。</p>";
      return;
    }
    renderList(list, members.map(renderMemberCard));
  }

  function refreshAll() {
    renderMembers();
    renderCurrentUserSelect();
    onCurrentUserChange();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      memberService.saveMember(data);
      notify(`會員 ${data.name} 已儲存`);
      form.reset();
      refreshAll();
    } catch (error) {
      notify(error.message);
    }
  });

  filterRun.addEventListener("click", () => {
    const members = memberService.filterMembers({
      city: filterCity.value,
      minNtrp: filterLevel.value,
    });
    renderMembers(members);
  });

  currentUserSelect.addEventListener("change", () => {
    memberService.setCurrentUserId(currentUserSelect.value);
    renderCurrentSummary();
    onCurrentUserChange();
    notify("已切換目前使用者");
  });

  refreshAll();

  return {
    applyAssessment(result) {
      form.elements.utr.value = result.utr;
      form.elements.ntrp.value = result.ntrp;
      notify("已把問卷結果帶入會員表單");
    },
    refresh() {
      refreshAll();
    },
  };
}
