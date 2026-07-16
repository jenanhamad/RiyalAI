import { getApiBase } from '../config/apiBase';

const TOKEN_KEY = 'riyalai_token';
const USER_KEY = 'riyalai_user';
const API_BASE = getApiBase();

export function getLocalToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getLocalUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setLocalSession({ token, username, displayName, userId, email, activeMode }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify({
    username: username || displayName,
    userId,
    email: email || null,
    activeMode: activeMode === 'business' ? 'business' : 'personal',
  }));
}

export function updateLocalUserMode(activeMode) {
  const user = getLocalUser();
  if (!user) return;
  localStorage.setItem(USER_KEY, JSON.stringify({
    ...user,
    activeMode: activeMode === 'business' ? 'business' : 'personal',
  }));
}

export function clearLocalSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function localRegister(username, password, email = '', accountMode = 'personal') {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      email: email.trim(),
      accountMode: accountMode === 'business' ? 'business' : 'personal',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || 'فشل إنشاء الحساب');
  setLocalSession(data);
  return data;
}

export async function localLogin(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'اسم المستخدم أو كلمة المرور غير صحيحة');
  setLocalSession(data);
  return data;
}

export async function forgotPassword(email) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || 'تعذّر إرسال الرابط');
  return data.message || 'إذا كان البريد مسجّلاً، ستصلك رسالة خلال دقائق.';
}

export async function resetPassword(token, password) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || 'تعذّر تغيير كلمة المرور');
  setLocalSession(data);
  return data;
}
