export function createStorageService(namespace) {
  const key = (name) => `${namespace}:${name}`;

  function get(name, fallback) {
    try {
      const raw = localStorage.getItem(key(name));
      if (!raw) {
        return fallback;
      }
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function set(name, value) {
    localStorage.setItem(key(name), JSON.stringify(value));
    return value;
  }

  function update(name, fallback, updater) {
    const current = get(name, fallback);
    const next = updater(current);
    return set(name, next);
  }

  return {
    get,
    set,
    update,
  };
}
