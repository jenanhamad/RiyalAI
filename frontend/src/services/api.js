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

  getExpenses: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/expenses`, { headers });
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

  getRecurringExpenses: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/expenses/recurring`, { headers });
  },

  toggleRecurring: async (expenseId) => {
    const headers = await authHeaders();
    return axios.post(`${API_BASE}/expenses/${expenseId}/recurring`, {}, { headers });
  },

  getAnalytics: async () => {
    const headers = await authHeaders();
    return axios.get(`${API_BASE}/expenses/analytics`, { headers });
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

  /** Process voice — transcribe + extract, does NOT save */
  voiceProcess: async ({ audioBlob, filename = 'voice.webm', transcription }) => {
    const headers = await authHeaders();
    if (transcription) {
      const form = new FormData();
      form.append('transcription', transcription);
      return axios.post(`${API_BASE}/voice/process`, form, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      });
    }
    const form = new FormData();
    form.append('audio_file', audioBlob, filename);
    return axios.post(`${API_BASE}/voice/process`, form, {
      headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      timeout: 90000,
    });
  },

  /** Confirm and save after user approves sheet */
  voiceConfirm: async (data) => {
    const headers = await authHeaders();
    return axios.post(`${API_BASE}/voice/confirm`, data, { headers, timeout: 30000 });
  },
};

export async function uploadReceiptFile(expenseId, file) {
  const { data } = await api.getUploadUrl(expenseId, file.name, file.type);
  await axios.put(data.uploadUrl, file, {
    headers: { 'Content-Type': file.type },
  });
  return { key: data.key };
}
