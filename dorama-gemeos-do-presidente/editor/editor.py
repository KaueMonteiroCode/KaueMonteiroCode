#!/usr/bin/env python3
"""Editor de novelinhas — monta uma parte inteira a partir de um roteiro JSON.

Entrada:
  partes/parteN.json        roteiro de montagem (planos, falas, efeitos, sons)
  midia/parteN/             clipes do gerador (p1_c01.mp4...), áudios do Fish
                            (p1_f01_hajun.mp3...) e, se quiser, trilha.mp3
Saída:
  saida/parteN_final.mp4    1080x1920, 30 fps, legenda palavra por palavra,
                            efeitos sonoros, trilha com ducking, pronto pro TikTok

O que faltar vira MODO TESTE: clipe ausente usa a imagem "teste" (ficha/cenário)
com zoom; áudio ausente vira silêncio com duração estimada. Assim dá pra ver a
montagem antes de ter tudo gerado.

Uso:
  python3 editor/editor.py partes/parte1.json
  python3 editor/editor.py partes/parte1.json --rapido   (prévia mais leve)
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent      # pasta da série
EDITOR = Path(__file__).resolve().parent
FPS = 30
W, H = 1080, 1920

# ---------------------------------------------------------------- utilidades


def rodar(cmd: list[str], cwd: Path | None = None) -> str:
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-3000:])
        raise SystemExit(f"\nFalhou: {' '.join(cmd[:6])} ...")
    return r.stdout + r.stderr


def duracao(arq: Path) -> float:
    out = rodar(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "csv=p=0", str(arq)])
    return float(out.strip().splitlines()[0])


def dimensoes(arq: Path) -> tuple[int, int]:
    out = rodar(["ffprobe", "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream=width,height", "-of", "csv=p=0", str(arq)])
    w, h = out.strip().splitlines()[0].split(",")[:2]
    return int(w), int(h)


def trecho_de_fala(arq: Path) -> tuple[float, float]:
    """Início e fim da voz dentro do áudio (ignora silêncio nas pontas)."""
    total = duracao(arq)
    out = rodar(["ffmpeg", "-hide_banner", "-i", str(arq), "-af",
                 "silencedetect=n=-38dB:d=0.12", "-f", "null", "-"])
    inicios = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    fins = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    ini, fim = 0.0, total
    if inicios and inicios[0] <= 0.02 and fins:
        ini = fins[0]
    if inicios and inicios[-1] > ini and (len(fins) < len(inicios) or fins[-1] >= total - 0.05):
        fim = inicios[-1]
    if fim - ini < 0.2:
        ini, fim = 0.0, total
    return ini, fim


def fala_no_audio_do_clipe(clipe: Path) -> tuple[float, float] | None:
    """Onde o personagem fala dentro do clipe gerado (pelo áudio que o gerador criou).
    Devolve (início, fim) em segundos, ou None se o clipe não tiver áudio útil."""
    tem_audio = rodar(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries",
                       "stream=index", "-of", "csv=p=0", str(clipe)]).strip()
    if not tem_audio:
        return None
    # volume em janelas de 50 ms, só na faixa da voz
    out = rodar(["ffmpeg", "-hide_banner", "-i", str(clipe), "-vn", "-af",
                 "highpass=f=250,lowpass=f=3500,aresample=16000,asetnsamples=800,"
                 "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level",
                 "-f", "null", "-"])
    tempos = [float(x) for x in re.findall(r"pts_time:([\d.]+)", out)]
    niveis = [(-99.0 if v in ("-inf", "nan") else float(v))
              for v in re.findall(r"RMS_level=([-\w.]+)", out)]
    if not niveis or max(niveis) < -45:
        return None                      # clipe mudo
    limite = max(niveis) - 12            # voz = até 12 dB abaixo do pico
    acima = [n >= limite for n in niveis]
    # exige 2 janelas seguidas para não pegar estalo
    idx = [k for k in range(len(acima) - 1) if acima[k] and acima[k + 1]]
    if not idx:
        return None
    on = tempos[idx[0]]
    off = tempos[min(idx[-1] + 2, len(tempos) - 1)]
    if off - on < 0.4:
        return None          # quase nada de voz: não dá para confiar
    return on, off


def estimar_fala(texto: str) -> float:
    return 0.45 + 0.34 * len(texto.split()) + 0.4 * texto.count("...")


# ---------------------------------------------------------------- modelo


@dataclass
class Fala:
    texto: str
    quem: str
    audio: Path | None          # None = ausente (modo teste)
    inicio: float = 0.0         # relativo ao plano
    dur: float = 0.0
    voz_ini: float = 0.0
    voz_fim: float = 0.0
    legenda: bool = True
    tempo: float = 1.0          # atempo aplicado à voz (encaixe na boca do clipe)


@dataclass
class Plano:
    id: str
    dados: dict
    clipe: Path | None
    teste: Path | None
    falas: list[Fala] = field(default_factory=list)
    inicio: float = 0.0         # no vídeo final
    dur: float = 0.0
    audio_clipe: bool = False   # voz = som do próprio clipe (lip sync feito fora)
    corte: float = 0.0


def montar_linha_do_tempo(roteiro: dict, midia: Path) -> tuple[list[Plano], list[str]]:
    avisos: list[str] = []
    planos: list[Plano] = []
    t_global = 0.0
    for p in roteiro["planos"]:
        clipe = midia / p["clipe"] if p.get("clipe") else None
        teste = RAIZ / p["teste"] if p.get("teste") else None
        if clipe and not clipe.exists():
            # sem vídeo: usa o quadro inicial do ChatGPT (pN_cXX_quadro.png), animado com zoom
            quadros = [midia / f"{clipe.stem}_quadro{ext}" for ext in (".png", ".jpg", ".jpeg", ".webp")]
            quadro = next((q for q in quadros if q.exists()), None)
            if quadro:
                p = {**p, "foco_teste": 0.5}
                if not set(p.get("efeitos", [])) & {"zoom_lento", "zoom_rapido"}:
                    p["efeitos"] = [*p.get("efeitos", []), "zoom_lento"]
                teste = quadro
                avisos.append(f"{p['id']}: sem vídeo → usando o quadro {quadro.name} com zoom")
            else:
                avisos.append(f"{p['id']}: clipe {p['clipe']} ausente → usando imagem de teste")
            clipe = None

        # clipe com lip sync: a fala tem que cair exatamente onde a boca mexe.
        # "fala_no_clipe" = segundo em que a fala começa dentro do clipe original;
        # o editor corta o que vier antes (deixando 0,25 s de respiro).
        alinhado = None
        if p.get("alinhar") == "auto" and clipe:
            alinhado = fala_no_audio_do_clipe(clipe)
            if alinhado:
                avisos_alinhar = f"{p['id']}: fala achada no clipe em {alinhado[0]:.2f}–{alinhado[1]:.2f}s"
                avisos.append(avisos_alinhar)
                p = {**p, "lipsync": True, "fala_no_clipe": alinhado[0]}
            else:
                avisos.append(f"{p['id']}: clipe sem áudio de fala — encaixe padrão")
        if p.get("lipsync"):
            t_fala = float(p.get("fala_no_clipe", 0.0))
            p = {**p, "cortar_inicio": max(t_fala - 0.25, 0.0)}
            cursor = t_fala - p["cortar_inicio"]
        else:
            cursor = float(p.get("entrada", 0.35))
        plano = Plano(p["id"], p, clipe, teste)
        ultimo_ini = cursor
        for f in p.get("falas", []):
            arq = midia / f["audio"]
            fala = Fala(f["texto"], f.get("quem", ""), arq if arq.exists() else None)
            if fala.audio:
                fala.dur = duracao(arq)
                fala.voz_ini, fala.voz_fim = trecho_de_fala(arq)
            else:
                avisos.append(f"{p['id']}: áudio {f['audio']} ausente → silêncio estimado")
                fala.dur = estimar_fala(f["texto"])
                fala.voz_ini, fala.voz_fim = 0.0, fala.dur
            if alinhado and not plano.falas and fala.audio:
                voz = fala.voz_fim - fala.voz_ini
                boca = alinhado[1] - alinhado[0]
                if len([x for x in p.get("falas", []) if not x.get("junto")]) == 1 and voz > 0 and boca > 0:
                    t = voz / boca
                    if 0.85 <= t <= 1.15:
                        fala.tempo = t
                fala.dur /= fala.tempo
                fala.voz_ini /= fala.tempo
                fala.voz_fim /= fala.tempo
                # a voz (não o arquivo) começa junto com a boca
                cursor = max(cursor - fala.voz_ini, 0.0)
            if f.get("junto"):
                fala.inicio = ultimo_ini
                fala.legenda = False
            else:
                fala.inicio = cursor + float(f.get("atraso", 0.0))
            ultimo_ini = fala.inicio
            cursor = max(cursor, fala.inicio + fala.dur)
            plano.falas.append(fala)

        fim_falas = cursor + float(p.get("respiro", 0.6)) if plano.falas else 0.0
        plano.dur = round(max(float(p.get("min", 2.5)), fim_falas) * FPS) / FPS

        if p.get("audio_do_clipe") and clipe:
            # o clipe já vem com a voz sincronizada: usa o som dele e só ajusta a legenda
            corte = float(p.get("cortar_inicio", 0.0))
            p = {**p, "cortar_inicio": corte}
            plano.dados = p
            plano.audio_clipe = True
            plano.corte = corte
            dur_clipe = duracao(clipe) - corte
            plano.dur = round(float(p.get("dur", dur_clipe)) * FPS) / FPS
            trecho = fala_no_audio_do_clipe(clipe)
            textos = [f for f in p.get("falas", []) if not f.get("junto")]
            if trecho and textos:
                ini, fim = trecho[0] - corte, min(trecho[1] - corte, plano.dur)
                pesos = [max(len(f["texto"]), 1) for f in textos]
                t, novas = ini, []
                for f, w in zip(textos, pesos):
                    d = (fim - ini) * w / sum(pesos)
                    novas.append(Fala(f["texto"], f.get("quem", ""), None, 0.0, plano.dur, t, t + d))
                    t += d
                plano.falas = novas
            else:
                plano.falas = []
                avisos.append(f"{p['id']}: não achei fala no som do clipe — sem legenda")
        plano.inicio = t_global
        t_global += plano.dur
        planos.append(plano)
    return planos, avisos


# ---------------------------------------------------------------- vídeo


def filtro_visual(plano: Plano, rapido: bool) -> tuple[list[str], str]:
    """Devolve (argumentos de entrada, filtro de vídeo) para o plano."""
    efeitos = plano.dados.get("efeitos", [])
    dur = plano.dur
    n = max(1, round(dur * FPS))
    escala = 1 if rapido else 2          # zoom suave: trabalha em resolução dobrada
    WW, HH = W * escala, H * escala

    if plano.clipe:
        corte = float(plano.dados.get("cortar_inicio", 0.3))
        entrada = ["-ss", f"{corte:.2f}", "-i", str(plano.clipe)]
        vel = float(plano.dados.get("velocidade", 1.0))      # <1 = câmera lenta
        lento = f"setpts=PTS/{vel}," if abs(vel - 1) > 0.001 else ""
        base = (f"{lento}scale={WW}:{HH}:force_original_aspect_ratio=increase,"
                f"crop={WW}:{HH},fps={FPS},setsar=1,"
                f"tpad=stop_mode=clone:stop_duration={dur + 1:.2f}")
    else:
        if not plano.teste or not plano.teste.exists():
            raise SystemExit(f"{plano.id}: sem clipe e sem imagem de teste")
        iw, ih = dimensoes(plano.teste)
        foco = float(plano.dados.get("foco_teste", 0.5))
        if iw / ih > 9 / 16:            # imagem larga: recorta janela vertical
            cw, ch = int(ih * 9 / 16) // 2 * 2, ih // 2 * 2
            cx = int(min(max(foco * iw - cw / 2, 0), iw - cw))
            cy = 0
        else:
            cw, ch = iw // 2 * 2, int(iw * 16 / 9) // 2 * 2
            cx, cy = 0, (ih - ch) // 2
        entrada = ["-loop", "1", "-framerate", str(FPS), "-i", str(plano.teste)]
        base = f"crop={cw}:{ch}:{cx}:{cy},scale={WW}:{HH},fps={FPS},setsar=1"

    cadeia = [base]
    zoom = 0.16 if "zoom_rapido" in efeitos else 0.07 if "zoom_lento" in efeitos else 0.0
    if not plano.clipe and zoom == 0.0:
        zoom = 0.05                       # imagem parada sempre ganha um respiro
    if zoom:
        cadeia.append(
            f"zoompan=z='1+{zoom}*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":d=1:s={W}x{H}:fps={FPS}")
    else:
        cadeia.append(f"scale={W}:{H}")
    if "tremor" in efeitos:
        cadeia.append(
            "crop=iw-48:ih-48:x='24+16*sin(t*57)*lt(t,0.8)':y='24+16*cos(t*43)*lt(t,0.8)',"
            f"scale={W}:{H}")
    if "flash" in efeitos:
        cadeia.append("fade=t=in:st=0:d=0.35:color=white")
    cadeia.append(f"trim=end_frame={n},setpts=PTS-STARTPTS,format=yuv420p")
    return entrada, ",".join(cadeia)


def renderizar_planos(planos: list[Plano], tmp: Path, rapido: bool) -> Path:
    lista = tmp / "planos.txt"
    linhas = []
    for i, plano in enumerate(planos, 1):
        saida = tmp / f"{i:02d}_{plano.id}.mp4"
        entrada, filtro = filtro_visual(plano, rapido)
        rodar(["ffmpeg", "-v", "error", "-y", *entrada, "-vf", filtro,
               "-frames:v", str(max(1, round(plano.dur * FPS))), "-an",
               "-c:v", "libx264", "-preset", "ultrafast" if rapido else "veryfast",
               "-crf", "17", "-r", str(FPS), str(saida)])
        linhas.append(f"file '{saida.name}'")
        print(f"  plano {plano.id:>4}  {plano.inicio:6.2f}s  +{plano.dur:5.2f}s  "
              f"{'clipe' if plano.clipe else 'teste'}")
    lista.write_text("\n".join(linhas) + "\n")
    mudo = tmp / "video_mudo.mp4"
    rodar(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lista),
           "-c", "copy", str(mudo)])
    return mudo


# ---------------------------------------------------------------- áudio


def renderizar_audio(planos: list[Plano], total: float, trilha: Path | None, tmp: Path,
                     vol_trilha: float = 0.35) -> Path:
    entradas: list[str] = []
    vozes: list[str] = []
    sons: list[str] = []
    k = 0
    for plano in planos:
        if plano.audio_clipe and plano.clipe:
            ms = int(plano.inicio * 1000)
            entradas += ["-ss", f"{plano.corte:.3f}", "-t", f"{plano.dur:.3f}", "-i", str(plano.clipe)]
            vozes.append(f"[{k}:a]aformat=sample_rates=48000:channel_layouts=stereo,"
                         f"adelay={ms}|{ms}[v{k}]")
            k += 1
            continue
        for f in plano.falas:
            if not f.audio:
                continue
            ms = int((plano.inicio + f.inicio) * 1000)
            entradas += ["-i", str(f.audio)]
            vel = f"atempo={f.tempo:.4f}," if abs(f.tempo - 1) > 0.005 else ""
            vozes.append(f"[{k}:a]aformat=sample_rates=48000:channel_layouts=stereo,{vel}"
                         f"adelay={ms}|{ms}[v{k}]")
            k += 1
        for s in plano.dados.get("sfx", []):
            arq = EDITOR / "sfx" / f"{s['som']}.wav"
            if not arq.exists():
                print(f"  aviso: efeito {s['som']} não encontrado")
                continue
            ms = int((plano.inicio + float(s.get("em", 0))) * 1000)
            vol = float(s.get("volume", 0.7))
            entradas += ["-i", str(arq)]
            sons.append(f"[{k}:a]aformat=sample_rates=48000:channel_layouts=stereo,"
                        f"volume={vol},adelay={ms}|{ms}[s{k}]")
            k += 1

    partes = [f"anullsrc=r=48000:cl=stereo,atrim=0:{total:.3f}[base]"]
    partes += vozes + sons
    rot_v = "".join("[" + p.rsplit("[", 1)[1] for p in vozes)   # ex.: [v0][v3]
    rot_s = "".join("[" + p.rsplit("[", 1)[1] for p in sons)
    nv = len(vozes)
    partes.append(f"[base]{rot_v}amix=inputs={nv + 1}:normalize=0:duration=first[voz]")
    partes.append(f"[voz]asplit=2[voz1][vozsc]")
    mix = ["[voz1]"]
    if sons:
        partes.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{total:.3f}[base2]")
        partes.append(f"[base2]{rot_s}amix=inputs={len(sons) + 1}:normalize=0:duration=first[efx]")
        mix.append("[efx]")
    if trilha:
        entradas += ["-stream_loop", "-1", "-i", str(trilha)]
        partes.append(f"[{k}:a]aformat=sample_rates=48000:channel_layouts=stereo,"
                      f"atrim=0:{total:.3f},volume={vol_trilha},"
                      f"afade=t=out:st={max(total - 2.5, 0):.2f}:d=2.5[mus]")
        partes.append("[mus][vozsc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[musd]")
        mix.append("[musd]")
    else:
        partes.append("[vozsc]anullsink")
    partes.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=first,"
                  f"loudnorm=I=-14:TP=-1.5:LRA=11,atrim=0:{total:.3f}[out]")
    saida = tmp / "audio.wav"
    rodar(["ffmpeg", "-v", "error", "-y", *entradas, "-filter_complex", ";".join(partes),
           "-map", "[out]", "-ar", "48000", str(saida)])
    return saida


# ---------------------------------------------------------------- legenda


def ass_tempo(t: float) -> str:
    t = max(t, 0)
    h, r = divmod(t, 3600)
    m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def palavras_com_tempo(f: Fala) -> list[tuple[str, float, float]]:
    palavras = f.texto.split()
    pesos = []
    for p in palavras:
        peso = len(re.sub(r"\W", "", p)) + 2.0
        if p.endswith("..."):
            peso += 5
        elif p[-1] in ".!?":
            peso += 3
        elif p[-1] in ",;:":
            peso += 2
        if p.startswith("..."):
            peso += 4
        pesos.append(peso)
    total = sum(pesos)
    ini, fim = f.voz_ini, f.voz_fim
    out, t = [], ini
    for p, peso in zip(palavras, pesos):
        d = (fim - ini) * peso / total
        out.append((p, t, t + d))
        t += d
    return out


def gerar_legenda(roteiro: dict, planos: list[Plano], total: float, tmp: Path) -> Path:
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Palavra,Inter Black,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,1,0,1,7,3,2,60,60,560,1
Style: Serie,Inter Black,74,&H0000D7FF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,2,0,1,5,2,8,60,60,210,1
Style: Parte,Inter ExtraBold,50,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,2,0,1,4,2,8,60,60,310,1
Style: Final,Inter Black,76,&H0000D7FF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,1,0,1,6,3,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    pop = r"{\fscx70\fscy70\t(0,90,\fscx106\fscy106)\t(90,170,\fscx100\fscy100)}"
    for plano in planos:
        for f in plano.falas:
            if not f.legenda:
                continue
            base = plano.inicio + f.inicio
            for palavra, a, b in palavras_com_tempo(f):
                txt = palavra.upper().replace("{", "(").replace("}", ")")
                ev.append(f"Dialogue: 1,{ass_tempo(base + a)},{ass_tempo(base + b)},"
                          f"Palavra,{f.quem},0,0,0,,{pop}{txt}")
    serie = roteiro.get("serie", "")
    parte = f"PARTE {roteiro.get('parte', '')}"
    if roteiro.get("titulo"):
        parte += f" · {roteiro['titulo'].upper()}"
    ev.append(f"Dialogue: 2,{ass_tempo(0.1)},{ass_tempo(3.2)},Serie,,0,0,0,,"
              f"{{\\fad(250,400)}}{serie}")
    ev.append(f"Dialogue: 2,{ass_tempo(0.3)},{ass_tempo(3.2)},Parte,,0,0,0,,"
              f"{{\\fad(250,400)}}{parte}")
    if roteiro.get("final"):
        ev.append(f"Dialogue: 2,{ass_tempo(total - 2.4)},{ass_tempo(total)},Final,,0,0,0,,"
                  f"{{\\fad(300,0)\\fscx80\\fscy80\\t(0,300,\\fscx100\\fscy100)}}"
                  f"{roteiro['final']}")
    arq = tmp / "legendas.ass"
    arq.write_text(cab + "\n".join(ev) + "\n", encoding="utf-8")
    return arq


# ---------------------------------------------------------------- principal


def main() -> None:
    ap = argparse.ArgumentParser(description="Editor de novelinhas")
    ap.add_argument("roteiro", help="ex.: partes/parte1.json")
    ap.add_argument("--rapido", action="store_true", help="prévia mais leve")
    ap.add_argument("--saida", help="arquivo de saída (padrão: saida/parteN_final.mp4)")
    args = ap.parse_args()

    roteiro_path = Path(args.roteiro)
    if not roteiro_path.is_absolute():
        roteiro_path = (Path.cwd() / roteiro_path).resolve()
    roteiro = json.loads(roteiro_path.read_text(encoding="utf-8"))
    midia = RAIZ / roteiro["midia"]
    midia.mkdir(parents=True, exist_ok=True)
    trilha = None
    if roteiro.get("trilha"):
        # procura na pasta de mídia da parte e, se não achar, a partir da pasta da série
        for cand in (midia / roteiro["trilha"], RAIZ / roteiro["trilha"]):
            if cand.exists():
                trilha = cand
                break
        else:
            print(f"  aviso: trilha {roteiro['trilha']} não encontrada — sem música")

    if not (EDITOR / "sfx" / "whoosh.wav").exists():
        subprocess.run([sys.executable, str(EDITOR / "gerar_sfx.py")], check=True)

    print(f"== {roteiro.get('serie')} · Parte {roteiro.get('parte')}")
    planos, avisos = montar_linha_do_tempo(roteiro, midia)
    total = sum(p.dur for p in planos)

    saida = Path(args.saida) if args.saida else RAIZ / "saida" / f"parte{roteiro.get('parte')}_final.mp4"
    saida.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        print("-- vídeo")
        mudo = renderizar_planos(planos, tmp, args.rapido)
        print("-- áudio")
        audio = renderizar_audio(planos, total, trilha, tmp,
                                 float(roteiro.get("volume_trilha", 0.35)))
        print("-- legenda e exportação")
        ass = gerar_legenda(roteiro, planos, total, tmp)
        shutil.copy(ass, saida.with_suffix(".ass"))
        # caminhos relativos no filtro de legenda: no Windows o "C:" quebra o filtro
        shutil.copytree(EDITOR / "fonts", tmp / "fonts", dirs_exist_ok=True)
        rodar(["ffmpeg", "-v", "error", "-y", "-i", str(mudo), "-i", str(audio),
               "-vf", f"subtitles={ass.name}:fontsdir=fonts",
               "-c:v", "libx264", "-preset", "veryfast" if args.rapido else "medium",
               "-crf", "20" if args.rapido else "18", "-pix_fmt", "yuv420p", "-r", str(FPS),
               "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
               str(saida.resolve())], cwd=tmp)

    print(f"\nPronto: {saida}  ({total:.1f}s)")
    if total <= 61:
        print("  ATENÇÃO: o vídeo tem 61 s ou menos — aumente 'min'/'respiro' para passar de 1 minuto.")
    if avisos:
        print(f"\nModo teste em {len(avisos)} item(ns):")
        for a in avisos:
            print("  -", a)


if __name__ == "__main__":
    main()
