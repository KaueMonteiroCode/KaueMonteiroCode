#!/usr/bin/env python3
"""Corta um áudio com várias falas seguidas (um por personagem) em arquivos separados.

Você gera no Fish Audio UM áudio por personagem com todas as falas dele, na ordem,
separadas por linha em branco. Este script acha as pausas mais longas entre as falas
e salva cada fala com o nome que o editor espera.

Como sabe quantas falas existem, ele usa as N-1 pausas MAIS LONGAS — então as
reticências dentro de uma fala ("Ha-eun... esse homem") não viram corte.

Uso:
  python3 editor/cortar_falas.py midia/parte1/p1_hajun_completo.mp3 \
      p1_f01_hajun p1_f04b_hajun p1_f05_hajun p1_f10_hajun
  python3 editor/cortar_falas.py --parte 1          (corta todos os *_completo.mp3 da parte)
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# ordem das falas dentro de cada áudio completo, por parte
ORDEM = {
    1: {
        "hajun": ["p1_f01_hajun", "p1_f04b_hajun", "p1_f05_hajun", "p1_f10_hajun"],
        "haeun": ["p1_f02_haeun", "p1_f04a_haeun", "p1_f06_haeun", "p1_f09_haeun"],
        "seoyeon": ["p1_f03_seoyeon", "p1_f13_seoyeon"],
        "dohyun": ["p1_f07_dohyun", "p1_f08_dohyun", "p1_f11_dohyun", "p1_f12_dohyun", "p1_f14_dohyun"],
    },
}

FOLGA = 0.12   # segundos de respiro mantidos antes/depois de cada fala


def duracao(arq: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(arq)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def silencios(arq: Path) -> list[tuple[float, float]]:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(arq), "-af",
                        "silencedetect=n=-40dB:d=0.18", "-f", "null", "-"],
                       capture_output=True, text=True)
    ini = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    fim = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    total = duracao(arq)
    if len(fim) < len(ini):
        fim.append(total)
    return list(zip(ini, fim))


def cortar(arq: Path, nomes: list[str]) -> None:
    total = duracao(arq)
    sil = silencios(arq)
    # silêncios internos (não encostados nas pontas do arquivo)
    internos = [(a, b) for a, b in sil if a > 0.05 and b < total - 0.05]
    precisa = len(nomes) - 1
    if len(internos) < precisa:
        sys.exit(f"{arq.name}: achei só {len(internos)} pausas, preciso de {precisa}. "
                 "Gere de novo deixando uma pausa clara entre as falas.")
    maiores = sorted(sorted(internos, key=lambda s: s[1] - s[0], reverse=True)[:precisa])
    menor_corte = min(b - a for a, b in maiores)
    proxima = sorted((b - a for a, b in internos), reverse=True)[precisa:precisa + 1]
    if proxima and proxima[0] > menor_corte * 0.8:
        print(f"  aviso: em {arq.name} uma pausa dentro de fala é quase do tamanho da pausa "
              "entre falas — confira se os cortes ficaram certos.")

    inicio_voz = sil[0][1] if sil and sil[0][0] <= 0.05 else 0.0
    fim_voz = sil[-1][0] if sil and sil[-1][1] >= total - 0.05 else total
    limites = [inicio_voz]
    for a, b in maiores:
        limites += [a, b]
    limites.append(fim_voz)

    for i, nome in enumerate(nomes):
        a = max(limites[2 * i] - FOLGA, 0)
        b = min(limites[2 * i + 1] + FOLGA, total)
        saida = arq.parent / f"{nome}.mp3"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(arq), "-ss", f"{a:.3f}",
                        "-to", f"{b:.3f}", "-af", "afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse",
                        "-c:a", "libmp3lame", "-q:a", "2", str(saida)], check=True)
        print(f"  ok  {saida.name:24s} {b - a:5.2f}s")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("audio", nargs="?", help="áudio completo de um personagem")
    ap.add_argument("nomes", nargs="*", help="nomes das falas, na ordem")
    ap.add_argument("--parte", type=int, help="corta todos os pN_<personagem>_completo.mp3")
    args = ap.parse_args()

    if args.parte:
        pasta = RAIZ / "midia" / f"parte{args.parte}"
        for pers, nomes in ORDEM[args.parte].items():
            arq = pasta / f"p{args.parte}_{pers}_completo.mp3"
            if arq.exists():
                print(f"-- {arq.name}")
                cortar(arq, nomes)
            else:
                print(f"-- {arq.name}: não encontrado (pulando)")
    elif args.audio and args.nomes:
        cortar(Path(args.audio), args.nomes)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
