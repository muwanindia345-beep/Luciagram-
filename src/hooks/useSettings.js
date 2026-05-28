import { useState, useEffect, useCallback } from 'react';
import API from '../api';

// In-memory cache — API baar baar call nahi hoga
let cache = null;
let cacheLoaded = false;

export function useSettings() {
  const [settings, setSettings] = useState(cache || {});
  const [ready, setReady] = useState(cacheLoaded);

  useEffect(() => {
    if (cacheLoaded) return;
    API.get('/settings').then(res => {
      cache = res.data || {};
      cacheLoaded = true;
      setSettings(cache);
      setReady(true);
    }).catch(() => { cacheLoaded = true; setReady(true); });
  }, []);

  const getSetting = useCallback((key, fallback = null) => {
    return settings[key] ?? fallback;
  }, [settings]);

  const setSetting = useCallback(async (key, value) => {
    // Optimistic update
    cache = { ...cache, [key]: value };
    setSettings({ ...cache });
    try {
      await API.post('/settings', { key, value });
    } catch {
      console.error('Setting save failed:', key);
    }
  }, []);

  const removeSetting = useCallback(async (key) => {
    if (cache) delete cache[key];
    setSettings({ ...cache });
    try {
      await API.delete(`/settings/${key}`);
    } catch {}
  }, []);

  return { settings, getSetting, setSetting, removeSetting, ready };
}

// Reset cache on logout
export function clearSettingsCache() {
  cache = null;
  cacheLoaded = false;
}
