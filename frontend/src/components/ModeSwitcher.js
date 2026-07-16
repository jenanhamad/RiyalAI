import React, { useState } from 'react';
import { useMode } from '../context/ModeContext';

const ModeSwitcher = ({ compact = false }) => {
  const { mode, setMode } = useMode();
  const [busy, setBusy] = useState(false);

  const switchTo = async (next) => {
    if (next === mode || busy) return;
    setBusy(true);
    try {
      await setMode(next);
    } catch {
      // keep current mode on failure
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`mode-switcher${compact ? ' compact' : ''}`}
      role="group"
      aria-label="تبديل وضع الحساب"
    >
      <button
        type="button"
        className={`mode-switch-btn${mode === 'personal' ? ' active' : ''}`}
        onClick={() => switchTo('personal')}
        disabled={busy}
      >
        أفراد
      </button>
      <button
        type="button"
        className={`mode-switch-btn${mode === 'business' ? ' active' : ''}`}
        onClick={() => switchTo('business')}
        disabled={busy}
      >
        أعمال
      </button>
    </div>
  );
};

export default ModeSwitcher;
