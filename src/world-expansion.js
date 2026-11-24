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
  // Poly Haven Road Damaged PBR set. The procedural asphalt remains a fallback.
  const damagedRoadMaterial = wetAsphalt.clone();
  damagedRoadMaterial.name = 'Асфальт с выбоинами — Poly Haven PBR';
  damagedRoadMaterial.color.setHex(0xc2c6bf);
  damagedRoadMaterial.roughness = 0.98;
  const damagedRoad = detail('Дорога — повреждённый асфальт Poly Haven', [10, 0.035, 82], [0, -0.012, 27], damagedRoadMaterial);
  const roadTextureLoader = new THREE.TextureLoader();
  const roadTextureFiles = {
    map: '../assets/road-damaged/road-damaged-albedo.jpg',
    normalMap: '../assets/road-damaged/road-damaged-normal.jpg',
    roughnessMap: '../assets/road-damaged/road-damaged-roughness.jpg',
    aoMap: '../assets/road-damaged/road-damaged-ao.jpg',
    bumpMap: '../assets/road-damaged/road-damaged-displacement.jpg'
  };
  Promise.all(Object.entries(roadTextureFiles).map(async ([slot, path]) => {
    const texture = await roadTextureLoader.loadAsync(new URL(path, import.meta.url).href);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // Fewer repeats make potholes and cracks readable on a phone screen.
    texture.repeat.set(2.25, 11.5);
    texture.anisotropy = isMobileDevice ? 2 : 4;
    if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
    return [slot, texture];
  })).then(entries => {
    for (const [slot, texture] of entries) damagedRoadMaterial[slot] = texture;
    if (damagedRoad.geometry?.attributes?.uv && !damagedRoad.geometry.attributes.uv2) {
      damagedRoad.geometry.setAttribute('uv2', damagedRoad.geometry.attributes.uv);
    }
    damagedRoadMaterial.normalScale.set(1.15, 1.15);
    damagedRoadMaterial.bumpScale = 0.026;
    damagedRoadMaterial.needsUpdate = true;
  }).catch(error => {
    console.warn('Не удалось загрузить PBR-текстуры повреждённой дороги; используется базовый асфальт.', error);
  });
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
  // Visible cracks and chipped pothole edges are placed ON the road lane,
  // not on the distant shoulders. Geometry is deliberately sparse for mobile GPUs.
  for (let i = 0; i < 13; i++) {
    const x = -4.25 + (i % 5) * 1.95;
    const z = 8 + Math.floor(i / 5) * 17 + (i % 2) * 2.1;
    const crack = detail('Трещина на проезжей части', [0.035 + (i % 3) * 0.018, 0.018, 0.9 + (i % 4) * 0.42], [x, 0.014, z], darkSteel);
    crack.rotation.y = (i % 2 ? 0.28 : -0.38);
  }
  for (let i = 0; i < 7; i++) {
    const x = -3.8 + (i % 4) * 2.25;
    const z = 13 + i * 9.2;
    const chip = detail('Скол асфальта', [0.42 + (i % 3) * 0.12, 0.012, 0.28 + (i % 2) * 0.12], [x, 0.013, z], darkSteel);
    chip.rotation.y = (i % 2) * 0.42;
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
  const vanX = -42, vanZ = 28;
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
  solid('Трансформаторная будка', [7.2, 4.1, 6.2], [44, 2.05, 5], darkSteel);
  for (let x = 40.9; x <= 47.1; x += 1.25) detail('Решётка трансформаторной', [0.055, 2.5, 0.08], [x, 1.8, 1.84], steel);
  detail('Знак высокого напряжения', [0.72, 0.78, 0.06], [44, 2.6, 1.78], hazard);
  const transformerLamp = new THREE.PointLight(0xd18b55, 1.6, 9, 2); transformerLamp.position.set(44, 3.2, 0.6); scene.add(transformerLamp);
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
  const chapelX = 45.0, chapelZ = 25.0, chapelScale = 0.65;
  const chapelUrl = new URL('../village-chapel.glb', import.meta.url).href;
  const chapelPad = detail('Площадка у заброшенной часовни', [9.8, 0.045, 11.8], [chapelX, -0.006, chapelZ], earthGround);
  chapelPad.receiveShadow = true;
  const chapelPath = detail('Грунтовая тропа к часовне', [4.8, 0.04, 7.4], [chapelX, 0.006, 19.7], gravelGround);
  chapelPath.receiveShadow = true;

  let chapelCollidersAdded = false;
  function addChapelColliders() {
    if (chapelCollidersAdded) return;
    chapelCollidersAdded = true;
    const halfWallWidth = 3.4 * chapelScale;
    const halfWallDepth = 5.8 * chapelScale;
    const wallT = 0.5 * chapelScale;
    const sideInnerX = 2.9 * chapelScale;
    const frontZ = chapelZ - halfWallDepth;
    const rearZ = chapelZ + halfWallDepth;
    const openingHalf = 0.68; // 1.36 m clear facade opening around the original door.
    const addWall = (minX, maxX, minZ, maxZ, maxY = 5.8) => colliders.push({
      minX, maxX, minY: 0, maxY, minZ, maxZ
    });
    // Match the original GLB masonry footprint (outer walls +/-3.4 X, +/-5.8 Z at 0.65 scale).
    // Colliders cover only stone, never the porch or the approach path.
    addWall(chapelX-halfWallWidth, chapelX-sideInnerX, frontZ, rearZ);
    addWall(chapelX+sideInnerX, chapelX+halfWallWidth, frontZ, rearZ);
    addWall(chapelX-halfWallWidth, chapelX+halfWallWidth, rearZ-wallT/2, rearZ+wallT/2);
    addWall(chapelX-halfWallWidth, chapelX-openingHalf, frontZ-wallT/2, frontZ+wallT/2);
    addWall(chapelX+openingHalf, chapelX+halfWallWidth, frontZ-wallT/2, frontZ+wallT/2);
    // Door centre is taken from the original GLB node bounds, after the 180-degree Y rotation.
    const originalDoorWorldZ = chapelZ - 5.415 * chapelScale;
    addWall(chapelX-0.38, chapelX+0.38, originalDoorWorldZ-0.06, originalDoorWorldZ+0.06, 2.12);
  }

  function loadChapel() {
    const assetUrl = new URL('../village-chapel.glb', import.meta.url);
    // Query version bypasses any stale cache entry left by earlier service-worker builds.
    assetUrl.searchParams.set('asset', 'original-chapel-0511');

    fetch(assetUrl.href, { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status} при загрузке ${assetUrl.href}`);
        return response.arrayBuffer();
      })
      .then(buffer => gltfLoaderPromise.then(loader => {
        if (!loader) throw new Error('GLTFLoader не удалось импортировать из Three.js');
        return new Promise((resolve, reject) => {
          const basePath = new URL('.', assetUrl.href).href;
          loader.parse(buffer, basePath, resolve, reject);
        });
      }))
      .then(gltf => {
        const chapel = gltf.scene;
        chapel.name = 'Оригинальная каменная часовня — village-chapel.glb';
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
              material.transmission = 0;
              material.transparent = true;
              material.opacity = 0.62;
              material.roughness = 0.48;
              material.depthWrite = false;
            }

            const textures = [
              material.map, material.normalMap, material.roughnessMap,
              material.metalnessMap, material.aoMap, material.emissiveMap
            ];
            for (const texture of textures) {
              if (!texture) continue;
              if (texture === material.map || texture === material.emissiveMap) {
                texture.colorSpace = THREE.SRGBColorSpace;
              }
              texture.anisotropy = Math.min(isMobileDevice ? 2 : 4, rendererMaxAnisotropy());
            }
            material.needsUpdate = true;
          }

          if (node.name === 'Doors' || node.name.startsWith('Doors')) {
            addInteract(
              node,
              'Дверь сельской часовни',
              'Старая дверь заперта. На железной накладке видны следы недавнего прикосновения.',
              'ОБЪЕКТ'
            );
          }
        });

        scene.add(chapel);
        scene.updateMatrixWorld(true);
        addChapelColliders();
        console.info(
          '[ТИШИНА] Загружена ИСХОДНАЯ часовня village-chapel.glb:',
          assetUrl.href,
          'mesh count:',
          gltf.scene.children.length
        );
      })
      .catch(error => {
        // Deliberately do NOT create the procedural substitute. Keep the error visible
        // in Safari's console so a failed original-asset request cannot be mistaken for success.
        console.error('[ТИШИНА] ОШИБКА загрузки исходной часовни village-chapel.glb:', error);
      });
  }

  // All devices load the original optimized GLB at world startup, like the UAZ asset.
  // The small inline Three.js chapel is retained ONLY as a network/loader failure fallback.
  // This restores the selected chapel's original geometry, materials, side glazing and silhouette on iPhone.
  loadChapel();

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
