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
  // 0.4.3 — weathered UAZ-452 service van: rounded cab-forward silhouette and real vehicle details.
const vanX = -28, vanZ = 28;
const uaz = new THREE.Group(); uaz.name = 'УАЗ-452 — старый служебный фургон'; uaz.position.set(vanX,0,vanZ); scene.add(uaz);
const uazPaint = toned(surfaces.plaster, 0x9b907a, 0.94, 0.025);
const uazDark = toned(surfaces.darkConcrete, 0x343a35, 0.94, 0.035);
const uazMetal = toned(surfaces.metal, 0x62645b, 0.88, 0.16);
const uazRubber = new THREE.MeshStandardMaterial({color:0x171917,roughness:0.995,metalness:0});
const uazGlass = new THREE.MeshStandardMaterial({color:0x52615e,roughness:0.24,metalness:0.015,transparent:true,opacity:0.78,side:THREE.DoubleSide});
const uazGasket = new THREE.MeshStandardMaterial({color:0x202421,roughness:0.98,metalness:0});
const uazLampRing = new THREE.MeshStandardMaterial({color:0x4b4b43,roughness:0.72,metalness:0.42});
const uazLamp = new THREE.MeshStandardMaterial({color:0xd7d0b5,emissive:0x4b4430,emissiveIntensity:0.32,roughness:0.28,metalness:0.05});
const uazAmber = new THREE.MeshStandardMaterial({color:0xa56f36,emissive:0x2c1607,emissiveIntensity:0.12,roughness:0.55});
const uazRed = new THREE.MeshStandardMaterial({color:0x71312d,emissive:0x210706,emissiveIntensity:0.08,roughness:0.62});

// Faded paint with vertical rain streaks, oxidized pinholes and irregular rust blooms.
const patinaCanvas = document.createElement('canvas'); patinaCanvas.width = patinaCanvas.height = 1024;
const patinaCtx = patinaCanvas.getContext('2d',{alpha:false});
patinaCtx.fillStyle = '#a49a82'; patinaCtx.fillRect(0,0,1024,1024);
let patinaSeed = 45219;
const patinaRand = () => { patinaSeed = (patinaSeed * 1664525 + 1013904223) >>> 0; return patinaSeed / 4294967296; };
for(let i=0;i<12500;i++){
 const x=patinaRand()*1024,y=patinaRand()*1024,r=.5+patinaRand()*5;
 const rustSpot=patinaRand()>.79;
 patinaCtx.fillStyle=rustSpot?`rgba(91,49,31,${.055+patinaRand()*.19})`:`rgba(${patinaRand()>.5?225:38},${patinaRand()>.5?213:42},${patinaRand()>.5?186:31},${.025+patinaRand()*.10})`;
 patinaCtx.beginPath(); patinaCtx.ellipse(x,y,r,r*(.45+patinaRand()),patinaRand()*Math.PI,0,Math.PI*2); patinaCtx.fill();
}
for(let i=0;i<68;i++){
 const x=patinaRand()*1024,y=patinaRand()*900,w=1+patinaRand()*5,h=30+patinaRand()*190;
 const grad=patinaCtx.createLinearGradient(x,y,x+(patinaRand()-.5)*12,y+h);
 grad.addColorStop(0,'rgba(73,43,27,0)');grad.addColorStop(.3,`rgba(84,48,30,${.08+patinaRand()*.17})`);grad.addColorStop(1,'rgba(73,43,27,0)');
 patinaCtx.fillStyle=grad;patinaCtx.fillRect(x,y,w,h);
}
const patinaTexture = new THREE.CanvasTexture(patinaCanvas);
patinaTexture.wrapS=patinaTexture.wrapT=THREE.RepeatWrapping;patinaTexture.repeat.set(1.35,1.15);
patinaTexture.colorSpace=THREE.SRGBColorSpace;patinaTexture.generateMipmaps=true;
patinaTexture.minFilter=THREE.LinearMipmapLinearFilter;patinaTexture.anisotropy=4;
uazPaint.map=patinaTexture;uazPaint.color.setHex(0xd0c4a9);uazPaint.needsUpdate=true;

function uazBox(name,size,pos,material,opts={}){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.position.set(...pos);
 mesh.castShadow=opts.cast!==false;mesh.receiveShadow=true;uaz.add(mesh);return mesh;
}
function uazCylinder(name,rTop,rBottom,height,pos,material,rotation=[0,0,0],segments=24){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBottom,height,segments),material);mesh.name=name;
 mesh.position.set(...pos);mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;uaz.add(mesh);return mesh;
}
function uazBeam(name,a,b,radius,material){
 const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),dir=new THREE.Vector3().subVectors(vb,va),len=dir.length();
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,len,8),material);
 mesh.name=name;mesh.position.copy(va).add(vb).multiplyScalar(.5);
 mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());mesh.castShadow=true;mesh.receiveShadow=true;uaz.add(mesh);return mesh;
}
function uazSideShape(name,shape,side,material){
 const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material);mesh.name=name;
 mesh.position.set(side*1.385,0,0);mesh.rotation.y=Math.PI/2;mesh.castShadow=false;mesh.receiveShadow=true;uaz.add(mesh);return mesh;
}

// One-piece rounded side profile with raised wheel arches, rather than a pair of rectangular boxes.
const uazProfile = new THREE.Shape();
uazProfile.moveTo(-2.48,.66);
uazProfile.lineTo(-2.02,.66);
uazProfile.quadraticCurveTo(-1.98,1.25,-1.53,1.25);
uazProfile.quadraticCurveTo(-1.08,1.25,-1.04,.66);
uazProfile.lineTo(1.04,.66);
uazProfile.quadraticCurveTo(1.08,1.25,1.53,1.25);
uazProfile.quadraticCurveTo(1.98,1.25,2.02,.66);
uazProfile.lineTo(2.48,.66);
uazProfile.lineTo(2.48,2.18);
uazProfile.quadraticCurveTo(2.48,2.47,2.19,2.52);
uazProfile.lineTo(-1.72,2.52);
uazProfile.quadraticCurveTo(-2.02,2.50,-2.17,2.30);
uazProfile.lineTo(-2.48,1.94);
uazProfile.closePath();
const uazBodyGeo=new THREE.ExtrudeGeometry(uazProfile,{depth:2.72,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.055,bevelThickness:.06,curveSegments:10});
uazBodyGeo.rotateY(-Math.PI/2);
const uazBody=new THREE.Mesh(uazBodyGeo,uazPaint);uazBody.name='Скруглённый кузов УАЗ-452 с арками колёс';
uazBody.position.x=1.36;uazBody.castShadow=true;uazBody.receiveShadow=true;uaz.add(uazBody);

// Cab-forward front panel, roof drip edge and front bumper.
uazBox('Передняя панель кабины',[2.48,1.34,.12],[0,1.55,-2.42],uazPaint);
uazBox('Передний бампер — изношенная сталь',[2.72,.19,.24],[0,.61,-2.57],uazMetal);
uazBox('Накладка бампера',[2.46,.065,.255],[0,.60,-2.70],uazDark);
for(const x of [-.92,.92]){
 uazBeam('Кронштейн переднего бампера',[x,.70,-2.38],[x,.70,-2.62],.055,uazDark);
 uazBeam('Буксировочная петля',[x,.53,-2.64],[x,.42,-2.72],.035,uazMetal);
}
uazBox('Защитная полка передка',[1.6,.08,.30],[0,1.05,-2.51],uazDark);

// Split windshield, rubber gaskets, center divider and two worn wiper arms.
const windShape=new THREE.Shape();
windShape.moveTo(-1.08,1.72);windShape.lineTo(1.08,1.72);windShape.lineTo(.98,2.34);
windShape.quadraticCurveTo(.93,2.39,.84,2.39);windShape.lineTo(-.84,2.39);
windShape.quadraticCurveTo(-.93,2.39,-.98,2.34);windShape.closePath();
const windshield=new THREE.Mesh(new THREE.ShapeGeometry(windShape),uazGlass);
windshield.name='Два мутных лобовых стекла УАЗ';windshield.position.set(0,0,-2.49);windshield.rotation.x=-.04;uaz.add(windshield);
uazBox('Уплотнитель лобового стекла — верх',[2.18,.055,.06],[0,2.405,-2.50],uazGasket);
uazBox('Уплотнитель лобового стекла — низ',[2.20,.055,.06],[0,1.70,-2.50],uazGasket);
uazBox('Разделитель лобового стекла',[.045,.69,.06],[0,2.05,-2.515],uazDark);
for(const x of [-.55,.55]){
 const wiper=uazBox('Старый стеклоочиститель',[.58,.025,.045],[x,1.76,-2.535],uazDark);
 wiper.rotation.z=x<0?-.12:.12;
}

// UAZ signature: two round recessed headlights and a narrow horizontal grille.
for(const x of [-.98,.98]){
 uazCylinder('Обод круглой фары УАЗ',.285,.285,.095,[x,1.42,-2.565],uazLampRing,[Math.PI/2,0,0],28);
 uazCylinder('Мутное стекло круглой фары',.235,.235,.105,[x,1.42,-2.625],uazLamp,[Math.PI/2,0,0],28);
 uazBox('Передний указатель поворота',[.23,.12,.07],[x,1.07,-2.56],uazAmber);
 uazBox('Передний габарит',[.15,.08,.06],[x,1.23,-2.57],uazAmber);
}
uazBox('Решётка радиатора — ниша',[.88,.34,.065],[0,1.27,-2.565],uazDark);
for(let y=1.15;y<=1.39;y+=.06)uazBox('Горизонтальная планка радиаторной решётки',[.78,.018,.035],[0,y,-2.61],uazMetal);
uazBox('Передний номерной знак',[.64,.16,.035],[0,.82,-2.59],uazMetal);
uazBox('Тёмная окантовка номерного знака',[.70,.21,.025],[0,.82,-2.57],uazDark);

// A worn dashboard, steering wheel and two seats make the cab read as a usable vehicle.
uazBox('Панель приборов',[2.05,.17,.42],[0,1.48,-2.02],uazDark);
uazBox('Потёртая приборная вставка',[1.48,.09,.035],[0,1.51,-2.24],uazMetal);
for(const x of [-.52,.52]){
 uazBox('Сиденье кабины — подушка',[.56,.18,.58],[x,.93,-1.38],uazDark);
 const seatBack=uazBox('Сиденье кабины — спинка',[.56,.72,.17],[x,1.30,-1.69],uazDark);
 seatBack.rotation.x=-.10;
 uazBox('Подголовник сиденья',[.34,.19,.13],[x,1.78,-1.73],uazDark);
}
const steeringWheel=new THREE.Mesh(new THREE.TorusGeometry(.19,.026,8,24),uazMetal);
steeringWheel.name='Рулевое колесо УАЗ';steeringWheel.position.set(-.60,1.60,-1.94);steeringWheel.rotation.x=Math.PI/2;uaz.add(steeringWheel);
uazBeam('Рулевая колонка',[-.60,1.37,-1.93],[-.60,1.58,-1.93],.045,uazDark);

// Side windows: separate driver/passenger glass and two broad cargo windows per side.
const cabWindow=new THREE.Shape();
cabWindow.moveTo(1.12,1.68);cabWindow.lineTo(2.16,1.68);cabWindow.lineTo(2.08,2.28);
cabWindow.quadraticCurveTo(2.04,2.33,1.96,2.33);cabWindow.lineTo(1.43,2.33);
cabWindow.lineTo(1.15,2.05);cabWindow.closePath();
const cargoWindow1=new THREE.Shape();
cargoWindow1.moveTo(-.05,1.72);cargoWindow1.lineTo(-.88,1.72);cargoWindow1.lineTo(-.88,2.30);cargoWindow1.lineTo(-.05,2.30);cargoWindow1.closePath();
const cargoWindow2=new THREE.Shape();
cargoWindow2.moveTo(-1.02,1.72);cargoWindow2.lineTo(-2.08,1.72);cargoWindow2.lineTo(-2.08,2.28);
cargoWindow2.quadraticCurveTo(-2.04,2.34,-1.96,2.34);cargoWindow2.lineTo(-1.02,2.34);cargoWindow2.closePath();
for(const side of [-1,1]){
 uazSideShape('Боковое стекло водительской двери',cabWindow,side,uazGlass);
 uazSideShape('Боковое грузовое стекло — среднее',cargoWindow1,side,uazGlass);
 uazSideShape('Боковое грузовое стекло — заднее',cargoWindow2,side,uazGlass);
 // Rubber window surrounds and body seams.
 for(const [z,y0,y1] of [[-1.64,1.63,2.36],[-.47,1.68,2.36],[.46,1.68,2.36],[1.55,1.66,2.36]]){
  uazBox('Стойка кузова вокруг бокового стекла',[.055,y1-y0,.065],[side*1.405,(y0+y1)/2,z],uazGasket);
 }
 uazBox('Нижняя окантовка боковых окон',[.045,.055,3.95],[side*1.405,1.64,.13],uazDark);
 // Cab door outline, two handles, three hinges and worn running board.
 uazBox('Шов водительской двери',[.035,1.22,.035],[side*1.405,1.27,-1.02],uazDark);
 uazBox('Ручка боковой двери',[.055,.075,.22],[side*1.445,1.47,-.84],uazMetal);
 for(const y of [.94,1.48,2.04])uazBox('Петля водительской двери',[.09,.12,.16],[side*1.43,y,-1.82],uazMetal);
 uazBox('Подножка под боковой дверью',[.22,.11,1.10],[side*1.42,.66,-1.10],uazDark);
 // Old mirror arms and rectangular mirrors.
 uazBeam('Кронштейн бокового зеркала',[side*1.34,1.86,-1.88],[side*1.72,1.93,-2.05],.045,uazMetal);
 uazBox('Корпус бокового зеркала',[.11,.32,.26],[side*1.75,1.95,-2.06],uazDark);
 uazBox('Зеркальная поверхность',[.025,.24,.19],[side*1.81,1.95,-2.06],uazGlass);
 // Faded ribs pressed into the side panels, plus roof rain gutter.
 for(const z of [-.72,-.34,.04,.42,.80,1.18,1.56,1.94]){
  uazBox('Штампованное ребро боковой панели',[.028,.82,.035],[side*1.392,1.12,z],uazMetal);
 }
 uazBox('Водосточный желоб крыши',[.065,.07,4.55],[side*1.34,2.49,.06],uazDark);
 // Faded vertical rust streak accents on the lower side.
 for(const z of [-.60,.02,.68,1.36,2.05]){
  uazBox('Пятно старой ржавчины на борту',[.012,.36,.12],[side*1.414,.94,z],rust);
 }
}

// Wheels with sidewalls, pressed steel hubs, lug nuts and half-round mudguards.
const wheelGeometry=new THREE.CylinderGeometry(.49,.49,.30,32);wheelGeometry.rotateZ(Math.PI/2);
const hubGeometry=new THREE.CylinderGeometry(.245,.245,.315,24);hubGeometry.rotateZ(Math.PI/2);
const wheelArchGeometry=new THREE.TorusGeometry(.565,.055,8,28,Math.PI);
wheelArchGeometry.rotateY(Math.PI/2);
for(const side of [-1,1])for(const z of [-1.55,1.55]){
 const tire=new THREE.Mesh(wheelGeometry,uazRubber);tire.name='Грязная внедорожная шина УАЗ';tire.position.set(side*1.40,.68,z);tire.castShadow=true;uaz.add(tire);
 const hub=new THREE.Mesh(hubGeometry,uazMetal);hub.name='Штампованный диск колеса';hub.position.set(side*1.43,.68,z);uaz.add(hub);
 const cap=uazCylinder('Ступичный колпак',.105,.105,.33,[side*1.46,.68,z],uazDark,[0,0,Math.PI/2],16);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.205,.027,8,20),uazMetal);ring.rotation.y=Math.PI/2;ring.position.set(side*1.455,.68,z);uaz.add(ring);
 const arch=new THREE.Mesh(wheelArchGeometry,uazDark);arch.name='Накладка арки колеса';arch.position.set(side*1.39, .68, z);arch.rotation.z=Math.PI;uaz.add(arch);
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3;
  uazCylinder('Колёсная гайка',.027,.027,.035,[side*1.47,.68+Math.sin(a)*.16,z+Math.cos(a)*.16],uazDark,[0,0,Math.PI/2],8);
 }
}
// Rear doors, spare wheel, bumpers and faded tail lamps.
uazBox('Задний бампер',[2.72,.18,.22],[0,.62,2.55],uazMetal);
uazBox('Задняя дверь — шов створок',[.035,1.48,.05],[0,1.48,2.50],uazDark);
uazBox('Ручка задних дверей',[.075,.24,.07],[0,1.45,2.57],uazMetal);
for(const x of [-1.05,1.05]){
 uazBox('Задний фонарь УАЗ',[.18,.42,.085],[x,1.25,2.52],uazRed);
 uazBox('Задний указатель',[.18,.12,.09],[x,1.48,2.52],uazAmber);
}
const spare=new THREE.Mesh(wheelGeometry,uazRubber);spare.name='Запасное колесо на задней двери';
spare.position.set(0,1.44,2.70);spare.rotation.y=Math.PI/2;uaz.add(spare);
uazCylinder('Колпак запасного колеса',.19,.19,.33,[0,1.44,2.88],uazMetal,[Math.PI/2,0,0],18);
uazBox('Табличка СЕВЕР-7',[.62,.16,.035],[0,2.02,2.56],uazDark);
uazBox('Передняя эмблема',[.16,.13,.035],[0,1.48,-2.64],uazMetal);

// Collision envelope for the assembled UAZ.
colliders.push({minX:vanX-1.62,maxX:vanX+1.62,minY:0,maxY:2.65,minZ:vanZ-2.80,maxZ:vanZ+2.82});
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
