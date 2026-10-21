/**
 * Dinheiro real é sempre guardado em CENTAVOS inteiros (number seguro até ~90 trilhões de reais).
 * Nunca use float para somar valores monetários.
 */
export type Cents = number;

export function assertCents(v: number): Cents {
  if (!Number.isSafeInteger(v)) throw new Error(`Valor monetário inválido: ${v}`);
  return v;
}

/**
 * Converte texto digitado em centavos. Aceita "25", "25,5", "25,50", "1.234,56", "1234.56", "R$ 10".
 * Retorna null se o texto não for um valor válido.
 */
export function parseBRL(input: string): Cents | null {
  let s = String(input ?? '').trim().replace(/\s|R\$/gi, '');
  if (!s) return null;
  let negative = false;
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  if (!/^[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let intPart: string;
  let fracPart = '';
  if (lastComma >= 0 && lastComma > lastDot) {
    intPart = s.slice(0, lastComma).replace(/\./g, '');
    fracPart = s.slice(lastComma + 1);
  } else if (lastDot >= 0 && lastComma < 0) {
    // "1234.56" (decimal) ou "1.234" (milhar). Se houver exatamente 3 dígitos após um único ponto e mais pontos, é milhar.
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length !== 3) {
      intPart = parts[0];
      fracPart = parts[1];
    } else if (parts.length === 2 && parts[1].length === 3) {
      intPart = parts.join('');
    } else {
      if (parts.slice(1).every((p) => p.length === 3)) intPart = parts.join('');
      else return null;
    }
  } else if (lastDot > lastComma && lastComma >= 0) {
    // "1,234.56" formato americano
    intPart = s.slice(0, lastDot).replace(/,/g, '');
    fracPart = s.slice(lastDot + 1);
  } else {
    intPart = s;
  }
  if (intPart === '') intPart = '0';
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;
  if (fracPart.length > 2) return null;
  const cents = Number(intPart) * 100 + Number((fracPart + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export function formatBRL(cents: Cents, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const reais = Math.floor(abs / 100);
  const c = abs % 100;
  let body: string;
  if (opts.compact && reais >= 1_000_000) body = (reais / 1_000_000).toFixed(1).replace('.', ',') + ' mi';
  else if (opts.compact && reais >= 10_000) body = Math.round(reais / 1000) + ' mil';
  else body = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + String(c).padStart(2, '0');
  const sign = neg ? '-' : opts.sign && cents > 0 ? '+' : '';
  return `${sign}R$ ${body}`;
}

/** Entrada para campo de texto: 2550 -> "25,50" */
export function centsToInput(cents: Cents): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  return (neg ? '-' : '') + Math.floor(abs / 100) + ',' + String(abs % 100).padStart(2, '0');
}

/** Divide um valor em N parcelas inteiras; a diferença de centavos vai para as primeiras parcelas. */
export function splitInstallments(total: Cents, n: number): Cents[] {
  if (n < 1 || !Number.isInteger(n)) throw new Error('Número de parcelas inválido');
  const base = Math.trunc(total / n);
  let rest = total - base * n;
  const out: Cents[] = [];
  for (let i = 0; i < n; i++) {
    const extra = rest > 0 ? 1 : rest < 0 ? -1 : 0;
    rest -= extra;
    out.push(base + extra);
  }
  return out;
}

export function formatCoins(n: number): string {
  return Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
