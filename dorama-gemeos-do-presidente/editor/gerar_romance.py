#!/usr/bin/env python3
"""Compõe um tema romântico curto (caixinha de música + cordas quentes) por síntese — sem direitos autorais.

Para momentos de romance (toque das mãos, olhares). Ré maior, I–V–vi–IV, ~12 s, entra suave e sai em fade.
Uso: python3 editor/gerar_romance.py [saida.mp3]   (padrão: editor/trilhas/romance.mp3)
Entra no roteiro como efeito: "sfx": [{"som": "romance", "em": 0.0, "volume": 0.5}]
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gerar_trilha import SR, pad, piano, baixo  # noqa: E402

BEAT = 60 / 66
BAR = 4 * BEAT

D = (38, [62, 66, 69])
A = (33, [61, 64, 69])
BM = (35, [62, 66, 71])
G = (31, [62, 67, 71])
# melodia da caixinha (uma nota por tempo; None = pausa)
MELODIA = [[78, 76, 74, 76], [73, None, 76, 78], [78, 81, 79, 78], [76, None, None, None]]


def compor() -> np.ndarray:
    acordes = [D, A, BM, G]
    buf = np.zeros(int((len(acordes) * BAR + 4) * SR))
    t = 0.0
    for i, (b, tri) in enumerate(acordes):
        pad(buf, t, BAR + 1.2, [b + 12] + tri, 0.16)
        baixo(buf, t, b + 12, 0.16, 2.5)
        for j, m in enumerate(MELODIA[i]):
            if m is not None:
                piano(buf, t + j * BEAT, m + 12, 0.10, 3.2)     # brilho de caixinha (oitava acima)
                piano(buf, t + j * BEAT, m, 0.16, 3.2)
        t += BAR
    piano(buf, t, 74, 0.14, 4.0)
    piano(buf, t, 81, 0.10, 4.0)
    n = len(buf)
    tt = np.arange(n) / SR
    buf *= np.minimum(tt / 0.8, 1) * np.clip((n / SR - tt) / 3.5, 0, 1)
    buf /= np.max(np.abs(buf)) + 1e-9
    return buf * 0.8


def main() -> None:
    saida = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "trilhas" / "romance.mp3"
    saida.parent.mkdir(parents=True, exist_ok=True)
    mono = compor()
    d = int(0.014 * SR)
    est = np.stack([mono, np.concatenate([np.zeros(d), mono[:-d]])], axis=1)
    pcm = (est * 32767).astype("<i2")
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / "t.raw"
        pcm.tofile(raw)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", str(raw),
             "-af", "aecho=0.8:0.7:61|113|197|311:0.32|0.24|0.18|0.12,"
                    "highpass=f=40,lowpass=f=12000,loudnorm=I=-18:TP=-2",
             "-c:a", "libmp3lame", "-q:a", "2", str(saida)],
            check=True)
    print(f"Tema romântico gerado: {saida}")


if __name__ == "__main__":
    main()
