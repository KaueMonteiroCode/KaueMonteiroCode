# Mesa de Aventura

RPG 2D para celular e PC, feito no Godot 4.3 ou mais novo. Um Mestre narra tudo e rola dados (Pen & Paper), a masmorra é de ação (Soul Knight) e a vila tem fazenda (Stardew).

## Abrir
1. Baixe o **Godot 4.3+** (versão padrão, não a .NET).
2. Clique em *Importar* e escolha `jogo/project.godot`.
3. Aperte **F5**.

## Controles
| | PC | Controle | Celular |
|---|---|---|---|
| Mover | WASD / setas | analógico esquerdo | joystick (metade esquerda da tela) |
| Atacar (mira sozinho) | J / Espaço | X | ATK |
| Interagir | E / K | A | USAR |
| Dash | Shift / L | B | DASH |

## Sua parte: as imagens
Coloque os PNGs em `jogo/assets/sprites/` com **exatamente** estes nomes. O jogo troca o quadrado colorido pela imagem sozinho. Pode ser de qualquer resolução, porque a imagem é ajustada ao tamanho abaixo (em pixels do jogo). Deixe o personagem **virado para a direita** e use fundo transparente.

| Arquivo | Tamanho no jogo | O que é |
|---|---|---|
| `jogador.png` | 14×18 | herói |
| `slime.png` | 16×16 | inimigo que persegue |
| `arqueiro.png` | 16×16 | inimigo que atira |
| `chefe.png` | 36×36 | chefe da masmorra |
| `tiro_jogador.png` / `tiro_inimigo.png` | 6×6 | projéteis (apontando para a direita) |
| `moeda.png` / `semente.png` | 7×7 | itens no chão |
| `porta.png` | 24×20 | saída da sala |
| `casa.png` / `loja.png` | 56×48 | prédios da vila |
| `caixa_venda.png` | 20×16 | caixa de venda |
| `portal_masmorra.png` | 32×32 | entrada da masmorra |
| `arvore.png` | 24×32 | árvore |
| `canteiro.png` / `canteiro_molhado.png` | 20×20 | terra seca / regada |
| `broto.png` | 8×8 | planta crescendo |
| `planta_pronta.png` | 14×16 | planta para colher |

**Texturas que se repetem** (ladrilho de 16×16 ou 32×32): `chao_vila.png`, `chao_masmorra.png`, `parede_masmorra.png`, `pilar.png`, `cerca.png`.

## Exportar para Android
*Projeto → Exportar → Adicionar → Android.* Na primeira vez, o Godot pede para instalar o Android SDK e o modelo de exportação. É só seguir o que ele mostra.
