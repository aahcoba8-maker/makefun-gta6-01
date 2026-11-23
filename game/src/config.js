export const TILE = 48;
export const WORLD = { cols: 44, rows: 30, width: 44 * TILE, height: 30 * TILE };
export const SEA_X = 35 * TILE;
export const DISTRICTS = [
  { id: 'pelabuhan', name: 'PELABUHAN', x: 0, y: 0, w: 14, h: 30, ground: '#39454b', wall: '#b66b42', roof: '#e1a45a' },
  { id: 'pasar', name: 'PASAR LAMA', x: 14, y: 0, w: 10, h: 14, ground: '#6d5644', wall: '#cc7959', roof: '#f2c56b' },
  { id: 'kotatua', name: 'KOTA TUA', x: 24, y: 0, w: 11, h: 14, ground: '#5a5960', wall: '#9c8b85', roof: '#c8b4a8' },
  { id: 'bukit', name: 'BUKIT HIJAU', x: 14, y: 14, w: 12, h: 16, ground: '#48684b', wall: '#d0b07b', roof: '#7b9f6b' },
  { id: 'pantai', name: 'PANTAI KARANG', x: 26, y: 14, w: 9, h: 16, ground: '#c8a875', wall: '#ef8e63', roof: '#f4d27e' },
];
export const PALETTE = { asphalt: '#252c32', line: '#e5c66d', sidewalk: '#8b9290', sea: '#1d6b83', sand: '#d9ba78', grass: '#3e704c', night: 'rgba(8,14,29,.58)' };
export const STORES = [
  { type: 'gun', name: 'GUN SHOP', x: 18 * TILE, y: 5 * TILE },
  { type: 'spray', name: 'PAY-N-SPRAY', x: 29 * TILE, y: 20 * TILE },
  { type: 'clinic', name: 'KLINIK', x: 22 * TILE, y: 18 * TILE },
  { type: 'safehouse', name: 'SAFEHOUSE', x: 30 * TILE, y: 9 * TILE },
];
export const ROAD_X = [2, 7, 12, 16, 21, 26, 31];
export const ROAD_Y = [2, 7, 12, 17, 22, 27];
