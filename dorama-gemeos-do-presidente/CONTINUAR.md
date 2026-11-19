# Prompt para continuar num chat novo (Claude Code com pasta local)

Cole tudo abaixo da linha no chat novo.

---

Vamos continuar um projeto que comecei com você em outra sessão. Leia tudo antes de agir e me responda em português, direto e prático, uma etapa de cada vez.

## O projeto
Série de **dorama coreano gerado por IA, dublado em português**, para TikTok: **"Os Gêmeos do Presidente"**. São 8 partes de ~60–65 s (precisa passar de 60 s para monetizar), com os personagens falando em primeira pessoa (sem narrador), legenda palavra por palavra no centro e cara de K-drama de alto orçamento.

**Enredo:** Han Seo-yeon (mãe solo, 26) leva os gêmeos Ha-eun e Ha-jun (4 anos) a uma entrevista no Kang Group. Ha-jun vê o retrato do presidente Kang Do-hyun (CEO frio, 31) e percebe que tem a cara dele — os dois têm a **mesma pinta abaixo do olho esquerdo** (pista da série). Madame Kang (avó, matriarca) e Yoon Bi-na (vilã, noiva arranjada) completam o elenco. Partes: 1 O Elevador · 2 A Contratada · 3 O Almoço · 4 O Colar · 5 O Relógio do Ha-jun · 6 O DNA · 7 Cinco Anos Atrás · 8 A Família.

## Onde está tudo
- Repositório: `https://github.com/KaueMonteiroCode/KaueMonteiroCode`, branch **`ccr-8ac7ecd7-yhjpu3`**, pasta **`dorama-gemeos-do-presidente/`**.
  - `README.md` — bíblia da série: descrição fixa de cada personagem (colar igual nos prompts), enredo, regras.
  - `fichas/` — fichas aprovadas dos 6 personagens · `cenarios/` — saguão, corredor (manhã e entardecer), elevador.
  - `falas/parte1_falas.md` — falas da Parte 1 · `prompts/parte1_clipes_v2.md` — prompts detalhados dos clipes.
  - `partes/parte1.json` — roteiro de montagem (planos, falas, efeitos) · `editor/` — editor automático (ver `editor/README.md`).
  - `midia/parte1/` — áudios do Fish já cortados (`p1_f01_hajun.mp3`...). **Os vídeos (.mp4) NÃO estão no Git** — eu coloco os meus clipes nessa pasta.
- Se a pasta ainda não estiver no meu PC: clone o repositório e faça checkout da branch acima.

## Ferramentas que eu uso (verba zero)
- **ChatGPT** (pago): fichas, cenários e o quadro inicial de cada clipe (prompt A, anexando ficha + cenário).
- **CapCut / PixVerse / outros com cota grátis**: animação imagem→vídeo (prompt B). **Eu mesmo faço o lip sync** e te mando os clipes já com a voz sincronizada.
- **Fish Audio** (pago): vozes — Seo-yeon = "menina", Do-hyun = "Megumi", Ha-jun = "Gael Pires", Ha-eun = "Voz Jovem Animada", Bi-na = "SANDRONE OFICIAL", Madame Kang = ainda não escolhida.
- **Você (Claude)**: roteiros, prompts e a **edição final com o editor** (Python + FFmpeg).

## Decisões já tomadas (não mudar sem eu pedir)
1. **Sem música de fundo** no editor — eu coloco a trilha depois no CapCut.
2. **Não tente sincronizar boca por conta própria.** Tentou-se encaixar a voz olhando a boca quadro a quadro e ficou ruim. Os clipes com fala chegam com lip sync feito por mim: use `"audio_do_clipe": true` no plano (o editor usa o som do próprio clipe, só corta tempo morto com `cortar_inicio`/`dur` e põe a legenda no trecho de fala).
3. Prompts de animação: **só uma pessoa fala por vez** ("ONLY X speaks... The others keep their mouths closed").
4. Nada de copiar personagens ou roteiro de outros criadores; marcar "conteúdo gerado por IA" ao postar; nada romântico físico envolvendo as crianças.
5. Clipes de 5 s (ou 10 s quando a cena pede); planos parados (retrato, porta) curtos — o retrato fica com ~2 s.

## Editor (como rodar)
Requisitos: Python 3.10+ e FFmpeg com libass (Windows: `winget install Gyan.FFmpeg`, que é o build completo). Dentro de `dorama-gemeos-do-presidente/`:
```
python editor/editor.py partes/parte1.json            # final -> saida/parte1_final.mp4
python editor/editor.py partes/parte1.json --rapido   # prévia
python editor/cortar_falas.py --parte 1               # corta pN_<personagem>_completo.mp3 em falas
```
Campos do roteiro em `editor/README.md` (clipe, falas, min, respiro, cortar_inicio, velocidade, efeitos zoom_lento/zoom_rapido/tremor/flash, sfx whoosh/coracao/impacto/elevador/suspense/brilho, audio_do_clipe). Clipe ausente vira imagem de teste; o editor avisa.

## Onde paramos
- Parte 1 com os 17 clipes gerados (c01–c17). Vou te mandar os clipes **com lip sync refeito por mim**. Sua tarefa agora:
  1. Colocar os clipes em `midia/parte1/` com os nomes `p1_c01.mp4` … `p1_c17.mp4` (se vierem com outro nome, me pergunte a ordem ou identifique pelas cenas descritas em `partes/parte1.json`).
  2. Marcar `"audio_do_clipe": true` nos planos com fala que vierem sincronizados (e tirar `lipsync`/`fala_no_clipe`/`alinhar` desses planos), ajustar `cortar_inicio`/`dur` para tirar tempo morto, garantir que o total passe de 60 s.
  3. Renderizar, olhar alguns quadros para conferir, e me entregar o `saida/parte1_final.mp4` sem música.
- Depois: Parte 2 "A Contratada" — fichas extras se precisar, falas para o Fish (um áudio por personagem com linha em branco entre as falas), prompts A/B no mesmo padrão, roteiro `partes/parte2.json`.

Ao terminar cada etapa, faça commit na mesma branch e push.
