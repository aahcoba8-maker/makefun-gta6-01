export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return {
    next() { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; },
    int(a, b) { return Math.floor(this.next() * (b - a + 1)) + a; },
    pick(list) { return list[this.int(0, list.length - 1)]; },
  };
}
export function hash2(x, y, seed = 1) {
  let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(y + seed, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
