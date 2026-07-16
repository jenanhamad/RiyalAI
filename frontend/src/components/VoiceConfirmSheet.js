import React, { useState, useEffect } from 'react';
import { getCategoryMeta, getCategoriesForMode } from '../utils/categories';
import { formatRiyal } from '../utils/format';

const CONFIDENCE_THRESHOLD = 0.8;

const VoiceConfirmSheet = ({ open, data, onConfirm, onRetry, onClose, accountMode = 'personal' }) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('Other');
  const [entryType, setEntryType] = useState('expense');
  const [projectTag, setProjectTag] = useState('');
  const [saving, setSaving] = useState(false);

  const categories = getCategoriesForMode(accountMode);
  const isBusiness = accountMode === 'business';

  useEffect(() => {
    if (!data) return;
    setAmount(String(data.amount ?? ''));
    setNote(data.note || '');
    setCategory(data.category || 'Other');
    setEntryType(data.entryType || data.entry_type || 'expense');
    setProjectTag(data.projectTag || data.project_tag || '');
  }, [data]);

  if (!open || !data) return null;

  const cat = getCategoryMeta(category, accountMode);
  const lowConfidence = (data.confidence ?? 1) < CONFIDENCE_THRESHOLD;

  const handleConfirm = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    setSaving(true);
    try {
      await onConfirm({
        amount: num,
        category,
        note: note.trim() || null,
        transcription: data.transcription,
        entryType: isBusiness ? entryType : 'expense',
        projectTag: isBusiness ? projectTag.trim() || null : null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="voice-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="voice-sheet"
        role="dialog"
        aria-labelledby="voice-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="voice-sheet-handle" />
        <h2 id="voice-sheet-title" className="voice-sheet-title">
          {isBusiness ? 'تأكيد الحركة' : 'تأكيد المصروف'}
        </h2>

        {lowConfidence && (
          <div className="voice-low-confidence">
            <p>هل قصدت:</p>
            <p className="voice-low-confidence-text">«{data.transcription}»</p>
          </div>
        )}

        {isBusiness && (
          <div className="mode-switcher compact" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={`mode-switch-btn${entryType === 'expense' ? ' active' : ''}`}
              onClick={() => setEntryType('expense')}
            >
              مصروف
            </button>
            <button
              type="button"
              className={`mode-switch-btn${entryType === 'income' ? ' active' : ''}`}
              onClick={() => setEntryType('income')}
            >
              إيراد
            </button>
          </div>
        )}

        <div className="voice-sheet-amount">
          <span className="voice-sheet-currency">﷼</span>
          <input
            type="number"
            inputMode="decimal"
            className="voice-sheet-amount-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="المبلغ"
          />
        </div>
        <p className="text-secondary voice-sheet-preview">
          {amount ? formatRiyal(parseFloat(amount) || 0) : '—'}
        </p>

        <div className="voice-sheet-category">
          <span className="voice-sheet-cat-icon" style={{ borderColor: cat.color }}>
            {cat.icon}
          </span>
          <span>{cat.labelAr}</span>
          <select
            className="voice-sheet-cat-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="التصنيف"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.labelAr}</option>
            ))}
          </select>
        </div>

        <label className="voice-sheet-note-label">
          ملاحظة
          <input
            type="text"
            className="voice-sheet-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isBusiness ? 'مثال: مورد، عميل، إعلان...' : 'مثال: غداء، بنزين...'}
          />
        </label>

        {isBusiness && (
          <label className="voice-sheet-note-label">
            مشروع / عميل (اختياري)
            <input
              type="text"
              className="voice-sheet-note"
              value={projectTag}
              onChange={(e) => setProjectTag(e.target.value)}
              placeholder="مثال: مشروع أحمد"
            />
          </label>
        )}

        {!lowConfidence && data.transcription && (
          <p className="voice-sheet-transcript text-secondary">«{data.transcription}»</p>
        )}

        <div className="voice-sheet-actions">
          <button
            type="button"
            className="btn-primary voice-sheet-confirm"
            onClick={handleConfirm}
            disabled={saving || !amount || parseFloat(amount) <= 0}
          >
            {saving ? 'جاري الحفظ...' : 'تأكيد وحفظ ✓'}
          </button>
          <button type="button" className="btn-outline voice-sheet-retry" onClick={onRetry}>
            إعادة التسجيل
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceConfirmSheet;
