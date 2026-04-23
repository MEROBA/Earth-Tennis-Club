import { createNode, formatDateTime, renderList } from "../ui/dom.js";

const surfaceText = {
  hard: "硬地",
  clay: "紅土",
  grass: "草地",
  synthetic: "合成地",
};

function fillCitySelect(select, cities) {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "全部";
  select.append(all);

  cities.forEach((city) => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    select.append(option);
  });
}

export function initCourtsModule({ courtService, cities, memberService, notify }) {
  const cityFilter = document.querySelector("#court-filter-city");
  const surfaceFilter = document.querySelector("#court-filter-surface");
  const filterBtn = document.querySelector("#court-filter-run");
  const list = document.querySelector("#court-list");
  const detail = document.querySelector("#court-detail");
  const reviewForm = document.querySelector("#review-form");
  const reviewList = document.querySelector("#court-review-list");

  fillCitySelect(cityFilter, cities);

  let selectedCourtId = null;
  let map;
  let markerLayer;

  function initMap() {
    map = L.map("court-map", {
      zoomControl: true,
      attributionControl: true,
    }).setView([23.7, 121], 7.2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);
  }

  function renderDetail(courtId) {
    selectedCourtId = courtId;
    const court = courtService.getCourt(courtId);
    if (!court) {
      detail.textContent = "找不到球場資料";
      return;
    }

    detail.innerHTML = "";
    detail.append(
      createNode("h4", null, court.name),
      createNode("p", null, `${court.city}｜${court.address}`),
      createNode("p", null, `${surfaceText[court.surface]}｜場數 ${court.courtCount}｜燈光 ${court.lights ? "有" : "無"}`),
      createNode("p", "hint", `費用: ${court.fee}｜平均評分: ${court.rating || "尚無"} (${court.reviewCount})`)
    );

    const reviews = courtService.getReviews(courtId);
    if (!reviews.length) {
      reviewList.innerHTML = "<p class='hint'>尚無評價，歡迎第一位留言。</p>";
      return;
    }

    const reviewNodes = reviews.map((review) => {
      const node = createNode("article", "list-item");
      node.append(
        createNode("h4", null, `${review.author}｜${"★".repeat(review.rating)}`),
        createNode("p", null, review.comment),
        createNode("p", "hint", formatDateTime(review.createdAt))
      );
      return node;
    });
    renderList(reviewList, reviewNodes);
  }

  function renderCourts() {
    const filters = {
      city: cityFilter.value,
      surface: surfaceFilter.value,
    };
    const courts = courtService.getCourts(filters);

    markerLayer.clearLayers();

    const cards = courts.map((court) => {
      const marker = L.marker([court.lat, court.lng]).addTo(markerLayer);
      marker.bindPopup(`${court.name}<br/>${court.city}｜${surfaceText[court.surface]}`);
      marker.on("click", () => renderDetail(court.id));

      const card = createNode("article", "list-item");
      const title = createNode("h4", null, court.name);
      const meta = createNode("p", null, `${court.city}｜${surfaceText[court.surface]}｜${court.fee}`);
      const score = createNode("p", "hint", `評分: ${court.rating || "尚無"} (${court.reviewCount})`);
      const button = createNode("button", "btn-secondary", "查看評價");
      button.type = "button";
      button.addEventListener("click", () => renderDetail(court.id));
      card.append(title, meta, score, button);
      return card;
    });

    renderList(list, cards);

    if (courts.length) {
      const group = new L.featureGroup(markerLayer.getLayers());
      map.fitBounds(group.getBounds().pad(0.22));
      if (!selectedCourtId || !courts.some((item) => item.id === selectedCourtId)) {
        renderDetail(courts[0].id);
      } else {
        renderDetail(selectedCourtId);
      }
    } else {
      detail.textContent = "目前篩選條件下無球場資料";
      reviewList.innerHTML = "";
    }
  }

  filterBtn.addEventListener("click", renderCourts);

  reviewForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!selectedCourtId) {
      notify("請先選擇球場");
      return;
    }

    const currentUser = memberService.getCurrentUser();
    const data = Object.fromEntries(new FormData(reviewForm).entries());
    courtService.addReview(selectedCourtId, {
      ...data,
      author: currentUser?.name || "匿名球友",
    });
    reviewForm.reset();
    renderCourts();
    notify("感謝你的球場評價");
  });

  initMap();
  renderCourts();

  return {
    refresh() { renderCourts(); },
    onTabShown() { if (map) setTimeout(() => map.invalidateSize(), 80); },
  };
}
