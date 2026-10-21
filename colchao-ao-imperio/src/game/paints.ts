import { hsl, shade, withAlpha } from '../engine/iso';
import type { Paint } from '../engine/prims';

/** Pinturas reutilizáveis para faces de móveis (coordenadas da face, 32 px = 1 unidade). */

export const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

/** Tela de monitor com conteúdo animado */
export function screenPaint(kind: 'code' | 'chart' | 'game' | 'crt' | 'off' | 'tv' | 'finance' | 'retro', bezel = 2, bezelColor = '#111'): Paint {
  return (ctx, w, h, t) => {
    rect(ctx, 0, 0, w, h, bezelColor);
    const x = bezel, y = bezel, W = w - bezel * 2, H = h - bezel * 2;
    if (W <= 0 || H <= 0) return;
    const glow = 0.85 + 0.15 * Math.sin(t * 2);
    if (kind === 'off') { rect(ctx, x, y, W, H, '#1a1d24'); rect(ctx, x + 1, y + 1, W * 0.3, 1, '#2c313b'); return; }
    if (kind === 'crt') {
      rect(ctx, x, y, W, H, `rgba(30,70,40,${glow})`);
      ctx.fillStyle = '#7dff9a';
      for (let i = 0; i < Math.floor(H / 3); i++) {
        const len = ((i * 37 + Math.floor(t * 2)) % 7) / 7;
        ctx.fillRect(x + 2, y + 2 + i * 3, Math.max(2, (W - 4) * len), 1);
      }
      if (Math.floor(t * 2) % 2) rect(ctx, x + 2, y + H - 4, 2, 2, '#7dff9a');
      return;
    }
    if (kind === 'code') {
      rect(ctx, x, y, W, H, '#1b2133');
      const cols = ['#ff79c6', '#8be9fd', '#50fa7b', '#f1fa8c', '#bd93f9'];
      const lines = Math.floor((H - 2) / 3);
      const off = Math.floor(t * 3);
      for (let i = 0; i < lines; i++) {
        const k = (i + off) % 11;
        ctx.fillStyle = cols[k % cols.length];
        const ind = (k % 3) * 3;
        ctx.fillRect(x + 2 + ind, y + 2 + i * 3, Math.max(2, ((k * 13) % (W - 6 - ind)) + 3), 1);
      }
      return;
    }
    if (kind === 'chart' || kind === 'finance') {
      rect(ctx, x, y, W, H, '#10241c');
      ctx.strokeStyle = '#3bd67a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= W - 4; i += 2) {
        const v = Math.sin(i * 0.3 + t * 1.5) * 0.25 + i / (W * 1.4);
        const py = y + H - 3 - v * (H - 6) - (H - 6) * 0.15;
        if (i === 0) ctx.moveTo(x + 2 + i, py); else ctx.lineTo(x + 2 + i, py);
      }
      ctx.stroke();
      if (kind === 'finance') { rect(ctx, x + 2, y + 2, 6, 2, '#ffd34d'); }
      return;
    }
    if (kind === 'game' || kind === 'retro') {
      rect(ctx, x, y, W, H, kind === 'retro' ? '#000' : '#203a6b');
      rect(ctx, x, y + H * 0.65, W, H * 0.35, kind === 'retro' ? '#2b2b6b' : '#3d8b3d');
      const px = x + ((t * 20) % Math.max(1, W - 4));
      rect(ctx, px, y + H * 0.65 - 4, 3, 4, '#ff5555');
      rect(ctx, x + W * 0.7, y + H * 0.3, 4, 3, '#ffd34d');
      return;
    }
    // tv
    const hue = (t * 40) % 360;
    rect(ctx, x, y, W, H, hsl(hue, 45, 35));
    rect(ctx, x + W * 0.2, y + H * 0.3, W * 0.6, H * 0.4, hsl(hue + 120, 50, 55));
  };
}

export function drawersPaint(rows: number, c: string, handle = '#d9c38f', cols = 1): Paint {
  return (ctx, w, h) => {
    const gap = 2;
    const rh = (h - gap * (rows + 1)) / rows;
    const cw = (w - gap * (cols + 1)) / cols;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const x = gap + k * (cw + gap), y = gap + r * (rh + gap);
      rect(ctx, x, y, cw, rh, shade(c, -0.08));
      rect(ctx, x, y, cw, 1, shade(c, 0.12));
      rect(ctx, x + cw / 2 - 3, y + rh / 2 - 1, 6, 2, handle);
    }
  };
}

export function doorsPaint(c: string, n = 2, handle = '#c9c9c9'): Paint {
  return (ctx, w, h) => {
    const dw = w / n;
    for (let i = 0; i < n; i++) {
      rect(ctx, i * dw + 1, 1, dw - 2, h - 2, shade(c, -0.05));
      rect(ctx, i * dw + 2, 2, dw - 4, 1, shade(c, 0.15));
      const hx = i % 2 === 0 ? i * dw + dw - 5 : i * dw + 3;
      rect(ctx, hx, h * 0.45, 2, 6, handle);
    }
  };
}

export function booksPaint(shelves: number, frame: string, seed = 1): Paint {
  return (ctx, w, h) => {
    rect(ctx, 0, 0, w, h, shade(frame, -0.35));
    const sh = h / shelves;
    const cols = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#ecf0f1', '#d35400', '#16a085'];
    for (let s = 0; s < shelves; s++) {
      const y0 = s * sh;
      rect(ctx, 0, y0 + sh - 2, w, 2, frame);
      let x = 2;
      let k = seed * 7 + s * 3;
      while (x < w - 3) {
        const bw = 2 + (k % 3);
        const bh = sh * (0.55 + ((k * 13) % 10) / 30);
        if ((k * 5) % 9 === 0) { x += bw + 1; k++; continue; }
        rect(ctx, x, y0 + sh - 2 - bh, bw, bh, cols[k % cols.length]);
        rect(ctx, x, y0 + sh - 2 - bh, bw, 1, 'rgba(255,255,255,0.25)');
        x += bw;
        k++;
      }
    }
    rect(ctx, 0, 0, 2, h, frame);
    rect(ctx, w - 2, 0, 2, h, frame);
  };
}

export function keysPaint(base: string, rgb = false): Paint {
  return (ctx, w, h, t) => {
    rect(ctx, 0, 0, w, h, base);
    const kw = 3, kh = 2;
    for (let r = 0; r < Math.floor((h - 2) / (kh + 1)); r++) {
      for (let c = 0; c < Math.floor((w - 2) / (kw + 1)); c++) {
        ctx.fillStyle = rgb ? hsl(c * 18 + r * 30 + t * 120, 90, 60) : shade(base, 0.35);
        ctx.fillRect(1 + c * (kw + 1), 1 + r * (kh + 1), kw, kh);
      }
    }
  };
}

export function fanPaint(count: number, rgb: boolean, frame: string, glass = true): Paint {
  return (ctx, w, h, t) => {
    rect(ctx, 0, 0, w, h, glass ? 'rgba(25,30,45,0.95)' : frame);
    if (glass) { rect(ctx, 1, 1, w - 2, h - 2, 'rgba(60,70,95,0.6)'); }
    const r = Math.min(w * 0.33, (h / count) * 0.4);
    for (let i = 0; i < count; i++) {
      const cx = w * 0.62, cy = (h / count) * (i + 0.5);
      ctx.save();
      ctx.translate(cx, cy);
      const col = rgb ? hsl(t * 90 + i * 70, 95, 60) : '#8892a6';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.rotate(t * 12 + i);
      ctx.fillStyle = rgb ? withAlpha('#ffffff', 0.4) : '#5b6475';
      for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.fillRect(0, -1, r * 0.85, 2); }
      ctx.restore();
    }
    if (glass) {
      // placa-mãe
      rect(ctx, 2, 3, w * 0.35, h * 0.5, '#1f4d2e');
      rect(ctx, 4, 5, 4, 3, '#999');
      if (rgb) rect(ctx, 2, h - 4, w - 4, 2, hsl(t * 90, 95, 60));
    }
  };
}

export function pcFrontPaint(c: string, led: string, bays = 2): Paint {
  return (ctx, w, h, t) => {
    rect(ctx, 0, 0, w, h, c);
    for (let i = 0; i < bays; i++) {
      rect(ctx, 2, 3 + i * 5, w - 4, 4, shade(c, -0.15));
      rect(ctx, 3, 4 + i * 5, w - 6, 1, shade(c, 0.12));
    }
    const on = Math.sin(t * 6) > -0.3;
    rect(ctx, w / 2 - 1, h - 6, 3, 3, on ? led : shade(led, -0.6));
    rect(ctx, w / 2 - 2, h - 11, 5, 3, shade(c, -0.25));
  };
}

export function plankPaint(c: string, vertical = false): Paint {
  return (ctx, w, h) => {
    rect(ctx, 0, 0, w, h, c);
    ctx.fillStyle = shade(c, -0.18);
    if (vertical) for (let x = 6; x < w; x += 7) ctx.fillRect(x, 0, 1, h);
    else for (let y = 5; y < h; y += 6) ctx.fillRect(0, y, w, 1);
  };
}

export function cushionPaint(c: string, n: number): Paint {
  return (ctx, w, h) => {
    const cw = w / n;
    for (let i = 0; i < n; i++) {
      rect(ctx, i * cw + 1, 1, cw - 2, h - 2, c);
      rect(ctx, i * cw + 2, 2, cw - 4, 1, shade(c, 0.2));
      rect(ctx, i * cw + 1, h - 2, cw - 2, 1, shade(c, -0.2));
    }
  };
}

export function stripesPaint(a: string, b: string, size = 4, diag = false): Paint {
  return (ctx, w, h) => {
    rect(ctx, 0, 0, w, h, a);
    ctx.fillStyle = b;
    if (diag) {
      for (let i = -h; i < w; i += size * 2) {
        ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + size, h); ctx.lineTo(i + size + h, 0); ctx.lineTo(i + h, 0); ctx.fill();
      }
    } else for (let x = 0; x < w; x += size * 2) ctx.fillRect(x, 0, size, h);
  };
}

export function rugPaint(kind: 'plain' | 'border' | 'stripes' | 'circle' | 'persian' | 'checker' | 'shaggy' | 'gamer' | 'money', a: string, b: string): Paint {
  return (ctx, w, h, t) => {
    rect(ctx, 0, 0, w, h, a);
    if (kind === 'border') { ctx.strokeStyle = b; ctx.lineWidth = 3; ctx.strokeRect(4, 4, w - 8, h - 8); }
    if (kind === 'stripes') { ctx.fillStyle = b; for (let y = 4; y < h; y += 10) ctx.fillRect(0, y, w, 4); }
    if (kind === 'checker') { ctx.fillStyle = b; for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 8 : 0; x < w; x += 16) ctx.fillRect(x, y, 8, 8); }
    if (kind === 'circle') { ctx.fillStyle = b; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.35, h * 0.35, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = a; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.2, h * 0.2, 0, 0, Math.PI * 2); ctx.fill(); }
    if (kind === 'persian') {
      ctx.strokeStyle = b; ctx.lineWidth = 2; ctx.strokeRect(3, 3, w - 6, h - 6); ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(w / 2, 14); ctx.lineTo(w - 14, h / 2); ctx.lineTo(w / 2, h - 14); ctx.lineTo(14, h / 2); ctx.fill();
      ctx.fillStyle = shade(a, 0.3); ctx.fillRect(w / 2 - 3, h / 2 - 3, 6, 6);
    }
    if (kind === 'shaggy') { for (let i = 0; i < w * h / 12; i++) { const x = (i * 37) % w, y = (i * 53) % h; rect(ctx, x, y, 1, 2, i % 2 ? shade(a, 0.2) : shade(a, -0.15)); } }
    if (kind === 'gamer') { ctx.strokeStyle = hsl(t * 60, 90, 55); ctx.lineWidth = 2; ctx.strokeRect(2, 2, w - 4, h - 4); rect(ctx, w / 2 - 6, h / 2 - 2, 12, 4, b); rect(ctx, w / 2 - 2, h / 2 - 6, 4, 12, b); }
    if (kind === 'money') { ctx.fillStyle = b; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', w / 2, h / 2); ctx.strokeStyle = b; ctx.strokeRect(3, 3, w - 6, h - 6); }
  };
}

export function framePaint(inner: Paint, frame: string, border = 2): Paint {
  return (ctx, w, h, t) => {
    rect(ctx, 0, 0, w, h, frame);
    rect(ctx, 0, 0, w, 1, shade(frame, 0.3));
    ctx.save();
    ctx.translate(border, border);
    ctx.beginPath(); ctx.rect(0, 0, w - border * 2, h - border * 2); ctx.clip();
    inner(ctx, w - border * 2, h - border * 2, t);
    ctx.restore();
  };
}

export function artPaint(kind: number, seed: number): Paint {
  return (ctx, w, h, t) => {
    const H = (n: number) => (seed * 47 + n * 83) % 360;
    switch (kind % 8) {
      case 0: // paisagem
        rect(ctx, 0, 0, w, h, hsl(H(1), 55, 70));
        rect(ctx, 0, h * 0.6, w, h * 0.4, hsl(H(2), 40, 40));
        ctx.fillStyle = hsl(H(3), 30, 30); ctx.beginPath(); ctx.moveTo(0, h * 0.65); ctx.lineTo(w * 0.35, h * 0.25); ctx.lineTo(w * 0.7, h * 0.65); ctx.fill();
        rect(ctx, w * 0.75, h * 0.15, 4, 4, '#ffe066');
        break;
      case 1: // abstrato
        rect(ctx, 0, 0, w, h, '#f4efe6');
        rect(ctx, w * 0.1, h * 0.1, w * 0.4, h * 0.5, hsl(H(1), 70, 50));
        rect(ctx, w * 0.45, h * 0.4, w * 0.45, h * 0.5, hsl(H(2), 70, 50));
        rect(ctx, w * 0.2, h * 0.65, w * 0.2, h * 0.25, '#222');
        break;
      case 2: // gráfico subindo (finanças)
        rect(ctx, 0, 0, w, h, '#0f1e2e');
        ctx.strokeStyle = '#3bd67a'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(2, h - 3); ctx.lineTo(w * 0.3, h * 0.6); ctx.lineTo(w * 0.5, h * 0.7); ctx.lineTo(w * 0.75, h * 0.3); ctx.lineTo(w - 3, h * 0.12); ctx.stroke();
        break;
      case 3: // retrato
        rect(ctx, 0, 0, w, h, hsl(H(1), 30, 30));
        ctx.fillStyle = '#e8b98f'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.4, w * 0.18, h * 0.2, 0, 0, 7); ctx.fill();
        rect(ctx, w * 0.25, h * 0.65, w * 0.5, h * 0.35, hsl(H(2), 40, 35));
        break;
      case 4: // pôster gamer
        rect(ctx, 0, 0, w, h, '#170f2e');
        for (let i = 0; i < 8; i++) rect(ctx, (i * 13) % w, (i * 7) % (h * 0.5), 1, 1, '#fff');
        rect(ctx, w / 2 - 5, h * 0.45, 10, 8, hsl(H(1) + t * 30, 90, 60));
        rect(ctx, w / 2 - 2, h * 0.45 - 3, 4, 3, '#fff');
        break;
      case 5: // banda / show
        rect(ctx, 0, 0, w, h, hsl(H(1), 80, 45));
        ctx.fillStyle = '#111';
        for (let i = 0; i < 3; i++) ctx.fillRect(w * (0.2 + i * 0.25), h * 0.5, 4, h * 0.4);
        rect(ctx, 2, 2, w - 4, 4, '#111');
        break;
      case 6: // mapa
        rect(ctx, 0, 0, w, h, '#2f6fa6');
        ctx.fillStyle = '#69a85a';
        ctx.fillRect(w * 0.1, h * 0.2, w * 0.25, h * 0.35); ctx.fillRect(w * 0.45, h * 0.15, w * 0.35, h * 0.3); ctx.fillRect(w * 0.55, h * 0.55, w * 0.2, h * 0.3);
        break;
      default: // dinheiro
        rect(ctx, 0, 0, w, h, '#2e7d4f');
        ctx.strokeStyle = '#a5e6b5'; ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = '#d7f5df'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('R$', w / 2, h / 2);
    }
  };
}

export function windowPaint(frame: string, panes: [number, number], old = false, curtain?: string): Paint {
  return (ctx, w, h, t) => {
    // céu conforme o horário real
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    const day = hour > 6 && hour < 18.5;
    const dusk = (hour >= 17.5 && hour < 19) || (hour > 5 && hour <= 6.5);
    const sky1 = day ? (dusk ? '#f7a26b' : '#7cc4ff') : '#0f1638';
    const sky2 = day ? (dusk ? '#ffd2a1' : '#cfeaff') : '#26305c';
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, sky1); g.addColorStop(1, sky2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (!day) for (let i = 0; i < 10; i++) rect(ctx, (i * 29) % w, (i * 17) % (h * 0.6), 1, 1, Math.sin(t + i) > 0 ? '#fff' : '#99a');
    // prédios ao fundo
    ctx.fillStyle = day ? '#8aa4bf' : '#1a2140';
    for (let i = 0; i < 6; i++) { const bw = w / 6; const bh = h * (0.25 + ((i * 37) % 5) / 12); ctx.fillRect(i * bw, h - bh, bw - 1, bh); }
    if (!day) for (let i = 0; i < 14; i++) rect(ctx, (i * 23) % w, h - ((i * 11) % (h * 0.4)) - 2, 1, 1, '#ffd36b');
    if (old) {
      ctx.fillStyle = 'rgba(120,110,80,0.35)'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(w * 0.6, 0); ctx.lineTo(w * 0.4, h * 0.4); ctx.lineTo(w * 0.55, h * 0.5); ctx.stroke();
    }
    ctx.fillStyle = frame;
    const fw = 2;
    ctx.fillRect(0, 0, w, fw); ctx.fillRect(0, h - fw - 1, w, fw + 1); ctx.fillRect(0, 0, fw, h); ctx.fillRect(w - fw, 0, fw, h);
    for (let i = 1; i < panes[0]; i++) ctx.fillRect((w / panes[0]) * i - 1, 0, 2, h);
    for (let i = 1; i < panes[1]; i++) ctx.fillRect(0, (h / panes[1]) * i - 1, w, 2);
    rect(ctx, -2, h - 2, w + 4, 2, shade(frame, -0.2));
    if (curtain) {
      rect(ctx, 0, 0, w * 0.22, h, curtain); rect(ctx, w * 0.78, 0, w * 0.22, h, curtain);
      ctx.fillStyle = shade(curtain, -0.2);
      for (let x = 2; x < w * 0.22; x += 4) { ctx.fillRect(x, 0, 1, h); ctx.fillRect(w - x, 0, 1, h); }
    }
  };
}
