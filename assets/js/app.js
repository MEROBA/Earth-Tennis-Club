import { APP_CONFIG, TAIWAN_CITIES } from "./config.js";
import { initMembersModule } from "./modules/members-module.js";
import { initMatchingModule } from "./modules/matching-module.js";
import { initCourtsModule } from "./modules/courts-module.js";
import { initForumModule } from "./modules/forum-module.js";
import { initInviteModule } from "./modules/invite-module.js";
import { createApiService } from "./services/api-service.js";
import { createCourtService } from "./services/court-service.js";
import { createForumService } from "./services/forum-service.js";
import { createMemberService } from "./services/member-service.js";
import { createInviteService } from "./services/invite-service.js";
import { createRateLimiter } from "./services/security-service.js";
import { createStorageService } from "./services/storage-service.js";
import { qsa } from "./ui/dom.js";

const storage = createStorageService(APP_CONFIG.storageNamespace);
const api = createApiService(APP_CONFIG.api);
const rateLimiter = createRateLimiter(storage);

const memberService = createMemberService(storage, api);
const courtService = createCourtService(storage, api);
const forumService = createForumService(storage, api);
const inviteService = createInviteService(storage);

const toast = document.querySelector("#toast");
const chip = document.querySelector("#api-mode-chip");
chip.textContent = APP_CONFIG.api.mode === "mock" ? "Mock Mode" : "API Mode";

let toastTimer;
function notify(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

function initTabs() {
  const buttons = qsa(".tab-button");
  const views = qsa(".view");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view;
      buttons.forEach((b) => b.classList.toggle("is-active", b === btn));
      views.forEach((v) => v.classList.toggle("is-active", v.dataset.view === target));
    });
  });
}

let matchingModule;
let inviteModule;
let courtsModule;
let forumModule;

function onCurrentUserChange() {
  matchingModule?.refresh();
  inviteModule?.refresh();
  courtsModule?.refresh();
  forumModule?.refresh();
}

const membersModule = initMembersModule({
  memberService,
  cities: TAIWAN_CITIES,
  notify,
  onCurrentUserChange,
});

matchingModule = initMatchingModule({
  memberService,
  onScheduleRequest(member) {
    // Switch to invite tab and pre-select this member
    const inviteTabBtn = document.querySelector('[data-view="invite"]');
    inviteTabBtn?.click();
    inviteModule?.prefillTarget(member);
    notify(`已切換至約打球，目標：${member.name}`);
  },
  notify,
});

inviteModule = initInviteModule({
  memberService,
  inviteService,
  rateLimiter,
  inviteLimit: APP_CONFIG.security.chatPerMinute,
  notify,
});

courtsModule = initCourtsModule({
  courtService,
  cities: TAIWAN_CITIES,
  memberService,
  notify,
});

forumModule = initForumModule({
  forumService,
  memberService,
  rateLimiter,
  postLimit: APP_CONFIG.security.postPerMinute,
  notify,
});

initTabs();
notify("Earth Tennis Club 已啟動");
