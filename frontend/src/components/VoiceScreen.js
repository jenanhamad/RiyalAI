import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useVoiceExpense } from '../hooks/useVoiceExpense';
import VoiceConfirmSheet from './VoiceConfirmSheet';
import { api } from '../services/api';
import { formatRiyal, getGreeting } from '../utils/format';
import { CATEGORIES, getCategoryMeta } from '../utils/categories';

const VoiceScreen = ({ user }) => {
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await api.getExpenses();
      setExpenses(res.data.expenses || []);
    } catch {
      setExpenses([]);
    } finally {
      setLoadingExpenses(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const {
    state,
    result,
    error,
    liveText,
    inputMode,
    setMode,
    startRecording,
    stopAndProcess,
    processReceiptFile,
    confirmExpense,
    dismiss,
  } = useVoiceExpense({ onSaved: fetchExpenses });

  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const showSheet = state === 'confirming' && result;
  const saved = result?.saved;
  const isReceiptMode = inputMode === 'receipt';

  useEffect(() => {
    if (state !== 'done') return undefined;
    const t = setTimeout(() => {
      dismiss();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [state, dismiss, previewUrl]);

  const grouped = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    return CATEGORIES.map((cat) => ({
      ...cat,
      items: sorted.filter((exp) => exp.category === cat.id),
      total: sorted
        .filter((exp) => exp.category === cat.id)
        .reduce((sum, exp) => sum + Number(exp.amount || 0), 0),
    })).filter((group) => group.items.length > 0);
  }, [expenses]);

  const handleMainAction = () => {
    if (isProcessing) return;
    if (isReceiptMode) {
      fileInputRef.current?.click();
      return;
    }
    if (isRecording) stopAndProcess();
    else startRecording();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    processReceiptFile(file);
  };

  const mainIcon = () => {
    if (isProcessing) return '⏳';
    if (state === 'done') return '✓';
    if (isRecording) return '⏹';
    return isReceiptMode ? '📷' : '🎤';
  };

  const statusText = () => {
    if (isReceiptMode && isProcessing) return 'نقرأ الإيصال ونصنّف المصروف...';
    if (isRecording && liveText && !liveText.startsWith('جاري')) return null;
    if (isRecording) return 'تكلم الآن... اضغط ⏹ لما تخلص';
    if (isProcessing) return isReceiptMode ? 'نقرأ الإيصال...' : 'نصنّف مصروفك ونضيفه...';
    if (state === 'done' && saved) {
      return `تم الإضافة! +${saved.xp_awarded ?? saved.gamification?.xpEarned ?? 20} XP`;
    }
    if (isReceiptMode) return 'صوّر الإيصال أو اختر صورة من الاستوديو';
    return 'اضغط وقول مثلاً: قهوة ١٥ ريال';
  };

  const handleRetry = () => {
    dismiss();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
    if (isReceiptMode) fileInputRef.current?.click();
    else startRecording();
  };

  return (
    <div className="page voice-screen voice-home">
      <div className="voice-home-header">
        <div>
          <p className="tagline">ريالي · ryialAI</p>
          <h1 className="page-title">{getGreeting()}، {user?.username || 'صديقي'}</h1>
        </div>
      </div>

      <p className="page-subtitle text-secondary">
        صوت أو صورة — نصنّف مصروفك ونضيفه تحت التصنيف
      </p>

      <div className="input-mode-toggle" role="tablist" aria-label="طريقة الإدخال">
        <button
          type="button"
          role="tab"
          aria-selected={!isReceiptMode}
          className={`input-mode-btn${!isReceiptMode ? ' active' : ''}`}
          onClick={() => setMode('voice')}
          disabled={isProcessing || isRecording}
        >
          🎤 صوت
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isReceiptMode}
          className={`input-mode-btn${isReceiptMode ? ' active' : ''}`}
          onClick={() => setMode('receipt')}
          disabled={isProcessing || isRecording}
        >
          📷 إيصال
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only-input"
        onChange={handleFileChange}
      />

      <div className="mic-rings mic-rings-compact">
        <div className="mic-ring" />
        <div className="mic-ring" />
        <button
          type="button"
          className={`mic-btn-large${isRecording ? ' recording' : ''}${state === 'done' ? ' done' : ''}${isProcessing ? ' processing' : ''}${isReceiptMode ? ' receipt' : ''}`}
          onClick={handleMainAction}
          disabled={isProcessing || state === 'done' || isRecording}
          aria-label={isReceiptMode ? 'تصوير إيصال' : 'تسجيل صوت'}
        >
          {mainIcon()}
        </button>
      </div>

      {statusText() && (
        <p className="text-secondary voice-status">{statusText()}</p>
      )}

      {previewUrl && isReceiptMode && !isProcessing && state !== 'done' && (
        <div className="receipt-preview-wrap">
          <img src={previewUrl} alt="معاينة الإيصال" className="receipt-preview" />
        </div>
      )}

      {liveText && isRecording && (
        <div className="voice-live-box" aria-live="polite">
          <span className="voice-live-label">تسمع الآن</span>
          <p className="voice-live-text">{liveText}</p>
        </div>
      )}

      {error && (
        <div className="voice-result-box error">
          <p className="voice-live-text">{error}</p>
        </div>
      )}

      {state === 'done' && saved && (
        <div className="voice-result-box ai">
          <p className="voice-live-text">{saved.messageAr || 'تم حفظ المصروف'}</p>
          <p className="voice-result-meta">
            {formatRiyal(saved.amount)}
            {' · '}
            {getCategoryMeta(saved.category).labelAr}
          </p>
        </div>
      )}

      <h2 className="section-title voice-categories-title">مصروفاتك حسب التصنيف</h2>

      {loadingExpenses ? (
        <div className="empty-state">
          <div className="spinner" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="empty-state">
          <p>ما عندك مصروفات بعد</p>
          <p>🎤 صوت أو 📷 إيصال</p>
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.id} className="voice-category-block">
            <div className="voice-category-header">
              <span className="voice-category-icon" style={{ borderColor: group.color }}>
                {group.icon}
              </span>
              <div className="voice-category-meta">
                <h3>{group.labelAr}</h3>
                <p className="text-secondary">{formatRiyal(group.total)}</p>
              </div>
            </div>
            <div className="voice-category-items">
              {group.items.map((exp) => (
                <Link
                  key={exp.expenseId}
                  to={`/expense/${exp.expenseId}`}
                  className="expense-item voice-category-item"
                >
                  <div className="expense-item-body">
                    <div className="expense-item-merchant">{exp.merchant}</div>
                    <div className="expense-item-meta">{exp.date}</div>
                  </div>
                  <div className="expense-item-amount">{formatRiyal(exp.amount)}</div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}

      <VoiceConfirmSheet
        open={Boolean(showSheet)}
        data={result}
        onConfirm={confirmExpense}
        onRetry={handleRetry}
        onClose={dismiss}
      />
    </div>
  );
};

export default VoiceScreen;
