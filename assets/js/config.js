export const APP_CONFIG = Object.freeze({
  appName: "Earth Tennis Club",
  storageNamespace: "earth_tennis_club_v1",
  api: {
    mode: "mock",
    baseUrl: "",
    timeoutMs: 8000,
  },
  security: {
    maxTextLength: 500,
    chatPerMinute: 20,
    postPerMinute: 6,
  },
});

export const TAIWAN_CITIES = Object.freeze([
  "基隆市",
  "台北市",
  "新北市",
  "桃園市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "台中市",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "台南市",
  "高雄市",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "台東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
]);
