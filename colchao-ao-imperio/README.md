# Do Colchão ao Império — Finance Tycoon

Jogo isométrico em pixel art em que seu **progresso financeiro real** transforma um quarto
precário (colchão no chão, parede descascada, PC amarelado) num complexo empresarial de luxo.

- **R$ (dinheiro real)**: você registra contas, receitas, despesas, cartões, dívidas, metas…
- **Moedas (virtuais)**: ganhas ao economizar, quitar dívidas, manter constância e cumprir missões.
  Gastas na loja do jogo. **Nunca** tiram um centavo do seu saldo real.

Tudo roda no navegador, offline, sem cadastro, sem servidor e sem conexão bancária.

## Como executar

Requisitos: Node 20+.

```bash
cd colchao-ao-imperio
npm install
npm run dev          # abre em http://localhost:5173
```

Build de produção (arquivos estáticos em `dist/`, abre de qualquer servidor estático):

```bash
npm run build
npm run preview
```

App de Windows (.exe): `npm run build:exe` gera `dist-exe/Colchao-ao-Imperio-Windows.zip`.
Extraia e abra `Colchao ao Imperio.exe`; o jogo roda offline e o save fica no computador.

Testes:

```bash
npm test             # testes unitários (dinheiro, ledger, anti-fraude de moedas, conteúdo)
npm run dev &        # depois, com o servidor rodando:
npm run e2e          # critério de sucesso de ponta a ponta no Chromium (desktop)
node scripts/e2e.mjs --mobile   # o mesmo fluxo em viewport de celular com toque
npm run qa           # QA ampla: cartão parcelado, dívida, calendário, decorar, interações
npm run visual       # gera folhas com as miniaturas de todos os móveis e cada imóvel
```

(`e2e`/`qa`/`visual` usam `playwright-core`; aponte `CHROMIUM=/caminho/do/chrome` se necessário.)

## Critério de sucesso (testado automaticamente em `scripts/e2e.mjs`)

Abrir o jogo → ver o personagem no quarto horrível → registrar R$ 25 de economia → ganhar
moedas → entrar na loja → comprar um objeto → posicioná-lo no quarto → fechar o navegador →
reabrir e encontrar tudo salvo. Passa em desktop e em modo celular.

## Arquitetura

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem / build | TypeScript + Vite | tipagem forte para regras financeiras; build estático |
| Interface | React 19 | telas financeiras, loja, painéis |
| Jogo isométrico | **Motor próprio em Canvas 2D** (`src/engine`) | ver abaixo |
| Persistência | IndexedDB + espelho síncrono em localStorage | sobrevive a fechar a aba abruptamente |
| Testes | Vitest + Playwright (Chromium) | unidade + ponta a ponta |

**Por que não Phaser/PixiJS?** Todos os sprites são **gerados por código** (não há imagens),
a partir de primitivas 3D (caixas com faces pintáveis) projetadas em isometria 2:1. Isso exige
controle fino de projeção, rotação de faces, ordenação por profundidade e iluminação — que em
Canvas 2D ficam simples e leves (bundle menor, sem WebGL obrigatório). O mundo é desenhado numa
resolução base e ampliado com *nearest-neighbor*, o que dá o visual pixel art nítido.

```
src/
  core/      dinheiro em centavos, datas locais, IndexedDB, contrato de sync futuro
  finance/   ledger (saldos assinados, patrimônio, faturas, parcelas, calendário, projeção), CSV
  game/      catálogo (373 móveis), pisos/paredes, imóveis, recompensas, conquistas, missões, títulos, eventos
  engine/    projeção isométrica, primitivas, personagem, A*, motor da cena, miniaturas
  state/     tipos do save, store imutável, ações (todas as regras de negócio validadas)
  ui/        telas React (jogo, loja, inventário, finanças, conquistas, imóveis, ajustes…)
  audio/     efeitos sonoros e música lo-fi sintetizados com WebAudio
```

## Regras financeiras (garantidas por código e testes)

- Valores sempre em **centavos inteiros**; parcelas divididas sem perder centavos.
- Todo saldo é **assinado**: ativos positivos, passivos (cartão, dívida) negativos.
  Patrimônio = soma de tudo. Logo:
  - **transferências** entre contas **não** alteram patrimônio e **não** geram moedas;
  - **empréstimo recebido** (transferência da conta Dívida para a corrente) não é enriquecimento;
  - **pagar dívida** reduz ativo e passivo juntos.
- **Saldo inicial** é linha de base e nunca gera moedas.
- Lançamentos futuros e recorrências ficam **pendentes até você confirmar**; nada é marcado como pago sozinho.
- Editar/excluir guarda **histórico** (lixeira com restauração + auditoria).

### Como as moedas são calculadas (anti-duplicação)

Moedas e XP **não são acumulados por evento**: são **recalculados do histórico** a cada mudança.

- Economia: curva generosa no começo (2 moedas por R$ até R$ 100, depois decrescente),
  aplicada ao **pico histórico de ganho de patrimônio**. Gastar depois não retira o que foi
  conquistado; recuperar até o pico não paga de novo; apagar um lançamento falso retira.
- Dívidas: só a redução de dívidas **que já existiam** (abaixo do menor valor já atingido).
  Pegar empréstimo e devolver não rende nada.
- Ajustes de saldo para cima não rendem.
- Constância: 5 moedas por dia (do relógio real, não retroativo) com registro.
- Conquistas e missões: cada uma vale uma vez; missões diárias/semanais por período.
- Compras/vendas ficam num livro de moedas separado. Itens que vêm com o imóvel não podem ser vendidos.

## O que existe de verdade

- **Jogo**: quarto inicial precário, personagem personalizável (cabelo, rosto, roupa, barba,
  acessórios — alguns premium) que anda (A*), senta, dorme, digita, toma café, comemora com
  confete; funcionários NPC nos escritórios; balões de fala; iluminação por lâmpadas/janelas
  (céu conforme a hora real); câmera com zoom, arrasto, pinça e "ver tudo".
- **Loja**: 373 móveis e variantes em 21 categorias + 39 pisos/papéis de parede, raridades de
  sucata a lendário, itens por nível, coleções e itens exclusivos de eventos sazonais.
- **Decoração**: comprar e posicionar com fantasma verde/vermelho, mover, girar, guardar,
  vender (50%), itens de mesa sobre superfícies (e que acompanham a mesa), itens de parede,
  pisos/paredes, temas de iluminação, expansão do ambiente, layouts salvos por imóvel.
- **12 imóveis** com tamanhos, paredes, pisos, janelas, fixos (colunas, elevadores) e móveis
  iniciais diferentes; os anteriores continuam acessíveis.
- **Finanças**: contas, saldo inicial, receitas, despesas, transferências, ajustes, cartões
  (fechamento/vencimento, faturas, parcelado), dívidas (parcelas, antecipação, avulso, juros),
  recorrências/assinaturas, calendário com confirmação, metas, reserva de emergência,
  orçamento por categoria, categorias personalizadas, patrimônio, gráficos, projeção,
  importação/exportação CSV, backup/restauração JSON, exclusão total dos dados.
- **Evolução**: níveis/XP, 245 conquistas em 12 ramos (lista + árvore), títulos, coleções,
  missões de história, diárias, semanais e de eventos, histórico de evolução e objetivos de
  curto/médio/longo prazo. Ficar dias sem registrar não pune (a sequência tolera 1 dia de folga).

## Novidades da versão 3

- **Instalar como app (PWA)**: ícone na tela inicial e funcionamento offline quando o jogo é aberto
  pelo endereço do site. O workflow `.github/workflows/colchao-pages.yml` publica no GitHub Pages:
  ative em *Settings → Pages → Source: GitHub Actions* e rode o workflow (ou faça merge na `main`).
- **Sincronizar aparelhos**: Ajustes → Sincronizar gera um código cifrado com senha (PBKDF2 + AES-GCM,
  no próprio aparelho). No outro aparelho os dados são **somados** (lançamentos dos dois lados ficam).
- **Importar extrato**: OFX de qualquer banco e CSV do Nubank (conta e cartão), Inter, Itaú; não duplica.
- **Simulador**: prazo de meta com rendimento e economia de juros antecipando dívidas.
- **Resumo da semana** ao abrir o jogo, **orçamento 50/30/20** automático, **linha do tempo** do
  patrimônio com marcos, **bichinho de estimação** liberado por hábitos, **foto do quarto** e **ajuda** (?) em cada painel.
- Anti-fraude reforçado: só conta a queda do **total** devido (refinanciar não rende), parcela parcial
  não quita, backup danificado é reparado e há tela de recuperação em vez de tela branca.

## Escritório dos Robôs (novo)

Um escritório em pixel art (mesmo motor do jogo) onde **cada robô/projeto é um NPC** na própria mesa,
com setup da cor dele. Os NPCs reagem ao que os robôs relatam: digitam quando estão trabalhando,
comemoram quando terminam, levantam com "Chefe, deu erro!" quando falham e dormem quando o robô
fica sem mandar notícias. Clicar num NPC abre a fala dele, as tarefas com progresso, os números e o
histórico, e dá para conversar com ele (com IA opcional, sempre baseada nos boletins reais).

**Abrir no PC (Windows):** dois cliques em `Abrir-Escritorio.bat` (precisa do Node.js). Ou `npm run office`
e abra http://localhost:4317. Sem servidor, a página roda em modo demonstração com dados fictícios.

**Ligar um robô:** no fim de cada etapa, ele manda um POST para `/api/report`:

```python
from office_client import report   # office-server/office_client.py
report("alfredo", status="working", task="Pesquisando ofertas de fones", progress=40, event="Encontrou 12 ofertas")
```

```js
import { report } from './office-server/client.mjs';
await report({ agent: 'teo', status: 'done', event: 'Vídeo 3 pronto' });
```

`status`: `working`, `idle`, `done` ou `error` (com `error: "motivo"`). Opcionais: `detail`, `progress`,
`tasks: [{name, progress}]`, `metrics: {"ofertas hoje": 12}`. Os robôs, nomes, cores e ícones ficam em
`office-server/data/agents.json` (criado a partir de `agents.example.json` na 1ª execução; o escritório
recarrega sozinho ao salvar). Cada robô novo ganha uma estação.

**Variáveis:** `ANTHROPIC_API_KEY` liga a IA nas conversas; `HOST=0.0.0.0` + `OFFICE_TOKEN=senha` deixam
outra pessoa da sua rede acompanhar em `http://IP-do-PC:4317/?k=senha` (aparece em "Online"). O mesmo
servidor pode ir para um servidor online depois, sem mudar os robôs (só o `OFFICE_URL`).

Desenvolvimento: `npm run office` + `npx vite` e abra http://localhost:5173/escritorio.html (o Vite repassa
`/api` para o servidor). `npm run build:office` gera `office-server/public/escritorio.html`.

## Limitações conhecidas / pendências

- Sprites são procedurais (formas geométricas pintadas), não arte desenhada à mão. A estética
  é consistente, mas um artista poderia substituir modelos por spritesheets no futuro.
- Importação CSV cobre o formato do próprio app e extratos simples (`data;descricao;valor`);
  extratos OFX e formatos específicos de bancos não são lidos.
- A fonte "Press Start 2P" vem do Google Fonts; offline cai para uma fonte monoespaçada.
- A sincronização é manual (código com senha), não automática: não há servidor. Decoração e compras
  vêm do aparelho usado por último; finanças dos dois lados são somadas.
- A instalação como app e o offline completo exigem abrir pelo endereço do site (GitHub Pages);
  o arquivo local e o link do Claude não permitem service worker.
