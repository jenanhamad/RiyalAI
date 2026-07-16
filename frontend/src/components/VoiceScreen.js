import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useVoiceExpense } from '../hooks/useVoiceExpense';
import VoiceConfirmSheet from './VoiceConfirmSheet';
import ModeSwitcher from './ModeSwitcher';
import { api } from '../services/api';
import { formatRiyal, getGreeting } from '../utils/format';
import { getCategoryMeta } from '../utils/categories';
import { useMode } from '../context/ModeContext';

const VoiceScreen = ({ user }) => {
  const { mode, isBusiness } = useMode();
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [previewUrl, setPreviewUrl] = useState('');
  const [personalPrompt, setPersonalPrompt] = useState(null);
  const [converting, setConverting] = useState(false);
  const [convertMsg, setConvertMsg] = useState('');
  const fileInputRef = useRef(null);

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await api.getExpenses(mode);
      setExpenses(res.data.expenses || []);
    } catch {
      setExpenses([]);
    } finally {
      setLoadingExpenses(false);
    }
  }, [mode]);

  useEffect(() => {
    setLoadingExpenses(true);
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
  } = useVoiceExpense({
    accountMode: mode,
    onSaved: (savedData) => {
      fetchExpenses();
      if (savedData?.suggestPersonal && savedData?.expenseId) {
        setPersonalPrompt({
          expenseId: savedData.expenseId,
          promptAr: savedData.personalSuggestion?.promptAr
            || 'يبدو مصروف شخصي. تبي أحوله لك لمصروف أفراد؟',
          amount: savedData.amount,
          note: savedData.note || savedData.transcription,
        });
        setConvertMsg('');
      } else {
        setPersonalPrompt(null);
      }
    },
  });

  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const showSheet = state === 'confirming' && result;
  const saved = result?.saved;
  const isReceiptMode = inputMode === 'receipt';
  const micButtonDisabled = isProcessing || state === 'done';

  useEffect(() => {
    if (state !== 'done') return undefined;
    // Keep result visible while asking to convert to personal
    if (personalPrompt) return undefined;
    const t = setTimeout(() => {
      dismiss();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [state, dismiss, previewUrl, personalPrompt]);

  const dismissPersonalPrompt = () => {
    setPersonalPrompt(null);
    dismiss();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  };

  const handleConvertPersonal = async () => {
    if (!personalPrompt?.expenseId || converting) return;
    setConverting(true);
    try {
      const res = await api.convertToPersonal(personalPrompt.expenseId);
      setConvertMsg(res.data.messageAr || 'تم التحويل لمصروف أفراد');
      setPersonalPrompt(null);
      await fetchExpenses();
      setTimeout(() => {
        setConvertMsg('');
        dismiss();
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl('');
        }
      }, 2200);
    } catch (err) {
      setConvertMsg(err.response?.data?.detail || 'تعذر التحويل');
    } finally {
      setConverting(false);
    }
  };

  const recentExpenses = useMemo(() => (
    [...expenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3)
  ), [expenses]);

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
    if (isReceiptMode && isProcessing) {
      return isBusiness ? 'نقرأ الإيصال ونصنّف الحركة...' : 'نقرأ الإيصال ونصنّف المصروف...';
    }
    if (isRecording && liveText && !liveText.startsWith('جاري')) return null;
    if (isRecording) return 'تكلم الآن... اضغط ⏹ لما تخلص';
    if (isProcessing) {
      return isReceiptMode
        ? 'نقرأ الإيصال...'
        : (isBusiness ? 'نصنّف حركة العمل...' : 'نصنّف مصروفك ونضيفه...');
    }
    if (state === 'done' && saved) {
      if (isBusiness || !(saved.xp_awarded ?? saved.gamification?.xpEarned)) {
        return saved.messageAr || 'تم التسجيل';
      }
      return `تم الإضافة! +${saved.xp_awarded ?? saved.gamification?.xpEarned ?? 20} XP`;
    }
    if (isReceiptMode) return 'صوّر الإيصال أو اختر صورة من الاستوديو';
    return isBusiness
      ? 'قول مثلاً: بيعت اليوم ١٢٠٠ ريال — أو اشتريت مواد ٣٤٠'
      : 'اضغط وقول مثلاً: قهوة ١٥ ريال';
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
          <p className="tagline">{isBusiness ? 'ريالي أعمال' : 'ريالي · ryialAI'}</p>
          <h1 className="page-title">{getGreeting()}، {user?.username || 'صديقي'}</h1>
        </div>
      </div>

      <ModeSwitcher compact />

      <p className="page-subtitle text-secondary">
        {isBusiness
          ? 'سجّل إيراد أو مصروف عمل بالصوت أو الإيصال'
          : 'صوت أو صورة — نصنّف مصروفك ونضيفه تحت التصنيف'}
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
          disabled={micButtonDisabled}
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
          <p className="voice-live-text">{saved.messageAr || 'تم الحفظ'}</p>
          <p className="voice-result-meta">
            {saved.entryType === 'income' ? '+' : ''}
            {formatRiyal(saved.amount)}
            {' · '}
            {saved.entryType === 'income'
              ? 'إيراد'
              : getCategoryMeta(saved.category, mode).labelAr}
          </p>
        </div>
      )}

      {convertMsg && (
        <div className="voice-result-box ai">
          <p className="voice-live-text">{convertMsg}</p>
        </div>
      )}

      {personalPrompt && (
        <div className="glass-card personal-convert-card" role="dialog" aria-label="تحويل لمصروف شخصي">
          <p className="personal-convert-title">مصروف شخصي؟</p>
          <p className="text-secondary personal-convert-text">{personalPrompt.promptAr}</p>
          {(personalPrompt.note || personalPrompt.amount) && (
            <p className="personal-convert-meta font-mono">
              {personalPrompt.note ? `«${personalPrompt.note}» · ` : ''}
              {formatRiyal(personalPrompt.amount || 0)}
            </p>
          )}
          <div className="personal-convert-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleConvertPersonal}
              disabled={converting}
            >
              {converting ? '...' : 'إيوه، حوّلها لأفراد'}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={dismissPersonalPrompt}
              disabled={converting}
            >
              لا، تبقى أعمال
            </button>
          </div>
        </div>
      )}

      <h2 className="section-title voice-categories-title">
        {isBusiness ? 'آخر الحركات' : 'آخر المصروفات'}
      </h2>

      {loadingExpenses ? (
        <div className="empty-state">
          <div className="spinner" />
        </div>
      ) : recentExpenses.length === 0 ? (
        <div className="empty-state">
          <p>{isBusiness ? 'ما عندك حركات عمل بعد' : 'ما عندك مصروفات بعد'}</p>
          <p>🎤 صوت أو 📷 إيصال</p>
        </div>
      ) : (
        <div className="voice-recent-list">
          {recentExpenses.map((exp) => {
            const cat = getCategoryMeta(exp.category, mode);
            const isIncome = exp.entryType === 'income';
            return (
              <Link
                key={exp.expenseId}
                to={`/expense/${exp.expenseId}`}
                className="expense-item voice-recent-item"
              >
                <div
                  className="expense-item-icon"
                  style={{ borderLeft: `3px solid ${isIncome ? '#22c55e' : cat.color}` }}
                >
                  {isIncome ? '↑' : cat.icon}
                </div>
                <div className="expense-item-body">
                  <div className="expense-item-merchant">{exp.merchant}</div>
                  <div className="expense-item-meta">
                    {isIncome ? 'إيراد' : cat.labelAr}
                    {exp.projectTag ? ` · ${exp.projectTag}` : ''}
                    {' · '}{exp.date}
                  </div>
                </div>
                <div className={`expense-item-amount ${isIncome ? 'income' : ''}`}>
                  {isIncome ? '+' : ''}{formatRiyal(exp.amount)}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <VoiceConfirmSheet
        open={Boolean(showSheet)}
        data={result}
        onConfirm={confirmExpense}
        onRetry={handleRetry}
        onClose={dismiss}
        accountMode={mode}
      />
    </div>
  );
};

export default VoiceScreen;
