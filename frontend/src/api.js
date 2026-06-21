export async function api(path, options = {}) {
  const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
  const token =
    localStorage.getItem("sevasetu_token") ||
    localStorage.getItem("sevasetu_auth_token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.detail || data.message || "API request failed");
  }

  return data;
}
