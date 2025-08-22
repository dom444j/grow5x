// src/lib/api.ts
// Asegurar una única base /api - default seguro a /api
const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export async function getJSON<T>(path: string, opts: { token?: string } = {}) {
  const url = `${API}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    mode: 'cors',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function postJSON<T>(path: string, data: any, opts: { token?: string } = {}) {
  const url = `${API}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: JSON.stringify(data),
    mode: 'cors',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function putJSON<T>(path: string, data: any, opts: { token?: string } = {}) {
  const url = `${API}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: JSON.stringify(data),
    mode: 'cors',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

// Helper function for authenticated requests
export function withAuth(token: string) {
  return {
    GET: <T>(path: string, opts: any = {}) => getJSON<T>(path, { ...opts, token }),
    POST: <T>(path: string, data: any, opts: any = {}) => postJSON<T>(path, data, { ...opts, token }),
    PUT: <T>(path: string, data: any, opts: any = {}) => putJSON<T>(path, data, { ...opts, token })
  };
}

// Legacy export for compatibility
export const api = {
  get: getJSON,
  post: postJSON,
  put: putJSON
};