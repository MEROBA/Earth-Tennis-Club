export function sanitizeText(value, maxLen = 200) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function safeNumber(value, min, max, fallback = min) {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

export function assertRequired(payload, fields) {
  const missing = fields.find((field) => !payload[field] && payload[field] !== 0);
  if (missing) {
    throw new Error(`缺少必要欄位: ${missing}`);
  }
}

export function createRateLimiter(storageService) {
  function hit(name, limit, windowMs) {
    const now = Date.now();
    const record = storageService.get(`ratelimit:${name}`, []);
    const alive = record.filter((ts) => now - ts < windowMs);
    if (alive.length >= limit) {
      return false;
    }
    storageService.set(`ratelimit:${name}`, [...alive, now]);
    return true;
  }

  return { hit };
}
