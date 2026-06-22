export const API_BASE_URL =
  (import.meta.env.VITE_API_URL || "https://sevasetu-backend-3ed6.onrender.com").replace(/\/$/, "");

export async function api(path, options = {}) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const token =
    localStorage.getItem("sevasetu_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    "";

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${cleanPath}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    throw new Error(data.detail || data.message || `API failed: ${res.status}`);
  }

  return data;
}

export default api;
