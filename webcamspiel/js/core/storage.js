// Thin LocalStorage wrapper: namespaced keys, JSON, never throws.
const PREFIX = 'webcamspiel:v1:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.warn('storage save failed', key, err);
  }
}
