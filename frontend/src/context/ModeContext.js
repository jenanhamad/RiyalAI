import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api } from '../services/api';
import { updateLocalUserMode } from '../services/localAuth';

const ModeContext = createContext({
  mode: 'personal',
  isBusiness: false,
  setMode: async () => {},
  syncMode: () => {},
});

export function ModeProvider({ children, initialMode = 'personal' }) {
  const [mode, setModeState] = useState(
    initialMode === 'business' ? 'business' : 'personal'
  );

  const syncMode = useCallback((next) => {
    const m = next === 'business' ? 'business' : 'personal';
    setModeState(m);
    updateLocalUserMode(m);
  }, []);

  const setMode = useCallback(async (next) => {
    const m = next === 'business' ? 'business' : 'personal';
    await api.setActiveMode(m);
    setModeState(m);
    updateLocalUserMode(m);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      isBusiness: mode === 'business',
      setMode,
      syncMode,
    }),
    [mode, setMode, syncMode]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}
