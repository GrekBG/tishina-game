import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';

// Exterior service yard extension for ТИШИНА 0.3.0, polished in 0.3.3.
// Designed for mobile WebGL: low-poly geometry, shared materials, modest light count.
export function installWorldExpansion({ THREE, scene, camera, isMobileDevice = false, box, floor, mat, addInteract, colliders, gltfLoaderPromise, surfaces, notify = () => {} }) {
  const toned = (base, color, roughness, metalness) => { const m = base.clone(); m.color.setHex(color); m.roughness = roughness; m.metalness = metalness; return m; };
  const steel = toned(surfaces.metal, 0x303a37, 0.72, 0.72);
  const darkSteel = toned(surfaces.darkConcrete, 0x202927, 0.82, 0.58);
  const fadedPaint = toned(surfaces.plaster, 0x59655d, 0.9, 0.16);
  const hazard = toned(surfaces.yellow, 0xb18b46, 0.86, 0.12);
  const wetAsphalt = toned(surfaces.floorMat, 0x73776f, 0.985, 0.01);
  const gravelGround = toned(surfaces.gravel || surfaces.floorMat, 0x66665d, 0.99, 0.0);
  const earthGround = toned(surfaces.earth || surfaces.darkConcrete, 0x4f5149, 0.99, 0.0);
  const apronConcrete = toned(surfaces.driveConcrete || surfaces.darkConcrete, 0x74766f, 0.97, 0.0);
  const rust = toned(surfaces.rust, 0x684737, 0.96, 0.25);
  const glass = new THREE.MeshStandardMaterial({ color: 0x71817c, roughness: 0.46, metalness: 0.025, transparent: true, opacity: 0.34, side: THREE.DoubleSide });
  const lamps = [];
  const animated = [];

  function solid(name, size, pos, material, parent = scene) {
    const mesh = box(parent, name, size, pos, material);
    const [w, h, d] = size;
    const [x, y, z] = pos;
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return mesh;
  }
  function detail(name, size, pos, material, parent = scene) { return box(parent, name, size, pos, material, { cast: false }); }
  function cylinder(name, radiusTop, radiusBottom, height, pos, material, sides = 10) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides), material);
    mesh.name = name; mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
  }

  // Extension ground: the original forecourt stays seamless and the player can walk south/east.
  // The enlarged base asphalt slab in main.js is continuous beneath this extension.
  detail('Дорога — шероховатый мокрый асфальт', [10, 0.035, 82], [0, -0.012, 27], wetAsphalt);
  // Distinct, non-mirrored ground zones: concrete apron, loose gravel shoulders and compacted earth.
  detail('Бетонный подъезд к ангару', [20.5, 0.045, 8.5], [0, -0.008, -2.4], apronConcrete);
  detail('Бетонная зона разгрузки', [20, 0.045, 8.0], [8.5, -0.008, 13.5], apronConcrete);
  function terrainShoulder(name, xCenter, material, seed) {
    const geometry = new THREE.PlaneGeometry(14, 72, 48, 160);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i);
      const wave = Math.sin((x + seed) * .52) * Math.cos((z - seed) * .13) * .045
        + Math.sin((x - seed) * 1.15 + z * .11) * .025
        + Math.cos(z * .31 + seed) * .018;
      position.setY(i, .035 + Math.max(-.018, wave));
    }
    position.needsUpdate = true;geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(geometry, material);terrain.name = name;terrain.position.set(xCenter, -.018, 25);
    terrain.receiveShadow = true;terrain.castShadow = false;scene.add(terrain);return terrain;
  }
  terrainShoulder('Рельефная щебёночная обочина — запад', -38, gravelGround, 3.2);
  terrainShoulder('Рельефная щебёночная обочина — восток', 38, gravelGround, 8.7);
  detail('Утрамбованный грунт — северо-запад', [12, 0.04, 15], [-31, -0.009, 49], earthGround);
  detail('Утрамбованный грунт — северо-восток', [12, 0.04, 15], [31, -0.009, 49], earthGround);
  // Shared instanced gravel fragments add a readable uneven shoulder without hundreds of draw calls.
  const pebbleGeometry = new THREE.DodecahedronGeometry(0.085, 0);
  const pebbleMaterial = new THREE.MeshStandardMaterial({ color: 0x74736a, roughness: 0.99, metalness: 0 });
  const pebbleCount = 320, pebbles = new THREE.InstancedMesh(pebbleGeometry, pebbleMaterial, pebbleCount);
  const pebbleDummy = new THREE.Object3D();
  let pebbleSeed = 33033; const pebbleRand = () => { pebbleSeed = (pebbleSeed * 1664525 + 1013904223) >>> 0; return pebbleSeed / 4294967296; };
  for (let i = 0; i < pebbleCount; i++) {
    const side = pebbleRand() > 0.5 ? 1 : -1;
    const x = side * (29 + pebbleRand() * 15), z = 5 + pebbleRand() * 48;
    pebbleDummy.position.set(x, 0.018 + pebbleRand() * 0.035, z);
    pebbleDummy.rotation.set(pebbleRand() * 2.8, pebbleRand() * Math.PI, pebbleRand() * 2.8);
    const scale = 0.5 + pebbleRand() * 1.2; pebbleDummy.scale.set(scale, 0.45 + pebbleRand() * 0.5, scale);
    pebbleDummy.updateMatrix(); pebbles.setMatrixAt(i, pebbleDummy.matrix);
  }
  pebbles.name = 'Россыпь щебня — инстансированная';pebbles.castShadow=false;pebbles.receiveShadow=true;scene.add(pebbles);

  for (let z = -8; z <= 56; z += 7) {
    detail('Разметка дороги', [0.12, 0.028, 2.2], [0, 0.002, z], hazard);
    detail('Старая белая разметка', [0.09, 0.026, 1.4], [-5.45, 0.002, z + 2.5], mat(0x9ca49a, 0.82, 0));
  }
  for (let i = 0; i < 16; i++) {
    const x = -37 + i * 4.9, z = 29 + (i % 2) * 2.8;
    detail('Трещина в покрытии', [0.025 + (i % 3) * 0.018, 0.016, 1.1 + (i % 4) * 0.35], [x, -0.008, z], darkSteel).rotation.y = (i % 2 ? 0.3 : -0.45);
  }

  // Chain-link perimeter fence and an open vehicle gate.
  const fenceZ = 59.3;
  for (const x of [-44, -39, -34, -29, -24, -19, -14, -9, 9, 14, 19, 24, 29, 34, 39, 44]) {
    solid('Стойка периметрального ограждения', [0.16, 2.75, 0.16], [x, 1.36, fenceZ], steel);
    detail('Крепление стойки', [0.28, 0.14, 0.28], [x, 0.18, fenceZ], darkSteel);
  }
  for (const y of [0.5, 1.28, 2.35]) {
    solid('Горизонтальная труба ограждения', [35, 0.075, 0.075], [-26.5, y, fenceZ], steel);
    solid('Горизонтальная труба ограждения', [35, 0.075, 0.075], [26.5, y, fenceZ], steel);
  }
  for (let x = -43; x <= -10; x += 0.65) detail('Сетка ограждения', [0.025, 2.0, 0.025], [x, 1.38, fenceZ], darkSteel);
  for (let x = 10; x <= 43; x += 0.65) detail('Сетка ограждения', [0.025, 2.0, 0.025], [x, 1.38, fenceZ], darkSteel);
  for (const x of [-8.5, 8.5]) {
    solid('Бетонная тумба ворот', [0.9, 2.8, 0.75], [x, 1.4, fenceZ], mat(0x555d57, 0.94, 0.06));
    detail('Полоса ворот', [0.16, 2.2, 0.035], [x, 1.42, fenceZ - 0.4], hazard);
  }
  detail('Знак — проход закрыт', [2.2, 0.72, 0.08], [0, 2.05, fenceZ - 0.2], mat(0x77766b, 0.9, 0.04));
  detail('Надпись на знаке', [1.25, 0.055, 0.025], [0, 2.1, fenceZ - 0.255], darkSteel);

  // Guard booth, open toward the road. A readable evacuation register advances Chapter I.
  const boothX = -15.5, boothZ = 45.2;
  floor('Пол будки КПП', boothX, boothZ, 5.8, 4.8, mat(0x484f49, 0.93, 0.05), 0.02);
  solid('Будка КПП — задняя стена', [5.5, 2.9, 0.2], [boothX, 1.45, boothZ - 2.3], fadedPaint);
  solid('Будка КПП — левая стена', [0.2, 2.9, 4.6], [boothX - 2.65, 1.45, boothZ], fadedPaint);
  solid('Будка КПП — правая стена', [0.2, 2.9, 4.6], [boothX + 2.65, 1.45, boothZ], fadedPaint);
  solid('Крыша будки КПП', [5.9, 0.22, 5.0], [boothX, 2.95, boothZ], darkSteel);
  detail('Окно будки КПП', [0.06, 1.1, 1.7], [boothX - 2.52, 1.85, boothZ - 0.35], glass);
  solid('Стойка дежурного КПП', [2.6, 0.95, 0.72], [boothX, 0.55, boothZ + 0.55], fadedPaint);
  detail('Столешница дежурного', [2.75, 0.1, 0.82], [boothX, 1.08, boothZ + 0.55], mat(0x69685b, 0.82, 0.08));
  const register = new THREE.Group(); register.position.set(boothX - 0.45, 1.18, boothZ + 0.35); scene.add(register);
  const book = box(register, 'Журнал эвакуации', [0.58, 0.075, 0.42], [0, 0, 0], mat(0x373b34, 0.94, 0.04));
  box(register, 'Пожелтевшие страницы журнала', [0.54, 0.018, 0.38], [0, 0.045, -0.012], mat(0xb6b09a, 0.98, 0));
  box(register, 'Красная печать журнала', [0.13, 0.008, 0.09], [0.16, 0.057, -0.1], mat(0x8a3934, 0.95, 0));
  for (let i = 0; i < 5; i++) detail('Строка журнала эвакуации', [0.3 - (i % 2) * 0.04, 0.004, 0.008], [boothX - 0.45, 1.235, boothZ + 0.22 + i * 0.045], darkSteel);
  addInteract(book, 'Журнал эвакуации', 'Последние страницы вырваны. В сохранившейся записи указано, что 14 сотрудников прошли через КПП, но в списке возврата числится пятнадцать пропусков. Последняя строка написана другим почерком: «Не открывать нижний шлюз. Он отвечает изнутри».', 'СЮЖЕТ');

  // Eastern logistics area: containers, loading platform, transformer and a wrecked service van.
  // Keep the loading ramp on the left loading bay; its previous width crossed the chapel porch.
  solid('Погрузочная рампа', [12, 0.72, 5.2], [8.5, 0.28, 18], mat(0x515953, 0.94, 0.04));
  for (let i = 0; i < 4; i++) {
    const x = 5.5 + i * 2.5;
    solid('Отбойник рампы', [0.18, 0.52, 0.18], [x, 0.28, 15.25], steel);
    detail('Жёлто-чёрная маркировка рампы', [0.12, 0.028, 0.52], [x, 0.66, 15.2], hazard);
  }
  const containerColors = [mat(0x46564f, 0.9, 0.24), mat(0x4f4a40, 0.92, 0.18), mat(0x465052, 0.88, 0.22)];
  for (let i = 0; i < 4; i++) {
    // The front-right container is replaced by the chapel. Move the rear-right
    // container east so it no longer blocks the route behind the chapel.
    if (i === 1 || i === 3) continue;
    const x = i === 3 ? 39.0 : 20 + (i % 2) * 9.4;
    const z = 25 + Math.floor(i / 2) * 7.2;
    solid('Грузовой контейнер', [8.4, 2.65, 6.2], [x, 1.34, z], containerColors[i % 3]);
    for (let k = 0; k < 9; k++) detail('Рёбра контейнера', [0.07, 2.5, 0.07], [x - 3.8 + k * 0.95, 1.34, z - 3.14], steel);
    detail('Маркировочная табличка контейнера', [1.1, 0.38, 0.045], [x, 1.9, z - 3.18], fadedPaint);
    detail('Номер контейнера', [0.45, 0.035, 0.018], [x, 1.93, z - 3.21], mat(0xc0bba6, 0.85, 0));
  }

  // 0.4.7 — imported, textured UAZ-452 asset. Preserve its original upright orientation.
  // COLLADA source declares Z_UP; ColladaLoader converts it to Three.js Y_UP.
  // Do not apply an additional Z-axis half-turn: it flips the complete vehicle upside down.
  const vanX = -28, vanZ = 28;
  const uazAnchor = new THREE.Group();
  uazAnchor.name = 'УАЗ-452 — импортированная модель';
  uazAnchor.position.set(vanX, 0, vanZ);
  scene.add(uazAnchor);

  const uazLoader = new ColladaLoader();
  const uazUrl = new URL('../uaz.dae', import.meta.url).href;
  uazLoader.load(
    uazUrl,
    (collada) => {
      const vehicle = collada.scene;
      vehicle.name = 'УАЗ-452 — исходная геометрия и UV-текстуры';

      // The source DAE is Z_UP. ColladaLoader first converts that coordinate
      // system to Three.js Y_UP. The authored UAZ itself is exported upside down,
      // so roll it 180 degrees around its longitudinal (Three.js Z) axis.
      // Use a parent group so this correction is applied AFTER ColladaLoader's
      // Z_UP -> Y_UP conversion instead of mixing Euler rotations on its root.
      vehicle.rotation.y = Math.PI;
      vehicle.scale.set(1.25, 1.45, 1.48);
      vehicle.updateMatrixWorld(true);

      const uazUpright = new THREE.Group();
      uazUpright.name = 'УАЗ-452 — разворот на колёса';
      uazUpright.rotation.z = Math.PI;
      uazUpright.add(vehicle);
      uazUpright.updateMatrixWorld(true);

      // Recalculate the bounds AFTER the roll, then place the lowest point on
      // the ground. This prevents the corrected vehicle from floating or sinking.
      const localBounds = new THREE.Box3().setFromObject(uazUpright);
      const localCenter = localBounds.getCenter(new THREE.Vector3());
      uazUpright.position.set(-localCenter.x, -localBounds.min.y, -localCenter.z);

      vehicle.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = true;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (!material) continue;
          if (material.map) {
            material.map.colorSpace = THREE.SRGBColorSpace;
            material.map.anisotropy = 4;
            material.map.generateMipmaps = true;
            material.map.minFilter = THREE.LinearMipmapLinearFilter;
            material.map.magFilter = THREE.LinearFilter;
          }
          if (material.isMeshPhongMaterial) {
            // Keep the source's painted/specular appearance without overly plastic highlights.
            material.shininess = Math.min(Number(material.shininess) || 28, 42);
            if (material.specular) material.specular.multiplyScalar(0.55);
          }
          material.needsUpdate = true;
        }
      });

      uazAnchor.add(uazUpright);
      uazAnchor.updateMatrixWorld(true);
      scene.updateMatrixWorld(true);

      const worldBounds = new THREE.Box3().setFromObject(uazAnchor);
      colliders.push({
        minX: worldBounds.min.x + 0.10,
        maxX: worldBounds.max.x - 0.10,
        minY: Math.max(0, worldBounds.min.y),
        maxY: worldBounds.max.y,
        minZ: worldBounds.min.z + 0.10,
        maxZ: worldBounds.max.z - 0.10
      });

      console.info('[ТИШИНА] Импортированная модель УАЗ-452 загружена', {
        meshes: countVehicleMeshes(vehicle),
        orientation: 'upright-roll-around-longitudinal-axis',
        dimensions: worldBounds.getSize(new THREE.Vector3()).toArray().map(v => Number(v.toFixed(2)))
      });
    },
    undefined,
    (error) => {
      console.error('[ТИШИНА] Не удалось загрузить модель УАЗ-452:', error);
      notify('НЕ УДАЛОСЬ ЗАГРУЗИТЬ МОДЕЛЬ УАЗ. Проверьте соединение и обновите игру.');
    }
  );

  function countVehicleMeshes(root) {
    let count = 0;
    root.traverse(node => { if (node.isMesh) count++; });
    return count;
  }


  // Transformer enclosure and a visible warning lamp near the eastern service lane.
  solid('Трансформаторная будка', [7.2, 4.1, 6.2], [28, 2.05, 5], darkSteel);
  for (let x = 24.9; x <= 31.1; x += 1.25) detail('Решётка трансформаторной', [0.055, 2.5, 0.08], [x, 1.8, 1.84], steel);
  detail('Знак высокого напряжения', [0.72, 0.78, 0.06], [28, 2.6, 1.78], hazard);
  const transformerLamp = new THREE.PointLight(0xd18b55, 1.6, 9, 2); transformerLamp.position.set(28, 3.2, 0.6); scene.add(transformerLamp);
  lamps.push({ light: transformerLamp, base: 1.6, seed: 2.1, pulse: 0.035 });

  // Open drainage channel, pipes and wet grates along the edge of the service yard.
  detail('Водоотводной канал', [2.8, 0.06, 26], [13.8, -0.03, 31], darkSteel);
  for (let z = 19; z < 44; z += 1.05) detail('Решётка водоотвода', [2.55, 0.035, 0.08], [13.8, 0.015, z], steel);
  for (let i = 0; i < 3; i++) {
    const pipe = cylinder('Дренажная труба', 0.16, 0.16, 9.2, [17.2 + i * 0.42, 0.45, 11 + i * 0.2], rust, 10);
    pipe.rotation.x = Math.PI / 2;
  }

  // Floodlight masts. Lamps have no shadow maps to keep the scene smooth on phones.
  for (const [x, z] of [[-8, 18], [8, 18], [-34, 42], [35, 42], [0, 51]]) {
    solid('Опора прожектора', [0.2, 7.5, 0.2], [x, 3.75, z], steel);
    detail('Кронштейн прожектора', [1.25, 0.12, 0.12], [x, 7.25, z], steel);
    const lamp = new THREE.PointLight(0xb9c7bd, 1.25, 16, 2.1); lamp.position.set(x, 7.0, z - 0.4); lamp.castShadow = false; scene.add(lamp);
    lamps.push({ light: lamp, base: 1.25, seed: x * 0.17 + z, pulse: 0.16 });
    detail('Корпус прожектора', [0.46, 0.25, 0.36], [x, 7.0, z - 0.42], mat(0x7a8077, 0.68, 0.44));
  }

  // Small pools, oil marks and rain-darkened stains break up repeated surfaces.
  for (let i = 0; i < 14; i++) {
    const x = -34 + ((i * 17) % 68), z = 12 + ((i * 11) % 43);
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.45 + (i % 4) * 0.22, 16), new THREE.MeshStandardMaterial({ color: i % 3 ? 0x555951 : 0x45483f, roughness: 0.96, metalness: 0.0, transparent: true, opacity: 0.34 }));
    stain.rotation.x = -Math.PI / 2; stain.position.set(x, -0.012, z); stain.scale.set(1.6, 0.62, 1); scene.add(stain);
  }


  // TISHINA 0.5.8 — create the chapel directly with Three.js on phones.
  // Mobile rendering no longer depends on a remote/large GLB request; the original optimized GLB remains for desktop.
  const chapelX = 29.4, chapelZ = 25.0, chapelScale = 0.65;
  const chapelUrl = new URL('../village-chapel.glb', import.meta.url).href;
  const chapelPad = detail('Площадка у заброшенной часовни', [9.8, 0.045, 11.8], [chapelX, -0.006, chapelZ], earthGround);
  chapelPad.receiveShadow = true;
  const chapelPath = detail('Грунтовая тропа к часовне', [4.8, 0.04, 7.4], [chapelX, 0.006, 19.7], gravelGround);
  chapelPath.receiveShadow = true;

  let chapelCollidersAdded = false;
  let chapelFallbackAdded = false;
  function addChapelColliders() {
    if (chapelCollidersAdded) return;
    chapelCollidersAdded = true;
    const halfWallWidth = 2.22;
    const halfWallDepth = 3.70;
    const wallT = 0.28;
    const sideInnerX = 1.94;
    const frontZ = chapelZ - halfWallDepth;
    const rearZ = chapelZ + halfWallDepth;
    const openingHalf = 0.68; // 1.36 m visual opening; the door itself is the only centre blocker.
    const addWall = (minX, maxX, minZ, maxZ, maxY = 5.8) => colliders.push({
      minX, maxX, minY: 0, maxY, minZ, maxZ
    });
    // Colliders trace only the real masonry footprint. No extended invisible slabs at front or rear.
    addWall(chapelX-halfWallWidth, chapelX-sideInnerX, frontZ, rearZ);
    addWall(chapelX+sideInnerX, chapelX+halfWallWidth, frontZ, rearZ);
    addWall(chapelX-halfWallWidth, chapelX+halfWallWidth, rearZ-wallT/2, rearZ+wallT/2);
    addWall(chapelX-halfWallWidth, chapelX-openingHalf, frontZ-wallT/2, frontZ+wallT/2);
    addWall(chapelX+openingHalf, chapelX+halfWallWidth, frontZ-wallT/2, frontZ+wallT/2);
    // Closed wooden door: it stops the player at the threshold but does not fill the approach area.
    addWall(chapelX-0.56, chapelX+0.56, frontZ-0.10, frontZ+0.10, 2.12);
  }

  function createChapelTexture(kind = 'stone') {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    let seed = kind === 'stone' ? 24058 : kind === 'roof' ? 5808 : 118;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    if (kind === 'stone') {
      ctx.fillStyle = '#514f49'; ctx.fillRect(0, 0, 256, 256);
      const rowH = 32;
      for (let row = 0; row < 8; row++) {
        const offset = row % 2 ? -24 : 0;
        for (let x = offset; x < 280; ) {
          const width = 34 + Math.floor(random() * 29);
          const tone = 103 + Math.floor(random() * 38);
          ctx.fillStyle = `rgb(${tone},${tone-2},${tone-8})`;
          ctx.fillRect(x+1, row*rowH+1, width-2, rowH-2);
          ctx.fillStyle = 'rgba(225,218,199,.10)';
          ctx.fillRect(x+3, row*rowH+3, width-7, 1);
          ctx.fillStyle = 'rgba(20,22,19,.20)';
          ctx.fillRect(x+2, row*rowH+rowH-4, width-4, 2);
          x += width;
        }
      }
      for (let i=0;i<1450;i++) {
        const a=.025+random()*.10;
        ctx.fillStyle = random()>.5 ? `rgba(235,229,211,${a})` : `rgba(17,19,17,${a})`;
        ctx.fillRect(random()*256, random()*256, 1+random()*2.5, 1+random()*2);
      }
    } else if (kind === 'roof') {
      ctx.fillStyle = '#303a38'; ctx.fillRect(0,0,256,256);
      for(let y=0;y<256;y+=32) for(let x=0;x<256;x+=42) {
        const tone=42+Math.floor(random()*20);
        ctx.fillStyle=`rgb(${tone},${tone+7},${tone+5})`;
        ctx.fillRect(x+(y/32%2)*10+1,y+1,39,29);
        ctx.strokeStyle='rgba(190,194,177,.12)';ctx.strokeRect(x+(y/32%2)*10+1,y+1,39,29);
      }
    } else {
      ctx.fillStyle = '#493a2e'; ctx.fillRect(0,0,256,256);
      for(let x=0;x<256;x+=30){ctx.fillStyle='rgba(205,177,135,.10)';ctx.fillRect(x,0,2,256);}
      for(let y=22;y<256;y+=54){ctx.fillStyle='rgba(12,13,12,.24)';ctx.fillRect(0,y,256,2);}
      for(let i=0;i<450;i++){ctx.fillStyle=`rgba(8,8,7,${.025+random()*.09})`;ctx.fillRect(random()*256,random()*256,1+random()*3,1+random()*5);}
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(kind === 'stone' ? 2.2 : 1.5, kind === 'stone' ? 1.7 : 2.0);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = Math.min(isMobileDevice ? 2 : 4, rendererMaxAnisotropy());
    return texture;
  }

  function createInlineChapel() {
    if (chapelFallbackAdded) return;
    chapelFallbackAdded = true;
    const group = new THREE.Group();
    group.name = 'Каменная сельская часовня — встроенная модель';
    group.position.set(chapelX, 0.015, chapelZ);
    const stoneMap = createChapelTexture('stone');
    const roofMap = createChapelTexture('roof');
    const woodMap = createChapelTexture('wood');
    const stone = new THREE.MeshStandardMaterial({ color: 0xb0ada2, map: stoneMap, roughness: .96, metalness: 0 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x858176, map: stoneMap, roughness: .97, metalness: 0 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x858b83, map: roofMap, roughness: .92, metalness: .04, side: THREE.DoubleSide });
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a8061, map: woodMap, roughness: .94, metalness: 0 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x17201e, roughness: .78, metalness: .02 });
    const metalwork = new THREE.MeshStandardMaterial({ color: 0x343b37, roughness: .72, metalness: .55 });
    const add = (name, geometry, material, position, rotation = [0,0,0]) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name; mesh.position.set(...position); mesh.rotation.set(...rotation);
      mesh.castShadow = !isMobileDevice; mesh.receiveShadow = !isMobileDevice;
      group.add(mesh); return mesh;
    };

    // Foundation and stone nave. The front wall is built in sections so the door is a true opening.
    add('Фундамент часовни', new THREE.BoxGeometry(4.55,.30,7.55), trim, [0,.18,0]);
    add('Левая каменная стена', new THREE.BoxGeometry(.30,3.05,7.35), stone, [-2.05,1.82,0]);
    add('Правая каменная стена', new THREE.BoxGeometry(.30,3.05,7.35), stone, [2.05,1.82,0]);
    add('Задняя каменная стена', new THREE.BoxGeometry(4.35,3.05,.30), stone, [0,1.82,3.55]);
    add('Передняя стена слева от двери', new THREE.BoxGeometry(1.46,3.05,.30), stone, [-1.32,1.82,-3.55]);
    add('Передняя стена справа от двери', new THREE.BoxGeometry(1.46,3.05,.30), stone, [1.32,1.82,-3.55]);
    add('Каменная перемычка над дверью', new THREE.BoxGeometry(1.20,.83,.32), stone, [0,2.94,-3.55]);
    add('Внутренний пол часовни', new THREE.BoxGeometry(4.02,.12,7.0), trim, [0,.36,0]);

    // Front and rear triangular gables under the pitched roof.
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-2.12,0); gableShape.lineTo(2.12,0); gableShape.lineTo(0,1.48); gableShape.closePath();
    const gableGeo = new THREE.ShapeGeometry(gableShape);
    const gableMat = stone.clone(); gableMat.side = THREE.DoubleSide;
    add('Фронтон над фасадом', gableGeo, gableMat, [0,3.34,-3.70]);
    add('Фронтон задней стены', gableGeo, gableMat, [0,3.34,3.70]);

    // Slate roof, ridge cap and fascia.
    add('Левый скат каменной крыши', new THREE.BoxGeometry(2.72,.22,7.95), roof, [-1.13,3.92,0], [0,0,.49]);
    add('Правый скат каменной крыши', new THREE.BoxGeometry(2.72,.22,7.95), roof, [1.13,3.92,0], [0,0,-.49]);
    add('Конёк крыши', new THREE.BoxGeometry(.18,.14,8.08), trim, [0,4.55,0]);
    add('Карниз слева', new THREE.BoxGeometry(.20,.22,8.02), trim, [-2.25,3.30,0]);
    add('Карниз справа', new THREE.BoxGeometry(.20,.22,8.02), trim, [2.25,3.30,0]);

    // Small bell tower with open belfry, bell, steep cap and a metal cross.
    add('Основание колокольни', new THREE.BoxGeometry(1.48,.34,1.48), trim, [0,4.58,-1.45]);
    for (const x of [-.53,.53]) for (const z of [-1.98,-.92])
      add('Столб колокольни', new THREE.BoxGeometry(.16,1.22,.16), stone, [x,5.30,z]);
    add('Верхняя обвязка колокольни', new THREE.BoxGeometry(1.32,.16,1.32), trim, [0,5.94,-1.45]);
    add('Колокол', new THREE.CylinderGeometry(.14,.24,.34,10), metalwork, [0,5.45,-1.45]);
    add('Крыша колокольни', new THREE.ConeGeometry(.95,1.02,4), roof, [0,6.48,-1.45], [0,Math.PI/4,0]);
    add('Крест часовни — стойка', new THREE.BoxGeometry(.10,.92,.10), metalwork, [0,7.40,-1.45]);
    add('Крест часовни — перекладина', new THREE.BoxGeometry(.62,.11,.11), metalwork, [0,7.55,-1.45]);

    // Wooden entrance, stone surround, iron straps and two small front windows.
    const door = add('Doors — входная дверь часовни', new THREE.BoxGeometry(1.08,2.12,.10), wood, [0,1.42,-3.77]);
    add('Косяк двери слева', new THREE.BoxGeometry(.14,2.25,.38), trim, [-.64,1.48,-3.58]);
    add('Косяк двери справа', new THREE.BoxGeometry(.14,2.25,.38), trim, [.64,1.48,-3.58]);
    add('Перемычка дверной рамы', new THREE.BoxGeometry(1.42,.16,.38), trim, [0,2.60,-3.58]);
    for(const y of [.78,1.42,2.04]) add('Железная полоса двери',new THREE.BoxGeometry(.94,.045,.025),metalwork,[0,y,-3.835]);
    add('Дверная ручка',new THREE.SphereGeometry(.065,8,6),metalwork,[.38,1.40,-3.85]);
    // Windows are intentionally placed on BOTH long side walls, not on the front facade.
    // A faint warm emissive tint keeps the stained glass readable in the game's night lighting.
    const sideGlass = new THREE.MeshStandardMaterial({
      color: 0x9bafa3, emissive: 0x493b25, emissiveIntensity: 0.22,
      roughness: 0.48, metalness: 0.02
    });
    for(const side of [-1,1]) for(const z of [-2.0,1.35]) {
      const xFrame = side * 2.17;
      const xGlass = side * 2.245;
      const xDetail = side * 2.275;
      // Tall, wide window set flush into the side masonry.
      add('Каменное обрамление бокового окна',new THREE.BoxGeometry(.16,1.34,.94),trim,[xFrame,2.02,z]);
      add('Стекло бокового витража',new THREE.BoxGeometry(.045,1.08,.68),sideGlass,[xGlass,2.02,z]);
      add('Вертикальная переплётная планка бокового окна',new THREE.BoxGeometry(.055,1.08,.055),metalwork,[xDetail,2.02,z]);
      add('Горизонтальная переплётная планка бокового окна',new THREE.BoxGeometry(.055,.055,.68),metalwork,[xDetail,2.02,z]);
      add('Подоконник бокового окна',new THREE.BoxGeometry(.24,.12,1.04),trim,[xFrame,1.32,z]);
      add('Перемычка бокового окна',new THREE.BoxGeometry(.24,.12,1.04),trim,[xFrame,2.72,z]);
    }

    // Broad two-step stone porch, aligned with the clear entrance corridor.
    add('Верхняя ступень часовни',new THREE.BoxGeometry(1.72,.18,.48),trim,[0,.21,-4.03]);
    add('Нижняя ступень часовни',new THREE.BoxGeometry(2.18,.16,.54),stone,[0,.08,-4.48]);
    addInteract(door, 'Дверь сельской часовни',
      'Старая дверь заперта. На железных полосах заметны следы недавнего прикосновения.', 'ОБЪЕКТ');
    scene.add(group);
    addChapelColliders();
    console.info('[ТИШИНА] Встроенная мобильная часовня создана без загрузки GLB.');
  }

  function loadChapel() {
    if (!gltfLoaderPromise) { createInlineChapel(); return; }
    gltfLoaderPromise.then(loader => {
      if (!loader) { createInlineChapel(); return; }
      loader.load(chapelUrl, gltf => {
        if (chapelFallbackAdded) return;
        const chapel = gltf.scene;
        chapel.name = 'Сельская каменная часовня';
        chapel.scale.setScalar(chapelScale);
        chapel.rotation.y = Math.PI;
        chapel.position.set(chapelX, 0.015, chapelZ);
        chapel.traverse(node => {
          if (!node.isMesh) return;
          node.castShadow = !isMobileDevice;
          node.receiveShadow = !isMobileDevice;
          node.frustumCulled = true;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          for (const material of materials) {
            if (!material) continue;
            if (isMobileDevice && Number(material.transmission) > 0) {
              material.transmission = 0; material.transparent = true;
              material.opacity = 0.62; material.roughness = 0.48;
              material.depthWrite = false; material.needsUpdate = true;
            }
            const textures = [material.map, material.normalMap, material.roughnessMap,
              material.metalnessMap, material.aoMap, material.emissiveMap];
            for (const texture of textures) {
              if (!texture) continue;
              if (texture === material.map || texture === material.emissiveMap) texture.colorSpace = THREE.SRGBColorSpace;
              texture.anisotropy = Math.min(isMobileDevice ? 2 : 4, rendererMaxAnisotropy());
              texture.generateMipmaps = true;
              texture.minFilter = THREE.LinearMipmapLinearFilter;
              texture.magFilter = THREE.LinearFilter;
              texture.needsUpdate = true;
            }
            material.needsUpdate = true;
          }
          if (node.name === 'Doors' || node.name.startsWith('Doors')) {
            addInteract(node, 'Дверь сельской часовни',
              'Старая дверь заперта. На железной накладке видны следы недавнего прикосновения.', 'ОБЪЕКТ');
          }
        });
        scene.add(chapel);
        scene.updateMatrixWorld(true);
        addChapelColliders();
        console.info('[ТИШИНА] Детализированная часовня загружена:', chapelUrl);
      }, undefined, error => {
        console.warn('[ТИШИНА] GLB часовни не загрузился; создаю встроенную модель:', error);
        createInlineChapel();
      });
    }).catch(error => {
      console.warn('[ТИШИНА] GLTFLoader часовни недоступен; создаю встроенную модель:', error);
      createInlineChapel();
    });
  }

  // On phones create the chapel synchronously during world setup. It is visible from the first frame.
  // Desktop keeps the original optimized GLB, with the same built-in model as a failure fallback.
  if (isMobileDevice) createInlineChapel();
  else loadChapel();

  function rendererMaxAnisotropy() {
    return scene.userData.maxAnisotropy || 4;
  }

  return {
    evacuationLog: book,
    update(dt, time) {
      for (const item of lamps) {
        const slow = Math.sin(time * 0.0011 + item.seed) * item.pulse;
        const flicker = Math.sin(time * 0.019 + item.seed * 2.3) > 0.985 ? 0.2 : 1;
        item.light.intensity = item.base * (0.92 + slow) * flicker;
      }
    }
  };
}
