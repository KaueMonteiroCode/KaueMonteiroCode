# Editor de novelinhas

Monta uma parte inteira da série a partir de um roteiro JSON: clipes, falas, legenda palavra
por palavra, efeitos sonoros, trilha com ducking, título de abertura e cartela final.
Saída: MP4 1080x1920, 30 fps, áudio normalizado para TikTok (-14 LUFS).

Requisitos: Python 3.10+ e FFmpeg com libass (padrão no Linux; no Windows, o build "full"
do gyan.dev). As fontes Inter já estão em `editor/fonts/`.

## Uso

```bash
# na pasta da série (dorama-gemeos-do-presidente/)
python3 editor/editor.py partes/parte1.json            # versão final
python3 editor/editor.py partes/parte1.json --rapido   # prévia mais leve
```

Resultado em `saida/parte1_final.mp4` (e a legenda em `saida/parte1_final.ass`).

## Onde colocar os arquivos

```
midia/parte1/
  p1_c01.mp4 ... p1_c17.mp4      clipes do gerador de vídeo (1 por plano)
  p1_f01_hajun.mp3 ...           falas do Fish Audio (nomes em falas/parte1_falas.md)
  trilha.mp3                     (opcional) música de fundo, abaixa sozinha quando alguém fala
```

**Modo teste:** o que faltar não trava a montagem. Clipe ausente vira a imagem de teste
(ficha/cenário) com zoom; fala ausente vira silêncio com duração estimada. Dá para montar
assim que chegar o primeiro arquivo e ir trocando.

## Roteiro de montagem (`partes/parteN.json`)

Cada item de `planos` é um clipe do vídeo final, na ordem:

| Campo | O que faz |
|---|---|
| `clipe` | arquivo de vídeo em `midia/parteN/` |
| `teste` / `foco_teste` | imagem usada enquanto o clipe não existe; `foco_teste` (0–1) escolhe a área horizontal |
| `falas` | lista de `{audio, quem, texto}`; o plano dura o tempo das falas + `respiro` |
| `atraso` (na fala) | segundos de espera antes da fala começar |
| `junto: true` (na fala) | fala ao mesmo tempo que a anterior (sem legenda duplicada) |
| `min` | duração mínima do plano (planos sem fala) |
| `respiro` | pausa depois da última fala (padrão 0,6 s) |
| `cortar_inicio` | segundos cortados do começo do clipe (padrão 0,3 s — tira o quadro parado) |
| `lipsync: true` + `fala_no_clipe` | clipe com boca sincronizada: a fala entra no segundo `fala_no_clipe` do clipe (padrão 0) e o que vem antes é cortado |
| `alinhar: "auto"` | acha a fala no áudio que o gerador criou e encaixa a voz do Fish ali (ajusta a velocidade em até ±15%) |
| `efeitos` | `zoom_lento`, `zoom_rapido`, `tremor`, `flash` |
| `sfx` | lista de `{som, em, volume}`; sons em `editor/sfx/` |

Se o clipe for mais curto que o plano, o último quadro congela até o fim (bom para ganchos).

## Efeitos sonoros

`python3 editor/gerar_sfx.py` cria o pack básico sintetizado: `whoosh`, `coracao`, `impacto`,
`elevador`, `suspense`, `brilho`. Para trocar por um efeito de pack baixado, coloque o arquivo
em `editor/sfx/` com o mesmo nome (ex.: `impacto.wav`) — ele passa a ser usado no lugar.
