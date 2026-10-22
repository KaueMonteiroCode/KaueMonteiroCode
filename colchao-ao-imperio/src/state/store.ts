import { useSyncExternalStore } from 'react';
import { idbGet, idbSet, loadSave, saveData, saveMirrorSync, wipeAll } from '../core/db';
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
let bootError = false;
export const hadBootError = () => bootError;

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
    try { state = normalizeSave(loaded); } catch { state = null; bootError = true; }
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

/** Restaura um backup. Guarda o estado anterior para poder desfazer. Retorna os reparos feitos. */
export async function replaceState(raw: unknown): Promise<string[]> {
  const report = { repairs: [] as string[] };
  const s = normalizeSave(raw, report);
  if (state) await idbSet('save-before-restore', state);
  setState(s);
  await flush();
  return report.repairs;
}

/** Aplica dados juntados de outro aparelho (guarda o estado anterior para desfazer). */
export async function applyMerged(s: SaveData) {
  if (state) await idbSet('save-before-restore', state);
  setState(normalizeSave(s));
  await flush();
}

/** Volta ao estado de antes da última restauração (se houver). */
export async function undoRestore(): Promise<boolean> {
  const prev = await idbGet<SaveData>('save-before-restore');
  if (!prev) return false;
  setState(normalizeSave(prev));
  await flush();
  return true;
}

export function useSave<T>(sel: (s: SaveData) => T): T {
  return useSyncExternalStore(subscribe, () => sel(getState()), () => sel(getState()));
}

export function useMaybeSave(): SaveData | null {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
