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
import itertools
import math
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


def peso_esperado(texto: str) -> float:
    """Duração relativa esperada de uma fala (sílabas + pausas de pontuação)."""
    silabas = len(re.findall(r"[aeiouáéíóúâêôãõà]+", texto.lower()))
    reticencias = texto.count("...")
    pontuacao = len(re.findall(r"[,.!?;:]", texto.replace("...", "")))
    return silabas + 2.0 * reticencias + 1.2 * pontuacao


def escolher_cortes(internos, inicio_voz, fim_voz, textos):
    """Testa todas as combinações de pausas e fica com a que melhor bate com o
    tamanho esperado de cada fala (e, no empate, com as pausas mais longas)."""
    precisa = len(textos) - 1
    esperado = [peso_esperado(t) for t in textos]
    soma_esp = sum(esperado)
    melhor = None
    for comb in itertools.combinations(internos, precisa):
        lim = [inicio_voz] + [v for c in comb for v in c] + [fim_voz]
        durs = [lim[2 * i + 1] - lim[2 * i] for i in range(len(textos))]
        if min(durs) <= 0:
            continue
        soma = sum(durs)
        erro = sum(math.log((d / soma) / (e / soma_esp)) ** 2 for d, e in zip(durs, esperado))
        nota = erro - 0.3 * sum(b - a for a, b in comb)
        if melhor is None or nota < melhor[0]:
            melhor = (nota, list(comb))
    return melhor[1] if melhor else None


def cortar(arq: Path, nomes: list[str], textos: list[str] | None = None,
           cortes_manuais: list[float] | None = None) -> None:
    total = duracao(arq)
    sil = silencios(arq)
    # silêncios internos (não encostados nas pontas do arquivo)
    internos = [(a, b) for a, b in sil if a > 0.05 and b < total - 0.05]
    precisa = len(nomes) - 1
    if len(internos) < precisa:
        sys.exit(f"{arq.name}: achei só {len(internos)} pausas, preciso de {precisa}. "
                 "Gere de novo deixando uma pausa clara entre as falas.")
    inicio_voz0 = sil[0][1] if sil and sil[0][0] <= 0.05 else 0.0
    fim_voz0 = sil[-1][0] if sil and sil[-1][1] >= total - 0.05 else total
    if cortes_manuais:
        # usa a pausa mais próxima de cada tempo informado
        maiores = sorted(min(internos, key=lambda s: abs((s[0] + s[1]) / 2 - t)) for t in cortes_manuais)
    elif textos:
        maiores = escolher_cortes(internos, inicio_voz0, fim_voz0, textos)
    else:
        maiores = sorted(sorted(internos, key=lambda s: s[1] - s[0], reverse=True)[:precisa])

    inicio_voz = sil[0][1] if sil and sil[0][0] <= 0.05 else 0.0
    fim_voz = sil[-1][0] if sil and sil[-1][1] >= total - 0.05 else total
    limites = [inicio_voz]
    for a, b in maiores:
        limites += [a, b]
    limites.append(fim_voz)

    print(f"  cortes em: {', '.join(f'{(a + b) / 2:.2f}s' for a, b in maiores)}")
    for i, nome in enumerate(nomes):
        a = max(limites[2 * i] - FOLGA, 0)
        b = min(limites[2 * i + 1] + FOLGA, total)
        saida = arq.parent / f"{nome}.mp3"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(arq), "-ss", f"{a:.3f}",
                        "-to", f"{b:.3f}", "-af", "afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse",
                        "-c:a", "libmp3lame", "-q:a", "2", str(saida)], check=True)
        texto = f"  \"{textos[i]}\"" if textos else ""
        print(f"  ok  {saida.name:24s} {a:5.2f}–{b:5.2f}s ({b - a:4.2f}s){texto}")


def textos_do_roteiro(parte: int) -> dict[str, str]:
    """nome do áudio (sem .mp3) -> texto, lido de partes/parteN.json."""
    import json
    arq = RAIZ / "partes" / f"parte{parte}.json"
    if not arq.exists():
        return {}
    roteiro = json.loads(arq.read_text(encoding="utf-8"))
    return {Path(f["audio"]).stem: f["texto"]
            for p in roteiro["planos"] for f in p.get("falas", [])}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("audio", nargs="?", help="áudio completo de um personagem")
    ap.add_argument("nomes", nargs="*", help="nomes das falas, na ordem")
    ap.add_argument("--parte", type=int, help="corta todos os pN_<personagem>_completo.mp3")
    ap.add_argument("--cortes", action="append", default=[],
                    help="cortes manuais: personagem=1.5,4.0 (segundos; pode repetir)")
    args = ap.parse_args()
    manuais = {}
    for c in args.cortes:
        pers, tempos = c.split("=")
        manuais[pers] = [float(t) for t in tempos.split(",")]

    if args.parte:
        pasta = RAIZ / "midia" / f"parte{args.parte}"
        textos = textos_do_roteiro(args.parte)
        for pers, nomes in ORDEM[args.parte].items():
            arq = pasta / f"p{args.parte}_{pers}_completo.mp3"
            if arq.exists():
                print(f"-- {arq.name}")
                cortar(arq, nomes, [textos.get(n, "") for n in nomes] if textos else None,
                       manuais.get(pers))
            else:
                print(f"-- {arq.name}: não encontrado (pulando)")
    elif args.audio and args.nomes:
        cortar(Path(args.audio), args.nomes)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
