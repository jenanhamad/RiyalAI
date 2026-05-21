export const CATEGORIES = [
  { id: 'Food & Dining', labelAr: 'طعام', icon: '🍽️', color: '#F59E0B' },
  { id: 'Transportation', labelAr: 'مواصلات', icon: '🚗', color: '#3B82F6' },
  { id: 'Shopping', labelAr: 'تسوق', icon: '🛍️', color: '#EC4899' },
  { id: 'Entertainment', labelAr: 'ترفيه', icon: '🎬', color: '#A855F7' },
  { id: 'Utilities', labelAr: 'فواتير', icon: '💡', color: '#14B8A6' },
  { id: 'Healthcare', labelAr: 'صحة', icon: '🏥', color: '#EF4444' },
  { id: 'Groceries', labelAr: 'بقالة', icon: '🛒', color: '#84CC16' },
  { id: 'Gas', labelAr: 'وقود', icon: '⛽', color: '#6366F1' },
  { id: 'Other', labelAr: 'أخرى', icon: '📝', color: '#8B949E' },
];

export function getCategoryMeta(name) {
  return CATEGORIES.find((c) => c.id === name) || CATEGORIES[CATEGORIES.length - 1];
}
