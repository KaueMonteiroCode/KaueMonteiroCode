/**
 * Salvar arquivo: na página publicada usa o recurso de download do visualizador
 * (o visitante confirma); fora dela, download comum do navegador.
 * Retorna 'saved', 'declined' ou 'failed'.
 */
type DownloadsNs = { save: (r: { filename: string; data: string | Blob }) => Promise<unknown> };
type ClaudeWin = { claude?: { use?: (n: string) => Promise<unknown> } };

let nsPromise: Promise<DownloadsNs | null> | null = null;
function downloadsNs(): Promise<DownloadsNs | null> {
  const c = (window as unknown as ClaudeWin).claude;
  if (!c?.use) return Promise.resolve(null);
  return (nsPromise ??= c.use('downloads').then((n) => (n as DownloadsNs) ?? null).catch(() => null));
}

export async function saveFile(filename: string, data: string | Blob, mime: string): Promise<'saved' | 'declined' | 'failed'> {
  const ns = await downloadsNs();
  if (ns) {
    try { await ns.save({ filename, data }); return 'saved'; }
    catch (e) { return (e as { code?: string })?.code === 'declined' ? 'declined' : 'failed'; }
  }
  try {
    const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'saved';
  } catch { return 'failed'; }
}
