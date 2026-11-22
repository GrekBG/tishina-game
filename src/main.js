import { installPbrSurfaces } from './pbr-surfaces.js';
import { installWorldExpansion } from './world-expansion.js';
import { createStoryController } from './story.js';
import { installSkyWeather } from './sky-weather.js';

const THREE = window.THREE;
if (!THREE) throw new Error('Three.js не загружен: обновите страницу и проверьте соединение.');
const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const isMobileDevice = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
const pixelRatioLimit = isMobileDevice ? 1.2 : 1.5;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9aa39e);
scene.fog = new THREE.FogExp2(0x9aa39e, 0.018);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 90);
camera.position.set(0, 1.68, 10.5);
scene.add(camera); // Camera-only first-person view: no visible player body, arms or legs.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioLimit));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
// Mobile Safari gets a lighter shadow path; HD surface maps stay at 1024×1024.
renderer.shadowMap.enabled = !isMobileDevice;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemisphereLight = new THREE.HemisphereLight(0xc5d0cb, 0x242d29, 0.92);
scene.add(hemisphereLight);
const sun = new THREE.DirectionalLight(0xd6ded9, 1.45);
sun.position.set(-12, 20, 9); sun.castShadow = !isMobileDevice;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -22; sun.shadow.camera.right = 22; sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
sun.shadow.bias = -0.00025; scene.add(sun);
const skyWeather = installSkyWeather({ THREE, scene, camera, sun, hemisphereLight, renderer, onHud: ({ date, clock, weather }) => { const dateEl = $('worldDate'); const timeEl = $('worldClock'); const weatherEl = $('worldWeather'); if (dateEl) dateEl.textContent = date; if (timeEl) timeEl.textContent = clock; if (weatherEl) weatherEl.textContent = weather; } });

// 0.3.3 flashlight: camera-mounted spotlight with a soft local fill.
// It follows camera yaw/pitch, does not render a hand-held body model, and casts no mobile shadow map.
const flashlight = new THREE.SpotLight(0xffe2b7, 0, 34, Math.PI / 7.2, 0.52, 1.55);
flashlight.position.set(0, -0.045, -0.035);
flashlight.target.position.set(0, 0, -1);
flashlight.castShadow = false;
camera.add(flashlight);
camera.add(flashlight.target);
const flashlightFill = new THREE.PointLight(0xffd9a1, 0, 2.1, 2);
flashlightFill.position.set(0, -0.06, -0.24);
camera.add(flashlightFill);

function grungeTexture(base, seed=1){
 const size=1024,c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d',{alpha:false});g.fillStyle=base;g.fillRect(0,0,size,size);
 let n=seed;const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=Math.min(isMobileDevice?4:8,renderer.capabilities.getMaxAnisotropy());
 // Draw the existing 1024px grain in small batches, so the menu and input handlers can boot first.
 let index=0;
 const drawBatch=()=>{
  const end=Math.min(index+900,26000);
  for(;index<end;index++){const v=Math.floor(rand()*95),a=.018+rand()*.105;g.fillStyle=rand()>.48?`rgba(225,225,210,${a})`:`rgba(10,14,12,${a})`;g.fillRect(rand()*size,rand()*size,.8+rand()*7,.8+rand()*5);}
  if(index<26000){setTimeout(drawBatch,0);return;}
  for(let i=0;i<82;i++){g.strokeStyle=`rgba(20,24,21,${.035+rand()*.10})`;g.lineWidth=.7+rand()*3;g.beginPath();let x=rand()*size,y=rand()*size;g.moveTo(x,y);g.lineTo(x+(rand()-.5)*170,y+45+rand()*220);g.stroke();}
  t.needsUpdate=true;
 };
 t.needsUpdate=true;setTimeout(drawBatch,0);return t;
}
const concreteMap=grungeTexture('#777d77',7), plasterMap=grungeTexture('#999b90',13), floorMap=grungeTexture('#666b64',23);
const mat = (color, roughness=0.92, metalness=0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const concrete = mat(0x747a75), darkConcrete = mat(0x444b47), plaster = mat(0x888d85), dirtyWhite = mat(0x9a9b8f), metal = mat(0x414b49,.78,.62), rust = mat(0x704b37,.96,.08), glass = new THREE.MeshStandardMaterial({color:0x738b8a,roughness:.42,metalness:.02,transparent:true,opacity:.30}), floorMat = mat(0x686d66,.98,.015), wood = mat(0x554b3e), paper = mat(0xb7b39e), yellow = mat(0x9b8b55,.9,.03);
const gravelMat = mat(0x65645a,.99,.0), earthMat = mat(0x4e5148,.99,.0), driveConcreteMat = mat(0x73766e,.96,.0);
// Shared hangar steel materials (also used by the main scene, not only the yard module).
const steel = metal.clone(); steel.color.setHex(0x303a37); steel.roughness = 0.72; steel.metalness = 0.72;
const darkSteel = darkConcrete.clone(); darkSteel.color.setHex(0x202927); darkSteel.roughness = 0.82; darkSteel.metalness = 0.58;
const pbrBuild = installPbrSurfaces(THREE, { concrete, darkConcrete, plaster, dirtyWhite, metal, rust, floorMat, wood, paper, yellow, gravel:gravelMat, earth:earthMat, driveConcrete:driveConcreteMat }, {
 renderer, quality: 'ultra', maxAnisotropy: isMobileDevice ? 4 : 8, rowsPerYield: isMobileDevice ? 12 : 24
}).catch(error => { console.error('[ТИШИНА] HD PBR generation failed; keeping base 1024px maps.', error); });
const colliders=[]; const interactables=[]; const inventory=[]; const motionObjects=[]; const pickupObjects={};
let pendingItemId=null,heldItemId=null,heldObject=null,heldSourceRoot=null,heldPointer=null,activeMotion=null;let heldFlipped=false,heldNoteOpen=false,heldRadioPowered=false,heldRadioChannel=4;const INVENTORY_MAX_SLOTS=8,INVENTORY_MAX_WEIGHT=8;
function readStored(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
const legacySaved=readStored('tishina02')||{};
const autosaved=readStored('tishinaAutoV1')||legacySaved;
let flashlightOn=Boolean(autosaved.flashlightOn);
(autosaved.items||[]).forEach(x=>inventory.push(x));
let medkits=Math.max(0,Number(autosaved.medkits)||0),energyItems=Math.max(0,Number(autosaved.energyItems)||0);
let yaw=0, pitch=0, started=false, activeTarget=null, modalOpen=false, joy={x:0,y:0}, joyTarget={x:0,y:0}, keys={}, drag=null, last=performance.now(), bob=0;
let posture='stand', jumpHeight=0, jumpVelocity=0, grounded=true, lowSpaceBlocked=false,peekState=null;
let handAction=null, soundContext=null, physicalFeedbackTimer=null;
let stanceFrom=null, stanceElapsed=1, sprintHeld=false, sprintBlend=0, stamina=100, staminaRecoveryDelay=0, sprintLocked=false, lastStaminaShown=-1;
const loadedHealth=Number(autosaved.health??100);
let health=Number.isFinite(loadedHealth)?Math.max(0,Math.min(100,loadedHealth)):100,lastHealthShown=-1,hazardClock=0,hazardNotice=false,bodyTime=0;
let damageFlashTimer=null;
const postures={stand:{eye:1.68,height:1.82,radius:.32,speed:3.5,label:'СТОЯ'},crouch:{eye:1.08,height:1.16,radius:.30,speed:2.0,label:'ПРИСЕЛ'},prone:{eye:.48,height:.62,radius:.27,speed:1.0,label:'ЛЁЖА'}};
const stance={...postures.stand};
const STANCE_TRANSITION_SECONDS=.38, SPRINT_MULTIPLIER=1.68, STAMINA_DRAIN=17, STAMINA_REGEN=16, STAMINA_RESTART=24;
const HEALTH_MAX=100,HEALTH_HAZARD_DAMAGE=9,HEALTH_HAZARD_INTERVAL=.72;
const lowClearanceZones=[{minX:-4.28,maxX:4.28,minZ:-11.0,maxZ:-9.46,clearance:.66,label:'Обрушившаяся балка'}];
concrete.map=concreteMap; plaster.map=plasterMap; floorMat.map=floorMap;
const forecourtMat=floorMat.clone();forecourtMat.color.setHex(0x777b73);forecourtMat.roughness=.985;forecourtMat.metalness=.01;

function box(parent, name, size, pos, material, opts={}) {
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material); mesh.name=name; mesh.position.set(...pos); mesh.castShadow=opts.cast!==false; mesh.receiveShadow=true; parent.add(mesh); if(opts.solid){const bounds=new THREE.Box3().setFromObject(mesh);colliders.push({minX:bounds.min.x,maxX:bounds.max.x,minY:bounds.min.y,maxY:bounds.max.y,minZ:bounds.min.z,maxZ:bounds.max.z});} return mesh;
}
function wall(name,x,y,z,w,h,d,material=concrete, collide=true){const m=box(scene,name,[w,h,d],[x,y,z],material);if(collide)colliders.push({minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2});return m;}
function floor(name,x,z,w,d,material=floorMat,y=0){return box(scene,name,[w,.18,d],[x,y,z],material,{cast:false});}
function addInteract(obj, title, description, type='ОСМОТР', action=null){obj.userData.interaction={title,description,type,action};interactables.push(obj);return obj;}

// Rain-darkened forecourt and approach.
floor('Мокрый асфальт',0,17,96,88,forecourtMat,-.12);
for(let i=0;i<9;i++){
 const puddle=new THREE.Mesh(new THREE.CircleGeometry(1.1+(i%3)*.45,24),new THREE.MeshStandardMaterial({color:0x7c8881,roughness:.42,metalness:.015,transparent:true,opacity:.24}));puddle.rotation.x=-Math.PI/2;puddle.position.set(-13+i*3.4,-.018,8+(i%2)*5);puddle.scale.y=.45;scene.add(puddle);
}
// Distant industrial silhouettes.
for(let i=0;i<6;i++){
 const x=-25+i*10; wall('Дальний корпус',x,5,-28,7,10,5,darkConcrete,false);
 const chimney= new THREE.Mesh(new THREE.CylinderGeometry(.55,.72,17,8),rust);chimney.position.set(x+2,8,-31);scene.add(chimney);
}
// Exterior warehouse shell, with a central entrance opening.
wall('Фасад левый',-6.2,4,-1,5.6,8,.7,concrete);
wall('Фасад правый',6.2,4,-1,5.6,8,.7,concrete);
wall('Фасад верх',0,7.4,-1,6.8,1.2,.7,concrete);
// A real window opening is cut into the left exterior wall: lower/upper masonry and side piers leave a clear aperture.
wall('Наружная стена слева — низ',-9.3,.45,-10,.7,.9,18,concrete);
wall('Наружная стена слева — верх',-9.3,5.25,-10,.7,5.5,18,concrete);
wall('Наружная стена слева — до окна',-9.3,1.7,-6.45,.7,1.6,10.9,concrete);
wall('Наружная стена слева — после окна',-9.3,1.7,-16.55,.7,1.6,4.9,concrete);
wall('Правая наружная стена',9.3,4,-10,.7,8,18,concrete);
wall('Задняя наружная стена',0,4,-19,19,8,.7,concrete);

// 0.3.3 — complete two-pitch industrial hangar roof with sealed gables, corrugated sheets and trusses.
const roofMetal=metal.clone();roofMetal.side=THREE.DoubleSide;roofMetal.roughness=.82;roofMetal.metalness=.52;
function roofQuad(name,points,material){
 const geometry=new THREE.BufferGeometry();
 const positions=points.flat();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
 geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
function roofTriangle(name,points,material){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,.5,1,1,0],2));geometry.setIndex([0,1,2]);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.material=material;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
const roofZ0=-19.55,roofZ1=-.48,roofMid=(roofZ0+roofZ1)/2;
const gableMat=darkSteel.clone();gableMat.side=THREE.DoubleSide;gableMat.roughness=.94;gableMat.metalness=.04;
roofQuad('Кровля ангара — левый скат',[[-9.85,8.08,roofZ0],[0,9.82,roofZ0],[0,9.82,roofZ1],[-9.85,8.08,roofZ1]],roofMetal);
roofQuad('Кровля ангара — правый скат',[[0,9.82,roofZ0],[9.85,8.08,roofZ0],[9.85,8.08,roofZ1],[0,9.82,roofZ1]],roofMetal);
for(const z of [roofZ0+.12,roofZ1-.12]){
 roofTriangle('Фронтон ангара — закрытая треугольная вставка',[[-9.35,8.0,z],[0,9.78,z],[9.35,8.0,z]],gableMat);
}
function beamBetween(name,a,b,thickness,material){
 const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),direction=new THREE.Vector3().subVectors(vb,va),length=direction.length();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(thickness,length,thickness),material);mesh.name=name;mesh.position.copy(va).add(vb).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
for(const z of [-2.2,-6.3,-10.4,-14.5,-18.4]){
 beamBetween('Стропило фермы — левое',[-9.25,7.94,z],[0,9.62,z],.16,darkSteel);
 beamBetween('Стропило фермы — правое',[0,9.62,z],[9.25,7.94,z],.16,darkSteel);
 box(scene,'Затяжка кровельной фермы',[18.55,.16,.16],[0,7.98,z],darkSteel);
 beamBetween('Раскос фермы — левый',[-4.65,8.79,z],[0,7.98,z],.105,steel);
 beamBetween('Раскос фермы — правый',[0,7.98,z],[4.65,8.79,z],.105,steel);
 beamBetween('Подвес конька',[0,9.62,z],[0,8.12,z],.10,steel);
}
// Raised longitudinal ribs catch grazing light and make the corrugated metal roof read at a distance.
for(let x=-9.25;x<=9.25;x+=.62){
 const left=x<0,ax=Math.abs(x),y=8.08+(1.74*(1-ax/9.85));
 const rib=box(scene,'Ребро профнастила крыши',[.055,.06,19.0],[x,y,roofMid],steel,{cast:false});
 rib.rotation.z=left?.175:-.175;
}
// Gable joints and eave trims close the roof envelope at the building ends.
for(const z of [roofZ0,roofZ1]){
 beamBetween('Торцевой карниз — левый',[-9.85,8.08,z],[0,9.82,z],.14,steel);
 beamBetween('Торцевой карниз — правый',[0,9.82,z],[9.85,8.08,z],.14,steel);
}
beamBetween('Коньковая накладка',[0,9.86,roofZ0],[0,9.86,roofZ1],.18,steel);
floor('Пол первого этажа',0,-10,18.5,18,floorMat,0);
// Broken windows and concrete lintels on the front elevation.
for(const x of [-7.8,-4.9,4.9,7.8]){
 const win=box(scene,'Разбитое окно',[1.45,1.55,.12],[x,5.35,-.59],glass,{cast:false});
 box(scene,'Подоконник',[1.8,.16,.42],[x,4.48,-.48],darkConcrete);
 box(scene,'Перемычка',[1.8,.18,.42],[x,6.22,-.48],darkConcrete);
 box(scene,'Осколок стекла',[.04,1.1,.05],[x+.25,5.3,-.45],glass,{cast:false});
}
// Entry vestibule and corridors.
wall('Тамбур левая',-2.2,2.1,-3.5,.25,4.2,4.5,plaster);
wall('Тамбур правая',2.2,2.1,-3.5,.25,4.2,4.5,plaster);
wall('Тамбур задняя левая',-1.65,2.1,-5.75,1.0,4.2,.25,plaster);
wall('Тамбур задняя правая',1.65,2.1,-5.75,1.0,4.2,.25,plaster);
// Main corridor cross partitions and rooms, door gaps left open.
wall('Коридор перегородка A',-5.8,2.1,-8.1,7.0,4.2,.22,plaster);
wall('Коридор перегородка B',5.8,2.1,-8.1,7.0,4.2,.22,plaster);
wall('Офис стена левая',-4.4,2.1,-12.4,.22,4.2,8.4,plaster);
wall('Офис стена правая',4.4,2.1,-12.4,.22,4.2,8.4,plaster);
wall('Офис задняя',0,2.1,-16.5,8.8,4.2,.22,plaster);
// 0.3.3: a full-width fallen roof beam, visibly supported by debris at both ends.
// The only passage is a 66 cm crawl gap; the corridor width is blocked from wall to wall.
box(scene,'Обрушившаяся балка — поперечная ферма',[8.24,.30,.58],[0,.83,-10.23],rust);
box(scene,'Обломок арматуры — передний',[4.8,.055,.06],[-.05,.655,-10.51],metal);
box(scene,'Опора балки — левый бетонный простенок',[.64,.68,.82],[-4.02,.34,-10.22],darkConcrete);
box(scene,'Опора балки — правый бетонный простенок',[.64,.68,.82],[4.02,.34,-10.22],darkConcrete);
for(const side of [-1,1]){
 for(let i=0;i<5;i++){
  const rubble= new THREE.Mesh(new THREE.DodecahedronGeometry(.18+(i%3)*.08,0),i%2?darkConcrete:rust);
  rubble.position.set(side*(3.18+i*.20),.12+(i%2)*.07,-10.78+(i%3)*.26);rubble.rotation.set(i*.6,i*.4,i*.9);scene.add(rubble);
 }
}

// Suspended ceiling strips and structural beams.
for(let z=-2;z>=-18;z-=4){box(scene,'Балка перекрытия',[18,.34,.48],[0,4.18,z],darkConcrete);}
// Doors, cabinets and drawers are physical motion objects. Their target position and speed are saved.
function registerHingedMotion(pivot,{kind='door',label='Дверь',description='',openAngle=Math.PI*.47,slow=1.8,fast=14,blocksPassage=false}={}){
 pivot.userData={...pivot.userData,open:false,ajar:false,target:0,targetFraction:0,hinged:true,motionKind:kind,motionLabel:label,motionDescription:description,openAngle,closedValue:0,openedValue:openAngle,speed:7,slowSpeed:slow,fastSpeed:fast,velocity:0,manualHold:0,manualHoldSpeed:.38,blocksPassage};motionObjects.push(pivot);return pivot;
}
function makeDoor(label,x,z,hingeSide=1,kind='door'){
 const pivot=new THREE.Group();pivot.position.set(x,0,z);pivot.name=`door:${label}`;scene.add(pivot);
 const width=kind==='cabinet'?.72:label==='Входная дверь'?2.8:1.25,height=kind==='cabinet'?1.65:2.75,thick=.12;
 const leaf=box(pivot,label,[width,height,thick],[hingeSide*width/2,height/2,0],kind==='cabinet'?wood:metal);
 box(pivot,'Ручка',[.06,.18,.07],[hingeSide*width*.82,height*.48,-.1],yellow);
 addInteract(leaf,label,kind==='cabinet'?'Старая дверца шкафа. Петли ещё держатся.':'Краска облупилась. Механизм давно не смазывали.','ДВЕРЬ',()=>openMotionPanel(pivot));
 registerHingedMotion(pivot,{kind:'door',label,description:kind==='cabinet'?'Петли сухие, внутри шкафа может что-то лежать.':'Старая дверь на тяжёлых петлях. Можно открыть её бесшумно, резко или оставить узкую щель.',openAngle:hingeSide*Math.PI*.47,blocksPassage:kind==='door'});pivot.userData.leaf=leaf;return pivot;
}
const entryDoor=makeDoor('Входная дверь',-.65,-1.02,1);

// Seal the overly wide rectangular facade opening around the real entrance door.
wall('Фасад — заполнение слева от входа',-2.025,3.4,-1.0,2.75,6.8,.72,concrete);
wall('Фасад — заполнение справа от входа',2.775,3.4,-1.0,1.25,6.8,.72,concrete);
wall('Фасад — перемычка над входной дверью',.75,4.775,-1.0,2.8,4.05,.72,concrete);
const officeDoor=makeDoor('Дверь кабинета',-.6,-8.12,1);
// The office window has a genuine opening in the masonry and a hinged glass sash.
function makeOpenableWindow(){
 const frameX=-8.91,centerY=1.7,centerZ=-13.0;
 box(scene,'Оконная рама верх',[.14,.09,2.25],[frameX,2.52,centerZ],wood);box(scene,'Оконная рама низ',[.14,.09,2.25],[frameX,.88,centerZ],wood);
 for(const z of [centerZ-1.08,centerZ+1.08])box(scene,'Оконная рама бок',[.14,1.7,.09],[frameX,centerY,z],wood);
 const pivot=new THREE.Group();pivot.position.set(-8.82,.9,centerZ+1.0);pivot.name='window:Окно бокового корпуса';scene.add(pivot);
 const pane=box(pivot,'Створка окна',[.055,1.5,2.0],[0,.8,-1.0],glass,{cast:false});
 box(pivot,'Перекладина окна',[.07,.07,2.0],[0,.8,-1.0],metal);
 box(pivot,'Ручка окна',[.08,.13,.07],[.04,.8,-.12],yellow);
 addInteract(pane,'Окно бокового корпуса','Старая оконная створка. Стекло мутное, но целое. Можно приоткрыть её, заглянуть наружу или распахнуть.','ОКНО',()=>openMotionPanel(pivot));
 registerHingedMotion(pivot,{kind:'window',label:'Окно бокового корпуса',description:'Створка держится на боковых петлях. Снаружи — мокрая площадка комплекса.',openAngle:-Math.PI*.42,slow:1.5,fast:10});pivot.userData.leaf=pane;
}
makeOpenableWindow();
// Cabinet body, hinged doors, and a real sliding lower drawer.
function makeCabinet(x,z){
 const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
 box(group,'Шкаф',[1.7,2.1,.7],[0,1.05,0],darkConcrete,{solid:true});
 for(const side of [-1,1]){
  const p=new THREE.Group();p.position.set(side*.82,0,-.39);p.name=`cabinet:${x}:${side}`;group.add(p);
  const leaf=box(p,'Дверца шкафа',[.78,1.98,.09],[-side*.39,1.05,0],wood);
  box(p,'Ручка шкафа',[.045,.16,.07],[-side*.12,1.05,-.06],yellow);
  addInteract(leaf,'Дверца шкафа','Внутри — пыльные папки и пустые крепления.','ШКАФ',()=>openMotionPanel(p));
  registerHingedMotion(p,{kind:'cabinet',label:'Дверца шкафа',description:'Деревянная дверца шкафа. За ней могут быть документы или мелкие вещи.',openAngle:side*1.25,slow:2.2,fast:12});p.userData.leaf=leaf;
 }
 const drawer=box(group,'Выдвижной ящик',[1.35,.32,.52],[0,.42,-.4],mat(0x5b5144));drawer.name=`drawer:${x}:${z}`;
 addInteract(drawer,'Нижний ящик','В ящике лежит связка ключей и лист с номером помещения: Б-12.','ЯЩИК',()=>openMotionPanel(drawer));
 drawer.userData={...drawer.userData,open:false,ajar:false,target:-.4,targetFraction:0,motion:'slide',motionKind:'drawer',motionLabel:'Нижний ящик',motionDescription:'Деревянный ящик на направляющих. Его можно выдвинуть на небольшую щель или полностью.',closedValue:-.4,openedValue:-.82,speed:7,slowSpeed:1.7,fastSpeed:13,velocity:0,manualHold:0,manualHoldSpeed:.42};motionObjects.push(drawer);
 const upper=box(group,'Верхний выдвижной ящик',[1.05,.25,.5],[0,.91,-.4],mat(0x625849));upper.name=`drawerUpper:${x}:${z}`;
 box(group,'Ручка верхнего ящика',[.16,.045,.035],[0,.91,-.67],yellow);
 addInteract(upper,'Верхний ящик','Небольшой ящик для канцелярии. Направляющие заедают, внутри лежат старые скрепки и пыль.','ЯЩИК',()=>openMotionPanel(upper));
 upper.userData={...upper.userData,open:false,ajar:false,target:-.4,targetFraction:0,motion:'slide',motionKind:'drawer',motionLabel:'Верхний ящик',motionDescription:'Небольшой ящик на тугих направляющих. Можно оставить его чуть выдвинутым или вытащить полностью.',closedValue:-.4,openedValue:-.78,speed:7,slowSpeed:1.6,fastSpeed:12,velocity:0,manualHold:0,manualHoldSpeed:.42};motionObjects.push(upper);
}
makeCabinet(-6.5,-11.2);
// Item catalogue: each collectible has its own recognizable shape, material and readable description.
const itemCatalog={
 radio:{name:'Старая рация',type:'РАДИОСТАНЦИЯ',weight:1.4,icon:'📻',description:'Тяжёлая портативная радиостанция с треснувшим корпусом, антенной и механическими регуляторами. На задней крышке маркером написано: «Канал 04. Не отвечать после 22:00». При повороте видны потёртая маркировка и крышка батарейного отсека.'},
 pass:{name:'Промышленный пропуск',type:'ПРОПУСК',weight:.03,icon:'🎫',description:'Пластиковая карта доступа с выцветшей фотографией и печатью комплекса «Север-7». Дата выдачи — за три дня до официальной эвакуации. На обороте номер допуска: С-0714.'},
 photo:{name:'Фотография',type:'ФОТОГРАФИЯ',weight:.02,icon:'🖼️',description:'Бумажная фотография в тонкой картонной рамке. На снимке — группа сотрудников у проходной «Север-7». На обороте шариковой ручкой написано: «Они знали заранее». Можно рассмотреть обе стороны.'},
 note:{name:'Служебная записка',type:'ЗАПИСКА',weight:.01,icon:'📄',description:'Сложенный вдвое лист из блокнота с торопливой рукописной записью: «Смену отменить. Нижний контур не отключать до прибытия группы. Если услышите вызов по каналу 04 — не отвечать». Внизу стоит дата за три дня до эвакуации.'},
 medkit:{name:'Аптечка',type:'МЕДИЦИНСКИЙ НАБОР',weight:.65,icon:'🩹',description:'Индивидуальная аптечка в тканевом подсумке с красной медицинской маркировкой. Можно забрать с собой и использовать из инвентаря.'},
 energy:{name:'Энергетик',type:'НАПИТОК',weight:.35,icon:'🥫',description:'Металлическая банка энергетического напитка. Можно забрать с собой и использовать из инвентаря.'}
};
const deskX=-5.8,deskZ=-5.0;
box(scene,'Стойка охраны',[3.1,1.05,.9],[deskX,.55,deskZ],wood,{solid:true});
box(scene,'Столешница',[3.25,.12,1.02],[deskX,1.12,deskZ],dirtyWhite,{solid:true});
function makeRadio(x,y,z){const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);
 const body=box(g,'Корпус рации',[.48,.28,.32],[0,0,0],mat(0x343d3c,.78,.38));
 box(g,'Передняя панель рации',[.37,.2,.025],[0,.015,-.17],mat(0x59635e,.7,.25));
 for(let i=0;i<7;i++)box(g,'Решётка динамика',[.018,.11,.012],[-.12+i*.04,.015,-.19],mat(0x171d1b));
 for(let i=0;i<2;i++){const knob=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.035,12),yellow);knob.rotation.x=Math.PI/2;knob.position.set(.12+i*.08,.07,-.205);g.add(knob);}
 const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.012,.018,.38,8),metal);antenna.position.set(-.17,.29,.04);antenna.rotation.z=-.16;g.add(antenna);
 const led=box(g,'Индикатор рации',[.035,.018,.012],[-.105,.085,-.207],mat(0x20352b,.35,.1),{cast:false});led.name='Индикатор рации';
 const display=box(g,'Экран рации',[.14,.07,.012],[.12,-.065,-.207],mat(0x18231d,.35,.08),{cast:false});display.name='Экран рации';
 for(let i=0;i<3;i++)box(g,'Сегмент экрана рации',[.085-i*.018,.006,.005],[.12,-.055-i*.018,-.215],mat(0x34483a,.4,.05),{cast:false});
 const rear=box(g,'Крышка батарейного отсека',[.28,.17,.018],[0,0,.17],mat(0x252d2b,.85,.2));rear.name='Крышка батарейного отсека';
 const root=g;const hit=addInteract(body,'Старая рация',itemCatalog.radio.description,'ПРЕДМЕТ',()=>offerItem('radio'));
 hit.userData.pickupGroup=root;root.userData.pickupId='radio';pickupObjects.radio=root;return root;}
function makePass(x,y,z){const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);
 const card=box(g,'Пластиковый пропуск',[.42,.018,.27],[0,0,0],mat(0x31504d,.48,.12));
 box(g,'Полоса пропуска',[.42,.024,.045],[0,.012,-.105],mat(0xc2a65f,.6,.15));
 box(g,'Фотография на пропуске',[.09,.012,.12],[-.13,.015,.035],mat(0x9a9e91));
 box(g,'Печать пропуска',[.08,.012,.08],[.12,.015,.04],mat(0x9b4239));
 for(let i=0;i<3;i++)box(g,'Строка на пропуске',[.13-i*.018,.008,.012],[.08,.016,-.01+i*.035],mat(0xd5d3bd));
 box(g,'Оборот пропуска',[.37,.008,.22],[0,-.014,0],mat(0x9d9b88));for(let i=0;i<5;i++)box(g,'Код на обороте пропуска',[.012,.004,.15],[ -.12+i*.055,-.022,0],mat(0x303632));
 const root=g;const hit=addInteract(card,'Промышленный пропуск',itemCatalog.pass.description,'ПРЕДМЕТ',()=>offerItem('pass'));hit.userData.pickupGroup=root;root.userData.pickupId='pass';pickupObjects.pass=root;return root;}
function makePhoto(x,y,z){const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);
 box(g,'Картонная рамка фотографии',[.43,.025,.32],[0,0,0],mat(0x5d5142));
 const face=box(g,'Лицевая сторона фотографии',[.37,.012,.26],[0,.019,0],mat(0x9b9d8d));
 // Printed scene: silhouettes, pale sky and the industrial gate make this visibly a photograph, not a blank sheet.
 box(g,'Небо на фотографии',[.35,.006,.095],[0,.027,-.075],mat(0x87928d));
 box(g,'Здание на фотографии',[.22,.012,.09],[.015,.034,-.005],mat(0x555e59));
 for(let i=0;i<4;i++){const person=new THREE.Mesh(new THREE.CylinderGeometry(.012,.018,.07,6),mat(0x343a36));person.position.set(-.12+i*.075,.045,.065);g.add(person);const head=new THREE.Mesh(new THREE.SphereGeometry(.018,6,5),mat(0x343a36));head.position.set(-.12+i*.075,.09,.065);g.add(head);}
 box(g,'Оборот фотографии',[.37,.012,.26],[0,-.019,0],mat(0xb8b5a4));for(let i=0;i<3;i++){const ink=box(g,'Надпись на обороте фото',[.22-i*.025,.004,.009],[0,-.028,-.055+i*.045],mat(0x494c46));ink.rotation.y=(i%2?.025:-.018);}
 const root=g;const hit=addInteract(face,'Фотография',itemCatalog.photo.description,'ПРЕДМЕТ',()=>offerItem('photo'));hit.userData.pickupGroup=root;root.userData.pickupId='photo';pickupObjects.photo=root;return root;}
function makeNote(x,y,z){const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);
 const sheet=box(g,'Сложенная служебная записка',[.34,.012,.125],[0,0,-.0625],mat(0xc4bea8,.96));
 const flap=new THREE.Group();flap.name='Записка: сгибаемая часть';flap.position.set(0,.009,0);flap.rotation.x=Math.PI;g.add(flap);box(flap,'Разворачиваемая часть записки',[.34,.01,.125],[0,0,.0625],mat(0xc4bea8,.96));
 for(let i=0;i<4;i++){const line=box(g,'Рукописная строка',[.23-(i%2)*.025,.004,.006],[.015,.01,-.105+i*.025],mat(i===3?0x8a433b:0x454b48));line.rotation.y=(i%2?.025:-.018);}
 for(let i=0;i<4;i++){const line=box(flap,'Продолжение рукописной записки',[.23-(i%2)*.025,.004,.006],[.015,.009,.025+i*.023],mat(0x454b48));line.rotation.y=(i%2?.025:-.018);}
 box(g,'Сгиб записки',[.012,.014,.012],[0,.012,0],mat(0x8c8878));
 const root=g;const hit=addInteract(sheet,'Служебная записка',itemCatalog.note.description,'ПРЕДМЕТ',()=>offerItem('note'));hit.userData.pickupGroup=root;root.userData.pickupId='note';pickupObjects.note=root;return root;}
makeRadio(-6.2,1.3,-5.0);makePass(-5.25,1.205,-5.0);
box(scene,'Рабочий стол',[2.5,.9,1.1],[1.9,.48,-12.5],wood,{solid:true});box(scene,'Папки',[.45,.22,.32],[1.25,1.05,-12.35],yellow);
makePhoto(2.4,.95,-12.3);makeNote(1.1,1.05,-12.32);
// Supplies have recognizable silhouettes and use the same hold / examine / take flow.
const medkitGroup=new THREE.Group();medkitGroup.position.set(-4.85,1.28,-5.0);scene.add(medkitGroup);
const medkitMesh=box(medkitGroup,'Аптечка',[.42,.22,.28],[0,0,0],mat(0xb5b6aa,.8));
box(medkitGroup,'Красная полоса аптечки',[.09,.225,.285],[0,0,0],mat(0x8d3834,.8));box(medkitGroup,'Крест аптечки',[.16,.035,.02],[0,.02,-.151],mat(0xe3e4d8,.8));
medkitMesh.userData.pickupGroup=medkitGroup;medkitMesh.userData.pickupId='medkit';pickupObjects.medkit=medkitGroup;
addInteract(medkitMesh,'Аптечка',itemCatalog.medkit.description,'ПРЕДМЕТ',()=>offerItem('medkit'));
const energyGroup=new THREE.Group();energyGroup.position.set(1.12,.93,-12.45);scene.add(energyGroup);
const energyMesh=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.34,12),mat(0x6d8580,.32,.35));energyMesh.position.y=.18;energyGroup.add(energyMesh);energyMesh.name='Энергетик';
const energyStripe=new THREE.Mesh(new THREE.CylinderGeometry(.108,.108,.075,12),mat(0xb6a36b,.35,.3));energyStripe.position.y=.18;energyGroup.add(energyStripe);
const energyTop=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.012,12),metal);energyTop.position.y=.35;energyGroup.add(energyTop);
energyMesh.userData.pickupGroup=energyGroup;energyMesh.userData.pickupId='energy';pickupObjects.energy=energyGroup;
addInteract(energyMesh,'Энергетик',itemCatalog.energy.description,'ПРЕДМЕТ',()=>offerItem('energy'));
// Wall mounted electrical panel with an inspectable latch.
const panel=box(scene,'Электрощит',[.95,1.5,.18],[3.3,2.1,-16.1],metal,{solid:true});
addInteract(panel,'Электрощит','Питание отключено. На схеме отмечен резервный контур, уходящий в подвал.','ОБОРУДОВАНИЕ');
// Damaged insulation has left a live cable in a shallow puddle. It is visible and avoidable.
const liveWater=new THREE.Mesh(new THREE.CircleGeometry(.72,28),new THREE.MeshStandardMaterial({color:0x354a4b,roughness:.2,metalness:.28,transparent:true,opacity:.82}));liveWater.rotation.x=-Math.PI/2;liveWater.position.set(2.55,.012,-14.35);liveWater.scale.set(1.15,.72,1);scene.add(liveWater);
const cableCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(3.3,1.5,-16.0),new THREE.Vector3(3.05,.18,-15.5),new THREE.Vector3(2.85,.08,-15.0),new THREE.Vector3(2.55,.06,-14.35)]);
const liveCable=new THREE.Mesh(new THREE.TubeGeometry(cableCurve,18,.035,6,false),mat(0x292e2c,.7,.25));scene.add(liveCable);
const cableCore=new THREE.PointLight(0x8cc4c9,1.1,3.2,2);cableCore.position.set(2.55,.22,-14.35);scene.add(cableCore);
const warningStripe=mat(0xb18a45,.85,.1);
for(let i=0;i<4;i++){const mark=box(scene,'Предупреждение об электричестве',[.09,.018,.28],[1.72+i*.12,.012,-14.35],warningStripe,{cast:false});mark.rotation.y=-.25;}
// Props: pipes, crates, rubble, pallets and weeds.
for(let i=0;i<7;i++){
 const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,5.5,10),rust);pipe.rotation.z=Math.PI/2;pipe.position.set(-2.5,3.45,-3-i*2.2);scene.add(pipe);
}
for(let i=0;i<12;i++){
 const x=-12+(i%6)*4.7,z=5+Math.floor(i/6)*7;
 const crate=box(scene,'Ящик',[.8+(i%2)*.3,.75,.8],[x,.38,z],i%3===0?wood:darkConcrete,{solid:true});
 if(i%3===0)addInteract(crate,'Грузовой ящик','Дерево разбухло от сырости. Внутри ничего ценного.','ОСМОТР');
}
for(let i=0;i<24;i++){
 const stone= new THREE.Mesh(new THREE.DodecahedronGeometry(.15+(i%4)*.07,0),darkConcrete);stone.position.set(-8+(i*1.73)%16,.02,3+(i*2.37)%15);stone.rotation.set(i,i*.7,i*.2);scene.add(stone);
}
// TISHINA_030_STORY_WORLD_UPGRADE
// TISHINA_033_CAMERA_FLASHLIGHT_HANGAR_INTERACTION
const expansion = installWorldExpansion({ THREE, scene, box, floor, mat, addInteract, colliders, surfaces: { metal, darkConcrete, plaster, yellow, floorMat, rust, gravel:gravelMat, earth:earthMat, driveConcrete:driveConcreteMat } });
const story = createStoryController({ onObjective: value => { const el = $('objective'); if (el) el.textContent = value; }, notify });
panel.userData.interaction.action = () => { const data = panel.userData.interaction; story.markBreaker(); openInspect(data); };
expansion.evacuationLog.userData.interaction.action = () => { const data = expansion.evacuationLog.userData.interaction; story.markJournal(); openInspect(data); };

// Rain particles: restrained count for mobile GPUs.
const rainCount=360, rainPositions=new Float32Array(rainCount*3);
for(let i=0;i<rainCount;i++){rainPositions[i*3]=(Math.random()-.5)*90;rainPositions[i*3+1]=Math.random()*18;rainPositions[i*3+2]=(Math.random()-.5)*88;}
const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xdce5e3,size:.035,transparent:true,opacity:.34}));scene.add(rain);

// Restrained first-person body rig: arms stay low and only come forward for actions.
const bodyRig=new THREE.Group();scene.add(bodyRig);const bodyParts=new THREE.Group();bodyRig.add(bodyParts);
const armsRig=new THREE.Group();bodyParts.add(armsRig);
const sleeveMat=mat(0x434c45,.96),sleeveTrim=mat(0x5f695f,.9),gloveMat=mat(0x252c29,.98),pantsMat=mat(0x343b37,.98),bootMat=mat(0x1f2523,.9,.08),stitchMat=mat(0x777e72,.92);
function limbMesh(parent,geometry,material,pos,rot=[0,0,0]){const m=new THREE.Mesh(geometry,material);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=false;m.receiveShadow=false;parent.add(m);return m;}
function makeArm(side){const pivot=new THREE.Group();pivot.position.set(side*.43,-.39,-.58);pivot.scale.setScalar(.66);armsRig.add(pivot);
 limbMesh(pivot,new THREE.CapsuleGeometry(.092,.23,3,7),sleeveMat,[0,-.10,0],[0,0,side*.16]);
 limbMesh(pivot,new THREE.CapsuleGeometry(.072,.22,3,7),sleeveTrim,[side*.02,-.30,-.09],[.13,0,side*.1]);
 limbMesh(pivot,new THREE.TorusGeometry(.073,.009,6,12),stitchMat,[side*.02,-.20,-.045],[Math.PI/2,0,0]);
 limbMesh(pivot,new THREE.SphereGeometry(.078,10,8),gloveMat,[side*.03,-.42,-.17],[0,0,0]);
 return pivot;}
const leftArm=makeArm(-1),rightArm=makeArm(1);armsRig.visible=false;
const torso=limbMesh(bodyParts,new THREE.CapsuleGeometry(.25,.42,4,8),pantsMat,[0,-.82,-.42]);torso.scale.set(1.05,1,.78);torso.visible=false;
const legsRig=new THREE.Group();bodyParts.add(legsRig);
function makeLeg(side){const pivot=new THREE.Group();pivot.position.set(side*.14,-.58,-.47);pivot.scale.setScalar(.76);legsRig.add(pivot);
 limbMesh(pivot,new THREE.CapsuleGeometry(.095,.34,3,7),pantsMat,[0,0,-.14],[Math.PI/2,0,0]);
 limbMesh(pivot,new THREE.BoxGeometry(.19,.11,.29),bootMat,[0,-.035,-.40],[.04,0,0]);
 limbMesh(pivot,new THREE.BoxGeometry(.19,.03,.11),sleeveTrim,[0,-.095,-.38],[0,0,0]);
 return pivot;}
const leftLeg=makeLeg(-1),rightLeg=makeLeg(1);
legsRig.visible=false;


function smooth01(v){v=THREE.MathUtils.clamp(v,0,1);return v*v*(3-2*v);}
function showPhysicalFeedback(text,sticky=false){
 const el=$('physicalFeedback');if(!el)return;el.textContent=text;el.classList.add('visible');clearTimeout(physicalFeedbackTimer);
 if(!sticky)physicalFeedbackTimer=setTimeout(()=>el.classList.remove('visible'),1450);
}
function beginHandAction(kind='pull',hold=false){handAction={kind,hold,weight:0,releaseElapsed:0,releaseDuration:.48};showPhysicalFeedback(kind==='peek'?'ОСТОРОЖНО ЗАГЛЯДЫВАЕШЬ ЗА КРАЙ':kind==='pickup'?'ОСМАТРИВАЕШЬ ПРЕДМЕТ':kind==='slide'?'ДВИГАЕШЬ ЯЩИК':'ПЕРЕМЕЩАЕШЬ СТВОРКУ',hold);}
function releaseHandAction(){if(handAction){handAction.hold=false;handAction.releaseElapsed=0;}}
function physicalSound(type='creak',strength=1){
 try{
  const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;
  if(!soundContext)soundContext=new AudioCtx();const ctx=soundContext;if(ctx.state==='suspended')ctx.resume().catch(()=>{});
  const now=ctx.currentTime,osc=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  const fast=type==='impact',click=type==='click';osc.type=fast?'triangle':click?'sine':'sawtooth';
  const start=fast?92:click?620:type==='slide'?145:105,end=fast?39:click?240:type==='slide'?82:166;
  osc.frequency.setValueAtTime(start,now);osc.frequency.exponentialRampToValueAtTime(Math.max(25,end),now+(fast?.17:click?.065:.34));
  filter.type='lowpass';filter.frequency.setValueAtTime(fast?390:click?1900:620,now);filter.Q.value=.7;
  const peak=(fast?.065:click?.028:.022)*Math.max(.2,Math.min(1.4,strength));gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(peak,now+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+(fast?.22:click?.09:.38));
  osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+(fast?.24:click?.1:.4));
  if(fast||click){const length=Math.floor(ctx.sampleRate*(fast?.12:.045)),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++){const fade=1-i/length;data[i]=(Math.random()*2-1)*fade*(fast?.42:.2);}const source=ctx.createBufferSource(),ng=ctx.createGain(),nf=ctx.createBiquadFilter();source.buffer=buffer;nf.type='bandpass';nf.frequency.value=fast?420:1250;ng.gain.setValueAtTime(fast?.22:.12,now);ng.gain.exponentialRampToValueAtTime(.0001,now+(fast?.12:.045));source.connect(nf);nf.connect(ng);ng.connect(ctx.destination);source.start(now);}
 }catch(err){/* Audio is optional; gameplay must work when sound is unavailable. */}
}
function currentMotionFraction(obj){const d=obj.userData,raw=d.motion==='slide'?obj.position.z:obj.rotation.y,span=d.openedValue-d.closedValue;if(Math.abs(span)<1e-6)return d.targetFraction||0;return THREE.MathUtils.clamp((raw-d.closedValue)/span,0,1);}
function startManualMotion(direction){
 if(!activeMotion)return;const d=activeMotion.userData;d.manualHold=direction;d.manualHoldSpeed=.38;d.speed=direction>0?(d.slowSpeed||1.8):(d.slowSpeed||1.8);d.targetFraction=currentMotionFraction(activeMotion);d.target=d.closedValue+(d.openedValue-d.closedValue)*d.targetFraction;
 beginHandAction(d.motionKind==='drawer'?'slide':'pull',true);physicalSound(d.motionKind==='drawer'?'slide':'creak',.65);showPhysicalFeedback(direction>0?'МЕДЛЕННО ТЯНЕШЬ СТВОРКУ':'ОСТОРОЖНО ВОЗВРАЩАЕШЬ СТВОРКУ',true);
}
function stopManualMotion(){
 if(!activeMotion)return;const d=activeMotion.userData;if(!d.manualHold)return;const fraction=currentMotionFraction(activeMotion);d.manualHold=0;d.targetFraction=fraction;d.target=d.motion==='slide'?activeMotion.position.z:activeMotion.rotation.y;d.velocity=0;releaseHandAction();showPhysicalFeedback('МЕХАНИЗМ ОСТАНОВЛЕН В ЭТОМ ПОЛОЖЕНИИ');save();
}
function notify(text){const m=$('message');m.textContent=text;m.style.opacity='1';clearTimeout(notify.timer);notify.timer=setTimeout(()=>m.style.opacity='0',2800);}

function setFlashlightState(on, announce=false){
 flashlightOn=Boolean(on);
 flashlight.intensity=flashlightOn?42:0;
 flashlightFill.intensity=flashlightOn?1.35:0;
 const button=$('flashlight');
 if(button){button.classList.toggle('active',flashlightOn);button.setAttribute('aria-pressed',String(flashlightOn));button.title=flashlightOn?'Выключить фонарик':'Включить фонарик';}
 if(announce)notify(flashlightOn?'ФОНАРИК ВКЛЮЧЁН':'ФОНАРИК ВЫКЛЮЧЕН');
}
function toggleFlashlight(){setFlashlightState(!flashlightOn,true);if(started)save();}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function itemByName(name){return Object.values(itemCatalog).find(item=>item.name===name)||{name,type:'ПРЕДМЕТ',weight:.1,icon:'▣',description:''};}
function inventoryWeight(){return inventory.reduce((sum,name)=>sum+itemByName(name).weight,0)+medkits*itemCatalog.medkit.weight+energyItems*itemCatalog.energy.weight;}
function updateInventoryUI(){
 const cells=inventory.map(name=>{const it=itemByName(name);return `<div class="inventoryCell"><span class="cellIcon">${it.icon}</span><span class="cellName">${escapeHtml(name)}</span></div>`;});
 for(let i=cells.length;i<8;i++)cells.push('<div class="inventoryCell empty"><span class="cellIcon">＋</span><span class="cellName">ПУСТО</span></div>');
 $('items').innerHTML=cells.join('');$('inventoryWeight').textContent=`ВЕС: ${inventoryWeight().toFixed(2)} / 8 КГ · ЯЧЕЙКИ: ${inventory.length+medkits+energyItems} / 8`;
 $('medkitCount').textContent=String(medkits);$('energyCount').textContent=String(energyItems);
 $('useMedkit').disabled=medkits<=0||health>=100;$('useEnergy').disabled=energyItems<=0||stamina>=100;
 story.refresh(inventory);
}
function makeSnapshot(){
 const motions=motionObjects.map(obj=>{const fraction=currentMotionFraction(obj),target=obj.userData.motion==='slide'?obj.position.z:obj.rotation.y;return {name:obj.name,open:fraction>=.99,ajar:fraction>.02&&fraction<.99,fraction,target};});
 return {version:4,savedAt:new Date().toISOString(),player:{x:camera.position.x,z:camera.position.z,yaw,pitch},health,stamina,flashlightOn,inventory:[...inventory],medkits,energyItems,story:story.snapshot(),sky:skyWeather.snapshot(),motions,collected:Object.keys(pickupObjects).filter(id=>!pickupObjects[id].visible)};
}
function storeJson(key,data){try{localStorage.setItem(key,JSON.stringify(data));return true;}catch(err){console.warn('Не удалось сохранить игру:',err);return false;}}
function save(){const ok=storeJson('tishinaAutoV1',makeSnapshot());storeJson('tishina02', {items:inventory,health,stamina,medkits,energyItems});updateInventoryUI();const cont=$('continueTitle');if(cont&&ok)cont.disabled=false;}
function applySnapshot(data){
 if(!data||typeof data!=='object')return false;
 inventory.splice(0,inventory.length,...(Array.isArray(data.inventory)?data.inventory.filter(x=>typeof x==='string'):Array.isArray(data.items)?data.items.filter(x=>typeof x==='string'):[]));
 medkits=Math.max(0,Math.min(20,Number(data.medkits)||0));energyItems=Math.max(0,Math.min(20,Number(data.energyItems)||0));
 health=Math.max(1,Math.min(100,Number.isFinite(Number(data.health))?Number(data.health):100));stamina=Math.max(0,Math.min(100,Number(data.stamina??100)||0));sprintLocked=stamina<STAMINA_RESTART;sprintHeld=false;sprintBlend=0;staminaRecoveryDelay=0;
 const px=Number(data.player?.x),pz=Number(data.player?.z);camera.position.set(Number.isFinite(px)?THREE.MathUtils.clamp(px,-44,44):0,postures.stand.eye,Number.isFinite(pz)?THREE.MathUtils.clamp(pz,-25,60):10.5);yaw=Number.isFinite(Number(data.player?.yaw))?Number(data.player.yaw):0;pitch=Number.isFinite(Number(data.player?.pitch))?THREE.MathUtils.clamp(Number(data.player.pitch),-1.05,.8):0;look(0,0);
 posture='stand';stanceFrom=null;stanceElapsed=1;Object.assign(stance,postures.stand);jumpHeight=0;jumpVelocity=0;grounded=true;
 story.restore(data.story, inventory);
 skyWeather.restore(data.sky);
 setFlashlightState(Boolean(data.flashlightOn),false);
 const collected=Array.isArray(data.collected)?data.collected:[];
 for(const [id,obj] of Object.entries(pickupObjects)){
  const legacyCollected=(id==='radio'&&inventory.includes('Старая рация'))||(id==='pass'&&inventory.includes('Промышленный пропуск'))||(id==='photo'&&inventory.includes('Фотография'))||(id==='note'&&inventory.includes('Служебная записка'));
  obj.visible=!(collected.includes(id)||legacyCollected);
 }
 for(const state of (Array.isArray(data.motions)?data.motions:[])){
  const obj=motionObjects.find(item=>item.name===state.name);if(!obj)continue;
  obj.userData.target=Number.isFinite(Number(state.target))?Number(state.target):(obj.userData.motion==='slide'?obj.userData.closedValue:0);
  obj.userData.targetFraction=Number.isFinite(Number(state.fraction))?THREE.MathUtils.clamp(Number(state.fraction),0,1):(state.open?1:0);obj.userData.open=obj.userData.targetFraction>=.99;obj.userData.ajar=obj.userData.targetFraction>.02&&!obj.userData.open;
  if(obj.userData.motion==='slide')obj.position.z=obj.userData.target;else obj.rotation.y=obj.userData.target;
 }
 updatePostureUI();updateHealthUI(true);updateStaminaUI(true);updateInventoryUI();return true;
}
function saveManual(){const ok=storeJson('tishinaManualSaveV1',makeSnapshot());$('menuStatus').textContent=ok?'СОХРАНЕНИЕ ЗАПИСАНО НА ЭТОМ УСТРОЙСТВЕ':'ОШИБКА СОХРАНЕНИЯ';if(ok){$('titleLoad').disabled=false;notify('Игра сохранена.');}}
function loadManual(){const data=readStored('tishinaManualSaveV1');if(!data){$('menuStatus').textContent='СОХРАНЕНИЕ НЕ НАЙДЕНО';$('titleStatus').textContent='СОХРАНЕНИЕ НЕ НАЙДЕНО';notify('Сохранение пока отсутствует.');return false;}const ok=applySnapshot(data);if(ok){started=true;modalOpen=false;$('pause').style.display='none';$('intro').style.display='none';$('confirmNew').style.display='none';$('downed').style.display='none';$('menuStatus').textContent='ИГРА ЗАГРУЖЕНА';$('titleStatus').textContent='';save();notify('Сохранение загружено.');}return ok;}
function itemRoot(id){return pickupObjects[id]||null;}
function canCarry(id){const item=itemCatalog[id];if(!item)return false;const slotCount=inventory.length+medkits+energyItems;return slotCount<INVENTORY_MAX_SLOTS&&inventoryWeight()+item.weight<=INVENTORY_MAX_WEIGHT;}
function openMotionPanel(obj){if(!obj?.userData?.motionKind)return;activeMotion=obj;const data=obj.userData;$('motionTitle').textContent=data.motionLabel||'МЕХАНИЗМ';$('motionDescription').textContent='Выбери действие.';$('motionPanel').style.display='flex';modalOpen=true;activeTarget=null;$('prompt').style.opacity='0';}
function applyMotion(obj,fraction,speed,message){if(!obj)return;const d=obj.userData;d.manualHold=0;fraction=THREE.MathUtils.clamp(fraction,0,1);d.targetFraction=fraction;d.target=d.closedValue+(d.openedValue-d.closedValue)*fraction;d.open=fraction>=.99;d.ajar=fraction>.02&&!d.open;d.speed=speed;beginHandAction(d.motionKind==='drawer'?'slide':'pull',false);physicalSound(speed>8?'impact':d.motionKind==='drawer'?'slide':'creak',speed>8?1:.7);showPhysicalFeedback(message);save();}
function closeMotionPanel(){if(activeMotion?.userData.manualHold)stopManualMotion();activeMotion=null;$('motionPanel').style.display='none';modalOpen=false;}
function doMotionAction(action){if(!activeMotion)return;const d=activeMotion.userData;const name=d.motionLabel||'Механизм';if(action==='ajar')applyMotion(activeMotion,.16,d.slowSpeed||1.8,`${name}: оставлена узкая щель.`);else if(action==='slowOpen')applyMotion(activeMotion,1,d.slowSpeed||1.8,`${name}: медленно открывается.`);else if(action==='fastOpen')applyMotion(activeMotion,1,d.fastSpeed||13,`${name}: резко открывается.`);else if(action==='slowClose')applyMotion(activeMotion,0,d.slowSpeed||1.8,`${name}: медленно закрывается.`);else if(action==='fastClose')applyMotion(activeMotion,0,d.fastSpeed||13,`${name}: быстро закрывается.`);closeMotionPanel();}
function endPeek(){if(!peekState||peekState.phase==='out')return;const p=peekState;p.phase='out';p.elapsed=0;p.duration=.34;p.fromX=camera.position.x;p.fromZ=camera.position.z;p.fromRoll=camera.rotation.z;p.fromYaw=yaw;p.fromPitch=pitch;p.toX=p.baseX;p.toZ=p.baseZ;p.toRoll=0;p.toYaw=yaw;p.toPitch=p.basePitch;releaseHandAction();$('peekExit').style.display='none';physicalSound('click',.65);showPhysicalFeedback('НАЗАД');}
function doPeek(){if(!activeMotion)return;if(!(currentMotionFraction(activeMotion)>.02)){notify('Сначала оставь щель.');return;}const forwardX=-Math.sin(yaw),forwardZ=-Math.cos(yaw),rightX=Math.cos(yaw),rightZ=-Math.sin(yaw);const baseX=camera.position.x,baseZ=camera.position.z,baseYaw=yaw,basePitch=pitch;peekState={phase:'in',elapsed:0,duration:.36,baseX,baseZ,baseYaw,basePitch,fromX:baseX,fromZ:baseZ,fromYaw:baseYaw,fromPitch:basePitch,fromRoll:0,toX:baseX+rightX*.24+forwardX*.10,toZ:baseZ+rightZ*.24+forwardZ*.10,toYaw:baseYaw+.07,toPitch:basePitch,toRoll:-.055};drag=null;keys={};joy={x:0,y:0};joyTarget={x:0,y:0};nubReset();beginHandAction('peek',true);physicalSound('click',.75);closeMotionPanel();$('peekExit').style.display='block';showPhysicalFeedback('ЗАГЛЯДЫВАЕШЬ',true);}
function offerItem(id){
 const item=itemCatalog[id];if(!item)return;pendingItemId=id;activeTarget=null;$('prompt').style.opacity='0';
 $('choiceType').textContent=item.type;$('choiceTitle').textContent=item.name;
 $('choiceText').textContent=item.description+'\n\nВыбери действие: подробно осмотреть предмет, сразу поместить его в инвентарь или оставить на месте.';
 const inventoryButton=$('choiceInventory');inventoryButton.disabled=!canCarry(id);inventoryButton.textContent=canCarry(id)?'В ИНВЕНТАРЬ':'ИНВЕНТАРЬ ПЕРЕПОЛНЕН';
 $('itemChoice').style.display='flex';modalOpen=true;
}
function takePendingItemToInventory(){
 if(!pendingItemId)return;const id=pendingItemId,item=itemCatalog[id],source=itemRoot(id);
 if(!item||!source)return;
 if(!canCarry(id)){notify('Недостаточно места в инвентаре.');return;}
 if(id==='medkit')medkits=Math.min(20,medkits+1);
 else if(id==='energy')energyItems=Math.min(20,energyItems+1);
 else if(!inventory.includes(item.name))inventory.push(item.name);
 source.visible=false;pendingItemId=null;$('itemChoice').style.display='none';modalOpen=false;
 updateInventoryUI();save();physicalSound('click',.55);notify(`${item.name} помещён в инвентарь.`);
}
function makeHeldClone(id){const root=itemRoot(id);if(!root)return null;const clone=root.clone(true);clone.visible=true;clone.position.set(0,0,0);clone.rotation.set(0,0,0);clone.scale.setScalar(1);return clone;}
function renderHeldSpecialActions(){const host=$('itemSpecialActions');let html='';if(heldItemId==='photo')html='<button class="btn" data-held-action="flip">ПЕРЕВЕРНУТЬ ФОТО</button>';else if(heldItemId==='pass')html='<button class="btn" data-held-action="flip">ПОСМОТРЕТЬ ОБОРОТ</button>';else if(heldItemId==='note')html=`<button class="btn" data-held-action="fold">${heldNoteOpen?'СЛОЖИТЬ ЗАПИСКУ':'РАЗВЕРНУТЬ ЗАПИСКУ'}</button>`;else if(heldItemId==='radio')html=`<button class="btn" data-held-action="power">${heldRadioPowered?'ВЫКЛЮЧИТЬ РАЦИЮ':'ВКЛЮЧИТЬ РАЦИЮ'}</button><span class="radioTune">КАНАЛ ${String(heldRadioChannel).padStart(2,'0')}</span><button class="btn" data-held-action="down">−</button><button class="btn" data-held-action="up">+</button>`;host.innerHTML=html;host.style.display=html?'flex':'none';}
function updateHeldDescription(){const item=itemCatalog[heldItemId];if(!item)return;let text=item.description;if(heldItemId==='photo'&&heldFlipped)text='Оборот фотографии. Почерк выцветший, но фраза читается: «Они знали заранее». На нижнем краю — едва заметная отметка «С-7 / 04».';if(heldItemId==='pass'&&heldFlipped)text='Оборот пропуска. Под штрих-кодом выбит номер допуска С-0714. На пластике остались следы от магнитного считывателя.';if(heldItemId==='note'&&heldNoteOpen)text='Записка полностью развёрнута. На внутренней половине дописано: «Если свет в окнах погаснет — не выходить на площадку. Они идут на звук». Подпись отсутствует.';if(heldItemId==='radio'&&heldRadioPowered)text=heldRadioChannel===4?'Рация включена. На канале 04 индикатор мигает в коротком ритме. На экране появляется обрывок служебной метки: «НИЖНИЙ КОНТУР · НЕ ОТВЕЧАТЬ».':'Рация включена. На канале '+String(heldRadioChannel).padStart(2,'0')+' — только помехи и редкие щелчки. Устойчивой связи нет.';$('heldDescription').textContent=text;}
function beginItemExamine(id){const item=itemCatalog[id],source=itemRoot(id);if(!item||!source)return;beginHandAction('pickup',false);physicalSound('click',.6);pendingItemId=null;heldItemId=id;heldSourceRoot=source;heldFlipped=false;heldNoteOpen=false;heldRadioPowered=false;heldRadioChannel=4;heldObject=makeHeldClone(id);heldObject.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=false;o.receiveShadow=false;}});camera.add(heldObject);heldObject.position.set(0,-.18,-.95);if(id==='radio'||id==='medkit')heldObject.rotation.set(-.08,Math.PI,0);else if(id==='photo'||id==='pass'||id==='note')heldObject.rotation.set(Math.PI/2,0,0);else heldObject.rotation.set(-.08,.18,0);source.visible=false;$('itemChoice').style.display='none';$('heldType').textContent=item.type+' · ОСМОТР';$('heldTitle').textContent=item.name;$('heldWeight').textContent=`МАССА: ${item.weight.toFixed(2)} КГ`;$('takeToInventory').disabled=!canCarry(id);$('takeToInventory').textContent=canCarry(id)?'В ИНВЕНТАРЬ':'ИНВЕНТАРЬ ПЕРЕПОЛНЕН';renderHeldSpecialActions();updateHeldDescription();$('itemExamine').style.display='block';modalOpen=true;}
function finishHeldItem(take){if(!heldItemId||!heldSourceRoot)return;beginHandAction('pickup',false);physicalSound('click',.55);const id=heldItemId,item=itemCatalog[id];if(heldObject){camera.remove(heldObject);heldObject=null;}if(take){if(id==='medkit')medkits=Math.min(20,medkits+1);else if(id==='energy')energyItems=Math.min(20,energyItems+1);else if(!inventory.includes(item.name))inventory.push(item.name);heldSourceRoot.visible=false;notify(`${item.name} помещён в инвентарь.`);}else{heldSourceRoot.visible=true;notify(`${item.name} возвращён на место.`);}heldItemId=null;heldSourceRoot=null;$('itemSpecialActions').innerHTML='';$('itemSpecialActions').style.display='none';$('itemExamine').style.display='none';modalOpen=false;save();}
function closeItemChoice(){pendingItemId=null;$('itemChoice').style.display='none';modalOpen=false;}
function handleHeldAction(action){if(!heldObject||!heldItemId)return;if(action==='flip'&&(heldItemId==='photo'||heldItemId==='pass')){heldFlipped=!heldFlipped;heldObject.rotation.x+=Math.PI;updateHeldDescription();}else if(action==='fold'&&heldItemId==='note'){heldNoteOpen=!heldNoteOpen;heldObject.userData.noteTarget=heldNoteOpen?0:Math.PI;const flap=heldObject.getObjectByName('Записка: сгибаемая часть');if(flap)flap.userData.foldTarget=heldObject.userData.noteTarget;renderHeldSpecialActions();updateHeldDescription();}else if(action==='power'&&heldItemId==='radio'){heldRadioPowered=!heldRadioPowered;const led=heldObject.getObjectByName('Индикатор рации'),display=heldObject.getObjectByName('Экран рации');if(led)led.material.color.setHex(heldRadioPowered?0x5cff84:0x20352b);if(display)display.material.color.setHex(heldRadioPowered?0x7abf83:0x18231d);renderHeldSpecialActions();updateHeldDescription();}else if((action==='up'||action==='down')&&heldItemId==='radio'){heldRadioChannel=THREE.MathUtils.clamp(heldRadioChannel+(action==='up'?1:-1),1,16);renderHeldSpecialActions();updateHeldDescription();}}
function useMedkit(){if(medkits<=0){notify('Аптечек нет.');return;}if(health>=100){notify('Здоровье уже полностью восстановлено.');return;}medkits--;health=Math.min(100,health+40);updateHealthUI(true);save();notify('Использована аптечка. Здоровье восстановлено.');}
function useEnergy(){if(energyItems<=0){notify('Энергетиков нет.');return;}if(stamina>=100){notify('Выносливость уже восстановлена.');return;}energyItems--;stamina=Math.min(100,stamina+55);if(stamina>=STAMINA_RESTART)sprintLocked=false;updateStaminaUI(true);save();notify('Энергетик использован. Выносливость восстановлена.');}
// Restore a previous local autosave on launch; a separate manual slot is controlled from the main menu.
if(autosaved&& (autosaved.player||autosaved.health!==undefined||autosaved.items))applySnapshot({inventory:autosaved.inventory||autosaved.items,health:autosaved.health,stamina:autosaved.stamina,medkits:autosaved.medkits,energyItems:autosaved.energyItems,player:autosaved.player,motions:autosaved.motions,collected:autosaved.collected});
else {updateInventoryUI();updateHealthUI(true);updateStaminaUI(true);}
const hasManualSave=!!readStored('tishinaManualSaveV1');const hasAutoSave=!!(autosaved&&(autosaved.player||autosaved.health!==undefined||autosaved.items));$('titleLoad').disabled=!hasManualSave;$('continueTitle').disabled=!hasAutoSave;if(hasManualSave||hasAutoSave)$('titleStatus').textContent='ЕСТЬ СОХРАНЕНИЕ НА ЭТОМ УСТРОЙСТВЕ';
function openInspect(data){beginHandAction('inspect',false);physicalSound('click',.35);modalOpen=true;$('inspectType').textContent=data.type;$('inspectTitle').textContent=data.title;$('inspectText').textContent=data.description;$('inspect').style.display='flex';}
function closeInspect(){$('inspect').style.display='none';modalOpen=false;}
function interact(){if(peekState){endPeek();return;}if(modalOpen)return;if(!activeTarget){notify('Ничего интересного в поле зрения.');return;}const d=activeTarget.userData.interaction;if(d.action){d.action();}else openInspect(d);}
const raycaster=new THREE.Raycaster();
function isEffectivelyVisible(obj){for(let node=obj;node;node=node.parent){if(!node.visible)return false;}return true;}
function updateTarget(){raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hits=raycaster.intersectObjects(interactables,false).filter(h=>h.distance<3.7&&isEffectivelyVisible(h.object));activeTarget=hits.length?hits[0].object:null;$('prompt').textContent=activeTarget?`◉ ${activeTarget.userData.interaction.title}`:'';$('prompt').style.opacity=activeTarget?'1':'0';}
function lowZoneAt(x,z,radius=0){return lowClearanceZones.find(zone=>x+radius>zone.minX&&x-radius<zone.maxX&&z+radius>zone.minZ&&z-radius<zone.maxZ)||null;}
function canFitAt(x,z,mode=posture){const zone=lowZoneAt(x,z,postures[mode].radius);return !zone||postures[mode].height<=zone.clearance;}
function canOccupyAt(x,z){const zone=lowZoneAt(x,z,stance.radius);return !zone||stance.height<=zone.clearance;}
function collides(x,z){if(x < -46 || x > 46 || z < -25 || z > 61)return true;const radius=stance.radius,feetY=Math.max(0,camera.position.y-stance.eye),headY=feetY+stance.height;for(const c of colliders){const verticalOverlap=feetY<c.maxY&&headY>c.minY;if(verticalOverlap&&x+radius>c.minX&&x-radius<c.maxX&&z+radius>c.minZ&&z-radius<c.maxZ)return true;}for(const obj of motionObjects){if(!obj.userData.blocksPassage||currentMotionFraction(obj)>=.98)continue;const leaf=obj.userData.leaf;if(!leaf)continue;const b=new THREE.Box3().setFromObject(leaf);const verticalOverlap=feetY<b.max.y&&headY>b.min.y;if(verticalOverlap&&x+radius>b.min.x&&x-radius<b.max.x&&z+radius>b.min.z&&z-radius<b.max.z)return true;}return false;}
function updatePostureUI(){const crouch=$('crouch'),prone=$('prone');crouch.classList.toggle('active',posture==='crouch');prone.classList.toggle('active',posture==='prone');crouch.setAttribute('aria-pressed',String(posture==='crouch'));prone.setAttribute('aria-pressed',String(posture==='prone'));$('postureStatus').textContent=`ПОЗА: ${postures[posture].label}`;}
function setPosture(next){if(!started||modalOpen)return;if(!grounded){notify('Сначала приземлись.');return;}if(next===posture)return;const x=camera.position.x,z=camera.position.z;if(!canFitAt(x,z,next)){notify('Над головой слишком мало места. Здесь можно только лечь.');return;}stanceFrom={eye:stance.eye,height:stance.height,radius:stance.radius,speed:stance.speed};stanceElapsed=0;posture=next;sprintHeld=false;updatePostureUI();notify(next==='stand'?'Поднимаешься на ноги.':next==='crouch'?'Плавно приседаешь.':'Опускаешься на землю.');}
function updateStaminaUI(force=false){const value=Math.max(0,Math.min(100,Math.round(stamina)));if(!force&&value===lastStaminaShown)return;lastStaminaShown=value;const fill=$('staminaFill'),label=$('staminaValue');if(fill)fill.style.width=value+'%';if(label)label.textContent=value+'%';const track=$('staminaTrack');if(track)track.setAttribute('aria-valuenow',String(value));track?.classList.toggle('low',value<=20);const sprint=$('sprint');if(sprint){sprint.classList.toggle('active',sprintHeld&&sprintBlend>.08);sprint.classList.toggle('depleted',sprintLocked);sprint.setAttribute('aria-pressed',String(sprintHeld));}}
function updateHealthUI(force=false){const value=Math.max(0,Math.min(HEALTH_MAX,Math.round(health)));if(!force&&value===lastHealthShown)return;lastHealthShown=value;const fill=$('healthFill'),label=$('healthValue'),track=$('healthTrack');if(fill)fill.style.width=value+'%';if(label)label.textContent=value+'%';if(track){track.setAttribute('aria-valuenow',String(value));track.classList.toggle('low',value<=25);}}
function damagePlayer(amount,reason){if(!started||health<=0||modalOpen)return;health=Math.max(0,health-amount);updateHealthUI(true);save();const fx=$('damageFx');if(fx){fx.style.opacity='.85';clearTimeout(damageFlashTimer);damageFlashTimer=setTimeout(()=>{fx.style.opacity='0';},240);}if(health<=0){sprintHeld=false;modalOpen=true;$('downed').style.display='flex';$('prompt').style.opacity='0';notify('Сознание постепенно угасает...');}else notify(reason||'Ты получил повреждение.');}
function updateHazards(dt){hazardClock=Math.max(0,hazardClock-dt);const x=camera.position.x,z=camera.position.z;const inLiveWater=x>1.95&&x<3.3&&z>-14.95&&z<-13.72;if(inLiveWater){if(!hazardNotice){notify('ОПАСНО: оголённый провод в воде. Обойди лужу.');hazardNotice=true;}if(hazardClock<=0){damagePlayer(HEALTH_HAZARD_DAMAGE,'Удар током! Отойди от повреждённого кабеля.');hazardClock=HEALTH_HAZARD_INTERVAL;}}else hazardNotice=false;}
function startSprint(){if(!started||modalOpen)return;if(posture!=='stand'||stanceElapsed<1){notify('Чтобы бежать, сначала полностью встань.');return;}if(sprintLocked||stamina<2){notify('Нужно восстановить выносливость.');return;}sprintHeld=true;updateStaminaUI(true);}
function stopSprint(){sprintHeld=false;updateStaminaUI(true);}
function jump(){if(!started||modalOpen||!grounded)return;if(posture!=='stand'||stanceElapsed<1){notify('Для прыжка нужно полностью встать.');return;}if(!canFitAt(camera.position.x,camera.position.z,'stand')){notify('Здесь слишком низкий потолок для прыжка.');return;}jumpVelocity=5.0;grounded=false;notify('Прыжок.');}
function move(dt){
 if(!started||modalOpen||peekState){sprintBlend=THREE.MathUtils.damp(sprintBlend,0,9,dt);updateBodyAnimation(dt,0,false);return;}
 // Blend the physical stance (height, radius and speed), not just the camera.
 if(stanceElapsed<1&&stanceFrom){
  stanceElapsed=Math.min(1,stanceElapsed+dt/STANCE_TRANSITION_SECONDS);
  const t=stanceElapsed*stanceElapsed*(3-2*stanceElapsed),target=postures[posture];
  for(const k of ['eye','height','radius','speed'])stance[k]=THREE.MathUtils.lerp(stanceFrom[k],target[k],t);
  if(stanceElapsed>=1)stanceFrom=null;
 }
 // Smooth the analog input slightly to remove fingertip jitter without adding a delayed stop.
 const joyBlend=1-Math.exp(-dt*24);
 joy.x+= (joyTarget.x-joy.x)*joyBlend;
 joy.y+= (joyTarget.y-joy.y)*joyBlend;
 let forward=0,side=0;
 if(keys.w||keys.arrowup)forward+=1;if(keys.s||keys.arrowdown)forward-=1;if(keys.a||keys.arrowleft)side-=1;if(keys.d||keys.arrowright)side+=1;
 forward+=-joy.y;side+=joy.x;const len=Math.hypot(forward,side);if(len>1){forward/=len;side/=len;}
 const canSprint=sprintHeld&&!sprintLocked&&posture==='stand'&&stanceElapsed>=1&&grounded&&len>.05&&stamina>0;
 sprintBlend=THREE.MathUtils.damp(sprintBlend,canSprint?1:0,8,dt);
 const activelySprinting=sprintBlend>.06&&posture==='stand'&&grounded&&len>.05;
 if(canSprint&&sprintBlend>.06){
  stamina=Math.max(0,stamina-STAMINA_DRAIN*sprintBlend*dt);staminaRecoveryDelay=1.25;
  if(stamina<=0){sprintHeld=false;sprintLocked=true;notify('Выносливость исчерпана. Нужно перевести дыхание.');}
 }else{
  staminaRecoveryDelay=Math.max(0,staminaRecoveryDelay-dt);
  if(staminaRecoveryDelay<=0&&stamina<100){stamina=Math.min(100,stamina+STAMINA_REGEN*dt);if(sprintLocked&&stamina>=STAMINA_RESTART)sprintLocked=false;}
 }
 updateStaminaUI();
 const moveSpeed=stance.speed*(1+(posture==='stand'?((SPRINT_MULTIPLIER-1)*sprintBlend):0));
 // Three.js camera looks along local -Z. Use the same yaw basis for forward and right,
 // so pushing the stick up always follows the view direction, even after turning.
 const speed=moveSpeed*dt;
 const forwardX=-Math.sin(yaw),forwardZ=-Math.cos(yaw);
 const rightX=Math.cos(yaw),rightZ=-Math.sin(yaw);
 const dx=(forwardX*forward+rightX*side)*speed;
 const dz=(forwardZ*forward+rightZ*side)*speed;
 const nx=camera.position.x+dx,nz=camera.position.z+dz;
 if(len>.02){
  if(!collides(nx,camera.position.z)&&canOccupyAt(nx,camera.position.z))camera.position.x=nx;
  else if(lowZoneAt(nx,camera.position.z,stance.radius)&&!lowSpaceBlocked){notify('Проход завален. Нужно лечь, чтобы проползти под балкой.');lowSpaceBlocked=true;}
  if(!collides(camera.position.x,nz)&&canOccupyAt(camera.position.x,nz))camera.position.z=nz;
  else if(lowZoneAt(camera.position.x,nz,stance.radius)&&!lowSpaceBlocked){notify('Проход завален. Нужно лечь, чтобы проползти под балкой.');lowSpaceBlocked=true;}
 }
 if(!lowZoneAt(camera.position.x,camera.position.z,stance.radius))lowSpaceBlocked=false;
 if(len>.05)bob+=dt*(activelySprinting?13:posture==='prone'?4:posture==='crouch'?6:9);
 if(!grounded){jumpVelocity-=14*dt;jumpHeight+=jumpVelocity*dt;if(jumpHeight<=0){const impact=Math.abs(jumpVelocity);jumpHeight=0;jumpVelocity=0;grounded=true;if(impact>8)damagePlayer(Math.min(30,(impact-7)*5),'Сильное приземление. Ты ушибся.');}}
 const bobAmount=activelySprinting?.032:posture==='stand'?.018:posture==='crouch'?.009:.004;
 const bobOffset=grounded&&len>.05?Math.sin(bob)*bobAmount:0;
 const targetEye=stance.eye+jumpHeight+bobOffset;camera.position.y=THREE.MathUtils.damp(camera.position.y,targetEye,12,dt);
 const targetFov=72+4*sprintBlend;if(Math.abs(camera.fov-targetFov)>.025){camera.fov=THREE.MathUtils.damp(camera.fov,targetFov,5,dt);camera.updateProjectionMatrix();}
 updateHazards(dt);updateBodyAnimation(dt,len,activelySprinting);
}
function updateBodyAnimation(){ bodyRig.visible=false; }

let lastIdleRender = 0;
function animate(t){requestAnimationFrame(animate);if(document.hidden)return;if(!started){if(t-lastIdleRender>250){renderer.render(scene,camera);lastIdleRender=t;}return;}const dt=Math.min(.04,(t-last)/1000||0);last=t;move(dt);
 for(const obj of motionObjects){const d=obj.userData;if(d.manualHold){d.targetFraction=THREE.MathUtils.clamp(d.targetFraction+d.manualHold*d.manualHoldSpeed*dt,0,1);d.target=d.closedValue+(d.openedValue-d.closedValue)*d.targetFraction;if(d.targetFraction<=0||d.targetFraction>=1){d.manualHold=0;releaseHandAction();}}
  const current=d.motion==='slide'?obj.position.z:obj.rotation.y,delta=d.target-current;const fast=(d.speed||0)>8,stiffness=fast?62:31,damping=fast?11.8:9.2;let velocity=Number(d.velocity)||0;velocity+=delta*stiffness*dt;velocity*=Math.exp(-damping*dt);let next=current+velocity*dt;if(Math.abs(delta)<.0015&&Math.abs(velocity)<.009){next=d.target;velocity=0;}else if(delta*(d.target-next)<0){next=d.target;velocity=0;}if(d.motion==='slide')obj.position.z=next;else obj.rotation.y=next;d.velocity=velocity;const fraction=currentMotionFraction(obj);d.open=fraction>=.99;d.ajar=fraction>.02&&!d.open;
 }
 if(heldObject){const flap=heldObject.getObjectByName('Записка: сгибаемая часть');if(flap&&flap.userData.foldTarget!==undefined)flap.rotation.x=THREE.MathUtils.damp(flap.rotation.x,flap.userData.foldTarget,10,dt);}
 if(peekState){const p=peekState;p.elapsed+=dt;const k=smooth01(p.elapsed/p.duration);camera.position.x=THREE.MathUtils.lerp(p.fromX,p.toX,k);camera.position.z=THREE.MathUtils.lerp(p.fromZ,p.toZ,k);const viewYaw=p.phase==='hold'?yaw:THREE.MathUtils.lerp(p.fromYaw,p.toYaw,k);const roll=THREE.MathUtils.lerp(p.fromRoll,p.toRoll,k);const viewPitch=p.phase==='hold'?pitch:THREE.MathUtils.lerp(p.fromPitch,p.toPitch,k);camera.rotation.set(viewPitch,viewYaw,roll,'YXZ');if(p.elapsed>=p.duration){if(p.phase==='in'){p.phase='hold';p.elapsed=0;p.fromX=p.toX;p.fromZ=p.toZ;p.fromYaw=p.toYaw;p.fromRoll=p.toRoll;camera.position.x=p.toX;camera.position.z=p.toZ;yaw=p.toYaw;camera.rotation.set(pitch,yaw,p.toRoll,'YXZ');}else if(p.phase==='out'){camera.position.x=p.toX;camera.position.z=p.toZ;camera.rotation.set(pitch,yaw,0,'YXZ');peekState=null;$('peekExit').style.display='none';}}}
 const p=rain.geometry.attributes.position;for(let i=0;i<rainCount;i++){p.array[i*3+1]-=dt*7;if(p.array[i*3+1]<0){p.array[i*3+1]=18;p.array[i*3]=(Math.random()-.5)*90;p.array[i*3+2]=(Math.random()-.5)*88;}}p.needsUpdate=true;cableCore.intensity=.55+Math.sin(t*.018)*.32;expansion.update(dt,t);if(started&&!modalOpen)skyWeather.update(dt,t);
 if(started&&!modalOpen)updateTarget();renderer.render(scene,camera);
}
requestAnimationFrame(animate);
function look(dx=0,dy=0){yaw-=dx*.0042;pitch=THREE.MathUtils.clamp(pitch-dy*.0042,-1.05,.8);const roll=peekState?.phase==='hold'?camera.rotation.z:0;camera.rotation.set(pitch,yaw,roll,'YXZ');}
function getViewportSize(){
 const viewport=window.visualViewport;
 return {
  width:Math.max(1,Math.round(viewport?.width||window.innerWidth||1)),
  height:Math.max(1,Math.round(viewport?.height||window.innerHeight||1))
 };
}
function resize(){
 const {width,height}=getViewportSize();
 document.documentElement.style.setProperty('--tishina-app-width',`${width}px`);
 document.documentElement.style.setProperty('--tishina-app-height',`${height}px`);
 camera.aspect=width/height;
 camera.updateProjectionMatrix();
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,pixelRatioLimit));
 renderer.setSize(width,height);
}
addEventListener('resize',resize,{passive:true});
addEventListener('orientationchange',()=>requestAnimationFrame(resize),{passive:true});
window.visualViewport?.addEventListener('resize',resize,{passive:true});
window.visualViewport?.addEventListener('scroll',resize,{passive:true});
resize();
const introFootText=document.querySelector('#intro .foot').textContent;
function resetWorld(){
 story.reset();
 skyWeather.reset();
 setFlashlightState(false,false);
 activeTarget=null;peekState=null;handAction=null;$('peekExit').style.display='none';$('physicalFeedback').classList.remove('visible');$('prompt').style.opacity='0';inventory.splice(0);medkits=0;energyItems=0;health=100;stamina=100;sprintLocked=false;sprintHeld=false;sprintBlend=0;staminaRecoveryDelay=0;
 for(const obj of Object.values(pickupObjects))obj.visible=true;
 for(const obj of motionObjects){obj.userData.open=false;obj.userData.ajar=false;obj.userData.targetFraction=0;obj.userData.target=obj.userData.closedValue??0;obj.userData.speed=7;obj.userData.velocity=0;obj.userData.manualHold=0;if(obj.userData.motion==='slide')obj.position.z=obj.userData.closedValue??-.4;else obj.rotation.y=obj.userData.closedValue??0;}
 posture='stand';stanceFrom=null;stanceElapsed=1;Object.assign(stance,postures.stand);jumpHeight=0;jumpVelocity=0;grounded=true;camera.position.set(0,postures.stand.eye,10.5);yaw=0;pitch=0;look(0,0);joy={x:0,y:0};joyTarget={x:0,y:0};nubReset();keys={};updatePostureUI();updateHealthUI(true);updateStaminaUI(true);updateInventoryUI();save();
}
function nubReset(){const nub=$('nub');if(nub)nub.style.transform='translate(0,0)';}
function beginNewGame(){
 try{
  $('titleStatus').textContent='';
  resetWorld();
  started=true;
  modalOpen=true;
  document.querySelector('#intro .foot').textContent=introFootText;
  $('confirmNew').style.display='none';
  $('pause').style.display='none';
  $('intro').style.display='none';
  $('menuStatus').textContent='';
  story.begin(()=>{
   modalOpen=false;
   save();
   notify('Проходная комплекса «Север-7». Осмотрись. Двери и предметы можно исследовать.');
  });
  save();
 }catch(error){
  started=false;
  modalOpen=true;
  $('confirmNew').style.display='none';
  $('pause').style.display='none';
  window.__TISHINA_BOOT__?.reportError?.(error);
  console.error('[ТИШИНА] Не удалось начать новую игру:',error);
 }
}
function openMainMenu(){if(!started)return;stopSprint();joy={x:0,y:0};joyTarget={x:0,y:0};nubReset();save();modalOpen=true;$('pause').style.display='flex';$('menuStatus').textContent='';}
function closeMainMenu(){ $('pause').style.display='none';modalOpen=false;}
function continueAuto(){const data=readStored('tishinaAutoV1')||autosaved;if(!data){$('titleStatus').textContent='АВТОСОХРАНЕНИЕ НЕ НАЙДЕНО';return;}applySnapshot(data);started=true;modalOpen=false;$('intro').style.display='none';$('downed').style.display='none';save();notify('Продолжаем с последней автосохранённой позиции.');}
function exitGame(){save();started=false;stopSprint();joy={x:0,y:0};joyTarget={x:0,y:0};nubReset();modalOpen=true;$('pause').style.display='none';$('intro').style.display='flex';document.querySelector('#intro .foot').textContent='ИГРА ОСТАНОВЛЕНА · В БРАУЗЕРЕ МОЖНО ЗАКРЫТЬ ВКЛАДКУ ВРУЧНУЮ';if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});}
$('start').onclick=beginNewGame;$('continueTitle').onclick=continueAuto;$('titleLoad').onclick=()=>{if(!loadManual()){$('titleStatus').textContent='Сначала сохраните игру в главном меню.';}};
$('use').onclick=interact;$('closeInspect').onclick=closeInspect;
$('choiceInspect').onclick=()=>{if(pendingItemId)beginItemExamine(pendingItemId);};$('choiceInventory').onclick=takePendingItemToInventory;$('choiceLeave').onclick=closeItemChoice;$('flashlight').onclick=toggleFlashlight;setFlashlightState(flashlightOn,false);
$('itemSpecialActions').addEventListener('click',e=>{const btn=e.target.closest('button[data-held-action]');if(btn)handleHeldAction(btn.dataset.heldAction);});
$('motionAjar').onclick=()=>doMotionAction('ajar');$('motionPeek').onclick=doPeek;$('motionSlowOpen').onclick=()=>doMotionAction('slowOpen');$('motionFastOpen').onclick=()=>doMotionAction('fastOpen');$('motionSlowClose').onclick=()=>doMotionAction('slowClose');$('motionFastClose').onclick=()=>doMotionAction('fastClose');$('motionClosePanel').onclick=closeMotionPanel;
function bindMotionHold(id,direction){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();if(!activeMotion)return;el.setPointerCapture(e.pointerId);startManualMotion(direction);});const end=()=>stopManualMotion();el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);el.addEventListener('contextmenu',e=>e.preventDefault());}
bindMotionHold('motionHoldOpen',1);bindMotionHold('motionHoldClose',-1);$('peekExit').onclick=endPeek;
$('takeToInventory').onclick=()=>finishHeldItem(true);$('putBack').onclick=()=>finishHeldItem(false);
const itemStage=$('itemStage');itemStage.addEventListener('pointerdown',e=>{if(!heldObject)return;heldPointer={x:e.clientX,y:e.clientY};itemStage.setPointerCapture(e.pointerId);});itemStage.addEventListener('pointermove',e=>{if(!heldPointer||!heldObject)return;const dx=e.clientX-heldPointer.x,dy=e.clientY-heldPointer.y;heldObject.rotation.y+=dx*.012;heldObject.rotation.x=THREE.MathUtils.clamp(heldObject.rotation.x+dy*.009,-1.25,1.25);heldPointer={x:e.clientX,y:e.clientY};});const stopHeldRotate=()=>{heldPointer=null;};itemStage.addEventListener('pointerup',stopHeldRotate);itemStage.addEventListener('pointercancel',stopHeldRotate);
$('bag').onclick=()=>{$('inventory').style.display='flex';modalOpen=true;updateInventoryUI();};$('closeBag').onclick=()=>{$('inventory').style.display='none';modalOpen=false;};
$('useMedkit').onclick=useMedkit;$('useEnergy').onclick=useEnergy;
$('openMenu').onclick=openMainMenu;$('closeMenu').onclick=closeMainMenu;$('continueGame').onclick=closeMainMenu;$('saveGame').onclick=saveManual;$('loadGame').onclick=()=>loadManual();$('newGame').onclick=()=>{$('confirmNew').style.display='flex';};$('confirmNewNo').onclick=()=>{$('confirmNew').style.display='none';};$('confirmNewYes').onclick=beginNewGame;$('exitGame').onclick=exitGame;
$('jump').onclick=jump;$('crouch').onclick=()=>setPosture(posture==='crouch'?'stand':'crouch');$('prone').onclick=()=>setPosture(posture==='prone'?'stand':'prone');$('recover').onclick=()=>{health=65;stamina=70;sprintLocked=false;sprintHeld=false;posture='stand';stanceFrom=null;stanceElapsed=1;Object.assign(stance,postures.stand);jumpHeight=0;jumpVelocity=0;grounded=true;camera.position.set(0,1.68,10.5);yaw=0;pitch=0;look(0,0);$('downed').style.display='none';modalOpen=false;updatePostureUI();updateStaminaUI(true);updateHealthUI(true);save();notify('Ты пришёл в себя у проходной. Будь осторожнее.');};updatePostureUI();updateStaminaUI(true);updateHealthUI(true);updateInventoryUI();
const sprintButton=$('sprint');sprintButton.addEventListener('pointerdown',e=>{e.preventDefault();sprintButton.setPointerCapture(e.pointerId);startSprint();});sprintButton.addEventListener('pointerup',e=>{e.preventDefault();stopSprint();});sprintButton.addEventListener('pointercancel',stopSprint);sprintButton.addEventListener('lostpointercapture',stopSprint);sprintButton.addEventListener('contextmenu',e=>e.preventDefault());
$('fullscreen').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{notify('Открой игру через «На экран Домой» для более полного режима.');}};
const stick=$('stick'),nub=$('nub');let stickPointerId=null;
function setJoy(e){
 const r=stick.getBoundingClientRect();
 const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
 const radius=Math.max(1,Math.min(r.width,r.height)*.39),distance=Math.hypot(dx,dy);
 const clampScale=distance>radius?radius/distance:1;
 const px=dx*clampScale,py=dy*clampScale,clampedDistance=Math.hypot(px,py);
 const amount=Math.min(1,clampedDistance/radius),deadZone=.12;
 const strength=amount<=deadZone?0:(amount-deadZone)/(1-deadZone);
 const divisor=clampedDistance||1;
 joyTarget.x=(px/divisor)*strength;
 joyTarget.y=(py/divisor)*strength;
 nub.style.transform=`translate(${px}px,${py}px)`;
}
function resetJoy(){stickPointerId=null;joy={x:0,y:0};joyTarget={x:0,y:0};nub.style.transform='translate(0,0)';}
stick.addEventListener('pointerdown',e=>{e.preventDefault();stickPointerId=e.pointerId;try{stick.setPointerCapture(e.pointerId);}catch{}setJoy(e);});
stick.addEventListener('pointermove',e=>{if(stickPointerId===e.pointerId){e.preventDefault();setJoy(e);}});
stick.addEventListener('pointerup',e=>{if(stickPointerId===e.pointerId)resetJoy();});
stick.addEventListener('pointercancel',resetJoy);stick.addEventListener('lostpointercapture',resetJoy);
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&e.clientX<innerWidth*.42&&e.clientY>innerHeight*.52)return;if(modalOpen)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId};try{canvas.setPointerCapture(e.pointerId);}catch{}});canvas.addEventListener('pointermove',e=>{if(drag&&drag.id===e.pointerId&&!modalOpen&&(!peekState||peekState.phase==='hold')){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;look(dx,dy);drag={x:e.clientX,y:e.clientY,id:e.pointerId};}});const stopLook=e=>{if(drag&&drag.id===e.pointerId)drag=null;};canvas.addEventListener('pointerup',stopLook);canvas.addEventListener('pointercancel',stopLook);canvas.addEventListener('lostpointercapture',stopLook);
addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(key==='escape'){if(peekState){endPeek();return;}if($('itemExamine').style.display==='block')finishHeldItem(false);else if($('itemChoice').style.display==='flex')closeItemChoice();else if($('motionPanel').style.display==='flex')closeMotionPanel();else if($('confirmNew').style.display==='flex')$('confirmNew').style.display='none';else if(started&&!modalOpen)openMainMenu();else if(modalOpen&&$('pause').style.display==='flex')closeMainMenu();else if(modalOpen&&$('inventory').style.display==='flex'){$('inventory').style.display='none';modalOpen=false;}else if(modalOpen&&$('inspect').style.display==='flex')closeInspect();return;}if(e.code==='ShiftLeft'||e.code==='ShiftRight'){startSprint();return;}if(e.code==='Space'){e.preventDefault();jump();return;}if(key==='f'&&!e.repeat){toggleFlashlight();return;}if(key==='c'){setPosture(posture==='crouch'?'stand':'crouch');return;}if(key==='z'){setPosture(posture==='prone'?'stand':'prone');return;}keys[key]=true;if(key==='e')interact();});addEventListener('keyup',e=>{if(e.code==='ShiftLeft'||e.code==='ShiftRight'){stopSprint();return;}keys[e.key.toLowerCase()]=false;});
addEventListener('blur',()=>{stopSprint();if(started)save();});document.addEventListener('visibilitychange',()=>{if(document.hidden){stopSprint();if(started)save();}});addEventListener('pagehide',()=>{if(started)save();});setInterval(()=>{if(started&&!modalOpen)save();},12000);
window.__TISHINA_BOOT__?.ready?.();
