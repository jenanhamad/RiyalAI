import axios from 'axios';
import { getLocalToken } from './localAuth';
import { getApiBase } from '../config/apiBase';

const API_BASE = getApiBase();

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

  voiceExpense: async (audioBase64, mimeType = 'audio/webm', transcription = null) => {
    const headers = await authHeaders();
    const payload = transcription
      ? { transcription, mimeType }
      : { audioBase64, mimeType };
    return axios.post(`${API_BASE}/voice/expense`, payload, { headers, timeout: 90000 });
  },
};

export async function uploadReceiptFile(expenseId, file) {
  const { data } = await api.getUploadUrl(expenseId, file.name, file.type);
  await axios.put(data.uploadUrl, file, {
    headers: { 'Content-Type': file.type },
  });
  return { key: data.key };
}
