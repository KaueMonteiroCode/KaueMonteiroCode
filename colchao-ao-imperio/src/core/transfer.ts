/**
 * Transferência entre aparelhos sem servidor: o save é comprimido e cifrado no próprio
 * aparelho (PBKDF2 + AES-GCM) e vira um texto que o usuário leva por onde quiser
 * (mensagem para si mesmo, e-mail, arquivo). Só quem sabe a senha consegue abrir.
 */
const PREFIX = 'CIMP1:';
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(data: Uint8Array, stream: unknown): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream as ReadableWritablePair<Uint8Array, Uint8Array>));
  return new Uint8Array(await out.arrayBuffer());
}
async function gzip(data: Uint8Array) { return typeof CompressionStream === 'undefined' ? data : pipe(data, new CompressionStream('gzip')); }
async function gunzip(data: Uint8Array) { return typeof DecompressionStream === 'undefined' ? data : pipe(data, new DecompressionStream('gzip')); }

async function key(pass: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encodeTransfer(data: unknown, pass: string): Promise<string> {
  if (pass.length < 6) throw new Error('Use uma senha com pelo menos 6 caracteres.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const compressed = typeof CompressionStream === 'undefined' ? 0 : 1;
  const plain = await gzip(enc.encode(JSON.stringify(data)));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await key(pass, salt), plain as BufferSource));
  const out = new Uint8Array(1 + 16 + 12 + cipher.length);
  out[0] = compressed; out.set(salt, 1); out.set(iv, 17); out.set(cipher, 29);
  return PREFIX + b64(out);
}

export async function decodeTransfer(text: string, pass: string): Promise<unknown> {
  const t = text.trim().replace(/\s+/g, '');
  if (!t.startsWith(PREFIX)) throw new Error('Este texto não é um código de transferência do jogo.');
  let raw: Uint8Array;
  try { raw = unb64(t.slice(PREFIX.length)); } catch { throw new Error('Código incompleto: copie o texto inteiro.'); }
  if (raw.length < 30) throw new Error('Código incompleto: copie o texto inteiro.');
  let plain: Uint8Array;
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(17, 29) as BufferSource }, await key(pass, raw.slice(1, 17)), raw.slice(29) as BufferSource));
  } catch { throw new Error('Senha errada ou código incompleto.'); }
  const json = raw[0] === 1 ? await gunzip(plain) : plain;
  return JSON.parse(dec.decode(json));
}
