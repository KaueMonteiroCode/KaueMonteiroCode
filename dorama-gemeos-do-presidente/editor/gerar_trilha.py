#!/usr/bin/env python3
"""Compõe uma trilha original de dorama (piano + cordas) por síntese — sem direitos autorais.

Estrutura (72 bpm, lá menor, ~70 s):
  A  (0–27 s)   piano em arpejo, delicado e curioso      → gêmeos no saguão
  B  (27–53 s)  pulso grave + cordas, tenso              → entrada do CEO / elevador
  C  (53–70 s)  cordas subindo, crescendo dramático      → a pinta / o reencontro

Uso: python3 editor/gerar_trilha.py [saida.mp3]
     (padrão: editor/trilhas/dorama_tensao.mp3)
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

SR = 44100
BPM = 72
BEAT = 60 / BPM
BAR = 4 * BEAT


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def piano(buf: np.ndarray, t0: float, midi: int, vel: float, dur: float = 2.8) -> None:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(midi)
    som = np.zeros(n)
    for k in range(1, 9):
        if f * k > 9000:
            break
        decaimento = np.exp(-t * (1.2 + 0.7 * k))
        som += np.sin(2 * np.pi * f * k * t * (1 + 0.0004 * k * k)) * decaimento / k ** 1.4
    ataque = np.minimum(t / 0.004, 1)
    som *= ataque * vel
    i = int(t0 * SR)
    fim = min(i + n, len(buf))
    buf[i:fim] += som[: fim - i]


def pad(buf: np.ndarray, t0: float, dur: float, notas: list[int], vol: float,
        tremolo: float = 0.0) -> None:
    n = int(dur * SR)
    t = np.arange(n) / SR
    som = np.zeros(n)
    for m in notas:
        for desafina in (-0.0035, 0.0, 0.0035):
            f = hz(m) * (1 + desafina)
            for k in range(1, 7):
                som += np.sin(2 * np.pi * f * k * t + k) / (k ** 1.6)
    env = np.minimum(t / 0.9, 1) * np.minimum((dur - t) / 0.9, 1)
    env = np.clip(env, 0, 1)
    if tremolo:
        env = env * (1 - tremolo + tremolo * np.sin(2 * np.pi * 5.5 * t) ** 2)
    som *= env * vol / (len(notas) * 3)
    i = int(t0 * SR)
    fim = min(i + n, len(buf))
    buf[i:fim] += som[: fim - i]


def baixo(buf: np.ndarray, t0: float, midi: int, vol: float, dur: float = 0.7) -> None:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(midi)
    som = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 4.5)
    som *= np.minimum(t / 0.01, 1) * vol
    i = int(t0 * SR)
    fim = min(i + n, len(buf))
    buf[i:fim] += som[: fim - i]


# acordes: (baixo, [tríade])
AM = (45, [57, 60, 64])
F = (41, [53, 57, 60])
C = (48, [55, 60, 64])
G = (43, [55, 59, 62])
EM = (40, [52, 55, 59])
DM = (38, [50, 53, 57])
E = (40, [52, 56, 59])


def compor() -> np.ndarray:
    secoes_a = [AM, F, C, G, AM, F, C, G]
    secoes_b = [F, G, EM, AM, F, G, EM, E]
    secoes_c = [AM, F, DM, E, AM]
    total_bars = len(secoes_a) + len(secoes_b) + len(secoes_c)
    buf = np.zeros(int((total_bars * BAR + 4) * SR))
    t = 0.0

    # A — arpejo delicado
    for i, (b, tri) in enumerate(secoes_a):
        pad(buf, t, BAR + 0.9, [b + 12] + tri, 0.10)
        arp = [tri[0], tri[1], tri[2], tri[0] + 12, tri[2], tri[1], tri[0] + 12, tri[2]]
        for j, m in enumerate(arp):
            vel = 0.20 if j % 2 == 0 else 0.14
            if i == 0 and j < 4:
                vel *= 0.6 + 0.1 * j          # entrada suave
            piano(buf, t + j * BEAT / 2, m + 12, vel)
        t += BAR

    # B — tensão: pulso grave, cordas com tremolo, piano esparso agudo
    for i, (b, tri) in enumerate(secoes_b):
        pad(buf, t, BAR + 0.9, [b + 12] + tri, 0.17, tremolo=0.25)
        for j in range(4):
            baixo(buf, t + j * BEAT, b, 0.30 if j == 0 else 0.20)
        piano(buf, t, tri[2] + 24, 0.13, 3.5)
        piano(buf, t + 2 * BEAT, tri[1] + 24, 0.09, 3.0)
        t += BAR

    # C — crescendo: cordas mais cheias e subindo, baixo em colcheias
    for i, (b, tri) in enumerate(secoes_c):
        ultimo = i == len(secoes_c) - 1
        vol = 0.20 + 0.05 * i
        notas = [b + 12] + tri + [tri[0] + 12, tri[2] + 12]
        pad(buf, t, (BAR * 1.6 if ultimo else BAR) + 0.9, notas, vol, tremolo=0 if ultimo else 0.3)
        if not ultimo:
            for j in range(8):
                baixo(buf, t + j * BEAT / 2, b, 0.18 + 0.02 * j, 0.45)
            for j, m in enumerate([tri[0], tri[1], tri[2], tri[0] + 12]):
                piano(buf, t + j * BEAT, m + 24, 0.12 + 0.02 * i)
        else:
            baixo(buf, t, b - 12, 0.45, 3.0)
            for m in tri:
                piano(buf, t, m + 12, 0.22, 4.5)
        t += BAR

    buf /= np.max(np.abs(buf)) + 1e-9
    return buf * 0.8


def main() -> None:
    saida = Path(sys.argv[1]) if len(sys.argv) > 1 else \
        Path(__file__).resolve().parent / "trilhas" / "dorama_tensao.mp3"
    saida.parent.mkdir(parents=True, exist_ok=True)
    mono = compor()
    # estéreo levemente aberto (atraso curto num canal)
    d = int(0.012 * SR)
    est = np.stack([mono, np.concatenate([np.zeros(d), mono[:-d]])], axis=1)
    pcm = (est * 32767).astype("<i2")
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / "t.raw"
        pcm.tofile(raw)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", str(raw),
             "-af", "aecho=0.8:0.6:47|89|151|263:0.30|0.22|0.16|0.10,"
                    "highpass=f=35,lowpass=f=11000,loudnorm=I=-18:TP=-2",
             "-c:a", "libmp3lame", "-q:a", "2", str(saida)],
            check=True)
    print(f"Trilha gerada: {saida}")


if __name__ == "__main__":
    main()
