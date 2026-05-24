import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVoiceExpense } from '../hooks/useVoiceExpense';
import VoiceConfirmSheet from './VoiceConfirmSheet';
import { formatRiyal } from '../utils/format';
import { getCategoryMeta } from '../utils/categories';

const VoiceScreen = () => {
  const navigate = useNavigate();
  const {
    state,
    result,
    error,
    liveText,
    startRecording,
    stopAndProcess,
    confirmExpense,
    dismiss,
  } = useVoiceExpense();

  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const showSheet = state === 'confirming' && result;
  const saved = result?.saved;

  useEffect(() => {
    if (state !== 'done') return undefined;
    const t = setTimeout(() => {
      dismiss();
      navigate('/');
    }, 2200);
    return () => clearTimeout(t);
  }, [state, dismiss, navigate]);

  const handleMic = () => {
    if (isProcessing) return;
    if (isRecording) stopAndProcess();
    else startRecording();
  };

  const micIcon = () => {
    if (isProcessing) return '⏳';
    if (state === 'done') return '✓';
    if (isRecording) return '⏹';
    return '🎤';
  };

  const statusText = () => {
    if (isRecording && liveText && !liveText.startsWith('جاري')) return null;
    if (isRecording) return 'تكلم الآن... اضغط ⏹ لما تخلص';
    if (isProcessing) return 'OpenRouter يحلّل كلامك...';
    if (state === 'done' && saved) {
      return `تم! +${saved.xp_awarded ?? saved.gamification?.xpEarned} XP`;
    }
    return 'اضغط وقول مثلاً: قهوة ١٥ ريال';
  };

  return (
    <div className="page voice-screen">
      <h1 className="page-title">سجّل بالصوت</h1>
      <p className="page-subtitle text-secondary">
        نفهم كلامك أولاً — ثم تأكد قبل الحفظ
      </p>

      <p className="voice-pipeline-hint text-secondary">
        OpenRouter: تفريغ صوت (Gemini) + استخراج مصروف (Claude) → تأكيدك
      </p>

      <div className="mic-rings">
        <div className="mic-ring" />
        <div className="mic-ring" />
        <div className="mic-ring" />
        <button
          type="button"
          className={`mic-btn-large${isRecording ? ' recording' : ''}${state === 'done' ? ' done' : ''}${isProcessing ? ' processing' : ''}`}
          onClick={handleMic}
          disabled={isProcessing || state === 'done'}
          aria-label="تسجيل"
        >
          {micIcon()}
        </button>
      </div>

      {statusText() && (
        <p className="text-secondary voice-status">{statusText()}</p>
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
          <p className="voice-live-text">{saved.messageAr}</p>
          <p className="voice-result-meta">
            {formatRiyal(saved.amount)}
            {' · '}
            {getCategoryMeta(saved.category).labelAr}
          </p>
        </div>
      )}

      <VoiceConfirmSheet
        open={Boolean(showSheet)}
        data={result}
        onConfirm={confirmExpense}
        onRetry={() => {
          dismiss();
          startRecording();
        }}
        onClose={dismiss}
      />
    </div>
  );
};

export default VoiceScreen;
