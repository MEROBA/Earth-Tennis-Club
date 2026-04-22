# Earth Tennis Club

Earth Tennis Club 是一個可直接部署到 **GitHub Pages** 的前端網球社群平台，提供：

- **球員卡系統**：每位球員可建立個人球員卡，包含照片、性別、身高、年齡、球齡、擅長打法與可打球時段
- **NTRP 自我評估**：整合於球員卡編輯頁，透過技術問卷估算 NTRP 等級
- **球友智慧推薦**：依據 NTRP 等級、球齡、地區與時段，一鍵找出最適合的球友
- **約打球排程**：直接對球友送出約球邀約，支援接受 / 拒絕 / 取消 / 完成等狀態管理
- **全台球場地圖**：全台 22 縣市球場資訊、篩選、Leaflet 地圖與評價（每人每場地一則）
- **球友交流區**：發文 / 留言 / 分類篩選社群討論

目前資料層預設為 LocalStorage（Mock Mode），已保留清楚的 `services` 抽象層，方便後續串接後端。

## 1. 本機啟動

由於使用 ES Modules，請不要直接雙擊 HTML，建議起一個本機伺服器：

```bash
cd /path/to/Earth-Tennis-Club
python3 -m http.server 8080
```

開啟 `http://localhost:8080`。

## 2. 部署到 GitHub Pages

1. 推送此專案到 GitHub repository。
2. 進入 `Settings` → `Pages`。
3. `Build and deployment` 選 `Deploy from a branch`。
4. Branch 選 `main`（或你的主分支），Folder 選 `/ (root)`。
5. 儲存後等待部署完成，即可取得公開網址。

## 3. 專案結構

```text
assets/
  css/styles.css                 # 設計系統、球員卡、響應式樣式
  js/app.js                      # 啟動入口
  js/config.js                   # 全域設定、城市名單
  js/data/                       # NTRP 問卷、球場靜態資料
  js/services/                   # 資料存取與商業邏輯（可替換為後端 API）
    member-service.js            # 球員管理、配對演算法、評估歷史
    invite-service.js            # 約球邀約 CRUD 與狀態管理
    court-service.js             # 球場資料與評價（更新插入）
    forum-service.js             # 社群文章與留言
    scoring-service.js           # NTRP 評分邏輯
    security-service.js          # 輸入淨化、限流
    storage-service.js           # LocalStorage 抽象層
    api-service.js               # 後端 API 呼叫（API 模式）
  js/modules/                    # 各功能 UI 模組
    members-module.js            # 球員卡列表 + 表單 + 嵌入式 NTRP 評估
    matching-module.js           # 球友推薦（一鍵配對）
    invite-module.js             # 約打球排程模組
    courts-module.js             # 球場地圖模組
    forum-module.js              # 交流區模組
  js/ui/dom.js                   # 共用 DOM 工具
index.html                       # 主頁面（5 個功能分頁）
backend/                         # 後端設計規格與 Node.js 服務骨架
SECURITY.md                      # 資安設計與上線建議
SDD-zh.md                        # 設計說明文件（繁體中文）
```

## 4. 功能分頁說明

| 分頁 | 功能 |
|------|------|
| **球員管理** | 查看自己球員卡、編輯資料與照片、NTRP 自我評估、瀏覽 / 篩選所有球員卡 |
| **球友推薦** | 一鍵智慧配對，顯示配對分數與球員卡，可直接跳轉至約打球 |
| **約打球** | 選擇對象（含球員卡預覽）、填寫日期時間與球場，管理邀約狀態 |
| **全台球場** | Leaflet 地圖 + 球場列表、縣市 / 場地類型篩選、球場評價 |
| **交流區** | 論壇發文與留言，支援分類篩選 |

## 5. 球友配對演算法

配對分數由以下五項加權計算（滿分約 100 分）：

| 項目 | 最高分 | 說明 |
|------|--------|------|
| 地區相同 | 30 | 同縣市得 30 分，不同縣市得 10 分 |
| NTRP 等級接近 | 28 | 差距 0 得 28 分，差距越大扣分越多 |
| 年齡接近 | 18 | 差距越小得分越高 |
| 球齡接近 | 12 | 差距越小得分越高 |
| 可打球時段相似 | 10 | 關鍵字重疊比例計算 |

## 6. 後端串接

把 `assets/js/config.js` 的 `api.mode` 切換為 `"api"`，並設定 `baseUrl`，再逐步將 service 內的 LocalStorage 邏輯改為 `api-service` 呼叫即可。

後端 Node.js/Express 骨架已建立在 `backend/src/`：

```bash
cd backend
npm install
cp .env.example .env   # 填入 DB / JWT 設定
npm run dev
```

## 7. 資安說明

已實作前端層保護（輸入淨化、欄位驗證、基本限流、CSP），完整細節請看 [SECURITY.md](./SECURITY.md)。

後端骨架包含：JWT Bearer 驗證、Argon2id 密碼雜湊、Refresh Token 輪換與重放偵測、稽核日誌。

## 8. 後端規格（API + PostgreSQL + JWT）

`backend/` 目錄包含：

- `backend/src/` — Node.js/Express 完整服務骨架（auth / members / matching / chat / courts / forum）
- `backend/api/openapi.yaml` — 完整 REST API 規格
- `backend/db/schema.sql` — PostgreSQL schema
- `backend/docs/JWT_FLOW.md` — Token 輪換與重放偵測流程
- `backend/docs/ARCHITECTURE.md` — 架構決策說明

## 9. 開發規格文件（SDD）

- `SDD-zh.md` — 完整設計說明文件（繁體中文）
