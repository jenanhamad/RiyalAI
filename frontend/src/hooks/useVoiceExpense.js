import { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';

const AUTO_SAVE_CONFIDENCE = 0.8;

/**
 * Voice / receipt flow: capture → process → auto-save (or confirm sheet) → done
 */
export function useVoiceExpense({ onSaved } = {}) {
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [liveText, setLiveText] = useState('');
  const [inputMode, setInputMode] = useState('voice');
  const mediaRecorderRef = useRef(null);
  const speechRef = useRef(null);
  const chunksRef = useRef([]);
  const finalTranscriptRef = useRef('');
  const streamRef = useRef(null);

  const saveExtracted = useCallback(async (extracted) => {
    const payload = {
      amount: extracted.amount,
      category: extracted.category,
      note: extracted.note || null,
      transcription: extracted.transcription,
      source: extracted.source || 'voice',
    };
    const saved = await api.voiceConfirm(payload);
    const savedData = saved.data;
    setResult((prev) => ({ ...(prev || extracted), ...extracted, saved: savedData }));
    setState('done');
    onSaved?.(savedData);
    return savedData;
  }, [onSaved]);

  const handleExtracted = useCallback(async (extracted) => {
    const amount = Number(extracted.amount);
    const confidence = extracted.confidence ?? 0;
    const canAutoSave = amount > 0 && confidence >= AUTO_SAVE_CONFIDENCE;

    setResult(extracted);

    if (canAutoSave) {
      try {
        await saveExtracted(extracted);
      } catch (err) {
        setError(parseVoiceError(err));
        setState('confirming');
      }
      return;
    }

    if (amount > 0) {
      setState('confirming');
      return;
    }

    setError('ما قدرنا نحدد المبلغ — عدّل وحفظ يدوياً');
    setState('confirming');
  }, [saveExtracted]);

  const processTranscription = useCallback(async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      setError('ما سمعت كلام — جرّب مرة ثانية');
      setState('idle');
      return;
    }
    setState('processing');
    setLiveText('');
    try {
      const res = await api.voiceProcess({ transcription: trimmed });
      await handleExtracted({ ...res.data, source: 'voice' });
    } catch (err) {
      setError(parseVoiceError(err));
      setState('idle');
    }
  }, [handleExtracted]);

  const processAudioBlob = useCallback(async (blob, filename = 'voice.webm') => {
    setState('processing');
    setLiveText('');
    try {
      const res = await api.voiceProcess({ audioBlob: blob, filename });
      await handleExtracted({ ...res.data, source: 'voice' });
    } catch (err) {
      setError(parseVoiceError(err));
      setState('idle');
    }
  }, [handleExtracted]);

  const processReceiptFile = useCallback(async (file) => {
    if (!file) return;
    setState('processing');
    setError('');
    setLiveText('جاري قراءة الإيصال...');
    try {
      const res = await api.receiptProcess(file);
      setLiveText('');
      await handleExtracted({ ...res.data, source: 'receipt' });
    } catch (err) {
      setError(parseVoiceError(err));
      setLiveText('');
      setState('idle');
    }
  }, [handleExtracted]);

  const startRecording = useCallback(async () => {
    setInputMode('voice');
    setError('');
    setResult(null);

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.lang = 'ar-SA';
      rec.interimResults = true;
      rec.continuous = true;
      speechRef.current = rec;
      finalTranscriptRef.current = '';

      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const part = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalTranscriptRef.current = `${finalTranscriptRef.current} ${part}`.trim();
          } else {
            interim += part;
          }
        }
        setLiveText(finalTranscriptRef.current || interim);
      };

      rec.onerror = () => {
        setError('تعذر التعرف على الصوت');
        setState('idle');
        setLiveText('');
      };

      rec.onend = () => {
        setLiveText('');
        const text = finalTranscriptRef.current.trim();
        setState('idle');
        if (text) processTranscription(text);
        else setError('ما سمعت كلام — جرّب مرة ثانية');
      };

      rec.start();
      setState('recording');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const ext = (mr.mimeType || '').includes('mp4') ? 'voice.m4a' : 'voice.webm';
        await processAudioBlob(blob, ext);
      };
      mr.start();
      setState('recording');
      setLiveText('جاري التسجيل... اضغط إيقاف لما تخلص');
    } catch {
      setError('فعّل الميكروفون من إعدادات المتصفح');
      setState('idle');
    }
  }, [processAudioBlob, processTranscription]);

  const stopAndProcess = useCallback(() => {
    if (state !== 'recording') return;
    speechRef.current?.stop();
    mediaRecorderRef.current?.stop();
  }, [state]);

  const confirmExpense = useCallback(async (edited) => {
    setState('processing');
    setError('');
    try {
      const savedData = await saveExtracted({
        ...result,
        amount: edited.amount,
        category: edited.category,
        note: edited.note,
        transcription: edited.transcription,
        source: result?.source || 'voice',
      });
      return savedData;
    } catch (err) {
      setError(parseVoiceError(err));
      setState('confirming');
      return null;
    }
  }, [result, saveExtracted]);

  const dismiss = useCallback(() => {
    setState('idle');
    setResult(null);
    setError('');
    setLiveText('');
  }, []);

  const setMode = useCallback((mode) => {
    if (state === 'processing' || state === 'recording') return;
    setInputMode(mode);
    setError('');
    setResult(null);
    setLiveText('');
    if (state !== 'idle' && state !== 'done') setState('idle');
  }, [state]);

  return {
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
  };
}

function parseVoiceError(err) {
  const data = err.response?.data;
  if (!data) return err.message || 'تعذّر المعالجة';
  const detail = data.detail;
  if (detail && typeof detail === 'object') {
    return detail.error || 'تعذّر المعالجة';
  }
  return typeof detail === 'string' ? detail : data.error || 'تعذّر المعالجة';
}
