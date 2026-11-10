# Mesa de Aventura: guia para o Claude

RPG 2D. O Mestre narra e rola d20 (estilo Knights of Pen & Paper), a masmorra é de ação (Soul Knight) e a vila tem fazenda (Stardew Valley).
O dono do projeto **só faz a arte (PNG)**. O Claude programa tudo. Responda em PT-BR, curto e sem muita explicação.

## Stack
- Godot **4.3+**, GDScript, renderer GL Compatibility.
- Tela base 640×360, stretch `canvas_items`/`expand`, paisagem.
- Alvo: Android primeiro, depois PC. O mesmo projeto exporta para os dois.

## Arquivos
- `project.godot`: autoloads `Jogo`, `Narrador` e `Toque`.
- `cenas/main.tscn` + `scripts/main.gd`: escolha de classe e troca vila ↔ masmorra.
- `scripts/autoload/jogo.gd`: estado global, save JSON (`user://save.json`), classes, missões e InputMap.
- `scripts/autoload/narrador.gd`: caixa de fala do Mestre (`falar`, `rolar_d20`).
- `scripts/autoload/toque.gd`: joystick e botões de toque (só aparecem no celular).
- `scripts/vila.gd`: fazenda, loja, venda, casa (dormir), quadro de missões e portal.
- `scripts/masmorra.gd`: 5 salas, evento d20 por sala, chefe na última, loot e morte.
- `scripts/jogador.gd`: movimento, dash, mira automática, classes, habilidades e câmera.
- `scripts/inimigo.gd`: tipos `slime`, `arqueiro` e `chefe`.
- `scripts/projetil.gd`, `scripts/coleta.gd`, `scripts/hud.gd`.
- `scripts/arte.gd`: carrega `assets/sprites/<nome>.png` ou desenha um placeholder colorido.
- `testes/teste_fluxo.tscn`: teste automático de ponta a ponta.

## Convenções (seguir sempre)
- Tudo é montado por código. As cenas `.tscn` são mínimas.
- **Não usar `class_name`.** Use `const X = preload("res://...")` e use `X` como tipo.
- **Arte:** sempre via `Arte.visual(nome, cor, tamanho)` ou `Arte.chao(...)`. Todo sprite novo entra na tabela do `README.md`.
- **Controles:** só usar ações do InputMap, criadas em `Jogo._criar_controles()`. Ação nova precisa de tecla, botão de controle **e** botão de toque em `toque.gd`.
- **Física:** nunca criar ou remover corpos dentro de `body_entered` ou de um sinal disparado por ele. Use `call_deferred`. Para trocar de cena, use `Jogo.ir_para("vila"|"masmorra")`.
- **Camadas de colisão:** 1 = paredes, 2 = jogador, 4 (layer 3) = inimigos.
- **Grupos:** `jogador`, `inimigos`, `chefe`, `container_projeteis`.
- **Estado persistente** fica em `Jogo`. Campo novo entra em `salvar()`, `carregar()` e `_novo_jogo()`.
- **Feedback ao jogador:** via `Narrador.falar()` e `Narrador.rolar_d20()`. Texto em PT-BR com acento, no tom de um mestre de RPG bem-humorado.

## Verificar depois de cada mudança
```bash
godot --headless --editor --quit --path jogo
godot --headless --path jogo res://testes/teste_fluxo.tscn
```
O resultado tem que terminar em `0 falha(s)` e sem `SCRIPT ERROR`. Ao criar uma mecânica nova, adicione um teste para ela em `testes/teste_fluxo.gd`.
