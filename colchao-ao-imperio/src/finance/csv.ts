import { isValidISODate } from '../core/dates';
import { parseBRL, type Cents } from '../core/money';
import type { FinanceState, Transaction } from '../state/types';

const KIND_PT: Record<Transaction['kind'], string> = { income: 'receita', expense: 'despesa', transfer: 'transferencia', adjustment: 'ajuste' };
const PT_KIND: Record<string, Transaction['kind']> = { receita: 'income', despesa: 'expense', transferencia: 'transfer', 'transferência': 'transfer', ajuste: 'adjustment', income: 'income', expense: 'expense', transfer: 'transfer', adjustment: 'adjustment' };

function esc(v: string) {
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function money(c: Cents) {
  const neg = c < 0; const a = Math.abs(c);
  return `${neg ? '-' : ''}${Math.floor(a / 100)},${String(a % 100).padStart(2, '0')}`;
}

export function exportCSV(fin: FinanceState, includeDeleted = false): string {
  const acc = new Map(fin.accounts.map((a) => [a.id, a.name]));
  const cat = new Map(fin.categories.map((c) => [c.id, c.name]));
  const head = ['data', 'tipo', 'valor', 'conta', 'conta_destino', 'categoria', 'descricao', 'status', 'economia_declarada', 'parcelas', 'id'];
  const rows = fin.transactions
    .filter((t) => includeDeleted || !t.deleted)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((t) => [t.date, KIND_PT[t.kind], money(t.amount), acc.get(t.accountId) ?? '', t.toAccountId ? acc.get(t.toAccountId) ?? '' : '', t.categoryId ? cat.get(t.categoryId) ?? '' : '', t.description, t.deleted ? 'excluido' : t.status === 'pending' ? 'pendente' : 'confirmado', t.saving ? 'sim' : '', t.installments ? String(t.installments.count) : '', t.id].map((v) => esc(String(v))).join(';'));
  return '﻿' + [head.join(';'), ...rows].join('\r\n');
}

export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let cur: string[] = [], field = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { cur.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      cur.push(field); field = '';
      if (cur.some((c) => c.trim() !== '')) rows.push(cur);
      cur = [];
    } else field += ch;
  }
  cur.push(field);
  if (cur.some((c) => c.trim() !== '')) rows.push(cur);
  return rows;
}

export interface ImportRow {
  line: number;
  date: string;
  kind: Transaction['kind'];
  amount: Cents;
  description: string;
  categoryName?: string;
  accountName?: string;
  error?: string;
  duplicate?: boolean;
  /** identificador do banco (FITID / Identificador) para não importar duas vezes */
  extId?: string;
}

function normDate(s: string): string | null {
  const t = s.trim();
  if (isValidISODate(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return isValidISODate(iso) ? iso : null;
  }
  return null;
}

const norm = (h: string) => h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const isDup = (fin: FinanceState, r: ImportRow) => fin.transactions.some((t) => !t.deleted && (
  (r.extId && t.tags?.includes(`ext:${r.extId}`)) ||
  (t.date === r.date && t.amount === r.amount && t.kind === r.kind && (t.description || '') === r.description)));

/**
 * Interpreta um CSV: o formato do próprio app, extratos simples (data;descricao;valor) e
 * os formatos exportados por Nubank (conta e cartão), Inter e Itaú.
 */
export function interpretCSV(text: string, fin: FinanceState): ImportRow[] {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const head = rows[0].map(norm);
  const idx = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iDate = idx('data', 'date', 'dt', 'data lancamento', 'data da transacao', 'data movimento');
  const iVal = idx('valor', 'value', 'amount', 'quantia', 'valor rs', 'valor r');
  const iDesc = idx('descricao', 'description', 'historico', 'memo', 'lancamento', 'title', 'estabelecimento');
  const iKind = idx('tipo', 'kind', 'type');
  const iCat = idx('categoria', 'category');
  const iAcc = idx('conta', 'account');
  const iId = idx('identificador', 'id', 'fitid');
  // fatura de cartão do Nubank (date,title,amount): valor positivo é gasto
  const cardFormat = head.includes('title') && head.includes('amount') && iKind < 0;
  if (iDate < 0 || iVal < 0) return [{ line: 1, date: '', kind: 'expense', amount: 0, description: '', error: 'O CSV precisa ter colunas de data e valor.' }];
  const out: ImportRow[] = [];
  rows.slice(1).forEach((r, k) => {
    const line = k + 2;
    const date = normDate(r[iDate] ?? '');
    let rawVal = parseBRL((r[iVal] ?? '').trim());
    if (rawVal != null && cardFormat) rawVal = -rawVal;
    const kindTxt = iKind >= 0 ? (r[iKind] ?? '').trim().toLowerCase() : '';
    let kind: Transaction['kind'] = PT_KIND[kindTxt] ?? (rawVal != null && rawVal < 0 ? 'expense' : 'income');
    if (kind === 'transfer') kind = 'expense'; // transferências importadas precisam ser revisadas manualmente
    const row: ImportRow = {
      line, date: date ?? '', kind, amount: rawVal == null ? 0 : Math.abs(rawVal),
      description: iDesc >= 0 ? (r[iDesc] ?? '').trim() : '', categoryName: iCat >= 0 ? r[iCat]?.trim() : undefined, accountName: iAcc >= 0 ? r[iAcc]?.trim() : undefined,
      extId: iId >= 0 && r[iId]?.trim() ? r[iId].trim() : undefined,
    };
    if (!date) row.error = 'Data inválida';
    else if (rawVal == null || rawVal === 0) row.error = 'Valor inválido';
    if (!row.error) row.duplicate = isDup(fin, row);
    out.push(row);
  });
  return out;
}

/** Interpreta um extrato OFX (formato que praticamente todo banco brasileiro exporta). */
export function interpretOFX(text: string, fin: FinanceState): ImportRow[] {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (b: string, name: string) => b.match(new RegExp(`<${name}>([^<\r\n]*)`, 'i'))?.[1]?.trim() ?? '';
  return blocks.map((b, k) => {
    const dt = tag(b, 'DTPOSTED');
    const date = dt.length >= 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : '';
    const val = parseBRL(tag(b, 'TRNAMT'));
    const desc = (tag(b, 'MEMO') || tag(b, 'NAME')).replace(/\s+/g, ' ');
    const row: ImportRow = { line: k + 1, date, kind: val != null && val < 0 ? 'expense' : 'income', amount: val == null ? 0 : Math.abs(val), description: desc, extId: tag(b, 'FITID') || undefined };
    if (!isValidISODate(date)) row.error = 'Data inválida';
    else if (val == null || val === 0) row.error = 'Valor inválido';
    if (!row.error) row.duplicate = isDup(fin, row);
    return row;
  });
}

export function interpretStatement(text: string, fin: FinanceState): ImportRow[] {
  return /<OFX>|OFXHEADER/i.test(text) ? interpretOFX(text, fin) : interpretCSV(text, fin);
}
