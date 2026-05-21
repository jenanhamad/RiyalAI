const TOKEN_KEY = 'riyalai_token';
const USER_KEY = 'riyalai_user';

import { getApiBase } from '../config/apiBase';

const API_BASE = getApiBase();

export function getLocalToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getLocalUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setLocalSession({ token, email, displayName, userId }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify({
    username: displayName || email,
    email,
    userId,
  }));
}

export function clearLocalSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function localRegister(email, password, displayName = '') {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || 'Registration failed');
  setLocalSession(data);
  return data;
}

export async function localLogin(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Invalid email or password');
  setLocalSession(data);
  return data;
}
