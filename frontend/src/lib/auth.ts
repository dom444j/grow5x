const KEY = 'g5x:token';

export const getToken = () => localStorage.getItem(KEY) || undefined;
export const setToken = (t: string) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);