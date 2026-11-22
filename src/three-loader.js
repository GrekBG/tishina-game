// TISHINA 0.4.0 — resilient Three.js loader.
// Both sources serve the exact same Three.js version to avoid mixed engine builds.
const THREE_SOURCES = [
  'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.187.0/three.module.js'
];

let threeNamespace = null;
let lastLoadError = null;
for (const source of THREE_SOURCES) {
  try {
    threeNamespace = await import(source);
    break;
  } catch (error) {
    lastLoadError = error;
    console.warn(`[ТИШИНА] Не удалось загрузить Three.js с ${source}`, error);
  }
}

if (!threeNamespace) {
  const detail = lastLoadError?.message ? ` (${lastLoadError.message})` : '';
  throw new Error(`Не удалось загрузить 3D-движок Three.js. Проверьте интернет-соединение и обновите страницу.${detail}`);
}

export const THREE = threeNamespace;
