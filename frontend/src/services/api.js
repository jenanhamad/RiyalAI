import axios from 'axios';
import { getLocalToken, clearLocalSession } from './localAuth';
import { getApiBase } from '../config/apiBase';

const API_BASE = getApiBase();

let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler) {
  onUnauthorized = typeof handler === 'function' ? handler : () => {};
}

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearLocalSession();
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

async function authHeaders() {
  const token = getLocalToken();
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  healthCheck: () => axios.get(`${API_BASE}/expenses/health`),

  getExpenses: async (mode) => {
    const headers = await authHeaders();
    const params = mode ? { mode } : undefined;
    return axios.get(`${API_BASE}/expenses`, { headers, params });
  },

  createExpense: async (data) => {
    const headers = await authHeaders();
    return axios.post(`${API_BASE}/expenses`, data, { headers });
  },

  getExpense: async (expenseId) => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/expenses/${expenseId}`, { headers });
  },

  updateExpense: async (expenseId, data) => {
    const headers = await authHeaders();
    return axios.put(`${API_BASE}/expenses/${expenseId}`, data, { headers });
  },

  deleteExpense: async (expenseId) => {
    const headers = await authHeaders();
    return axios.delete(`${API_BASE}/expenses/${expenseId}`, { headers });
  },

  convertToPersonal: async (expenseId) => {
    const headers = await authHeaders();
    return axios.post(`${API_BASE}/expenses/${expenseId}/convert-personal`, {}, { headers });
  },

  getRecurringExpenses: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/expenses/recurring`, { headers });
  },

  toggleRecurring: async (expenseId) => {
    const headers = await authHeaders();
    return axios.post(`${API_BASE}/expenses/${expenseId}/recurring`, {}, { headers });
  },

  getAnalytics: async (mode) => {
    const headers = await authHeaders();
    const params = mode ? { mode } : undefined;
    return axios.get(`${API_BASE}/expenses/analytics`, { headers, params });
  },

  getUploadUrl: async (expenseId, filename, contentType) => {
    const headers = await authHeaders();
    return axios.post(
      `${API_BASE}/upload`,
      { expenseId, filename, contentType },
      { headers }
    );
  },

  getProfile: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/profile`, { headers });
  },

  setActiveMode: async (mode) => {
    const headers = await authHeaders();
    return axios.patch(`${API_BASE}/profile/mode`, { mode }, { headers });
  },

  getBusinessDashboard: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/business/dashboard`, { headers });
  },

  getBusinessVat: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/business/vat`, { headers });
  },

  getBusinessLeaks: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/business/leaks`, { headers });
  },

  getBusinessGlance: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/business/glance`, { headers, timeout: 60000 });
  },

  getWeeklyStory: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/story/weekly`, { headers, timeout: 60000 });
  },

  getChallenges: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/challenges`, { headers });
  },

  generateChallenges: async () => {
    const headers = await authHeaders();
    return axios.post(`${API_BASE}/challenges/generate`, {}, { headers });
  },

  claimChallenge: async (challengeId) => {
    const headers = await authHeaders();
    return axios.post(`${API_BASE}/challenges/${challengeId}/claim`, {}, { headers });
  },

  getLeaderboard: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/leaderboard`, { headers });
  },

  lookupUser: async (username) => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/users/lookup/${encodeURIComponent(username)}`, { headers });
  },

  getFriends: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/friends`, { headers });
  },

  addFriend: async (username) => {
    const headers = await authHeaders();
    return axios.post(`${API_BASE}/friends`, { username }, { headers });
  },

  removeFriend: async (friendId) => {
    const headers = await authHeaders();
    return axios.delete(`${API_BASE}/friends/${friendId}`, { headers });
  },

  getFriendsLeaderboard: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/friends/leaderboard`, { headers });
  },

  getSharedChallenges: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/challenges/shared`, { headers });
  },

  shareChallenge: async (challengeId) => {
    const headers = await authHeaders();
    return axios.post(`${API_BASE}/challenges/${challengeId}/share`, {}, { headers });
  },

  joinSharedChallenge: async (groupId) => {
    const headers = await authHeaders();
    return axios.post(`${API_BASE}/challenges/shared/join`, { groupId }, { headers });
  },

  /** Process voice — transcribe + extract, does NOT save */
  voiceProcess: async ({ audioBlob, filename = 'voice.webm', transcription, mode }) => {
    const headers = await authHeaders();
    const form = new FormData();
    if (mode) form.append('mode', mode);
    if (transcription) {
      form.append('transcription', transcription);
      return axios.post(`${API_BASE}/voice/process`, form, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      });
    }
    form.append('audio_file', audioBlob, filename);
    return axios.post(`${API_BASE}/voice/process`, form, {
      headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      timeout: 90000,
    });
  },

  /** Process receipt image — extract expense, does NOT save */
  receiptProcess: async (file, mode) => {
    const headers = await authHeaders();
    const form = new FormData();
    form.append('image_file', file, file.name || 'receipt.jpg');
    if (mode) form.append('mode', mode);
    return axios.post(`${API_BASE}/receipt/process`, form, {
      headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      timeout: 90000,
    });
  },

  /** Confirm and save after user approves sheet */
  voiceConfirm: async (data) => {
    const headers = await authHeaders();
    return axios.post(`${API_BASE}/voice/confirm`, data, { headers, timeout: 30000 });
  },

  /** Upload a past expenses/income report (CSV/Excel) — parses + suggests column mapping */
  importPreview: async (file) => {
    const headers = await authHeaders();
    const form = new FormData();
    form.append('file', file, file.name);
    return axios.post(`${API_BASE}/business/import/preview`, form, {
      headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },

  /** Apply the confirmed mapping and bulk-insert the imported rows */
  importConfirm: async (payload) => {
    const headers = await authHeaders();
    return axios.post(`${API_BASE}/business/import/confirm`, payload, { headers, timeout: 60000 });
  },

  /** Download raw business expenses/income as a file (csv|xlsx) */
  exportExpenses: async ({ format = 'xlsx', days } = {}) => {
    const headers = await authHeaders();
    const params = { format };
    if (days) params.days = days;
    return axios.get(`${API_BASE}/business/export/expenses`, {
      headers, params, responseType: 'blob', timeout: 60000,
    });
  },

  /** Download a printable summary report (Excel) */
  exportReport: async ({ days = 90 } = {}) => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/business/export/report`, {
      headers, params: { days }, responseType: 'blob', timeout: 60000,
    });
  },
};

/** Trigger a browser download from an axios blob response */
export function downloadBlobResponse(response, fallbackName = 'download') {
  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : fallbackName;
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function uploadReceiptFile(expenseId, file) {
  const { data } = await api.getUploadUrl(expenseId, file.name, file.type);
  await axios.put(data.uploadUrl, file, {
    headers: { 'Content-Type': file.type },
  });
  return { key: data.key };
}
