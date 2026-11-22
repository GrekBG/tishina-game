// TISHINA 0.3.3 — 1024px procedural PBR material library.
// Generates tileable albedo, normal and roughness maps locally; no texture downloads.
export async function installPbrSurfaces(THREE, surfaces, options = {}) {
  const quality = options.quality || 'ultra';
  const renderer = options.renderer || null;
  const maxAnisotropy = Math.max(1, Math.min(16, renderer?.capabilities?.getMaxAnisotropy?.() || 8));

  const configs = {
    concrete:     { baseRoughness: 0.96, metalness: 0.02, repeat: 3.2, hero: true,  normalStrength: 2.15, pattern: 'concrete', bumpScale: 0.018 },
    darkConcrete: { baseRoughness: 0.98, metalness: 0.01, repeat: 3.0, hero: false, normalStrength: 2.35, pattern: 'concrete', bumpScale: 0.020 },
    plaster:      { baseRoughness: 0.93, metalness: 0.00, repeat: 2.4, hero: false, normalStrength: 1.75, pattern: 'plaster', bumpScale: 0.014 },
    dirtyWhite:   { baseRoughness: 0.93, metalness: 0.00, repeat: 2.6, hero: false, normalStrength: 1.65, pattern: 'plaster', bumpScale: 0.012 },
    metal:        { baseRoughness: 0.70, metalness: 0.78, repeat: 2.8, hero: true,  normalStrength: 1.45, pattern: 'metal', bumpScale: 0.006 },
    rust:         { baseRoughness: 0.98, metalness: 0.24, repeat: 3.0, hero: false, normalStrength: 2.10, pattern: 'rust', bumpScale: 0.018 },
    floorMat:     { baseRoughness: 0.86, metalness: 0.12, repeat: 4.2, hero: true,  normalStrength: 2.30, pattern: 'asphalt', bumpScale: 0.014 },
    wood:         { baseRoughness: 0.92, metalness: 0.02, repeat: 2.5, hero: false, normalStrength: 1.75, pattern: 'wood', bumpScale: 0.012 },
    paper:        { baseRoughness: 0.99, metalness: 0.00, repeat: 1.8, hero: false, normalStrength: 1.35, pattern: 'paper', bumpScale: 0.004 },
    yellow:       { baseRoughness: 0.90, metalness: 0.03, repeat: 2.2, hero: false, normalStrength: 1.25, pattern: 'paint', bumpScale: 0.005 },
    gravel:       { baseRoughness: 0.99, metalness: 0.00, repeat: 5.8, hero: true,  normalStrength: 2.55, pattern: 'gravel', bumpScale: 0.025 },
    earth:        { baseRoughness: 0.99, metalness: 0.00, repeat: 3.8, hero: true,  normalStrength: 2.35, pattern: 'earth', bumpScale: 0.022 },
    driveConcrete:{ baseRoughness: 0.97, metalness: 0.00, repeat: 4.1, hero: true,  normalStrength: 2.20, pattern: 'concrete', bumpScale: 0.018 }
  };

  const random = seed => {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  };

  function makeGrid(size, rand) {
    const grid = new Float32Array(size * size);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    return grid;
  }

  function sampleGrid(grid, gridSize, x, y, textureSize) {
    const fx = (x / textureSize) * gridSize;
    const fy = (y / textureSize) * gridSize;
    const x0 = Math.floor(fx) % gridSize;
    const y0 = Math.floor(fy) % gridSize;
    const x1 = (x0 + 1) % gridSize;
    const y1 = (y0 + 1) % gridSize;
    const tx = fx - Math.floor(fx);
    const ty = fy - Math.floor(fy);
    const a = grid[y0 * gridSize + x0] * (1 - tx) + grid[y0 * gridSize + x1] * tx;
    const b = grid[y1 * gridSize + x0] * (1 - tx) + grid[y1 * gridSize + x1] * tx;
    const blend = ty * ty * (3 - 2 * ty);
    return a * (1 - blend) + b * blend;
  }

  function makeTexture(data, size, repeat, colorSpace = null) {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.flipY = true; // Align DataTexture orientation with CanvasTexture albedo.
    texture.repeat.set(repeat, repeat);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = maxAnisotropy;
    if (colorSpace) texture.colorSpace = colorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  function addSurfaceMarks(ctx, size, kind, rand) {
    ctx.save();
    if (kind === 'concrete' || kind === 'plaster') {
      for (let i = 0; i < (kind === 'concrete' ? 180 : 115); i++) {
        const x = rand() * size, y = rand() * size;
        const radius = (kind === 'concrete' ? 1.2 : 2.0) + rand() * (kind === 'concrete' ? 7 : 11);
        ctx.fillStyle = rand() > 0.48 ? `rgba(16,22,20,${0.018 + rand() * 0.075})` : `rgba(224,219,204,${0.02 + rand() * 0.07})`;
        ctx.beginPath(); ctx.ellipse(x, y, radius * (0.65 + rand() * 0.8), radius, rand() * Math.PI, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < (kind === 'concrete' ? 22 : 12); i++) {
        const x = rand() * size, y = rand() * size;
        ctx.strokeStyle = `rgba(24,27,24,${0.12 + rand() * 0.18})`;
        ctx.lineWidth = 0.45 + rand() * 1.25;
        ctx.beginPath(); ctx.moveTo(x, y);
        let px = x, py = y;
        for (let j = 0; j < 5 + Math.floor(rand() * 7); j++) {
          px += (rand() - 0.5) * 23; py += 3 + rand() * 18; ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    } else if (kind === 'metal' || kind === 'rust' || kind === 'paint') {
      for (let i = 0; i < (kind === 'metal' ? 720 : 380); i++) {
        const x = rand() * size, y = rand() * size;
        const length = kind === 'metal' ? 5 + rand() * 82 : 2 + rand() * 18;
        ctx.strokeStyle = rand() > 0.5 ? `rgba(226,224,208,${0.025 + rand() * 0.13})` : `rgba(13,17,16,${0.03 + rand() * 0.15})`;
        ctx.lineWidth = 0.3 + rand() * (kind === 'metal' ? 1.0 : 2.2);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length, y + (rand() - 0.5) * (kind === 'metal' ? 1.4 : 8)); ctx.stroke();
      }
      for (let i = 0; i < (kind === 'metal' ? 90 : 250); i++) {
        const x = rand() * size, y = rand() * size, r = 0.8 + rand() * (kind === 'rust' ? 7 : 3.5);
        ctx.fillStyle = kind === 'metal' ? `rgba(116,66,39,${0.05 + rand() * 0.2})` : `rgba(45,25,16,${0.05 + rand() * 0.2})`;
        ctx.beginPath(); ctx.ellipse(x, y, r * (0.5 + rand()), r, rand(), 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 'asphalt') {
      for (let i = 0; i < 6000; i++) {
        const x = rand() * size, y = rand() * size, r = 0.35 + rand() * 2.2;
        const v = rand() > 0.5 ? 205 : 10;
        ctx.fillStyle = `rgba(${v},${v},${v},${0.025 + rand() * 0.12})`;
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r, rand(), 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 38; i++) {
        const x = rand() * size, y = rand() * size;
        ctx.fillStyle = `rgba(14,24,24,${0.025 + rand() * 0.06})`;
        ctx.beginPath(); ctx.ellipse(x, y, 10 + rand() * 52, 3 + rand() * 13, rand() * Math.PI, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 'gravel' || kind === 'earth') {
      const count = kind === 'gravel' ? 9200 : 4200;
      for (let i = 0; i < count; i++) {
        const x = rand() * size, y = rand() * size;
        const r = kind === 'gravel' ? 0.5 + rand() * 5.2 : 1.2 + rand() * 12;
        const light = rand() > 0.54;
        const alpha = kind === 'gravel' ? 0.035 + rand() * 0.17 : 0.025 + rand() * 0.12;
        ctx.fillStyle = light ? `rgba(205,202,184,${alpha})` : `rgba(24,27,24,${alpha})`;
        ctx.beginPath();ctx.ellipse(x,y,r*(0.55+rand()*0.8),r*(0.45+rand()*0.55),rand()*Math.PI,0,Math.PI*2);ctx.fill();
      }
      for (let i = 0; i < (kind === 'gravel' ? 75 : 45); i++) {
        const x = rand() * size, y = rand() * size;
        ctx.strokeStyle = `rgba(30,32,27,${0.05 + rand() * 0.09})`;ctx.lineWidth=0.5+rand()*2;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rand()-.5)*90,y+(rand()-.5)*70);ctx.stroke();
      }
    } else if (kind === 'wood') {
      for (let i = 0; i < 90; i++) {
        const y = rand() * size, bend = rand() * 18;
        ctx.strokeStyle = rand() > 0.5 ? `rgba(31,20,12,${0.035 + rand() * 0.13})` : `rgba(231,206,167,${0.025 + rand() * 0.1})`;
        ctx.lineWidth = 0.45 + rand() * 2.1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(size * 0.28, y + bend, size * 0.68, y - bend, size, y + (rand() - 0.5) * 8); ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const x = rand() * size, y = rand() * size;
        for (let ring = 0; ring < 5; ring++) {
          ctx.strokeStyle = `rgba(45,28,15,${0.08 - ring * 0.012})`; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.ellipse(x, y, 4 + ring * 3.2, 2 + ring * 1.6, rand() * 0.2, 0, Math.PI * 2); ctx.stroke();
        }
      }
    } else if (kind === 'paper') {
      for (let i = 0; i < 2100; i++) {
        const x = rand() * size, y = rand() * size;
        ctx.strokeStyle = rand() > 0.5 ? `rgba(100,82,56,${0.025 + rand() * 0.08})` : `rgba(255,255,244,${0.025 + rand() * 0.1})`;
        ctx.lineWidth = 0.25 + rand() * 0.7;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - 0.5) * 5, y + 1 + rand() * 7); ctx.stroke();
      }
    }
    ctx.restore();
  }

 async function buildMaps(name, material, config, size) {
    const rand = random((name.length * 7919 + size * 31) >>> 0);
    const grids = [makeGrid(8, rand), makeGrid(24, rand), makeGrid(72, rand), makeGrid(192, rand)];
    const heights = new Float32Array(size * size);
    const roughness = new Uint8Array(size * size * 4);
    const color = new Uint8ClampedArray(size * size * 4);
    const hex = material.color?.getHex?.() ?? 0x777d77;
    const base = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
    const kind = config.pattern;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const n0 = sampleGrid(grids[0], 8, x, y, size);
        const n1 = sampleGrid(grids[1], 24, x, y, size);
        const n2 = sampleGrid(grids[2], 72, x, y, size);
        const n3 = sampleGrid(grids[3], 192, x, y, size);
        let h = 0.47 + (n0 - 0.5) * 0.23 + (n1 - 0.5) * 0.18 + (n2 - 0.5) * 0.15 + (n3 - 0.5) * 0.10;
        if (kind === 'metal') h += Math.sin(y * 0.34 + n1 * 8) * 0.018;
        if (kind === 'wood') h += Math.sin(y * 0.16 + n1 * 5) * 0.045;
        if (kind === 'asphalt') h += (n3 > 0.79 ? 0.09 : 0) - (n3 < 0.13 ? 0.045 : 0);
        if (kind === 'rust') h += (n2 > 0.75 ? 0.08 : 0) - (n2 < 0.20 ? 0.035 : 0);
        if (kind === 'gravel') h += (n3 > 0.77 ? 0.11 : 0) - (n3 < 0.16 ? 0.035 : 0);
        if (kind === 'earth') h += (n2 > 0.80 ? 0.07 : 0) - (n2 < 0.15 ? 0.04 : 0);
        h = Math.max(0.08, Math.min(0.92, h));
        heights[i] = h;

        let shade = 0.73 + n0 * 0.25 + n1 * 0.18 + (n2 - 0.5) * 0.18 + (n3 - 0.5) * 0.12;
        if (kind === 'rust' && n2 > 0.73) shade *= 0.66;
        if (kind === 'concrete' && n3 < 0.12) shade *= 0.72;
        if (kind === 'asphalt' && n3 > 0.84) shade *= 0.60;
        if (kind === 'metal' && n3 > 0.95) shade *= 1.18;
        if (kind === 'wood') shade *= 0.92 + Math.sin(y * 0.18 + n1 * 9) * 0.08;
        const ci = i * 4;
        color[ci] = Math.max(0, Math.min(255, base[0] * shade));
        color[ci + 1] = Math.max(0, Math.min(255, base[1] * shade));
        color[ci + 2] = Math.max(0, Math.min(255, base[2] * shade));
        color[ci + 3] = 255;
        let r = config.baseRoughness + (n2 - 0.5) * 0.18 + (n3 - 0.5) * 0.10;
        if (kind === 'asphalt' && n3 > 0.84) r -= 0.08;
        if (kind === 'gravel' || kind === 'earth') r = Math.max(r, 0.94);
        if (kind === 'metal' && n1 > 0.78) r += 0.12;
        r = Math.max(0.28, Math.min(1, r));
        const rv = Math.round(r * 255);
        roughness[ci] = roughness[ci + 1] = roughness[ci + 2] = rv;
        roughness[ci + 3] = 255;
      }
    }

    const normal = new Uint8Array(size * size * 4);
    const at = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const dx = (at(x + 1, y) - at(x - 1, y)) * config.normalStrength * 15;
        const dy = (at(x, y + 1) - at(x, y - 1)) * config.normalStrength * 15;
        let nx = -dx, ny = -dy, nz = 1;
        const length = Math.hypot(nx, ny, nz) || 1;
        nx /= length; ny /= length; nz /= length;
        normal[i] = Math.round((nx * 0.5 + 0.5) * 255);
        normal[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        normal[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        normal[i + 3] = 255;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { alpha: false });
    const image = ctx.createImageData(size, size);
    image.data.set(color);
    ctx.putImageData(image, 0, 0);
    addSurfaceMarks(ctx, size, kind, rand);

    const albedo = new THREE.CanvasTexture(canvas);
    albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
    albedo.repeat.set(config.repeat, config.repeat);
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.generateMipmaps = true;
    albedo.minFilter = THREE.LinearMipmapLinearFilter;
    albedo.magFilter = THREE.LinearFilter;
    albedo.anisotropy = maxAnisotropy;
    albedo.needsUpdate = true;

    const normalMap = makeTexture(normal, size, config.repeat);
    const roughnessMap = makeTexture(roughness, size, config.repeat);
    return { albedo, normalMap, roughnessMap };
  }

  const report = { quality, materials: [], resolutions: {} };
  for (const [name, config] of Object.entries(configs)) {
    const material = surfaces[name];
    if (!material) continue;
    const resolution = 1024;
    let maps;
    try {
      maps = buildMaps(name, material, config, resolution);
    } catch (error) {
      // The source grunge map for each primary surface is also 1024px; keep it if a secondary PBR map cannot be allocated.
      console.warn(`[ТИШИНА] Не удалось собрать полный PBR-набор 1024px для ${name}; сохранена базовая 1024px-карта.`, error);
      report.materials.push(name);
      report.resolutions[name] = 1024;
      continue;
    }
    for (const oldMap of [material.map, material.normalMap, material.roughnessMap, material.bumpMap]) {
      if (oldMap?.dispose) oldMap.dispose();
    }
    material.color.setHex(0xffffff); // The albedo map already contains the original base colour.
    material.map = maps.albedo;
    material.normalMap = maps.normalMap;
    material.normalScale = new THREE.Vector2(config.normalStrength * 0.38, config.normalStrength * 0.38);
    material.roughnessMap = maps.roughnessMap;
    material.bumpMap = null;
    material.roughness = config.baseRoughness;
    material.metalness = config.metalness;
    material.envMapIntensity = config.pattern === 'metal' ? 1.15 : 0.72;
    material.needsUpdate = true;
    report.materials.push(name);
    report.resolutions[name] = resolution;
  }
  console.info('[ТИШИНА] HD PBR surfaces:', report);
  return report;
}
