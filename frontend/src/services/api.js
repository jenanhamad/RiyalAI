import { fetchAuthSession } from 'aws-amplify/auth';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '';

async function authHeaders() {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    throw new Error('Not authenticated');
  }
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
};

export async function uploadReceiptFile(expenseId, file) {
  const { data } = await api.getUploadUrl(expenseId, file.name, file.type);
  await axios.put(data.uploadUrl, file, {
    headers: { 'Content-Type': file.type },
  });
  return { key: data.key };
}
