// Exterior service yard extension for ТИШИНА 0.3.0.
// Designed for mobile WebGL: low-poly geometry, shared materials, modest light count.
export function installWorldExpansion({ THREE, scene, box, floor, mat, addInteract, colliders, surfaces }) {
  const toned = (base, color, roughness, metalness) => { const m = base.clone(); m.color.setHex(color); m.roughness = roughness; m.metalness = metalness; return m; };
  const steel = toned(surfaces.metal, 0x303a37, 0.72, 0.72);
  const darkSteel = toned(surfaces.darkConcrete, 0x202927, 0.82, 0.58);
  const fadedPaint = toned(surfaces.plaster, 0x59655d, 0.9, 0.16);
  const hazard = toned(surfaces.yellow, 0xb18b46, 0.86, 0.12);
  const wetAsphalt = toned(surfaces.floorMat, 0x303936, 0.48, 0.22);
  const rust = toned(surfaces.rust, 0x684737, 0.96, 0.25);
  const glass = new THREE.MeshStandardMaterial({ color: 0x71817c, roughness: 0.22, metalness: 0.25, transparent: true, opacity: 0.42 });
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
  detail('Дорога — мокрый асфальт', [10, 0.025, 82], [0, -0.018, 27], mat(0x202927, 0.36, 0.18));
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
  solid('Погрузочная рампа', [18, 0.72, 5.2], [25, 0.28, 18], mat(0x515953, 0.94, 0.04));
  for (let i = 0; i < 6; i++) {
    const x = 17 + i * 3.0;
    solid('Отбойник рампы', [0.18, 0.52, 0.18], [x, 0.28, 15.25], steel);
    detail('Жёлто-чёрная маркировка рампы', [0.12, 0.028, 0.52], [x, 0.66, 15.2], hazard);
  }
  const containerColors = [mat(0x46564f, 0.9, 0.24), mat(0x4f4a40, 0.92, 0.18), mat(0x465052, 0.88, 0.22)];
  for (let i = 0; i < 4; i++) {
    const x = 20 + (i % 2) * 9.4, z = 25 + Math.floor(i / 2) * 7.2;
    solid('Грузовой контейнер', [8.4, 2.65, 6.2], [x, 1.34, z], containerColors[i % 3]);
    for (let k = 0; k < 9; k++) detail('Рёбра контейнера', [0.07, 2.5, 0.07], [x - 3.8 + k * 0.95, 1.34, z - 3.14], steel);
    detail('Маркировочная табличка контейнера', [1.1, 0.38, 0.045], [x, 1.9, z - 3.18], fadedPaint);
    detail('Номер контейнера', [0.45, 0.035, 0.018], [x, 1.93, z - 3.21], mat(0xc0bba6, 0.85, 0));
  }
  // A service van silhouette gives scale and a strong landmark without heavy geometry.
  const vanX = -28, vanZ = 28;
  solid('Служебный фургон — кузов', [3.1, 1.55, 5.4], [vanX, 1.1, vanZ], mat(0x414b47, 0.82, 0.18));
  solid('Служебный фургон — кабина', [2.9, 1.45, 1.9], [vanX, 2.1, vanZ - 1.55], fadedPaint);
  detail('Лобовое стекло фургона', [2.45, 0.82, 0.05], [vanX, 2.12, vanZ - 2.52], glass);
  for (const x of [vanX - 1.45, vanX + 1.45]) for (const z of [vanZ - 1.7, vanZ + 1.7]) {
    const wheel = cylinder('Колесо служебного фургона', 0.47, 0.47, 0.24, [x, 0.58, z], darkSteel, 12);
    wheel.rotation.z = Math.PI / 2;
  }
  detail('Потухший задний фонарь', [0.2, 0.3, 0.06], [vanX + 1.12, 1.08, vanZ + 2.73], mat(0x692f2d, 0.72, 0.12));

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
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.45 + (i % 4) * 0.22, 16), new THREE.MeshStandardMaterial({ color: i % 3 ? 0x3f4b47 : 0x282d2a, roughness: 0.28, metalness: 0.22, transparent: true, opacity: 0.28 }));
    stain.rotation.x = -Math.PI / 2; stain.position.set(x, -0.012, z); stain.scale.set(1.6, 0.62, 1); scene.add(stain);
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
