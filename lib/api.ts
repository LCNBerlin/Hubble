import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./config";

const ACCESS_TOKEN_KEY = "hubble:access_token";
const REFRESH_TOKEN_KEY = "hubble:refresh_token";

export async function getStoredTokens() {
  const [access, refresh] = await AsyncStorage.multiGet([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  return { accessToken: access[1] ?? null, refreshToken: refresh[1] ?? null };
}

export async function storeTokens(accessToken: string, refreshToken: string) {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const { refreshToken } = await getStoredTokens();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) { await clearTokens(); return null; }
    const { accessToken, refreshToken: newRefresh } = await res.json();
    await storeTokens(accessToken, newRefresh);
    return accessToken;
  } catch {
    return null;
  }
}

/** Execute at most one refresh at a time; callers share the same promise. */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

type RequestInit2 = RequestInit & { _retry?: boolean };

export async function apiFetch(path: string, init: RequestInit2 = {}): Promise<Response> {
  const { accessToken } = await getStoredTokens();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${API_URL}/api${path}`, { ...init, headers });

  if (res.status === 401 && !init._retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      return fetch(`${API_URL}/api${path}`, { ...init, headers, _retry: true } as RequestInit2);
    }
    await clearTokens();
  }

  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: "GET" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}
