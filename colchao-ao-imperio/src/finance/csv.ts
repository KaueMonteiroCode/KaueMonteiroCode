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

/** Interpreta um CSV (do próprio app ou de extrato simples com data;descricao;valor). */
export function interpretCSV(text: string, fin: FinanceState): ImportRow[] {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const idx = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iDate = idx('data', 'date', 'dt');
  const iVal = idx('valor', 'value', 'amount', 'quantia');
  const iDesc = idx('descricao', 'description', 'historico', 'memo', 'lancamento');
  const iKind = idx('tipo', 'kind', 'type');
  const iCat = idx('categoria', 'category');
  const iAcc = idx('conta', 'account');
  if (iDate < 0 || iVal < 0) return [{ line: 1, date: '', kind: 'expense', amount: 0, description: '', error: 'O CSV precisa ter colunas "data" e "valor".' }];
  const out: ImportRow[] = [];
  rows.slice(1).forEach((r, k) => {
    const line = k + 2;
    const date = normDate(r[iDate] ?? '');
    const rawVal = parseBRL((r[iVal] ?? '').trim());
    const kindTxt = iKind >= 0 ? (r[iKind] ?? '').trim().toLowerCase() : '';
    let kind: Transaction['kind'] = PT_KIND[kindTxt] ?? (rawVal != null && rawVal < 0 ? 'expense' : 'income');
    if (kind === 'transfer') kind = 'expense'; // transferências importadas precisam ser revisadas manualmente
    const row: ImportRow = {
      line, date: date ?? '', kind, amount: rawVal == null ? 0 : Math.abs(rawVal),
      description: iDesc >= 0 ? (r[iDesc] ?? '').trim() : '', categoryName: iCat >= 0 ? r[iCat]?.trim() : undefined, accountName: iAcc >= 0 ? r[iAcc]?.trim() : undefined,
    };
    if (!date) row.error = 'Data inválida';
    else if (rawVal == null || rawVal === 0) row.error = 'Valor inválido';
    if (!row.error) {
      row.duplicate = fin.transactions.some((t) => !t.deleted && t.date === row.date && t.amount === row.amount && t.kind === row.kind && (t.description || '') === row.description);
    }
    out.push(row);
  });
  return out;
}
