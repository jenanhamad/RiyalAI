/* Category colors derived from the Nova brand palette */
export const CATEGORIES = [
  { id: 'Food & Dining', labelAr: 'طعام', icon: '🍽️', color: '#F4A524' },
  { id: 'Transportation', labelAr: 'مواصلات', icon: '🚗', color: '#0E9488' },
  { id: 'Shopping', labelAr: 'تسوق', icon: '🛍️', color: '#6C4CF0' },
  { id: 'Entertainment', labelAr: 'ترفيه', icon: '🎬', color: '#8A6BFF' },
  { id: 'Utilities', labelAr: 'فواتير', icon: '💡', color: '#17B6A6' },
  { id: 'Healthcare', labelAr: 'صحة', icon: '🏥', color: '#F5405E' },
  { id: 'Groceries', labelAr: 'بقالة', icon: '🛒', color: '#12B981' },
  { id: 'Gas', labelAr: 'وقود', icon: '⛽', color: '#64708A' },
  { id: 'Other', labelAr: 'أخرى', icon: '📝', color: '#97A2B8' },
];

export const BUSINESS_CATEGORIES = [
  { id: 'Marketing', labelAr: 'تسويق', icon: '📣', color: '#6C4CF0' },
  { id: 'Salaries', labelAr: 'رواتب', icon: '👥', color: '#0E9488' },
  { id: 'Inventory', labelAr: 'مخزون', icon: '📦', color: '#12B981' },
  { id: 'Rent', labelAr: 'إيجار', icon: '🏠', color: '#8A6BFF' },
  { id: 'Tax', labelAr: 'ضريبة', icon: '🧾', color: '#F5405E' },
  { id: 'Equipment', labelAr: 'معدات', icon: '🔧', color: '#64708A' },
  { id: 'Commissions', labelAr: 'عمولات', icon: '٪', color: '#F4A524' },
  { id: 'Utilities', labelAr: 'فواتير', icon: '💡', color: '#17B6A6' },
  { id: 'Transportation', labelAr: 'مواصلات', icon: '🚗', color: '#0891B2' },
  { id: 'Other', labelAr: 'أخرى', icon: '📝', color: '#97A2B8' },
];

export function getCategoryMeta(name, mode = 'personal') {
  const list = mode === 'business' ? BUSINESS_CATEGORIES : CATEGORIES;
  return list.find((c) => c.id === name) || list[list.length - 1];
}

export function getCategoriesForMode(mode = 'personal') {
  return mode === 'business' ? BUSINESS_CATEGORIES : CATEGORIES;
}
