# 設計說明文件

## 1. 文件管控

- 專案名稱：Earth Tennis Club
- 版本：1.0.0
- 日期：2026-04-22
- 狀態：開發基準版（進行中）
- 範圍：當前前端實作 + 後端合約與資料架構

## 2. 目的

本文件定義 Earth Tennis Club 的當前開發規格，包含功能行為、系統架構、資料設計、API 合約邊界、資安控制及非功能性需求。

## 3. 產品範疇

Earth Tennis Club 是一個網球社群平台，提供以下功能：

- 網球等級自我評估（`UTR` 與 `NTRP` 估算）
- 會員個人檔案註冊與公開配對資料
- 球友配對推薦
- 聊天互動與約球排程
- 全台灣球場瀏覽（地圖與評價）
- 社群論壇文章與留言

## 4. 利害關係人

- 終端使用者：尋找球友或球場的網球玩家
- 產品負責人：平台運營者或社群組織者
- 工程團隊：前端、後端、資料庫、DevOps / 資安
- 內容管理 / 管理員：內容審核與濫用管理

## 5. 功能需求

### FR-01 使用者與個人檔案

- 使用者可以註冊 / 登入。
- 每位使用者擁有一份個人檔案，包含：
  - 顯示名稱
  - 所在城市
  - 性別
  - 年齡
  - 球齡（年）
  - 慣用場地類型
  - 可打球時段文字
  - 目前 UTR / NTRP

### FR-02 技術評估

- 使用者可以回答網球技術問卷。
- 系統依據答題結果計算估算的 NTRP / UTR。
- 評估歷史紀錄會被保存，以供未來分析。

### FR-03 配對

- 使用者可以瀏覽公開會員個人檔案。
- 系統依據以下條件計算推薦分數：
  - 城市相近程度
  - 等級差距
  - 年齡與球齡相近程度
  - 可打球時段相似度

### FR-04 聊天與約球邀約

- 使用者可以開啟一對一聊天室。
- 使用者可以在聊天室中傳送訊息。
- 使用者可以建立約球邀約，包含日期時間、球場與備註。
- 邀約狀態支援完整生命週期：提案中 / 已接受 / 已拒絕 / 已取消 / 已完成。

### FR-05 球場與評價

- 使用者可以瀏覽全台灣的球場列表與地圖。
- 使用者可以依城市或場地類型篩選。
- 使用者可以查看並提交球場評價。
- 每位使用者對每個球場只能維護一則評價（更新插入行為）。

### FR-06 論壇

- 使用者可以依分類發布文章。
- 使用者可以新增留言（透過父留言 ID 支援串狀回覆）。
- 支援公開讀取。

### FR-07 資安與驗證

- 受保護 API 使用 JWT 存取權杖進行身分驗證。
- 更新 Token 輪換機制，具備重複使用偵測功能。
- 登出時撤銷更新 Token 工作階段。
- 基本濫用防護（速率限制、輸入驗證、內容淨化）。

## 6. 非功能性需求

### NFR-01 可維護性

- 前端採用模組化設計（`modules`、`services`、`ui`、`state`）。
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
- 基於 ES 模組的 JavaScript。
- 目前本機模式：使用 LocalStorage 模擬資料層。
- 可透過設定啟用 API 模式。

### 7.2 後端（目標）

- 應用程式 API 服務（REST）
- PostgreSQL 作為主要資料儲存
- Redis 用於速率限制、Token / 工作階段控制與快取
- API 前端部署 CDN / WAF，防禦 DDoS 與機器人攻擊

## 8. UI / UX 設計規格

當前網頁前端的視覺設計方向：

- 主題：高對比網球運動風格
- 色彩系統：
  - 深夜球場藍色背景
  - 電光藍強調色
  - 網球螢光黃作為亮點色
- 字型：
  - 標題顯示：`Barlow Condensed`
  - 內文：`Noto Sans TC`
- 動畫效果：
  - 細緻的顯現過渡動畫
  - 環境光暈效果
- 版面構成：
  - 球場 / 場地線條疊層
  - 基於卡片的戰術儀表板佈局

設計靈感參考：

- Nike 運動應用程式風格（運動感、高對比、粗體標題）
- 澳網視覺語彙（藍色 + 網球能量亮點）

## 9. 資料設計（PostgreSQL）

結構描述檔案：`backend/db/schema.sql`

主要實體：

- `app_users`（應用程式使用者）
- `member_profiles`（會員個人檔案）
- `member_assessments`（技術評估紀錄）
- `match_requests`（配對請求）
- `chat_rooms`（聊天室）
- `chat_room_participants`（聊天室參與者）
- `chat_messages`（聊天訊息）
- `play_invites`（約球邀約）
- `courts`（球場）
- `court_reviews`（球場評價）
- `forum_posts`（論壇文章）
- `forum_comments`（論壇留言）
- `auth_refresh_sessions`（驗證更新工作階段）
- `auth_audit_logs`（驗證稽核日誌）

設計說明：

- 所有主要資料表使用 UUID 主鍵。
- 使用列舉類型強制領域限制。
- 透過觸發器自動維護 `updated_at` 欄位。
- 針對高頻查詢路徑建立局部 / 複合索引。

## 10. API 合約

OpenAPI 檔案：`backend/api/openapi.yaml`

API 領域：

- Auth（驗證）：register / login / refresh / logout
- Members（會員）：me / profile / 公開列表
- Matching（配對）：推薦列表
- Chat（聊天）：rooms / messages / invites
- Courts（球場）：list / reviews
- Forum（論壇）：posts / comments

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

- 存取 Token：
  - JWT Bearer
  - 有效期 15 分鐘
- 更新 Token：
  - HttpOnly Cookie
  - 有效期 30 天
  - 每次更新時輪換
  - 具備重複使用偵測與工作階段家族撤銷機制
- 登出：
  - 撤銷更新 Token 工作階段
  - 清除 Cookie

## 12. 資安控制

前端基準：

- `index.html` 中設置 CSP（內容安全策略）
- 輸入淨化與欄位長度限制
- 用戶端濫用節流

後端必要控制：

- 伺服器端驗證（絕不信任前端資料）
- 依 IP 與使用者識別碼進行速率限制
- Cookie 安全旗標設定（`HttpOnly`、`Secure`、`SameSite`）
- 驗證事件稽核日誌
- 金鑰 / 密鑰輪換流程

## 13. 部署規格

前端：

- GitHub Pages 靜態部署

後端目標：

- 容器化 API 服務
- PostgreSQL + Redis 服務
- 透過 `.env` 檔案進行環境設定
- 邊緣層進行 TLS 終止與 WAF 防護

## 14. 測試策略

- 單元測試：
  - 評分計算邏輯
  - 配對評分演算法
  - 驗證 Token / 工作階段生命週期
- 整合測試：
  - 驗證流程：register / login / refresh / logout
  - 論壇發文與留言
  - 聊天訊息與約球邀約操作
- 端對端測試（E2E）：
  - 前端工作流程：會員、配對、論壇、球場

## 15. 可追溯性（功能 → 對應檔案）

- UI 與互動：`index.html`、`assets/css/styles.css`、`assets/js/*`
- API 規格：`backend/api/openapi.yaml`
- 資料庫結構：`backend/db/schema.sql`
- 驗證流程：`backend/docs/JWT_FLOW.md`
- 系統架構：`backend/docs/ARCHITECTURE.md`
- 前後端對應：`backend/docs/FRONTEND_INTEGRATION.md`

## 16. 已知缺口與後續步驟

- 目前前端預設仍以模擬儲存模式運行。
- 本儲存庫中後端實作尚未搭建完成。
- 建議下一階段：
  1. 依 OpenAPI 規格建立後端服務骨架
  2. 執行資料庫遷移並匯入球場種子資料
  3. 整合前端 API 模式，銜接驗證功能與受保護路由
