/*
 * Dolapy AI provider adapter.
 *
 * This file deliberately contains no provider key and no mandatory network call.
 * The browser can use local vision first; a future Worker can call this contract
 * server-side without changing the product UI.
 */
(() => {
  'use strict';

  const CONFIG_KEY = 'dolapy.ai.v1';
  const DEFAULTS = {
    enabled: false,
    provider: 'none',
    endpoint: '',
    model: '',
    timeoutMs: 20000,
    maxOutputTokens: 700
  };

  const readConfig = () => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') }; }
    catch { return { ...DEFAULTS }; }
  };

  const saveConfig = (patch) => {
    const next = { ...readConfig(), ...patch };
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); } catch {}
    return next;
  };

  const withTimeout = async (promise, ms) => {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('AI request timed out')), ms); })
      ]);
    } finally { clearTimeout(timer); }
  };

  async function generate({ system = '', prompt = '', context = {}, signal } = {}) {
    const config = readConfig();
    if (!config.enabled || !config.endpoint) {
      return { ok: false, skipped: true, reason: 'AI provider is not configured' };
    }

    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });

    try {
      const response = await withTimeout(fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model || undefined,
          system,
          prompt,
          context,
          max_output_tokens: config.maxOutputTokens
        }),
        signal: controller.signal
      }), config.timeoutMs);

      if (!response.ok) return { ok: false, status: response.status, reason: await response.text().catch(() => 'AI request failed') };
      const data = await response.json();
      return { ok: true, data };
    } catch (error) {
      return { ok: false, reason: error?.message || 'AI request failed' };
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }

  window.DolapyAI = { readConfig, saveConfig, generate, defaults: { ...DEFAULTS } };
})();
