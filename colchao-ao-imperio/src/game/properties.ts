/**
 * Imóveis: cada um é um ambiente com dimensões, formato de paredes, estilos padrão,
 * móveis fixos e (em alguns) funcionários NPC.
 */
export interface PropertyDef {
  id: string;
  order: number;
  name: string;
  desc: string;
  w: number;
  d: number;
  maxExpansion: number;
  wallH: number;
  floor: string;
  wall: string;
  light: string;
  price: number; // moedas virtuais
  req: { level: number; gainCents: number };
  /** móveis colocados ao desbloquear (ganhos, não comprados) */
  starter: { defId: string; x: number; y: number; rot: number; locked?: boolean }[];
  npcs: number;
  /** cor de fundo do "exterior" */
  outside: string;
  /** colunas internas / paredes divisórias (tiles bloqueados com fixo) */
}

type Starter = PropertyDef['starter'][number];
/** Fileiras de estações de trabalho: mesa + monitor + teclado + cadeira virada para a mesa. */
function stations(x0: number, y0: number, cols: number, rows: number, opts: { dx?: number; dy?: number; desk?: string; chair?: string; mon?: string; pc?: string } = {}): Starter[] {
  const { dx = 3, dy = 3, desk = 'mesa-escritorio-gray', chair = 'cadeira-acolchoada-navy', mon = 'monitor-24-black', pc } = opts;
  const out: Starter[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + c * dx, y = y0 + r * dy;
    out.push({ defId: desk, x, y, rot: 0 }, { defId: mon, x, y, rot: 0 }, { defId: 'teclado-basico', x, y, rot: 0 }, { defId: chair, x, y: y + 1, rot: 2 });
    if (pc) out.push({ defId: pc, x: x + 1, y, rot: 0 });
  }
  return out;
}

export const PROPERTIES: PropertyDef[] = [
  {
    id: 'p01-quarto-precario', order: 1, name: 'Quarto extremamente precário', desc: 'Um cubículo de 4x4 com cheiro de mofo. Mas é seu.',
    w: 4, d: 4, maxExpansion: 2, wallH: 2.6, floor: 'piso-cimento-sujo', wall: 'parede-descascada', light: 'sombria', price: 0,
    req: { level: 1, gainCents: 0 }, npcs: 0, outside: '#0e0c14',
    starter: [
      { defId: 'colchao-chao', x: 0, y: 2, rot: 0 },
      { defId: 'mesa-improvisada', x: 2, y: 0, rot: 0 },
      { defId: 'monitor-tubo', x: 2, y: 0, rot: 0 },
      { defId: 'pc-amarelado', x: 3, y: 0, rot: 0 },
      { defId: 'teclado-velho', x: 2, y: 0, rot: 0 },
      { defId: 'mouse-bolinha', x: 2, y: 0, rot: 0 },
      { defId: 'cadeira-plastico-branca', x: 2, y: 1, rot: 2 },
      { defId: 'lampada-pendurada', x: 2, y: 2, rot: 0 },
      { defId: 'fios-chao', x: 2, y: 1, rot: 0 },
      { defId: 'janela-velha', x: 1, y: 0, rot: 1 },
      { defId: 'porta-velha', x: 0, y: 3, rot: 0 },
      { defId: 'planta-morta', x: 0, y: 0, rot: 0 },
      { defId: 'poster-rasgado', x: 0, y: 1, rot: 0 },
    ],
  },
  {
    id: 'p02-quarto-reformado', order: 2, name: 'Quarto simples reformado', desc: 'Paredes pintadas e piso que não solta. Luxo!',
    w: 5, d: 5, maxExpansion: 2, wallH: 2.7, floor: 'piso-ceramica-branca', wall: 'parede-branca', light: 'quente', price: 150,
    req: { level: 3, gainCents: 10000 }, npcs: 0, outside: '#121222',
    starter: [{ defId: 'janela-simples', x: 1, y: 0, rot: 1 }, { defId: 'porta-branca', x: 0, y: 3, rot: 0 }, { defId: 'colchao-novo', x: 0, y: 3, rot: 0 }],
  },
  {
    id: 'p03-quarto-gamer-basico', order: 3, name: 'Quarto gamer básico', desc: 'Espaço para um setup decente e uma fita de LED.',
    w: 6, d: 5, maxExpansion: 2, wallH: 2.7, floor: 'piso-laminado', wall: 'parede-grafite', light: 'neon', price: 400,
    req: { level: 5, gainCents: 30000 }, npcs: 0, outside: '#100c1c',
    starter: [{ defId: 'janela-dupla', x: 1, y: 0, rot: 1 }, { defId: 'porta-branca', x: 0, y: 4, rot: 0 }],
  },
  {
    id: 'p04-quarto-gamer-completo', order: 4, name: 'Quarto gamer completo', desc: 'Suíte com espaço para cama de casal e estação de stream.',
    w: 7, d: 6, maxExpansion: 2, wallH: 2.8, floor: 'piso-madeira-escura', wall: 'parede-gamer', light: 'neon', price: 900,
    req: { level: 8, gainCents: 100000 }, npcs: 0, outside: '#0c0a18',
    starter: [{ defId: 'janela-madeira', x: 2, y: 0, rot: 1 }, { defId: 'porta-madeira', x: 0, y: 5, rot: 0 }],
  },
  {
    id: 'p05-home-office', order: 5, name: 'Pequeno escritório doméstico', desc: 'Um cômodo só para trabalhar. Produtividade nível 2.',
    w: 7, d: 7, maxExpansion: 2, wallH: 2.8, floor: 'piso-madeira', wall: 'parede-verde', light: 'quente', price: 1600,
    req: { level: 11, gainCents: 250000 }, npcs: 0, outside: '#14141f',
    starter: [{ defId: 'janela-panoramica', x: 2, y: 0, rot: 1 }, { defId: 'porta-madeira', x: 0, y: 5, rot: 0 }, { defId: 'estante-livros-wood', x: 0, y: 5, rot: 1 }],
  },
  {
    id: 'p06-escritorio-alugado', order: 6, name: 'Escritório alugado', desc: 'Sala comercial com carpete e ar-condicionado central (que nunca funciona).',
    w: 9, d: 8, maxExpansion: 2, wallH: 3.0, floor: 'piso-carpete-cinza', wall: 'parede-cinza', light: 'fria', price: 2800,
    req: { level: 14, gainCents: 500000 }, npcs: 1, outside: '#121826',
    starter: [{ defId: 'fixo-janelao', x: 2, y: 0, rot: 1 }, { defId: 'porta-vidro', x: 0, y: 6, rot: 0 }, { defId: 'bebedouro', x: 8, y: 1, rot: 0 }, ...stations(2, 3, 2, 1, { desk: 'mesa-madeira-white', chair: 'cadeira-acolchoada-gray' }), { defId: 'planta-fern-g-0', x: 8, y: 6, rot: 0 }],
  },
  {
    id: 'p07-escritorio-funcionarios', order: 7, name: 'Escritório com funcionários', desc: 'Agora você tem equipe. E folha de pagamento (virtual).',
    w: 11, d: 9, maxExpansion: 2, wallH: 3.0, floor: 'piso-carpete-placa', wall: 'parede-branca', light: 'fria', price: 4500,
    req: { level: 18, gainCents: 1000000 }, npcs: 4, outside: '#101624',
    starter: [{ defId: 'fixo-janelao', x: 3, y: 0, rot: 1 }, { defId: 'porta-vidro', x: 0, y: 8, rot: 0 }, ...stations(2, 2, 3, 2, { dy: 4 }), { defId: 'bebedouro', x: 10, y: 1, rot: 0 }, { defId: 'impressora', x: 10, y: 4, rot: 0 }, { defId: 'quadro-branco', x: 0, y: 2, rot: 0 }],
  },
  {
    id: 'p08-escritorio-empresarial', order: 8, name: 'Escritório empresarial', desc: 'Andar inteiro com recepção e sala de reunião.',
    w: 13, d: 10, maxExpansion: 2, wallH: 3.2, floor: 'piso-porcelanato', wall: 'parede-concreto', light: 'neutra', price: 7000,
    req: { level: 22, gainCents: 2000000 }, npcs: 6, outside: '#0e1422',
    starter: [{ defId: 'fixo-janelao', x: 2, y: 0, rot: 1 }, { defId: 'fixo-janelao', x: 6, y: 0, rot: 1 }, { defId: 'porta-dupla', x: 0, y: 7, rot: 0 }, { defId: 'fixo-coluna', x: 6, y: 5, rot: 0, locked: true }, ...stations(1, 2, 2, 2, { dy: 4, chair: 'cadeira-ergonomica', mon: 'monitor-27' }), { defId: 'mesa-reuniao', x: 8, y: 2, rot: 0 }, { defId: 'recepcao', x: 8, y: 7, rot: 0 }, { defId: 'sofa-3-gray', x: 9, y: 9, rot: 2 }],
  },
  {
    id: 'p09-sede-corporativa', order: 9, name: 'Sede corporativa', desc: 'Seu nome na fachada. Elevador privativo.',
    w: 15, d: 12, maxExpansion: 2, wallH: 3.4, floor: 'piso-marmore', wall: 'parede-madeira', light: 'quente', price: 11000,
    req: { level: 27, gainCents: 4000000 }, npcs: 8, outside: '#0c1220',
    starter: [{ defId: 'fixo-elevador', x: 0, y: 7, rot: 0, locked: true }, { defId: 'fixo-janelao', x: 2, y: 0, rot: 1 }, { defId: 'fixo-janelao', x: 7, y: 0, rot: 1 }, { defId: 'fixo-coluna', x: 5, y: 6, rot: 0, locked: true }, { defId: 'fixo-coluna', x: 10, y: 6, rot: 0, locked: true }, ...stations(1, 2, 3, 3, { dy: 3, chair: 'cadeira-ergonomica', mon: 'monitor-27', desk: 'mesa-escritorio-wood' }), { defId: 'mesa-executiva', x: 11, y: 2, rot: 0 }, { defId: 'cadeira-executiva-black', x: 12, y: 3, rot: 2 }, { defId: 'estante-alta', x: 13, y: 0, rot: 0 }],
  },
  {
    id: 'p10-predio-comercial', order: 10, name: 'Prédio comercial', desc: 'Um prédio inteiro. Este é o saguão principal.',
    w: 17, d: 13, maxExpansion: 2, wallH: 3.8, floor: 'piso-marmore', wall: 'parede-vidro', light: 'neutra', price: 16000,
    req: { level: 32, gainCents: 7500000 }, npcs: 10, outside: '#0a1020',
    starter: [{ defId: 'fixo-elevador', x: 0, y: 6, rot: 0, locked: true }, { defId: 'fixo-elevador', x: 0, y: 10, rot: 0, locked: true }, { defId: 'recepcao', x: 7, y: 4, rot: 0 }, { defId: 'fixo-coluna', x: 4, y: 7, rot: 0, locked: true }, { defId: 'fixo-coluna', x: 12, y: 7, rot: 0, locked: true }, { defId: 'sofa-moderno', x: 2, y: 9, rot: 0 }, { defId: 'sofa-moderno', x: 12, y: 9, rot: 0 }, { defId: 'planta-palm-g-1', x: 1, y: 1, rot: 0 }, { defId: 'planta-palm-g-1', x: 15, y: 1, rot: 0 }, ...stations(1, 4, 2, 1, { mon: 'monitor-27', chair: 'cadeira-ergonomica' })],
  },
  {
    id: 'p11-arranha-ceu', order: 11, name: 'Arranha-céu', desc: 'Cobertura no 80º andar com vista para a cidade inteira.',
    w: 18, d: 15, maxExpansion: 2, wallH: 4.0, floor: 'piso-marmore-preto', wall: 'parede-vidro', light: 'quente', price: 24000,
    req: { level: 38, gainCents: 15000000 }, npcs: 12, outside: '#070b18',
    starter: [{ defId: 'fixo-janelao', x: 1, y: 0, rot: 1 }, { defId: 'fixo-janelao', x: 6, y: 0, rot: 1 }, { defId: 'fixo-janelao', x: 11, y: 0, rot: 1 }, { defId: 'fixo-janelao', x: 0, y: 2, rot: 0 }, { defId: 'fixo-janelao', x: 0, y: 8, rot: 0 }, { defId: 'fixo-elevador', x: 0, y: 12, rot: 0, locked: true }, { defId: 'mesa-executiva', x: 7, y: 5, rot: 0 }, { defId: 'monitor-triplo', x: 7, y: 5, rot: 0 }, { defId: 'cadeira-executiva-darkwood', x: 8, y: 6, rot: 2 }, { defId: 'sofa-chester-black', x: 3, y: 10, rot: 0 }, { defId: 'tapete-persian-0', x: 3, y: 8, rot: 0 }, ...stations(11, 4, 2, 3, { dy: 3, chair: 'cadeira-ergonomica', mon: 'monitor-27' })],
  },
  {
    id: 'p12-complexo-luxo', order: 12, name: 'Complexo empresarial de luxo', desc: 'O império. Mármore, ouro e um piano que ninguém toca.',
    w: 20, d: 18, maxExpansion: 2, wallH: 4.4, floor: 'piso-ouro', wall: 'parede-dourada', light: 'quente', price: 36000,
    req: { level: 45, gainCents: 30000000 }, npcs: 16, outside: '#140c06',
    starter: [{ defId: 'porta-cofre', x: 0, y: 9, rot: 0, locked: true }, { defId: 'fixo-janelao', x: 2, y: 0, rot: 1 }, { defId: 'fixo-janelao', x: 9, y: 0, rot: 1 }, { defId: 'lustre-cristal', x: 9, y: 8, rot: 0 }, { defId: 'tapete-vermelho', x: 9, y: 1, rot: 0 }, { defId: 'mesa-executiva', x: 8, y: 11, rot: 0 }, { defId: 'cadeira-luxo', x: 9, y: 12, rot: 2 }, { defId: 'piano', x: 2, y: 13, rot: 0 }, ...stations(13, 3, 2, 4, { dy: 3, chair: 'cadeira-executiva-black', mon: 'monitor-27', desk: 'mesa-vidro' }), ...stations(2, 3, 2, 2, { dy: 4, chair: 'cadeira-ergonomica', mon: 'monitor-27', desk: 'mesa-escritorio-white' })],
  },
];

export const PROPERTIES_BY_ID: Record<string, PropertyDef> = Object.fromEntries(PROPERTIES.map((p) => [p.id, p]));
export const getProperty = (id: string) => PROPERTIES_BY_ID[id];

export function roomSize(p: PropertyDef, expansion: number) {
  return { w: p.w + expansion, d: p.d + expansion };
}

export function expansionPrice(p: PropertyDef, next: number) {
  return Math.round((60 + p.order * 80) * next * (p.order < 3 ? 1 : 1.5));
}

/** Ambiente extra fora da progressão do jogo (ex.: Escritório dos robôs). */
export function registerProperty(p: PropertyDef) { PROPERTIES_BY_ID[p.id] = p; return p; }
