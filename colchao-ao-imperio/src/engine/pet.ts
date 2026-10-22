/** Bichinhos de estimação em pixel art (desenhados por código). */
export type PetKind = 'gato' | 'cachorro' | 'coelho' | 'papagaio';

export const PETS: { id: PetKind; name: string; ach: string; how: string; colors: string[] }[] = [
  { id: 'gato', name: 'Gato', ach: 'days-7', how: 'Registre movimentações em 7 dias diferentes', colors: ['#f0a04b', '#2b2b2b', '#e9e6df', '#8a8f99'] },
  { id: 'cachorro', name: 'Cachorro', ach: 'save-1000', how: 'Guarde seus primeiros R$ 1.000', colors: ['#a8713f', '#e9e6df', '#2b2b2b', '#d6a35b'] },
  { id: 'coelho', name: 'Coelho', ach: 'goal-done-1', how: 'Conclua sua primeira meta', colors: ['#f4f1ea', '#8a8f99', '#d6a35b'] },
  { id: 'papagaio', name: 'Papagaio', ach: 'posm-1', how: 'Feche um mês com saldo positivo', colors: ['#2e9e5b', '#2f6fd1', '#e2b53f'] },
];

const C = 2;
/** Desenha o bichinho com as patas em (0,0). dir: 1/0 = olhando para a direita/esquerda. */
export function drawPet(ctx: CanvasRenderingContext2D, kind: PetKind, color: number, t: number, moving: boolean, facingRight: boolean, sitting: boolean) {
  const pet = PETS.find((p) => p.id === kind) ?? PETS[0];
  const main = pet.colors[color % pet.colors.length];
  const dark = 'rgba(0,0,0,0.35)';
  const O = '#1a1420';
  ctx.save();
  if (facingRight) ctx.scale(-1, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  const step = moving ? Math.floor(t * 10) % 2 : 0;
  const bob = moving ? -(step) : 0;
  const px = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect((x - 6) * C, (y - 11) * C + bob, w * C, h * C); };
  if (kind === 'papagaio') {
    const hop = moving ? -Math.abs(Math.sin(t * 10)) * 3 : 0;
    ctx.translate(0, hop);
    px(4, 3, 5, 6, O); px(5, 3, 4, 5, main); px(4, 3, 3, 3, main); px(3, 4, 2, 2, '#e2b53f'); px(5, 4, 1, 1, O);
    px(7, 5, 3, 3, pet.colors[1]); px(8, 8, 3, 2, pet.colors[1]); px(5, 9, 1, 2, '#d68a2b'); px(7, 9, 1, 2, '#d68a2b');
    ctx.restore(); return;
  }
  if (kind === 'coelho') {
    px(3, 2, 2, 5, O); px(3, 2, 1, 4, main); px(5, 2, 2, 5, O); px(5, 2, 1, 4, main);
    px(2, 6, 5, 4, O); px(2, 6, 4, 3, main); px(3, 7, 1, 1, O); px(2, 8, 1, 1, '#e88');
    px(5, 8, 6, 3, O); px(5, 8, 5, 2, main); px(10, 8, 2, 2, '#fff');
    px(5, 10, 2, 1, dark); px(8, 10, 2, 1, dark);
    ctx.restore(); return;
  }
  // gato e cachorro (quadrúpedes)
  const dog = kind === 'cachorro';
  const sit = sitting && !moving;
  // corpo
  px(4, sit ? 6 : 6, 7, sit ? 4 : 3, O); px(4, 6, 6, sit ? 3 : 2, main);
  // cabeça
  px(1, 3, 5, 5, O); px(1, 3, 4, 4, main);
  if (dog) { px(0, 3, 2, 4, O); px(0, 3, 1, 3, pet.colors[1] ?? dark); px(0, 6, 2, 1, '#2b2b2b'); }
  else { px(1, 2, 1, 2, O); px(1, 2, 1, 1, main); px(4, 2, 1, 2, O); px(4, 2, 1, 1, main); }
  const blink = Math.sin(t * 1.7) > 0.97;
  px(2, 4, 1, 1, blink ? main : O); px(4, 4, 1, 1, blink ? main : O);
  px(2, 6, 1, 1, dog ? '#2b2b2b' : '#e88');
  // patas
  if (sit) { px(4, 9, 2, 2, O); px(8, 9, 2, 2, O); }
  else {
    px(4, 8 + step, 1, 3 - step, O); px(6, 8 + (1 - step), 1, 3 - (1 - step), O);
    px(8, 8 + step, 1, 3 - step, O); px(10, 8 + (1 - step), 1, 3 - (1 - step), O);
  }
  // rabo
  const wag = Math.sin(t * (dog ? 12 : 3)) * (dog ? 1.5 : 1);
  ctx.fillStyle = O;
  ctx.fillRect((11 - 6) * C, (4 - 11) * C + wag + bob, C, 4 * C);
  ctx.fillStyle = main;
  ctx.fillRect((11 - 6) * C, (4 - 11) * C + wag + bob, C, 3 * C);
  ctx.restore();
}
