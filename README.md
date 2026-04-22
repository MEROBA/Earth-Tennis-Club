# Earth Tennis Club

Earth Tennis Club 是一個可直接部署到 **GitHub Pages** 的前端網站，提供：

- 網球技術問卷自評，估算 **NTRP / UTR**
- 會員註冊（地點、性別、年齡、球齡）
- 依公開資料進行球友配對
- 聊天互動與約球邀約
- 全台灣球場地圖、基本資料與評價
- 球友交流區（發文 / 留言）

目前資料層預設為 LocalStorage（Mock Mode），已保留清楚的 `services` 抽象層，方便後續串接後端。

## 1. 本機啟動

由於使用 ES Modules，請不要直接雙擊 HTML，建議起一個本機伺服器：

```bash
cd /home/yuheng/PT_KURO/Project/Earth-Tennis-Club
python3 -m http.server 8080
```

開啟 `http://localhost:8080`。

## 2. 部署到 GitHub Pages

1. 推送此專案到 GitHub repository。
2. 進入 `Settings` -> `Pages`。
3. `Build and deployment` 選 `Deploy from a branch`。
4. Branch 選 `main`（或你的主分支），Folder 選 `/ (root)`。
5. 儲存後等待部署完成，即可取得公開網址。

## 3. 專案結構

```text
assets/
  css/styles.css                 # 設計系統與響應式樣式
  js/app.js                      # 啟動入口
  js/config.js                   # 全域設定、城市名單
  js/state/store.js              # 輕量狀態管理
  js/data/                       # 問卷、球場靜態資料
  js/services/                   # 資料存取與商業邏輯（可替換為後端 API）
  js/modules/                    # 各功能 UI 模組
  js/ui/dom.js                   # 共用 DOM 工具
index.html                       # 主頁面
SECURITY.md                      # 資安設計與上線建議
```

## 4. 可維護性與擴展性設計

- **分層架構**：UI 模組 (`modules`) 與資料邏輯 (`services`) 分離。
- **資料抽象**：目前使用 LocalStorage，未來可切到 REST/GraphQL。
- **可擴充功能點**：
  - `member-service.js`：會員與配對規則
  - `chat-service.js`：聊天與邀約
  - `court-service.js`：球場資料與評分
  - `forum-service.js`：社群文章與留言

## 5. 後端串接建議

把 `assets/js/config.js` 的 `api.mode` 切換為 `api`，並補上 `baseUrl`，再逐步將 service 內的 LocalStorage 邏輯改為 `api-service` 呼叫即可。

建議後端 API：

- `POST /auth/login`, `POST /auth/register`
- `GET/POST /members`
- `GET /matches?userId=...`
- `GET/POST /chat/rooms/:roomId/messages`
- `GET/POST /courts`, `GET/POST /courts/:id/reviews`
- `GET/POST /forum/posts`, `POST /forum/posts/:id/comments`

## 6. 資安說明

已實作前端層保護（輸入淨化、欄位驗證、基本限流、CSP），完整細節請看 [SECURITY.md](./SECURITY.md)。

