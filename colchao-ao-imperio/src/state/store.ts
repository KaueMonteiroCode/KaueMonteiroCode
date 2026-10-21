import { useSyncExternalStore } from 'react';
import { loadSave, saveData, saveMirrorSync, wipeAll } from '../core/db';
import { newSave, normalizeSave } from './defaults';
import type { SaveData } from './types';

/**
 * Store mínimo e imutável. Cada `update` produz um novo objeto de save (cópia estrutural),
 * o que permite memoização barata das contas derivadas (saldos, moedas, conquistas).
 */
let state: SaveData | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaveOk = true;

export function getState(): SaveData {
  if (!state) throw new Error('Save não carregado');
  return state;
}
export function hasState() { return !!state; }

function emit() { listeners.forEach((l) => l()); }

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

export async function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!state) return;
  try {
    await saveData(state);
    lastSaveOk = true;
  } catch {
    lastSaveOk = false;
  }
}
export const saveStatus = () => lastSaveOk;

export function setState(next: SaveData, persist = true) {
  next.savedAt = Date.now();
  state = next;
  if (persist) scheduleSave();
  emit();
}

/** Aplica uma mutação sobre uma cópia profunda do estado. */
export function update(fn: (draft: SaveData) => void) {
  const draft = structuredClone(getState());
  fn(draft);
  setState(draft);
  return draft;
}

export async function boot(): Promise<SaveData | null> {
  const loaded = await loadSave<SaveData>();
  if (loaded) {
    try { state = normalizeSave(loaded); } catch { state = null; }
  }
  if (typeof window !== 'undefined') {
    const sync = () => { if (state) { state.savedAt = Date.now(); saveMirrorSync(state); } };
    window.addEventListener('pagehide', sync);
    window.addEventListener('beforeunload', sync);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { sync(); void flush(); } });
  }
  emit();
  return state;
}

export function startNewGame() {
  setState(newSave());
  void flush();
}

export async function eraseEverything() {
  await wipeAll();
  state = null;
  emit();
}

export function replaceState(raw: unknown) {
  const s = normalizeSave(raw);
  setState(s);
  void flush();
}

export function useSave<T>(sel: (s: SaveData) => T): T {
  return useSyncExternalStore(subscribe, () => sel(getState()), () => sel(getState()));
}

export function useMaybeSave(): SaveData | null {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
