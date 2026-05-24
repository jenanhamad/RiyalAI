import React, { useState, useEffect } from 'react';
import { getCategoryMeta } from '../utils/categories';
import { formatRiyal } from '../utils/format';

const CONFIDENCE_THRESHOLD = 0.8;

const VoiceConfirmSheet = ({ open, data, onConfirm, onRetry, onClose }) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('Other');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setAmount(String(data.amount ?? ''));
    setNote(data.note || '');
    setCategory(data.category || 'Other');
  }, [data]);

  if (!open || !data) return null;

  const cat = getCategoryMeta(category);
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
        <h2 id="voice-sheet-title" className="voice-sheet-title">تأكيد المصروف</h2>

        {lowConfidence && (
          <div className="voice-low-confidence">
            <p>هل قصدت:</p>
            <p className="voice-low-confidence-text">«{data.transcription}»</p>
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
            {[
              'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
              'Utilities', 'Healthcare', 'Groceries', 'Gas', 'Other',
            ].map((id) => (
              <option key={id} value={id}>{getCategoryMeta(id).labelAr}</option>
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
            placeholder="مثال: غداء، بنزين..."
          />
        </label>

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
