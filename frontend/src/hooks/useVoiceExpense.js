import { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';

/**
 * Voice expense flow: record → process (no save) → confirm sheet → save.
 * States: idle | recording | processing | confirming | done
 */
export function useVoiceExpense() {
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [liveText, setLiveText] = useState('');
  const mediaRecorderRef = useRef(null);
  const speechRef = useRef(null);
  const chunksRef = useRef([]);
  const finalTranscriptRef = useRef('');
  const streamRef = useRef(null);

  const reset = useCallback(() => {
    setResult(null);
    setError('');
    setLiveText('');
    if (state !== 'recording') setState('idle');
  }, [state]);

  const processTranscription = async (text) => {
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
      setResult(res.data);
      setState('confirming');
    } catch (err) {
      setError(parseVoiceError(err));
      setState('idle');
    }
  };

  const processAudioBlob = async (blob, filename = 'voice.webm') => {
    setState('processing');
    setLiveText('');
    try {
      const res = await api.voiceProcess({ audioBlob: blob, filename });
      setResult(res.data);
      setState('confirming');
    } catch (err) {
      setError(parseVoiceError(err));
      setState('idle');
    }
  };

  const startRecording = useCallback(async () => {
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
  }, []);

  const stopAndProcess = useCallback(() => {
    if (state !== 'recording') return;
    speechRef.current?.stop();
    mediaRecorderRef.current?.stop();
  }, [state]);

  const confirmExpense = useCallback(async (edited) => {
    setState('processing');
    setError('');
    try {
      const saved = await api.voiceConfirm(edited);
      setResult((prev) => ({ ...prev, saved: saved.data }));
      setState('done');
      return saved.data;
    } catch (err) {
      setError(parseVoiceError(err));
      setState('confirming');
      return null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setState('idle');
    setResult(null);
    setError('');
    setLiveText('');
  }, []);

  return {
    state,
    result,
    error,
    liveText,
    startRecording,
    stopAndProcess,
    confirmExpense,
    dismiss,
    reset,
  };
}

function parseVoiceError(err) {
  const data = err.response?.data;
  if (!data) return err.message || 'تعذّر فهم الصوت';
  const detail = data.detail;
  if (detail && typeof detail === 'object') {
    return detail.error || 'تعذّر فهم الصوت';
  }
  return typeof detail === 'string' ? detail : data.error || 'تعذّر فهم الصوت';
}
