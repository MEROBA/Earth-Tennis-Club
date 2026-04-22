# Security Notes

此專案是可部署於 GitHub Pages 的前端範例，無法單靠前端完整防禦所有攻擊，但已納入以下基礎設計。

## 已實作保護

- **CSP (Content Security Policy)**：限制 script/style/font/img 來源。
- **輸入清理與驗證**：
  - `sanitizeText()` 移除危險字元並限制長度
  - `safeNumber()` 夾住數值範圍
  - `assertRequired()` 保證必要欄位
- **安全渲染**：使用 `textContent` 與 DOM API，避免拼接未信任 HTML。
- **前端限流（Rate Limit）**：聊天室、發文與留言每分鐘限制次數。
- **模組化資料層**：可在後端加入權限、審計、黑名單、風險控管而不改 UI。

## 風險與上線建議

### 1. DDoS / 流量攻擊

前端無法防禦 DDoS。正式上線請至少搭配：

- Cloudflare / AWS Shield / GCP Armor
- CDN + WAF
- IP/UA Rate Limit
- Bot Management

### 2. 身分驗證與授權

目前為 demo（無真正帳號登入）。正式上線建議：

- JWT + Refresh Token
- HttpOnly + Secure + SameSite Cookie
- RBAC / ABAC 權限控管

### 3. 後端資料安全

- 伺服器端再做一次輸入驗證（不可只信前端）
- 參數化查詢防 SQL Injection
- 敏感資訊加密（at rest / in transit）
- API request schema validation（例如 Zod / Joi）

### 4. Chat / Forum 內容安全

- 伺服器端內容審核與關鍵字政策
- XSS 防護（HTML Sanitizer）
- 反垃圾策略（冷卻時間、重複訊息偵測）

## 建議的安全里程碑

1. 導入真實 Auth 與權限模型
2. 佈署 API Gateway + WAF + Rate Limit
3. 對聊天與論壇內容做 server-side moderation
4. 設置監控告警（5xx、流量異常、登入異常）

