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

export const BUSINESS_CATEGORIES = [
  { id: 'Marketing', labelAr: 'تسويق', icon: '📣', color: '#F59E0B' },
  { id: 'Salaries', labelAr: 'رواتب', icon: '👥', color: '#3B82F6' },
  { id: 'Inventory', labelAr: 'مخزون', icon: '📦', color: '#84CC16' },
  { id: 'Rent', labelAr: 'إيجار', icon: '🏠', color: '#EC4899' },
  { id: 'Tax', labelAr: 'ضريبة', icon: '🧾', color: '#EF4444' },
  { id: 'Equipment', labelAr: 'معدات', icon: '🔧', color: '#6366F1' },
  { id: 'Commissions', labelAr: 'عمولات', icon: '٪', color: '#A855F7' },
  { id: 'Utilities', labelAr: 'فواتير', icon: '💡', color: '#14B8A6' },
  { id: 'Transportation', labelAr: 'مواصلات', icon: '🚗', color: '#0EA5E9' },
  { id: 'Other', labelAr: 'أخرى', icon: '📝', color: '#8B949E' },
];

export function getCategoryMeta(name, mode = 'personal') {
  const list = mode === 'business' ? BUSINESS_CATEGORIES : CATEGORIES;
  return list.find((c) => c.id === name) || list[list.length - 1];
}

export function getCategoriesForMode(mode = 'personal') {
  return mode === 'business' ? BUSINESS_CATEGORIES : CATEGORIES;
}
