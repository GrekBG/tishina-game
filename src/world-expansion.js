// Exterior service yard extension for ТИШИНА 0.3.0, polished in 0.3.3.
// Designed for mobile WebGL: low-poly geometry, shared materials, modest light count.
export function installWorldExpansion({ THREE, scene, box, floor, mat, addInteract, colliders, surfaces }) {
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
  detail('Бетонная зона разгрузки', [20, 0.045, 8.0], [25, -0.008, 13.5], apronConcrete);
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
  // 0.3.3: shaped industrial utility van with a sloped cab, glazing, doors, lights, bumpers and detailed wheels.
  const vanX = -28, vanZ = 28;
  const van = new THREE.Group();van.name='Служебный фургон — детализированная модель';van.position.set(vanX,0,vanZ);scene.add(van);
  const vanPaint = toned(surfaces.plaster, 0x69746d, 0.78, 0.16);
  const vanDarkPaint = toned(surfaces.metal, 0x333b37, 0.82, 0.26);
  const vanRubber = new THREE.MeshStandardMaterial({ color:0x171c1a, roughness:0.99, metalness:0.0 });
  const vanGlass = new THREE.MeshStandardMaterial({ color:0x657b7a, roughness:0.27, metalness:0.02, transparent:true, opacity:0.66, side:THREE.DoubleSide });
  const vanTrim = new THREE.MeshStandardMaterial({ color:0x9a9b8c, roughness:0.86, metalness:0.05 });
  const vanLamp = new THREE.MeshStandardMaterial({ color:0xe1d6ac, emissive:0x66512b, emissiveIntensity:0.22, roughness:0.38, metalness:0.02 });
  // Extruded side profile creates the cab slope and a subtly rounded cargo body instead of two cubes.
  const vanProfile = new THREE.Shape();
  vanProfile.moveTo(-2.7,0.48);vanProfile.lineTo(2.7,0.48);vanProfile.lineTo(2.7,2.34);
  vanProfile.lineTo(1.75,2.48);vanProfile.lineTo(-0.82,2.48);vanProfile.lineTo(-1.52,2.05);
  vanProfile.lineTo(-1.72,1.54);vanProfile.lineTo(-2.7,1.48);vanProfile.closePath();
  const vanShellGeometry = new THREE.ExtrudeGeometry(vanProfile,{depth:2.78,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:0.045,bevelThickness:0.045});
  vanShellGeometry.rotateY(-Math.PI/2);
  const vanShell = new THREE.Mesh(vanShellGeometry,vanPaint);vanShell.name='Кузов фургона — профилированный';vanShell.position.set(1.39,0,0);vanShell.castShadow=true;vanShell.receiveShadow=true;van.add(vanShell);
  // Lower chassis and front/rear aprons.
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.7,.34,4.95),vanDarkPaint);chassis.position.set(0,.48,0);van.add(chassis);
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(3.05,.18,.22),vanDarkPaint);frontBumper.position.set(0,.62,-2.76);van.add(frontBumper);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(3.05,.18,.22),vanDarkPaint);rearBumper.position.set(0,.62,2.76);van.add(rearBumper);
  // Front windscreen and two side windows use trapezoid silhouettes.
  const frontWindowShape = new THREE.Shape();frontWindowShape.moveTo(-1.12,1.66);frontWindowShape.lineTo(1.12,1.66);frontWindowShape.lineTo(.82,2.32);frontWindowShape.lineTo(-.82,2.32);frontWindowShape.closePath();
  const frontWindow = new THREE.Mesh(new THREE.ShapeGeometry(frontWindowShape),vanGlass);frontWindow.name='Лобовое стекло фургона';frontWindow.position.set(0,0,-2.58);frontWindow.rotation.x=-0.32;van.add(frontWindow);
  const sideWindowShape = new THREE.Shape();sideWindowShape.moveTo(2.02,1.64);sideWindowShape.lineTo(1.56,2.30);sideWindowShape.lineTo(.76,2.30);sideWindowShape.lineTo(.76,1.64);sideWindowShape.closePath();
  const sideWindowGeo = new THREE.ShapeGeometry(sideWindowShape);
  for(const side of [-1,1]){
    const windowMesh = new THREE.Mesh(sideWindowGeo,vanGlass);windowMesh.name=side<0?'Левое боковое стекло':'Правое боковое стекло';windowMesh.position.set(side*1.402,0,0);windowMesh.rotation.y=Math.PI/2;van.add(windowMesh);
    const cargoWindowShape=new THREE.Shape();cargoWindowShape.moveTo(-.48,1.76);cargoWindowShape.lineTo(.44,1.76);cargoWindowShape.lineTo(.44,2.23);cargoWindowShape.lineTo(-.48,2.23);cargoWindowShape.closePath();
    const cargoWindow=new THREE.Mesh(new THREE.ShapeGeometry(cargoWindowShape),vanGlass);cargoWindow.name='Боковое грузовое окно';cargoWindow.position.set(side*1.402,0,0);cargoWindow.rotation.y=Math.PI/2;van.add(cargoWindow);
    // Sliding door seam, sill, handle, mirror and step.
    const seam = new THREE.Mesh(new THREE.BoxGeometry(.025,1.45,.025),vanDarkPaint);seam.position.set(side*1.405,1.18,.35);van.add(seam);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(.045,.07,.22),vanTrim);handle.position.set(side*1.43,1.46,-.52);van.add(handle);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(.12,.11,1.55),vanDarkPaint);sill.position.set(side*1.42,.67,-.2);van.add(sill);
    const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(.12,.06,.36),vanDarkPaint);mirrorArm.position.set(side*1.52,1.72,-1.72);mirrorArm.rotation.y=.22;van.add(mirrorArm);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(.12,.25,.32),vanDarkPaint);mirror.position.set(side*1.58,1.78,-1.87);van.add(mirror);
    const mirrorGlass = new THREE.Mesh(new THREE.BoxGeometry(.018,.18,.24),vanGlass);mirrorGlass.position.set(side*1.646,1.78,-1.87);van.add(mirrorGlass);
  }
  // Front grille, lamps, indicators, wipers and registration plate.
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.0,.34,.045),vanDarkPaint);grille.position.set(0,.98,-2.72);van.add(grille);
  for(let i=0;i<7;i++){const slot=new THREE.Mesh(new THREE.BoxGeometry(.035,.25,.018),vanTrim);slot.position.set(-.31+i*.103,.98,-2.752);van.add(slot);}
  for(const x of [-1.04,1.04]){
    const headlamp = new THREE.Mesh(new THREE.BoxGeometry(.42,.25,.085),vanLamp);headlamp.position.set(x,1.18,-2.72);van.add(headlamp);
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(.22,.10,.07),new THREE.MeshStandardMaterial({color:0x9a6938,roughness:.6,metalness:.02}));indicator.position.set(x,1.0,-2.72);van.add(indicator);
    const rearLamp = new THREE.Mesh(new THREE.BoxGeometry(.18,.42,.075),new THREE.MeshStandardMaterial({color:0x6b302c,roughness:.65,metalness:.02}));rearLamp.position.set(x,1.18,2.73);van.add(rearLamp);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.72,.17,.035),vanTrim);plate.position.set(0,.74,-2.73);van.add(plate);
  for(const x of [-.46,.46]){const wiper=new THREE.Mesh(new THREE.BoxGeometry(.62,.025,.035),vanDarkPaint);wiper.position.set(x,1.62,-2.57);wiper.rotation.z=x<0?.10:-.10;van.add(wiper);}
  // Four detailed rubber wheels with hubs and sidewall rings.
  const wheelGeo = new THREE.CylinderGeometry(.47,.47,.28,24);wheelGeo.rotateZ(Math.PI/2);
  const hubGeo = new THREE.CylinderGeometry(.23,.23,.295,18);hubGeo.rotateZ(Math.PI/2);
  for(const x of [-1.42,1.42])for(const z of [-1.72,1.72]){
    const wheel = new THREE.Mesh(wheelGeo,vanRubber);wheel.name='Шина фургона';wheel.position.set(x,.57,z);wheel.castShadow=true;van.add(wheel);
    const hub = new THREE.Mesh(hubGeo,vanTrim);hub.name='Ступица колеса';hub.position.set(x+Math.sign(x)*.02,.57,z);van.add(hub);
    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.31,12),vanDarkPaint);hubCap.rotation.z=Math.PI/2;hubCap.position.set(x+Math.sign(x)*.035,.57,z);van.add(hubCap);
  }
  // Side ribs, roof rain gutter and rear cargo doors provide visual scale and break up the silhouette.
  for(const side of [-1,1]){
    for(let z=.85;z<=2.35;z+=.42){const rib=new THREE.Mesh(new THREE.BoxGeometry(.035,1.48,.045),vanDarkPaint);rib.position.set(side*1.405,1.42,z);van.add(rib);}
    const gutter=new THREE.Mesh(new THREE.BoxGeometry(.045,.055,3.4),vanTrim);gutter.position.set(side*1.405,2.49,.55);van.add(gutter);
  }
  for(let x of [-.72,0,.72]){const rearRib=new THREE.Mesh(new THREE.BoxGeometry(.04,1.72,.035),vanDarkPaint);rearRib.position.set(x,1.48,2.73);van.add(rearRib);}
  const rearHandle=new THREE.Mesh(new THREE.BoxGeometry(.08,.34,.06),vanTrim);rearHandle.position.set(0,1.48,2.77);van.add(rearHandle);
  // Collision envelope for the assembled vehicle.
  colliders.push({minX:vanX-1.62,maxX:vanX+1.62,minY:0,maxY:2.65,minZ:vanZ-2.83,maxZ:vanZ+2.83});
  detail('Потухший задний фонарь — фургон', [0.18,0.24,0.06], [vanX+1.12,1.08,vanZ+2.79], mat(0x692f2d,0.78,0.01));


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
