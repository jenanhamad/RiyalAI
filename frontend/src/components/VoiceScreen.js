import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { formatRiyal } from '../utils/format';

const VoiceScreen = () => {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [bubbles, setBubbles] = useState([]);
  const mediaRecorderRef = useRef(null);
  const speechRef = useRef(null);
  const chunksRef = useRef([]);

  const addBubble = (role, text) => {
    setBubbles((prev) => [...prev, { role, text, id: Date.now() }]);
  };

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const submitTranscription = async (text) => {
    setProcessing(true);
    addBubble('user', text);
    try {
      const res = await api.voiceExpense(null, 'audio/webm', text);
      const d = res.data;
      addBubble('ai', d.messageAr || `تم تسجيل ${formatRiyal(d.expense?.amount || d.extracted?.amount)}`);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      addBubble('ai', err.response?.data?.error || 'ما قدرت أفهم، جرّب مرة ثانية');
    } finally {
      setProcessing(false);
      setRecording(false);
    }
  };

  const processAudio = async (blob, mimeType) => {
    setProcessing(true);
    addBubble('user', '🎤 تسجيل صوتي...');
    try {
      const b64 = await blobToBase64(blob);
      const res = await api.voiceExpense(b64, mimeType);
      const d = res.data;
      setBubbles((prev) => [
        ...prev.slice(0, -1),
        { role: 'user', text: d.transcription || '...', id: Date.now() - 1 },
        { role: 'ai', text: d.messageAr || 'تم!', id: Date.now() },
      ]);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      addBubble('ai', err.response?.data?.error || 'فشل التحليل');
    } finally {
      setProcessing(false);
    }
  };

  const startSpeech = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    const rec = new SR();
    rec.lang = 'ar-SA';
    speechRef.current = rec;
    rec.onresult = (e) => submitTranscription(e.results[0][0].transcript);
    rec.onerror = () => {
      addBubble('ai', 'تعذر التعرف على الصوت');
      setRecording(false);
    };
    rec.onend = () => setRecording(false);
    rec.start();
    setRecording(true);
    return true;
  };

  const handleMic = async () => {
    if (processing) return;
    if (recording) {
      speechRef.current?.stop();
      mediaRecorderRef.current?.stop();
      return;
    }
    if (startSpeech()) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await processAudio(new Blob(chunksRef.current), mr.mimeType || 'audio/webm');
      };
      mr.start();
      setRecording(true);
    } catch {
      addBubble('ai', 'فعّل الميكروفون من إعدادات المتصفح');
    }
  };

  return (
    <div className="page voice-screen">
      <h1 className="page-title">سجّل بالصوت</h1>
      <p className="page-subtitle text-secondary">قل مصروفك بالعربي — نحلّله ونسجّله</p>

      <div className="mic-rings">
        <div className="mic-ring" />
        <div className="mic-ring" />
        <div className="mic-ring" />
        <button
          type="button"
          className={`mic-btn-large${recording ? ' recording' : ''}`}
          onClick={handleMic}
          disabled={processing}
          aria-label="تسجيل"
        >
          {processing ? '⏳' : recording ? '⏹' : '🎤'}
        </button>
      </div>

      <p className="text-secondary" style={{ marginBottom: 24 }}>
        {recording ? 'تكلم الآن...' : processing ? 'جاري التحليل...' : 'اضغط وقول مثلاً: قهوة ١٥ ريال'}
      </p>

      <div style={{ width: '100%', maxWidth: 360 }}>
        {bubbles.map((b) => (
          <div key={b.id} className={`voice-bubble ${b.role}`}>{b.text}</div>
        ))}
      </div>
    </div>
  );
};

export default VoiceScreen;
