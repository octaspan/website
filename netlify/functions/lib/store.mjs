// Storage: Netlify Blobs in production. Falls back to an in-memory map when Blobs are not
// available (local tests), so the same code runs everywhere.
const mem = new Map();
let blobs;
async function open() {
  if (blobs !== undefined) return blobs;
  try {
    const { getStore } = await import('@netlify/blobs');
    blobs = getStore({ name: 'octaspan-threat', consistency: 'strong' });
  } catch { blobs = null; }
  return blobs;
}
export const usingBlobs = async () => !!(await open());

export async function getJSON(key, fallback = null) {
  const b = await open();
  try {
    const v = b ? await b.get(key, { type: 'json' }) : mem.get(key);
    return v === undefined || v === null ? fallback : v;
  } catch { return fallback; }
}
export async function setJSON(key, value) {
  const b = await open();
  if (b) await b.setJSON(key, value); else mem.set(key, JSON.parse(JSON.stringify(value)));
}
export function _resetMemory() { mem.clear(); }
