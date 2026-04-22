import { APP_CONFIG, TAIWAN_CITIES } from "./config.js";
import { QUESTIONNAIRE_ITEMS } from "./data/questionnaire.js";
import { initAssessmentModule } from "./modules/assessment-module.js";
import { initMembersModule } from "./modules/members-module.js";
import { initMatchingModule } from "./modules/matching-module.js";
import { initChatModule } from "./modules/chat-module.js";
import { initCourtsModule } from "./modules/courts-module.js";
import { initForumModule } from "./modules/forum-module.js";
import { createApiService } from "./services/api-service.js";
import { createChatService } from "./services/chat-service.js";
import { createCourtService } from "./services/court-service.js";
import { createForumService } from "./services/forum-service.js";
import { createMemberService } from "./services/member-service.js";
import { evaluateTennisLevel } from "./services/scoring-service.js";
import { createRateLimiter } from "./services/security-service.js";
import { createStorageService } from "./services/storage-service.js";
import { createStore } from "./state/store.js";
import { qsa } from "./ui/dom.js";

const storage = createStorageService(APP_CONFIG.storageNamespace);
const api = createApiService(APP_CONFIG.api);
const rateLimiter = createRateLimiter(storage);
const store = createStore({
  latestAssessment: null,
});

const memberService = createMemberService(storage, api);
const chatService = createChatService(storage, api);
const courtService = createCourtService(storage, api);
const forumService = createForumService(storage, api);

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

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.view;
      buttons.forEach((item) => item.classList.toggle("is-active", item === button));
      views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === target));
    });
  });
}

let matchingModule;
let chatModule;
let courtsModule;
let forumModule;
let membersModule;

function onCurrentUserChange() {
  matchingModule?.refresh();
  chatModule?.refresh();
  courtsModule?.refresh();
  forumModule?.refresh();
}

const assessmentModule = initAssessmentModule({
  questionnaireItems: QUESTIONNAIRE_ITEMS,
  evaluate: evaluateTennisLevel,
  getHistory: () => memberService.getAssessmentHistory(),
  onResult(result) {
    store.setState({ latestAssessment: result });
    memberService.saveAssessment(result);
    membersModule?.applyAssessment(result);
  },
  notify,
});

membersModule = initMembersModule({
  memberService,
  cities: TAIWAN_CITIES,
  notify,
  onCurrentUserChange,
});

matchingModule = initMatchingModule({
  memberService,
  notify,
});

chatModule = initChatModule({
  memberService,
  chatService,
  rateLimiter,
  chatLimit: APP_CONFIG.security.chatPerMinute,
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

store.subscribe((state) => {
  if (state.latestAssessment) {
    assessmentModule.setLatestResult(state.latestAssessment);
  }
});

initTabs();
notify("Earth Tennis Club 已啟動");
