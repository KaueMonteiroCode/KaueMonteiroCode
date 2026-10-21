import type { AvatarConfig } from '../state/types';
import { shade } from './iso';

export const SKIN = ['#ffdbc4', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5b3a1e'];
export const HAIR_COLORS = ['#1c1410', '#4a2c17', '#8b5a2b', '#d6a35b', '#f1d38a', '#b33a2f', '#8a8f99', '#6b4fd6', '#e86fb0', '#2f9e8f'];
export const CLOTH_COLORS = ['#e9e6df', '#2a2a33', '#c0392b', '#2f6fd1', '#2e9e5b', '#e2b53f', '#8e52d6', '#e86fb0', '#e67e22', '#1aa39a', '#7c8191', '#6b4226', '#2b3a67'];
export const HAIR_STYLES = ['Careca', 'Curto', 'Topete', 'Longo', 'Black power', 'Rabo de cavalo', 'Moicano', 'Franja', 'Coque', 'Cacheado'];
export const EYES = ['Pontinhos', 'Grandes', 'Sonolentos', 'Sorridentes'];
export const MOUTHS = ['Sorriso', 'Neutra', 'Aberta', 'De lado'];
export const SHIRTS = ['Camiseta', 'Regata', 'Camisa social', 'Moletom', 'Terno', 'Jaqueta', 'Vestido', 'Camiseta listrada'];
export const PANTS = ['Calça', 'Bermuda', 'Saia', 'Calça de moletom'];
export const ACCESSORIES = ['Nenhum', 'Óculos', 'Boné', 'Headphone', 'Corrente de ouro', 'Gravata-borboleta', 'Óculos escuros', 'Coroa', 'Relógio de ouro', 'Chapéu de magnata'];
export const BEARDS = ['Sem barba', 'Bigode', 'Cavanhaque', 'Barba cheia'];

/** Acessórios premium exigem compra na loja de visual */
export const PREMIUM_ACCESSORIES: Record<number, { price: number; minLevel: number }> = {
  4: { price: 300, minLevel: 6 }, 6: { price: 120, minLevel: 3 }, 7: { price: 2500, minLevel: 20 }, 8: { price: 600, minLevel: 10 }, 9: { price: 1500, minLevel: 15 },
};

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: 1, hairStyle: 1, hairColor: 1, eyes: 0, mouth: 0, shirtStyle: 0, shirtColor: 0, pantsStyle: 0, pantsColor: 12, shoesColor: 1, accessory: 0, beard: 0,
};

export type AvatarAnim = 'idle' | 'walk' | 'sit' | 'sleep' | 'celebrate' | 'type' | 'use' | 'drink';

export interface AvatarPose {
  /** 0:+y (baixo-esq), 1:+x (baixo-dir), 2:-y (cima-dir), 3:-x (cima-esq) */
  dir: number;
  anim: AvatarAnim;
  t: number;
  /** ângulo (rad) do corpo deitado, alinhado à cama */
  lie?: number;
}

const C = 2; // tamanho do "pixel" do personagem

/**
 * Desenha o personagem com os pés em (0,0). Altura total ~54px.
 */
export function drawAvatar(ctx: CanvasRenderingContext2D, cfg: AvatarConfig, pose: AvatarPose) {
  const lying = pose.anim === 'sleep';
  const front = lying || pose.dir === 0 || pose.dir === 1;
  const mirror = !lying && (pose.dir === 1 || pose.dir === 3); // espelha para direita
  ctx.save();
  if (mirror) ctx.scale(-1, 1);

  const skin = SKIN[cfg.skin % SKIN.length];
  const hair = HAIR_COLORS[cfg.hairColor % HAIR_COLORS.length];
  const shirt = CLOTH_COLORS[cfg.shirtColor % CLOTH_COLORS.length];
  const pants = CLOTH_COLORS[cfg.pantsColor % CLOTH_COLORS.length];
  const shoes = CLOTH_COLORS[cfg.shoesColor % CLOTH_COLORS.length];
  const O = '#1a1420';

  const anim = pose.anim;
  const t = pose.t;
  let bob = 0;
  let walkPhase = 0;
  if (anim === 'walk') { walkPhase = Math.floor(t * 8) % 4; bob = walkPhase % 2 === 0 ? 0 : -1; }
  if (anim === 'idle') bob = Math.sin(t * 2) > 0.95 ? -1 : 0;
  let jump = 0;
  if (anim === 'celebrate') jump = -Math.abs(Math.sin(t * 7)) * 8;

  if (anim === 'sleep') {
    // deita o corpo ao longo da cama, com o centro do corpo no ponto de ancoragem
    ctx.translate(0, -3);
    ctx.rotate(pose.lie ?? -Math.PI / 2);
    ctx.translate(0, 24);
  }

  const sitting = anim === 'sit' || anim === 'type';
  const H = 26;
  const baseY = (sitting ? -12 : 0) + bob + jump;
  // função de célula (cx, cy) a partir do topo
  const px = (cx: number, cy: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round((cx - 6) * C), Math.round(baseY + (cy - H) * C), w * C, h * C);
  };

  // sombra no chão
  if (anim !== 'sleep') {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- pernas ---------- */
  const shortPants = cfg.pantsStyle === 1;
  const skirt = cfg.pantsStyle === 2;
  const dress = cfg.shirtStyle === 6;
  const pantsC = cfg.pantsStyle === 3 ? shade(pants, 0.05) : pants;
  if (sitting) {
    // coxas para frente (para a esquerda na vista frontal)
    if (front) {
      px(1, 18, 9, 3, O); px(1, 18, 8, 2, dress ? shirt : pantsC);
      px(0, 20, 3, 5, O); px(0, 20, 2, 4, shortPants || skirt || dress ? skin : pantsC);
      px(-1, 24, 4, 2, shoes); px(-1, 25, 4, 1, shade(shoes, -0.3));
    } else {
      px(3, 18, 7, 3, dress ? shirt : pantsC);
    }
  } else {
    const legOff = anim === 'walk' ? [0, 1, 0, -1][walkPhase] : 0;
    const legL = (dx: number, lift: number) => {
      const top = 18;
      px(dx, top, 3, 6 - lift, shortPants || skirt ? skin : pantsC);
      if (shortPants || skirt) px(dx, top, 3, 2, skirt ? pants : pantsC);
      px(dx - (front ? 1 : 0), 24 - lift, 4, 2, shoes);
      px(dx - (front ? 1 : 0), 25 - lift, 4, 1, shade(shoes, -0.3));
    };
    legL(3, Math.max(0, legOff));
    legL(7, Math.max(0, -legOff));
    if (skirt) px(2, 17, 9, 4, pants);
  }

  /* ---------- tronco ---------- */
  const torsoTop = 10;
  const shirtC = shirt;
  px(2, torsoTop, 9, dress ? 10 : 8, O);
  px(2, torsoTop, 9, dress ? 9 : 8, shirtC);
  px(2, torsoTop + 7, 9, 1, shade(shirtC, -0.2));
  if (cfg.shirtStyle === 1) { px(2, torsoTop, 2, 3, skin); px(9, torsoTop, 2, 3, skin); }
  if (cfg.shirtStyle === 2) { px(5, torsoTop, 3, 2, '#ffffff'); px(6, torsoTop + 2, 1, 6, shade(shirtC, -0.15)); }
  if (cfg.shirtStyle === 3) { px(3, torsoTop - 1, 7, 2, shade(shirtC, -0.15)); px(5, torsoTop + 4, 3, 2, shade(shirtC, -0.2)); }
  if (cfg.shirtStyle === 4) { px(2, torsoTop, 3, 8, '#22222a'); px(8, torsoTop, 3, 8, '#22222a'); px(5, torsoTop, 3, 8, '#f4f4f4'); px(6, torsoTop, 1, 6, shirtC); }
  if (cfg.shirtStyle === 5) { px(6, torsoTop, 1, 8, shade(shirtC, -0.35)); px(2, torsoTop, 9, 1, shade(shirtC, 0.2)); }
  if (cfg.shirtStyle === 7) { for (let r = 0; r < 4; r++) px(2, torsoTop + 1 + r * 2, 9, 1, shade(shirtC, -0.3)); }
  if (!front) px(3, torsoTop, 7, 1, shade(shirtC, -0.1));

  /* ---------- braços ---------- */
  const armC = cfg.shirtStyle === 1 ? skin : cfg.shirtStyle === 4 ? '#22222a' : shirtC;
  if (anim === 'celebrate') {
    px(0, 4, 2, 7, armC); px(0, 2, 2, 2, skin);
    px(11, 4, 2, 7, armC); px(11, 2, 2, 2, skin);
  } else if (anim === 'type' || anim === 'use') {
    const k = Math.floor(t * 10) % 2;
    px(0, torsoTop + 1, 2, 4, armC); px(-2, torsoTop + 4 + k, 3, 2, skin);
    px(11, torsoTop + 1, 2, 4, armC); px(9, torsoTop + 5 - k, 3, 2, skin);
  } else if (anim === 'drink') {
    px(0, torsoTop + 1, 2, 7, armC); px(0, torsoTop + 8, 2, 2, skin);
    px(11, torsoTop + 1, 2, 3, armC); px(9, torsoTop + 2, 3, 2, skin); px(8, torsoTop, 2, 3, '#f4f4f4');
  } else {
    const sw = anim === 'walk' ? [0, 1, 0, -1][walkPhase] : 0;
    px(0, torsoTop + 1 + sw, 2, 7, armC); px(0, torsoTop + 8 + sw, 2, 2, skin);
    px(11, torsoTop + 1 - sw, 2, 7, armC); px(11, torsoTop + 8 - sw, 2, 2, skin);
  }
  if (cfg.accessory === 8) px(11, torsoTop + 7, 2, 1, '#e2b53f');

  /* ---------- cabeça ---------- */
  px(5, 9, 3, 1, shade(skin, -0.15)); // pescoço
  px(2, 1, 9, 9, O);
  px(3, 1, 7, 8, skin);
  px(3, 8, 7, 1, shade(skin, -0.12));
  if (front) px(2, 4, 1, 2, skin); // orelha

  // rosto
  if (front) {
    const sleeping = anim === 'sleep';
    const happy = anim === 'celebrate';
    const blink = !sleeping && Math.sin(t * 1.3 + cfg.skin) > 0.985;
    const ey = 5;
    const eyesStyle = cfg.eyes % 4;
    if (sleeping || blink || eyesStyle === 2) { px(3, ey, 2, 1, O); px(7, ey, 2, 1, O); }
    else if (happy || eyesStyle === 3) { px(3, ey - 1, 2, 1, O); px(7, ey - 1, 2, 1, O); px(3, ey, 1, 1, skin); }
    else if (eyesStyle === 1) { px(3, ey - 1, 2, 2, '#ffffff'); px(7, ey - 1, 2, 2, '#ffffff'); px(3, ey, 1, 1, O); px(7, ey, 1, 1, O); }
    else { px(3, ey, 1, 1, O); px(7, ey, 1, 1, O); }
    // bochechas
    px(3, 6, 1, 1, 'rgba(230,110,110,0.35)');
    const m = happy ? 2 : sleeping ? 1 : cfg.mouth % 4;
    if (m === 0) { px(4, 7, 3, 1, '#8a3b3b'); px(3, 6, 1, 1, '#8a3b3b'); }
    else if (m === 1) px(4, 7, 3, 1, '#8a3b3b');
    else if (m === 2) { px(4, 7, 3, 2, '#6b2222'); px(5, 8, 1, 1, '#e88'); }
    else { px(5, 7, 3, 1, '#8a3b3b'); px(7, 6, 1, 1, '#8a3b3b'); }
    // barba
    const beard = cfg.beard % 4;
    if (beard === 1) px(4, 6, 4, 1, hair);
    if (beard === 2) { px(4, 6, 4, 1, hair); px(5, 8, 2, 1, hair); }
    if (beard === 3) { px(3, 6, 7, 1, hair); px(3, 7, 1, 2, hair); px(8, 7, 2, 2, hair); px(3, 8, 7, 1, hair); px(4, 7, 3, 1, '#8a3b3b'); }
  }

  // cabelo
  const hs = cfg.hairStyle % HAIR_STYLES.length;
  const hl = shade(hair, 0.18);
  if (hs !== 0) {
    if (front) {
      switch (hs) {
        case 1: px(2, 0, 9, 3, hair); px(9, 2, 2, 3, hair); px(4, 0, 4, 1, hl); break;
        case 2: px(2, 0, 9, 3, hair); px(3, -2, 6, 2, hair); px(9, 2, 2, 3, hair); px(4, -2, 3, 1, hl); break;
        case 3: px(2, 0, 9, 3, hair); px(8, 2, 3, 9, hair); px(2, 2, 1, 5, hair); px(4, 0, 4, 1, hl); break;
        case 4: px(0, -3, 13, 7, hair); px(0, 3, 3, 4, hair); px(10, 3, 3, 4, hair); px(3, -3, 5, 1, hl); break;
        case 5: px(2, 0, 9, 3, hair); px(9, 2, 2, 3, hair); px(11, 2, 2, 7, hair); px(4, 0, 4, 1, hl); break;
        case 6: px(5, -3, 3, 4, hair); px(5, -3, 3, 1, hl); px(3, 1, 7, 1, shade(skin, -0.2)); break;
        case 7: px(2, 0, 9, 3, hair); px(2, 2, 5, 3, hair); px(9, 2, 2, 4, hair); px(3, 0, 4, 1, hl); break;
        case 8: px(2, 0, 9, 3, hair); px(4, -3, 5, 3, hair); px(9, 2, 2, 3, hair); px(5, -3, 2, 1, hl); break;
        case 9: px(1, -1, 11, 4, hair); px(1, 2, 2, 5, hair); px(10, 2, 2, 5, hair); for (let i = 0; i < 5; i++) px(1 + i * 2, -1, 1, 1, hl); break;
      }
    } else {
      // de costas: cabelo cobre a cabeça
      switch (hs) {
        case 6: px(5, -3, 3, 11, hair); break;
        case 3: px(2, 0, 9, 11, hair); break;
        case 4: px(0, -3, 13, 11, hair); break;
        case 5: px(2, 0, 9, 7, hair); px(5, 7, 3, 6, hair); break;
        case 8: px(2, 0, 9, 7, hair); px(4, -3, 5, 3, hair); break;
        case 9: px(1, -1, 11, 9, hair); break;
        default: px(2, 0, 9, 7, hair); px(3, 0, 6, 1, hl);
      }
    }
  }

  // acessórios
  const acc = cfg.accessory % ACCESSORIES.length;
  if (acc === 1 && front) { px(2, 4, 4, 2, O); px(6, 4, 4, 2, O); px(3, 5, 2, 1, '#a8d8ff'); px(7, 5, 2, 1, '#a8d8ff'); }
  if (acc === 6 && front) { px(2, 4, 9, 2, '#111'); px(3, 4, 2, 1, '#555'); }
  if (acc === 2) { px(2, -1, 9, 3, '#c0392b'); px(front ? -1 : 9, 1, 4, 1, shade('#c0392b', -0.2)); px(5, -1, 2, 1, '#fff'); }
  if (acc === 3) { px(2, -1, 9, 1, '#222'); px(1, 3, 2, 4, '#222'); px(10, 3, 2, 4, '#222'); px(1, 4, 1, 2, '#e33'); }
  if (acc === 4) { px(3, torsoTop, 7, 1, '#e2b53f'); px(5, torsoTop + 1, 3, 2, '#e2b53f'); px(6, torsoTop + 2, 1, 1, '#fff3b0'); }
  if (acc === 5 && front) { px(4, torsoTop, 2, 2, '#c0392b'); px(7, torsoTop, 2, 2, '#c0392b'); px(6, torsoTop, 1, 2, '#8e2a20'); }
  if (acc === 7) { px(3, -2, 7, 2, '#e2b53f'); px(3, -4, 1, 2, '#e2b53f'); px(6, -4, 1, 2, '#e2b53f'); px(9, -4, 1, 2, '#e2b53f'); px(6, -2, 1, 1, '#e33'); }
  if (acc === 9) { px(0, 0, 13, 1, '#111'); px(3, -4, 7, 4, '#111'); px(3, -1, 7, 1, '#c0392b'); }

  ctx.restore();

  if (anim === 'sleep') {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px monospace';
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.6 + i / 3) % 1;
      ctx.globalAlpha = 1 - p;
      ctx.fillText('z', 6 + p * 10 + i * 2, -18 - p * 18);
    }
    ctx.restore();
  }
}

/** Desenha um avatar em um canvas próprio (pré-visualização) */
export function renderAvatarPreview(canvas: HTMLCanvasElement, cfg: AvatarConfig, pose: AvatarPose, scale = 3) {
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, canvas.width / 2, canvas.height - 6 * scale);
  drawAvatar(ctx, cfg, pose);
}
