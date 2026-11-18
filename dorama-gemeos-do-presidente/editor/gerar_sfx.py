#!/usr/bin/env python3
"""Gera o pack básico de efeitos sonoros do editor, sintetizado com FFmpeg.

Não depende de download. Cada efeito vira um .wav em editor/sfx/.
Para usar um efeito de um pack baixado, é só colocar o arquivo em editor/sfx/
com o mesmo nome (ex.: whoosh.wav) que ele substitui o sintetizado.

Uso: python3 editor/gerar_sfx.py
"""
import subprocess
from pathlib import Path

PASTA = Path(__file__).resolve().parent / "sfx"
SR = 48000

# nome -> (duração em s, expressão aevalsrc ou filtro lavfi completo)
EFEITOS = {
    # "tum-tum" de coração: duas batidas graves, repetidas duas vezes
    "coracao": (
        2.2,
        "aevalsrc='"
        "0.9*sin(2*PI*52*t)*(exp(-22*t)*gte(t,0)"
        "+0.7*exp(-22*(t-0.26))*gte(t,0.26)"
        "+exp(-22*(t-1.1))*gte(t,1.1)"
        "+0.7*exp(-22*(t-1.36))*gte(t,1.36))'"
        ":s={sr}:d={d}",
    ),
    # impacto grave de revelação
    "impacto": (
        2.0,
        "aevalsrc='0.95*sin(2*PI*(40+60*exp(-8*t))*t)*exp(-2.5*t)'"
        ":s={sr}:d={d}",
    ),
    # "plim" de elevador (duas notas)
    "elevador": (
        1.8,
        "aevalsrc='"
        "0.35*sin(2*PI*1318.5*t)*exp(-3*t)"
        "+0.35*sin(2*PI*1046.5*(t-0.35))*exp(-3*(t-0.35))*gte(t,0.35)'"
        ":s={sr}:d={d}",
    ),
    # acorde dramático de suspense (sobe e some)
    "suspense": (
        3.5,
        "aevalsrc='"
        "(0.18*sin(2*PI*110*t)+0.15*sin(2*PI*130.8*t)+0.12*sin(2*PI*164.8*t)"
        "+0.10*sin(2*PI*233.1*t)+0.06*sin(2*PI*440*t))"
        "*(1+0.25*sin(2*PI*6*t))*min(t/0.25,1)*exp(-0.9*t)'"
        ":s={sr}:d={d}",
    ),
}

# whoosh e brilho usam ruído filtrado (não dá com aevalsrc puro)
FILTROS_RUIDO = {
    "whoosh": (
        1.0,
        "anoisesrc=d={d}:c=pink:r={sr}:a=0.9,"
        "bandpass=f=900:width_type=o:w=2,"
        "afade=t=in:st=0:d=0.45:curve=exp,afade=t=out:st=0.45:d=0.55:curve=exp,"
        "volume=2.2",
    ),
    "brilho": (
        1.2,
        "anoisesrc=d={d}:c=white:r={sr}:a=0.5,highpass=f=6000,"
        "afade=t=in:st=0:d=0.05,afade=t=out:st=0.05:d=1.1:curve=exp,volume=0.8",
    ),
}


def gerar(nome: str, dur: float, fonte: str) -> None:
    saida = PASTA / f"{nome}.wav"
    if saida.exists():
        return  # respeita arquivo já existente (ex.: efeito de pack baixado)
    fonte = fonte.format(sr=SR, d=dur)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", fonte,
         "-af", "alimiter=limit=0.9", "-ac", "2", str(saida)],
        check=True,
    )
    print(f"  ok  {saida.name}")


def main() -> None:
    PASTA.mkdir(parents=True, exist_ok=True)
    print("Gerando efeitos sonoros em", PASTA)
    for nome, (dur, expr) in {**EFEITOS, **FILTROS_RUIDO}.items():
        gerar(nome, dur, expr)


if __name__ == "__main__":
    main()
