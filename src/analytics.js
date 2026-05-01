const USER_ID_STORAGE_KEY = "cam_analytics_user_id";
const USER_ID_COOKIE_KEY = "cam_analytics_user_id";

let analyticsEnabled = false;
let appVersion = "unknown";
let sessionId = "";
let userId = "";

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in private mode or locked environments.
  }
}

function safeCookieGet(name) {
  try {
    const encoded = encodeURIComponent(name);
    const chunk = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${encoded}=`));
    if (!chunk) {
      return null;
    }
    return decodeURIComponent(chunk.slice(encoded.length + 1));
  } catch {
    return null;
  }
}

function safeCookieSet(name, value) {
  try {
    const encodedName = encodeURIComponent(name);
    const encodedValue = encodeURIComponent(value);
    const maxAgeSeconds = 60 * 60 * 24 * 365 * 2;
    document.cookie = `${encodedName}=${encodedValue}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
  } catch {
    // Ignore cookie write errors.
  }
}

function getOrCreateUserId() {
  const existing = safeStorageGet(USER_ID_STORAGE_KEY) || safeCookieGet(USER_ID_COOKIE_KEY);
  if (existing) {
    safeStorageSet(USER_ID_STORAGE_KEY, existing);
    safeCookieSet(USER_ID_COOKIE_KEY, existing);
    return existing;
  }
  const created = makeId();
  safeStorageSet(USER_ID_STORAGE_KEY, created);
  safeCookieSet(USER_ID_COOKIE_KEY, created);
  return created;
}

function ensureGtagStub() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
}

export function initAnalytics({ measurementId, version }) {
  appVersion = version || "unknown";
  sessionId = makeId();
  userId = getOrCreateUserId();

  if (!measurementId) {
    analyticsEnabled = false;
    return;
  }

  ensureGtagStub();
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    anonymize_ip: true,
    send_page_view: true,
    user_id: userId,
  });
  analyticsEnabled = true;
}

function buildBasePayload(extra = {}) {
  return {
    app_version: appVersion,
    session_id: sessionId,
    anon_user_id: userId,
    ...extra,
  };
}

export function trackEvent(name, payload = {}) {
  if (!analyticsEnabled || typeof window.gtag !== "function") {
    return;
  }
  window.gtag("event", name, buildBasePayload(payload));
}

export function createRunAnalyticsId() {
  return makeId();
}
