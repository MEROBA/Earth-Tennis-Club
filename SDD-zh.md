# 設計說明文件

## 1. 文件管控

- 專案名稱：Earth Tennis Club
- 版本：1.1.0
- 日期：2026-04-23
- 狀態：開發基準版（進行中）
- 範圍：當前前端實作 + 後端合約與資料架構

## 2. 目的

本文件定義 Earth Tennis Club 的當前開發規格，包含功能行為、系統架構、資料設計、API 合約邊界、資安控制及非功能性需求。

## 3. 產品範疇

Earth Tennis Club 是一個網球社群平台，提供以下功能：

- 球員卡系統（照片、基本資料、身高、擅長打法）
- NTRP 自我評估問卷（整合於球員卡編輯頁）
- 球友智慧推薦（一鍵配對，依 NTRP、球齡、地區計分）
- 約打球排程與邀約狀態管理
- 全台灣球場瀏覽（地圖與評價）
- 社群論壇文章與留言

## 4. 利害關係人

- 終端使用者：尋找球友或球場的網球玩家
- 產品負責人：平台運營者或社群組織者
- 工程團隊：前端、後端、資料庫、DevOps / 資安
- 內容管理 / 管理員：內容審核與濫用管理

## 5. 功能需求

### FR-01 球員卡與個人檔案

- 使用者可以建立 / 更新自己的球員卡。
- 球員卡包含：
  - 顯示名稱
  - 所在城市
  - 性別
  - 身高（選填）
  - 年齡
  - 球齡（年）
  - 慣用場地類型
  - 擅長打法（底線型 / 上網型 / 全場型 / 防守型 / 進攻型）
  - 可打球時段文字
  - 球員照片（選填，Base64 儲存）
  - NTRP 等級
- 球員卡在球員列表、配對結果與約球邀約中皆可顯示。

### FR-02 NTRP 自我評估

- 使用者可在編輯球員卡時展開 NTRP 自我評估問卷。
- 系統依據答題結果計算估算的 NTRP 等級並自動填入欄位。
- 評估歷史紀錄儲存於 LocalStorage，供未來分析。
- 平台僅使用 NTRP 等級，不使用 UTR 等級。

### FR-03 球友智慧推薦

- 使用者可以一鍵產生球友推薦列表。
- 系統依據以下條件計算推薦分數：
  - 城市相近程度（同縣市 30 分，不同縣市 10 分）
  - NTRP 等級差距（差距越小分數越高，最高 28 分）
  - 年齡接近程度（最高 18 分）
  - 球齡接近程度（最高 12 分）
  - 可打球時段關鍵字相似度（最高 10 分）
- 推薦結果以球員卡形式呈現，可直接點選「約打球」跳轉至排程頁面。

### FR-04 約打球排程

- 使用者可以對任意球員送出約球邀約，包含日期時間、球場名稱與備註。
- 對象選擇頁面顯示目標球員的球員卡預覽。
- 邀約狀態支援完整生命週期：
  - `proposed`（待確認）
  - `accepted`（已接受）
  - `rejected`（已拒絕）
  - `cancelled`（已取消）
  - `completed`（已完成）
- 收到邀約者可接受或拒絕；已接受的邀約可進一步標記為完成或取消。
- 不包含聊天訊息功能，專注於約球排程。

### FR-05 球場與評價

- 使用者可以瀏覽全台灣的球場列表與 Leaflet 地圖。
- 使用者可以依城市或場地類型篩選。
- 使用者可以查看並提交球場評價。
- 每位使用者對每個球場只能維護一則評價（更新插入行為）。

### FR-06 論壇

- 使用者可以依分類發布文章（戰術討論 / 裝備心得 / 訓練分享 / 閒聊）。
- 使用者可以新增留言（透過父留言 ID 支援串狀回覆）。
- 支援分類篩選瀏覽。
- 支援公開讀取。

### FR-07 資安與驗證

- 受保護 API 使用 JWT 存取權杖進行身分驗證。
- 更新 Token 輪換機制，具備重複使用偵測功能。
- 登出時撤銷更新 Token 工作階段。
- 基本濫用防護（速率限制、輸入驗證、內容淨化）。

## 6. 非功能性需求

### NFR-01 可維護性

- 前端採用模組化設計（`modules`、`services`、`ui`）。
- 後端合約以 OpenAPI 定義。
- 資料庫結構與驗證流程皆有文件記錄且支援版本管理。

### NFR-02 可擴展性

- 儲存層與 API 層與 UI 邏輯分離。
- 資料模型支援角色擴充、內容審核及數據分析。

### NFR-03 效能

- 核心列表端點支援分頁。
- 建議架構使用 Redis 以實現低延遲的速率限制 / 工作階段查詢。

### NFR-04 資安

- API 邊界執行輸入驗證。
- 密碼使用 Argon2id 演算法雜湊。
- 存取 Token 短效期，更新 Token 採輪換機制。
- 正式環境建議部署 WAF / CDN。

### NFR-05 可用性

- API 應提供健康狀態端點。
- 高頻讀取路徑已建立資料庫索引。

## 7. 系統架構

### 7.1 前端

- 可部署於 GitHub Pages 的靜態網站。
- 基於 ES 模組的 JavaScript，無需打包工具。
- 目前本機模式：使用 LocalStorage 模擬資料層。
- 可透過 `config.js` 的 `api.mode` 設定啟用 API 模式。

### 7.2 後端（目標）

- 應用程式 API 服務（Node.js + Express，REST 風格）
- PostgreSQL 作為主要資料儲存
- Redis 用於速率限制、Token / 工作階段控制與快取
- API 前端部署 CDN / WAF，防禦 DDoS 與機器人攻擊

## 8. UI / UX 設計規格

當前網頁前端的視覺設計方向：

- 主題：2026 澳網（Australian Open）藍白漸層運動風格
- 色彩系統（CSS 自訂屬性）：

| 變數 | 色碼 | 用途 |
|------|------|------|
| `--ao-navy` | `#001840` | 深藍底色、Hero 背景深層 |
| `--ao-royal` | `#0052A8` | 皇家藍、按鈕漸層終點 |
| `--ao-blue` | `#0070D4` | 主強調藍、Tab active 漸層起點 |
| `--ao-sky` | `#0096E0` | 天空藍、按鈕漸層起點 |
| `--ao-cyan` | `#00B4E8` | 青色亮點、徽章色調 |

  - 主體背景：`linear-gradient(155deg, #f2f8ff 0%, #e0eeff 48%, #d2e8ff 100%)` — 淺藍白漸層
  - Hero / 深色面板：保留 AO Navy 深色背景，確保白色文字對比
  - 卡片：白色表面（`rgba(255, 255, 255, 0.97)`），搭配藍色框線與陰影

- 字型：
  - 標題顯示：`Barlow Condensed`
  - 內文：`Noto Sans TC`
- 動畫效果：
  - 細緻的顯現過渡動畫（`fade-up`）
  - 環境光暈效果（`glow-orb`）：青色（左）與皇家藍（右）
- 版面構成：
  - 球場線條疊層裝飾（`court-lines`）
  - 基於卡片的球員卡網格佈局（`player-card-grid`）

設計靈感參考：

- 2026 澳網官方視覺識別（深藍 + 天空藍 + 白色空間）
- Nike 運動應用程式風格（運動感、高對比、粗體標題）

## 9. 資料設計（PostgreSQL）

結構描述檔案：`backend/db/schema.sql`

主要實體：

| 資料表 | 說明 |
|--------|------|
| `app_users` | 應用程式使用者（帳號 / 密碼雜湊） |
| `member_profiles` | 會員個人檔案（含身高、擅長打法） |
| `member_assessments` | NTRP 技術評估歷史紀錄 |
| `match_requests` | 配對請求記錄 |
| `chat_rooms` | 聊天室（後端預留） |
| `chat_room_participants` | 聊天室參與者 |
| `chat_messages` | 聊天訊息（後端預留） |
| `play_invites` | 約球邀約（前端主要使用） |
| `courts` | 球場靜態資料 |
| `court_reviews` | 球場評價（每人每場地唯一） |
| `forum_posts` | 論壇文章 |
| `forum_comments` | 論壇留言（支援串狀回覆） |
| `auth_refresh_sessions` | 驗證更新工作階段 |
| `auth_audit_logs` | 驗證稽核日誌 |

設計說明：

- 所有主要資料表使用 UUID 主鍵。
- 使用列舉類型強制領域限制。
- 透過觸發器自動維護 `updated_at` 欄位。
- 針對高頻查詢路徑建立局部 / 複合索引。

## 10. API 合約

OpenAPI 檔案：`backend/api/openapi.yaml`

API 領域：

| 領域 | 端點 |
|------|------|
| Auth（驗證） | register / login / refresh / logout |
| Members（會員） | GET/PATCH /me、公開球員卡列表（含篩選） |
| Matching（配對） | 推薦列表（依評分排序） |
| Chat（約球） | rooms / messages / invites |
| Courts（球場） | 球場列表（分頁）/ 評價 upsert |
| Forum（論壇） | posts / comments（支援串狀回覆） |

錯誤格式：

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": null
}
```

## 11. JWT 與工作階段規格

流程說明檔案：`backend/docs/JWT_FLOW.md`

- 存取 Token：JWT Bearer，有效期 15 分鐘
- 更新 Token：HttpOnly Cookie，有效期 30 天，每次更新時輪換，具備重複使用偵測與工作階段家族撤銷機制
- 登出：撤銷更新 Token 工作階段並清除 Cookie

## 12. 資安控制

前端基準：

- `index.html` 中設置 CSP（內容安全策略）
- 輸入淨化與欄位長度限制（`security-service.js`）
- 約球邀約與發文具備用戶端速率限制

後端必要控制：

- 伺服器端驗證（絕不信任前端資料）
- 依 IP 與使用者識別碼進行速率限制
- Cookie 安全旗標設定（`HttpOnly`、`Secure`、`SameSite`）
- 驗證事件稽核日誌
- 金鑰 / 密鑰輪換流程

## 13. 部署規格

前端：

- GitHub Pages 靜態部署（零伺服器費用）
- 僅需一個靜態伺服器，ES 模組直接載入

後端目標：

- 容器化 API 服務（Docker）
- PostgreSQL + Redis 服務
- 透過 `.env` 檔案進行環境設定
- 邊緣層進行 TLS 終止與 WAF 防護

## 14. 測試策略

- 單元測試：
  - NTRP 評分計算邏輯（`scoring-service.js`）
  - 配對評分演算法（`member-service.js`）
  - 驗證 Token / 工作階段生命週期
- 整合測試：
  - 驗證流程：register / login / refresh / logout
  - 論壇發文與留言
  - 約球邀約 CRUD 與狀態轉換
- 端對端測試（E2E）：
  - 前端工作流程：球員卡編輯、球友推薦、約打球、球場

## 15. 可追溯性（功能 → 對應檔案）

| 功能 | 對應檔案 |
|------|----------|
| UI 與互動 | `index.html`、`assets/css/styles.css`、`assets/js/modules/*` |
| 球員卡 + NTRP 評估 | `members-module.js`、`member-service.js`、`scoring-service.js` |
| 球友推薦 | `matching-module.js`、`member-service.js`（`findMatches`） |
| 約打球排程 | `invite-module.js`、`invite-service.js` |
| 球場地圖 | `courts-module.js`、`court-service.js`、`data/courts.js` |
| 論壇 | `forum-module.js`、`forum-service.js` |
| 後端 API 規格 | `backend/api/openapi.yaml` |
| 資料庫結構 | `backend/db/schema.sql` |
| 後端服務骨架 | `backend/src/` |
| 驗證流程 | `backend/docs/JWT_FLOW.md` |
| 系統架構 | `backend/docs/ARCHITECTURE.md` |
| 前後端對應 | `backend/docs/FRONTEND_INTEGRATION.md` |

## 16. 已知缺口與後續步驟

- 目前前端預設仍以模擬儲存模式（LocalStorage）運行。
- 球員照片以 Base64 儲存於 LocalStorage，後端版本應改用 Object Storage（如 S3）。
- 後端實作已有骨架，尚待串接資料庫與正式環境測試。
- 建議下一階段：
  1. 對後端骨架補充資料庫查詢實作並執行整合測試
  2. 執行資料庫遷移並匯入全台球場種子資料
  3. 整合前端 API 模式，銜接 JWT 驗證與受保護路由
  4. 後端 member_profiles 資料表新增 `height`、`play_style`、`photo_url` 欄位
