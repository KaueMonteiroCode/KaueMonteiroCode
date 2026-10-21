/** Datas de lançamentos são strings "AAAA-MM-DD" no fuso local, para evitar erros de fuso. */
export type ISODate = string;

export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now);
}
export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
/** Soma meses mantendo o dia (limitado ao último dia do mês). */
export function addMonths(s: ISODate, n: number, preferredDay?: number): ISODate {
  const [y, m, d] = s.split('-').map(Number);
  const day = preferredDay ?? d;
  const target = new Date(y, m - 1 + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toISO(target);
}
export function monthKey(s: ISODate): string {
  return s.slice(0, 7);
}
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${names[m - 1]}/${String(y).slice(2)}`;
}
export function monthName(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${names[m - 1]} de ${y}`;
}
export function addMonthKey(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
export function formatDateBR(s: ISODate): string {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
}
/** Segunda-feira da semana de uma data (chave de semana). */
export function weekKey(s: ISODate): ISODate {
  const d = fromISO(s);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return toISO(d);
}
export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = fromISO(s);
  return toISO(d) === s;
}
