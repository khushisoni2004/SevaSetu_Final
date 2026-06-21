const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

function safeJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getUser() {
  return (
    safeJson(localStorage.getItem("sevasetu_user"), {}) ||
    safeJson(localStorage.getItem("sevasetu_profile"), {}) ||
    {}
  );
}

function fireAndForget(path, payload) {
  fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

/* Save important localStorage data into MongoDB */
(function patchLocalStorageSync() {
  if (window.__sevasetuMongoSyncPatched) return;
  window.__sevasetuMongoSyncPatched = true;

  const originalSetItem = localStorage.setItem.bind(localStorage);

  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);

    const user = getUser();
    const email = user.email || "local-user@sevasetu";

    if (key === "sevasetu_profile") {
      const profile = safeJson(value, {});
      fireAndForget("/api/voice-form/save", {
        email,
        userEmail: email,
        profile,
        profilePreview: profile,
        rawLocalStorageKey: key,
        source: "frontend_profile_sync",
      });
    }

    if (key === "sevasetu_final_application_tracker") {
      const items = safeJson(value, []);
      fireAndForget("/api/application-tracker/sync", {
        email,
        userEmail: email,
        items: Array.isArray(items) ? items : [],
      });
    }

    if (key === "sevasetu_saved_schemes") {
      fireAndForget("/api/frontend-sync", {
        email,
        type: "saved_schemes_localstorage",
        key,
        value: safeJson(value, value),
      });
    }
  };
})();

/* Capture Voice Bot input and backend output */
(function patchVoiceFetchLogger() {
  if (window.__sevasetuFetchVoiceLogger) return;
  window.__sevasetuFetchVoiceLogger = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (resource, options = {}) {
    const url = typeof resource === "string" ? resource : resource?.url || "";
    const isVoiceApi =
      url.includes("/api/ai/voice-query") ||
      url.includes("/voice-query");

    let requestBody = null;

    if (isVoiceApi && options?.body) {
      requestBody = safeJson(options.body, options.body);
    }

    const response = await originalFetch(resource, options);

    if (isVoiceApi) {
      try {
        const clone = response.clone();
        const responseJson = await clone.json();
        const user = getUser();
        const email = user.email || "local-user@sevasetu";

        fireAndForget("/api/voice-interactions", {
          email,
          userEmail: email,
          source: "voice_bot",
          apiUrl: url,
          input: requestBody,
          output: responseJson,
          query:
            requestBody?.query ||
            requestBody?.message ||
            requestBody?.text ||
            "",
          reply:
            responseJson?.reply ||
            responseJson?.answer ||
            responseJson?.message ||
            "",
          matches:
            responseJson?.matches ||
            responseJson?.schemes ||
            responseJson?.topMatches ||
            [],
        });
      } catch {
        // ignore logging error
      }
    }

    return response;
  };
})();
