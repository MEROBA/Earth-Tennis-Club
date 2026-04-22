export function createApiService(config) {
  async function request(path, options = {}) {
    if (config.mode === "mock") {
      throw new Error("Mock mode: 此功能目前由本機資料層處理");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${config.baseUrl}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API error (${response.status})`);
      }

      return response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  return { request };
}
