/** Saudi-style currency and numbers */
export const RIYAL = '\uFDFC'; // ﷼

export function formatRiyal(amount) {
  const n = parseFloat(amount) || 0;
  const formatted = new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
  return `${formatted} ${RIYAL}`;
}

export function formatXp(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء الخير';
  return 'مساء الخير';
}

export function getMondayResetCountdown() {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  const diff = next - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { days, hours, label: `${days}ي ${hours}س` };
}
