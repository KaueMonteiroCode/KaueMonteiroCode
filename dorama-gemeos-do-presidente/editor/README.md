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
| `velocidade` | 0.7 = câmera lenta (clipe 30% mais longo), 1.2 = acelerado |
| `audio_do_clipe: true` | o clipe já vem com a voz sincronizada (lip sync feito fora): usa o som dele, a duração dele, e só coloca a legenda no trecho de fala |
| `cortar_inicio: "auto"` / `dur: "auto"` | (com `audio_do_clipe`) corta o tempo morto antes da 1ª palavra e depois da última + `respiro`, pelo Whisper |
| `lut` | no roteiro (vale pra todos) ou no plano: cor de K-drama, `kdrama_quente`, `kdrama_frio`, `kdrama_flashback` (em `editor/luts/`); `"lut": null` no plano desliga |
| `trilha` (no roteiro) | arquivo da música em `midia/parteN/` (fora do Git); `volume_trilha` (padrão 0,35) e `trilha_inicio` (segundo da música onde começa). Abaixa sozinha quando alguém fala, entra em 0,6 s e sai em 2,5 s |
| `trilha` (no plano) | multiplica o volume da música só naquele plano: `1.5` sobe, `0.5` abaixa |
| `efeitos` | `zoom_lento`, `zoom_rapido`, `tremor`, `flash` |
| `sobrepor` | lista de `{arquivo, em}`: animação com fundo transparente (`.mov` ProRes 4444 ou `.webm` VP9, feita no HyperFrames/Remotion) por cima do plano, `em` segundos depois do começo dele; o arquivo é procurado em `midia/parteN/` e depois a partir da pasta da série. Pode passar do fim do plano |
| `entrada` | (falas com áudio) segundo do plano em que a primeira fala começa (padrão 0,35) |
| `sfx` | lista de `{som, em, volume}`; sons em `editor/sfx/` ou na biblioteca extra `sfx/` (fora do Git: Kenney CC0, Pixabay), pelo nome do arquivo sem extensão |

**Legenda pelo Whisper:** se o editor rodar com o Python que tem o `faster-whisper` (o `.venv` da pasta do
dorama) e achar o modelo `modelo/whisper-large-v3-turbo` numa pasta acima, os planos com `audio_do_clipe`
ganham a legenda no tempo exato de cada palavra falada no clipe (o texto continua o do roteiro). O resultado
fica guardado em `midia/parteN/.whisper/`. Sem o Whisper, volta ao jeito antigo (divide pelo volume da voz).
Se o FFmpeg não estiver no PATH, o editor usa o de `%LOCALAPPDATA%\Programs\ffmpeg\bin`.

Se o clipe for mais curto que o plano, o último quadro congela até o fim (bom para ganchos).

## Efeitos sonoros

`python3 editor/gerar_sfx.py` cria o pack básico sintetizado: `whoosh`, `coracao`, `impacto`,
`elevador`, `suspense`, `brilho`. Para trocar por um efeito de pack baixado, coloque o arquivo
em `editor/sfx/` com o mesmo nome (ex.: `impacto.wav`) — ele passa a ser usado no lugar.
