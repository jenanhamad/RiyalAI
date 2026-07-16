/* Category colors derived from Amed 2026 brand palette */
export const CATEGORIES = [
  { id: 'Food & Dining', labelAr: 'طعام', icon: '🍽️', color: '#C96A3E' },
  { id: 'Transportation', labelAr: 'مواصلات', icon: '🚗', color: '#253A63' },
  { id: 'Shopping', labelAr: 'تسوق', icon: '🛍️', color: '#C0503F' },
  { id: 'Entertainment', labelAr: 'ترفيه', icon: '🎬', color: '#1B2A4A' },
  { id: 'Utilities', labelAr: 'فواتير', icon: '💡', color: '#4C8C6B' },
  { id: 'Healthcare', labelAr: 'صحة', icon: '🏥', color: '#B85A32' },
  { id: 'Groceries', labelAr: 'بقالة', icon: '🛒', color: '#4CAF7D' },
  { id: 'Gas', labelAr: 'وقود', icon: '⛽', color: '#6B7280' },
  { id: 'Other', labelAr: 'أخرى', icon: '📝', color: '#A39E90' },
];

export const BUSINESS_CATEGORIES = [
  { id: 'Marketing', labelAr: 'تسويق', icon: '📣', color: '#C96A3E' },
  { id: 'Salaries', labelAr: 'رواتب', icon: '👥', color: '#1B2A4A' },
  { id: 'Inventory', labelAr: 'مخزون', icon: '📦', color: '#4C8C6B' },
  { id: 'Rent', labelAr: 'إيجار', icon: '🏠', color: '#253A63' },
  { id: 'Tax', labelAr: 'ضريبة', icon: '🧾', color: '#C0503F' },
  { id: 'Equipment', labelAr: 'معدات', icon: '🔧', color: '#6B7280' },
  { id: 'Commissions', labelAr: 'عمولات', icon: '٪', color: '#B85A32' },
  { id: 'Utilities', labelAr: 'فواتير', icon: '💡', color: '#4CAF7D' },
  { id: 'Transportation', labelAr: 'مواصلات', icon: '🚗', color: '#253A63' },
  { id: 'Other', labelAr: 'أخرى', icon: '📝', color: '#A39E90' },
];

export function getCategoryMeta(name, mode = 'personal') {
  const list = mode === 'business' ? BUSINESS_CATEGORIES : CATEGORIES;
  return list.find((c) => c.id === name) || list[list.length - 1];
}

export function getCategoriesForMode(mode = 'personal') {
  return mode === 'business' ? BUSINESS_CATEGORIES : CATEGORIES;
}
