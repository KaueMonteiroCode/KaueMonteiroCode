/** A* em grade 8-direções (sem cortar cantos). grid[x][y] = true quando bloqueado. */
export function findPath(grid: boolean[][], sx: number, sy: number, tx: number, ty: number, allowTargetBlocked = false): [number, number][] | null {
  const W = grid.length, D = grid[0]?.length ?? 0;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < D;
  if (!inb(tx, ty) || !inb(sx, sy)) return null;
  const blocked = (x: number, y: number) => grid[x][y] && !(allowTargetBlocked && x === tx && y === ty) && !(x === sx && y === sy);
  if (blocked(tx, ty)) return null;
  const key = (x: number, y: number) => x * 1000 + y;
  const open = new Map<number, { x: number; y: number; g: number; f: number }>();
  const came = new Map<number, number>();
  const gScore = new Map<number, number>();
  const h = (x: number, y: number) => Math.max(Math.abs(x - tx), Math.abs(y - ty)) + 0.41 * Math.min(Math.abs(x - tx), Math.abs(y - ty));
  open.set(key(sx, sy), { x: sx, y: sy, g: 0, f: h(sx, sy) });
  gScore.set(key(sx, sy), 0);
  const closed = new Set<number>();
  let guard = 0;
  while (open.size && guard++ < 5000) {
    let best: { x: number; y: number; g: number; f: number } | null = null;
    for (const n of open.values()) if (!best || n.f < best.f) best = n;
    const cur = best!;
    const ck = key(cur.x, cur.y);
    if (cur.x === tx && cur.y === ty) {
      const path: [number, number][] = [[cur.x, cur.y]];
      let k = ck;
      while (came.has(k)) { k = came.get(k)!; path.push([Math.floor(k / 1000), k % 1000]); }
      return path.reverse();
    }
    open.delete(ck);
    closed.add(ck);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!inb(nx, ny) || blocked(nx, ny)) continue;
      if (dx && dy && (blocked(cur.x + dx, cur.y) || blocked(cur.x, cur.y + dy))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const g = cur.g + (dx && dy ? 1.41 : 1);
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        came.set(nk, ck);
        open.set(nk, { x: nx, y: ny, g, f: g + h(nx, ny) });
      }
    }
  }
  return null;
}

/** Tile livre mais próximo de (x,y) */
export function nearestFree(grid: boolean[][], x: number, y: number): [number, number] | null {
  const W = grid.length, D = grid[0]?.length ?? 0;
  let best: [number, number] | null = null, bd = Infinity;
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
    if (grid[i][j]) continue;
    const dd = Math.hypot(i - x, j - y);
    if (dd < bd) { bd = dd; best = [i, j]; }
  }
  return best;
}
