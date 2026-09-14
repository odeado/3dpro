// Fase 4: guardar/abrir proyectos (localStorage, sin cuenta todavia),
// exportar imagen PNG transparente, e instalable como PWA (manifest.json +
// sw.js, registrado al final de este archivo). Se suma tambien el Toroide
// como forma (util para bocas/ojos: aplastado con Escalar queda como un
// aro o una media luna).

import * as THREE from 'three';
import { OrbitControls } from './vendor/three-addons/OrbitControls.js';
import { TransformControls } from './vendor/three-addons/TransformControls.js';

const wrap = document.getElementById('canvasWrap');
const layerList = document.getElementById('layerList');
const layerEmpty = document.getElementById('layerEmpty');
const propsPanel = document.getElementById('propsPanel');
const propsColor = document.getElementById('propsColor');
const propsRoughness = document.getElementById('propsRoughness');
const propsMetalness = document.getElementById('propsMetalness');
const propsOpacity = document.getElementById('propsOpacity');
const propsWireframe = document.getElementById('propsWireframe');
const alignOriginBtn = document.getElementById('alignOriginBtn');
const alignGroundBtn = document.getElementById('alignGroundBtn');
const focusCamBtn = document.getElementById('focusCamBtn');
const exportObjBtn = document.getElementById('exportObjBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonBtn = document.getElementById('importJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');
const shadowToggle = document.getElementById('shadowToggle');
const toggleSidePanelBtn = document.getElementById('toggleSidePanelBtn');
const rightPanel = document.getElementById('rightPanel');
const symmetryXInput = document.getElementById('symmetryX');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const lightRange = document.getElementById('lightRange');
const saveBtn = document.getElementById('saveBtn');
const openBtn = document.getElementById('openBtn');
const exportBtn = document.getElementById('exportBtn');
const openModal = document.getElementById('openModal');
const closeOpenModal = document.getElementById('closeOpenModal');
const projectListModal = document.getElementById('projectListModal');
const projectListEmpty = document.getElementById('projectListEmpty');
const toolbar = document.getElementById('toolbar');
const brushRow = document.getElementById('brushRow');
const brushSizeInput = document.getElementById('brushSize');
const brushStrengthInput = document.getElementById('brushStrength');

// Tab switcher for right inspector panel
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    if (tabId) {
      const target = document.getElementById(tabId);
      if (target) target.classList.add('active');
    }
  });
});

// Dropdown click handler (for touch/click)
document.querySelectorAll('.dropbtn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = btn.closest('.dropdown');
    document.querySelectorAll('.dropdown').forEach(d => {
      if (d !== dropdown) d.classList.remove('active');
    });
    if (dropdown) dropdown.classList.toggle('active');
  });
});

window.addEventListener('click', () => {
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b2f33);

const perspCam = new THREE.PerspectiveCamera(50, wrap.clientWidth / wrap.clientHeight, 0.1, 2000);
perspCam.position.set(180, 160, 260);

// Camara ortografica para las vistas Frente/Atras/Izquierda/Derecha/Arriba/
// Abajo -- sin la distorsion de perspectiva, para que sirvan de verdad para
// alinear cosas ("disenios perfectos"), no solo la vista libre en 3D.
const ORTHO_HALF_HEIGHT = 220;
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);

// Camaras fijas para el modo "4 vistas a la vez" (como Cinema4D): a
// diferencia de orthoCam (que se reposiciona segun la vista elegida en modo
// de una sola vista), estas quedan quietas en Frente/Izquierda/Arriba para
// que las cuatro vistas se vean todas juntas y a la vez.
const gridFrontCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);
const gridLeftCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);
const gridTopCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);

let activeCamera = perspCam;
let fourViewMode = false;
let currentViewKey = 'perspective';
let activeQuadrant = 'tl';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(wrap.clientWidth, wrap.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
wrap.appendChild(renderer.domElement);

const BASE_DIR_INTENSITY = 1.1;
const BASE_AMBIENT_INTENSITY = 0.45;
const dirLight = new THREE.DirectionalLight(0xffffff, BASE_DIR_INTENSITY);
dirLight.position.set(120, 200, 150);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 1000;
const shadowDist = 300;
dirLight.shadow.camera.left = -shadowDist;
dirLight.shadow.camera.right = shadowDist;
dirLight.shadow.camera.top = shadowDist;
dirLight.shadow.camera.bottom = -shadowDist;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

const ambientLight = new THREE.AmbientLight(0xffffff, BASE_AMBIENT_INTENSITY);
scene.add(ambientLight);

const groundGeo = new THREE.PlaneGeometry(800, 800);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.25 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(400, 20, 0x555555, 0x3d4146);
scene.add(grid);

const orbit = new OrbitControls(perspCam, renderer.domElement);
orbit.target.set(0, 20, 0);
orbit.enableDamping = true;

const transform = new TransformControls(perspCam, renderer.domElement);
transform.size = 1.3;
const transformHelper = transform.getHelper ? transform.getHelper() : transform;
scene.add(transformHelper);
transform.addEventListener('dragging-changed', (e) => {
  orbit.enabled = !e.value;
  if (!e.value) pushHistory(); // se soltó el gizmo: guardar el estado nuevo para poder deshacerlo
});

const DEFAULT_COLOR = 0xe0762f;

const sceneObjects = new Map(); // id -> { id, kind, mesh, visible }
let objIdCounter = 1;
let selectedId = null;
let toolMode = 'translate'; // 'translate' | 'rotate' | 'scale' | 'sculpt'

const KIND_LABEL = {
  cube: '🧊 Cubo', sphere: '⚪ Esfera', cylinder: '🥫 Cilindro',
  cone: '🔺 Cono', plane: '▭ Plano', torus: '🍩 Toroide', null: '🗂️ Grupo (Nulo)',
  hair: '💇 Pelo'
};

const HAIR_ROOT_RADIUS = 4;
const HAIR_TIP_RADIUS = 0.6;
const HAIR_DEFAULT_COLOR = 0x3b2415;
const HAIR_MIN_SPACING = 4; // unidades: no agregar un punto nuevo del trazo si esta muy cerca del anterior

// Arma un tubo afinado (grueso en la raiz, fino en la punta) que pasa por
// "points" -- mismo metodo que usa THREE.TubeGeometry por dentro
// (computeFrenetFrames para no torcerse), pero con el radio variando a lo
// largo de la curva en vez de ser fijo, para que se vea como un pelo de
// verdad y no como un fideo.
function buildTaperedTubeGeometry(points, rootRadius, tipRadius, radialSegments = 6) {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = Math.max(6, (points.length - 1) * 3);
  const frames = curve.computeFrenetFrames(segs, false);
  const vertices = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const P = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, P);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = rootRadius + (tipRadius - rootRadius) * u;
    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v), cos = -Math.cos(v);
      normal.set(cos * N.x + sin * B.x, cos * N.y + sin * B.y, cos * N.z + sin * B.z).normalize();
      normals.push(normal.x, normal.y, normal.z);
      vertices.push(P.x + r * normal.x, P.y + r * normal.y, P.z + r * normal.z);
      uvs.push(u, j / radialSegments);
    }
  }

  for (let j = 1; j <= segs; j++) {
    for (let i = 1; i <= radialSegments; i++) {
      const a = (radialSegments + 1) * (j - 1) + (i - 1);
      const b = (radialSegments + 1) * j + (i - 1);
      const c = (radialSegments + 1) * j + i;
      const d = (radialSegments + 1) * (j - 1) + i;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeBoundingSphere();
  return geo;
}

// Un Pelo no tiene una "forma de fabrica" como un cubo o una esfera -- su
// geometria sale entera del trazo dibujado. Para poder reconstruirlo (al
// deshacer/rehacer, abrir un proyecto guardado, o clonarlo) se guarda/
// restaura el buffer completo (posiciones, normales, uvs, indice), no solo
// un puñado de parametros.
function serializeGeometry(geo) {
  return {
    position: Array.from(geo.attributes.position.array),
    normal: Array.from(geo.attributes.normal.array),
    uv: geo.attributes.uv ? Array.from(geo.attributes.uv.array) : null,
    index: geo.index ? Array.from(geo.index.array) : null
  };
}

function geometryFromSerialized(data) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(data.position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normal, 3));
  if (data.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
  if (data.index) geo.setIndex(data.index);
  geo.computeBoundingSphere();
  return geo;
}

function geometryFor(kind) {
  switch (kind) {
    case 'sphere': return new THREE.SphereGeometry(42, 48, 36);
    case 'cylinder': return new THREE.CylinderGeometry(36, 36, 78, 32, 16);
    case 'cone': return new THREE.ConeGeometry(42, 78, 32, 16);
    case 'plane': return new THREE.PlaneGeometry(90, 90, 24, 24);
    case 'torus': return new THREE.TorusGeometry(42, 15, 24, 64);
    case 'cube':
    default: return new THREE.BoxGeometry(66, 66, 66, 12, 12, 12);
  }
}

// Crea el Object3D (o Mesh) de una figura, mas el objeto que de verdad se
// usa para detectar el toque (pickMesh) -- para una figura normal son lo
// mismo; para un Nulo, "node" es el grupo vacio que se mueve/rota/escala
// (y que arrastra con el a todo lo que se agrupe adentro), y "pickMesh" es
// una esfera invisible mas grande, para poder tocarlo comodo con el dedo.
function buildObject(kind, colorHex, extra) {
  if (kind === 'null') {
    const group = new THREE.Object3D();
    const axes = new THREE.AxesHelper(28);
    group.add(axes);
    const hitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(18, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    group.add(hitMesh);
    return { node: group, pickMesh: hitMesh };
  }

  const roughness = (extra && extra.roughness != null) ? extra.roughness : (kind === 'hair' ? 0.6 : 0.5);
  const metalness = (extra && extra.metalness != null) ? extra.metalness : 0.05;
  const opacity = (extra && extra.opacity != null) ? extra.opacity : 1.0;
  const wireframe = (extra && extra.wireframe != null) ? !!extra.wireframe : false;

  if (kind === 'hair') {
    const geo = extra && extra.geometryData ? geometryFromSerialized(extra.geometryData) : new THREE.BufferGeometry();
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex != null ? colorHex : HAIR_DEFAULT_COLOR,
      roughness, metalness, opacity,
      transparent: opacity < 1,
      wireframe,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { node: mesh, pickMesh: mesh };
  }

  const geo = geometryFor(kind);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex != null ? colorHex : DEFAULT_COLOR,
    roughness, metalness, opacity,
    transparent: opacity < 1,
    wireframe,
    side: kind === 'plane' ? THREE.DoubleSide : THREE.FrontSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { node: mesh, pickMesh: mesh };
}

let placeAngle = 0;
let placeCount = 0;
function nextPlacement() {
  if (placeCount === 0) { placeCount++; return { x: 0, y: 0, z: 0 }; }
  placeCount++;
  const radius = 110;
  const p = { x: Math.cos(placeAngle) * radius, y: 0, z: Math.sin(placeAngle) * radius };
  placeAngle += Math.PI / 3;
  return p;
}

function addPrimitive(kind) {
  const built = buildObject(kind);
  const pos = nextPlacement();
  built.node.position.set(pos.x, pos.y, pos.z);
  scene.add(built.node);
  const id = objIdCounter++;
  built.pickMesh.userData.ownerId = id;
  sceneObjects.set(id, { id, kind, mesh: built.node, pickMesh: built.pickMesh, visible: true, parentId: null, sculpted: false, name: null, collapsed: false });
  renderLayerList();
  selectObject(id);
  pushHistory();
}

function disposeEntry(entry) {
  entry.mesh.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
}

function removeObject(id) {
  const entry = sceneObjects.get(id);
  if (!entry) return;
  sceneObjects.forEach(child => {
    if (child.parentId === id) {
      scene.attach(child.mesh); // conserva su posicion/rotacion/escala en el mundo
      child.parentId = null;
    }
  });
  scene.remove(entry.mesh);
  disposeEntry(entry);
  sceneObjects.delete(id);
  if (selectedId === id) selectObject(null);
  renderLayerList();
  pushHistory();
}

function copySculptIfAny(srcEntry, destNode) {
  if (!srcEntry.sculpted || !srcEntry.mesh.geometry || !destNode.geometry) return false;
  const srcPos = srcEntry.mesh.geometry.attributes.position;
  const destPos = destNode.geometry.attributes.position;
  if (!srcPos || !destPos || srcPos.array.length !== destPos.array.length) return false;
  destPos.array.set(srcPos.array);
  destPos.needsUpdate = true;
  destNode.geometry.computeVertexNormals();
  destNode.geometry.computeBoundingSphere();
  return true;
}

function cloneObject(id) {
  const src = sceneObjects.get(id);
  if (!src) return;
  const colorHex = src.mesh.material ? src.mesh.material.color.getHex() : undefined;
  const extraOpts = {
    roughness: src.mesh.material ? src.mesh.material.roughness : undefined,
    metalness: src.mesh.material ? src.mesh.material.metalness : undefined,
    opacity: src.mesh.material ? src.mesh.material.opacity : undefined,
    wireframe: src.mesh.material ? src.mesh.material.wireframe : undefined,
  };
  if (src.kind === 'hair') {
    extraOpts.geometryData = serializeGeometry(src.mesh.geometry);
  }
  const built = buildObject(src.kind, colorHex, extraOpts);
  built.node.position.copy(src.mesh.position).add(new THREE.Vector3(24, 0, 24));
  built.node.rotation.copy(src.mesh.rotation);
  built.node.scale.copy(src.mesh.scale);
  const copiedSculpt = src.kind === 'hair' ? false : copySculptIfAny(src, built.node);
  scene.add(built.node);
  const newId = objIdCounter++;
  built.pickMesh.userData.ownerId = newId;
  sceneObjects.set(newId, { id: newId, kind: src.kind, mesh: built.node, pickMesh: built.pickMesh, visible: true, parentId: null, sculpted: copiedSculpt, name: src.name ? (src.name + ' (copia)') : null, collapsed: false });
  renderLayerList();
  selectObject(newId);
  pushHistory();
}

function cloneObjectSymmetry(id) {
  const src = sceneObjects.get(id);
  if (!src || src.kind === 'null') return;

  const srcLabel = src.name || KIND_LABEL[src.kind] || src.kind;
  const colorHex = src.mesh.material ? src.mesh.material.color.getHex() : undefined;
  const extraOpts = {
    roughness: src.mesh.material ? src.mesh.material.roughness : undefined,
    metalness: src.mesh.material ? src.mesh.material.metalness : undefined,
    opacity: src.mesh.material ? src.mesh.material.opacity : undefined,
    wireframe: src.mesh.material ? src.mesh.material.wireframe : undefined,
  };
  if (src.kind === 'hair') extraOpts.geometryData = serializeGeometry(src.mesh.geometry);

  // 1. Crear el objeto espejo
  const mirror = buildObject(src.kind, colorHex, extraOpts);
  // El espejo empieza en posicion local cero — el Nulo determina donde va
  mirror.node.position.set(0, 0, 0);
  mirror.node.rotation.copy(src.mesh.rotation);
  mirror.node.rotation.y = -src.mesh.rotation.y;
  mirror.node.scale.copy(src.mesh.scale);
  // Escala negativa en X = efecto espejo sin duplicar geometría
  mirror.node.scale.x = -Math.abs(src.mesh.scale.x);

  let copiedSculpt = false;
  if (src.kind !== 'hair') {
    copiedSculpt = copySculptIfAny(src, mirror.node);
    if (copiedSculpt && mirror.node.geometry && mirror.node.geometry.attributes.position) {
      const posAttr = mirror.node.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) posAttr.setX(i, -posAttr.getX(i));
      posAttr.needsUpdate = true;
      mirror.node.geometry.computeVertexNormals();
      mirror.node.geometry.computeBoundingSphere();
    }
  }

  // 2. Crear el Nulo contenedor (Simetría)
  const nullBuilt = buildObject('null', undefined, {});
  // Centrar el Nulo entre el original y donde irá el espejo (en X=0)
  const worldPos = new THREE.Vector3();
  src.mesh.getWorldPosition(worldPos);
  nullBuilt.node.position.set(0, worldPos.y, worldPos.z);
  scene.add(nullBuilt.node);
  const nullId = objIdCounter++;
  nullBuilt.pickMesh.userData.ownerId = nullId;
  sceneObjects.set(nullId, {
    id: nullId, kind: 'null', mesh: nullBuilt.node, pickMesh: nullBuilt.pickMesh,
    visible: true, parentId: null, sculpted: false,
    name: `🪞 Simetría (${srcLabel})`, collapsed: false,
    symmetrySourceId: id   // marca especial para saber cual es el original
  });

  // 3. Meter el espejo dentro del Nulo
  scene.add(mirror.node);
  const mirrorId = objIdCounter++;
  mirror.pickMesh.userData.ownerId = mirrorId;
  sceneObjects.set(mirrorId, {
    id: mirrorId, kind: src.kind, mesh: mirror.node, pickMesh: mirror.pickMesh,
    visible: true, parentId: nullId, sculpted: copiedSculpt,
    name: srcLabel + ' (Espejo X)', collapsed: false,
    isMirrorOf: id   // marca especial
  });
  nullBuilt.node.attach(mirror.node); // conserva posicion mundo

  // 4. Meter el original dentro del Nulo también
  nullBuilt.node.attach(src.mesh); // conserva posicion mundo
  src.parentId = nullId;

  // 5. Posicionar el espejo al lado opuesto del original dentro del Nulo
  const localPos = new THREE.Vector3();
  src.mesh.parent.worldToLocal(worldPos.clone(), localPos);
  src.mesh.getWorldPosition(worldPos);
  nullBuilt.node.worldToLocal(worldPos);
  src.mesh.position.copy(worldPos);
  const mwp = worldPos.clone();
  mwp.x = -worldPos.x;
  mirror.node.position.copy(mwp);

  renderLayerList();
  selectObject(nullId);
  pushHistory();
}

// --- Agrupar / desagrupar (el Nulo funciona como "mango": lo que se mete
// adentro se mueve/rota/escala junto con el cuando se transforma el Nulo) ---
function isDescendantOf(candidateId, ancestorId) {
  let cur = sceneObjects.get(candidateId);
  let guard = 0;
  while (cur && cur.parentId != null && guard++ < 50) {
    if (cur.parentId === ancestorId) return true;
    cur = sceneObjects.get(cur.parentId);
  }
  return false;
}

function groupInto(childId, parentId) {
  const child = sceneObjects.get(childId);
  const parent = sceneObjects.get(parentId);
  if (!child || !parent || childId === parentId) return;
  if (isDescendantOf(parentId, childId)) return; // no meter un grupo dentro de si mismo
  parent.mesh.attach(child.mesh); // conserva su posicion/rotacion/escala en el mundo
  child.parentId = parentId;
  renderLayerList();
  pushHistory();
}

function ungroup(id) {
  const entry = sceneObjects.get(id);
  if (!entry || entry.parentId == null) return;
  scene.attach(entry.mesh); // conserva su posicion/rotacion/escala en el mundo
  entry.parentId = null;
  renderLayerList();
  pushHistory();
}

function depthOf(entry) {
  let d = 0, cur = entry, guard = 0;
  while (cur && cur.parentId != null && guard++ < 50) {
    d++;
    cur = sceneObjects.get(cur.parentId);
  }
  return d;
}

// Arma la lista de "raices" (sin padre) y, para cada Nulo, sus hijos
// directos -- en el orden en que aparecen en sceneObjects (que es el mismo
// orden que usan moveObject/reordenar). El panel de capas recorre esto en
// profundidad para que cada figura salga debajo de su grupo, no suelta por
// ahi solo con sangria.
function buildTree() {
  const rootIds = [];
  const childrenOf = new Map();
  sceneObjects.forEach(e => {
    if (e.parentId != null && sceneObjects.has(e.parentId)) {
      if (!childrenOf.has(e.parentId)) childrenOf.set(e.parentId, []);
      childrenOf.get(e.parentId).push(e.id);
    } else {
      rootIds.push(e.id);
    }
  });
  return { rootIds, childrenOf };
}

// Sube o baja una figura un lugar entre sus HERMANOS (misma figura padre,
// o el nivel de arriba de todo si no tiene). El orden se guarda de verdad
// (no es solo visual): se intercambian las dos posiciones dentro del Map
// sceneObjects, asi que el nuevo orden sobrevive deshacer/rehacer y
// guardar el proyecto, porque snapshotScene/rebuildSceneFrom recorren el
// Map en este mismo orden.
function moveObject(id, direction) {
  const entry = sceneObjects.get(id);
  if (!entry) return;
  const parentKey = entry.parentId != null ? entry.parentId : null;
  const siblingIds = Array.from(sceneObjects.values())
    .filter(e => (e.parentId != null ? e.parentId : null) === parentKey)
    .map(e => e.id);
  const idx = siblingIds.indexOf(id);
  const swapWith = siblingIds[idx + direction];
  if (swapWith == null) return; // ya esta en una punta de la lista
  const ids = Array.from(sceneObjects.keys());
  const i = ids.indexOf(id), j = ids.indexOf(swapWith);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const rebuilt = ids.map(k => [k, sceneObjects.get(k)]);
  sceneObjects.clear();
  rebuilt.forEach(([k, e]) => sceneObjects.set(k, e));
  renderLayerList();
  pushHistory();
}

function renameObject(id) {
  const entry = sceneObjects.get(id);
  if (!entry) return;
  const nombre = window.prompt('Nombre para esta figura:', entry.name || '');
  if (nombre === null) return; // cancelado
  entry.name = nombre.trim() ? nombre.trim() : null;
  renderLayerList();
  pushHistory();
}

// Solo es un estado de VISTA del panel (que carpetas estan abiertas o
// cerradas) -- se guarda igual en el snapshot para que un grupo cerrado
// siga cerrado despues de deshacer/abrir el proyecto, pero no hace falta
// meterlo en el historial de deshacer como una accion en si misma.
function toggleCollapse(id) {
  const entry = sceneObjects.get(id);
  if (!entry) return;
  entry.collapsed = !entry.collapsed;
  renderLayerList();
}

function toggleVisible(id) {
  const entry = sceneObjects.get(id);
  if (!entry) return;
  entry.visible = !entry.visible;
  entry.mesh.visible = entry.visible;
  if (!entry.visible && selectedId === id) selectObject(null);
  renderLayerList();
  pushHistory();
}

function setColor(id, hex) {
  const entry = sceneObjects.get(id);
  if (!entry || !entry.mesh.material) return;
  entry.mesh.material.color.set(hex);
}

const noSelectionMsg = document.getElementById('noSelectionMsg');

function selectObject(id) {
  selectedId = id;
  const entry = id != null ? sceneObjects.get(id) : null;
  if (entry) {
    if (toolMode === 'sculpt' || toolMode === 'hair') transform.detach(); else transform.attach(entry.mesh);
    if (entry.mesh.material) {
      propsPanel.style.display = 'flex';
      if (noSelectionMsg) noSelectionMsg.style.display = 'none';
      propsColor.value = '#' + entry.mesh.material.color.getHexString();
      propsRoughness.value = entry.mesh.material.roughness != null ? entry.mesh.material.roughness : 0.5;
      propsMetalness.value = entry.mesh.material.metalness != null ? entry.mesh.material.metalness : 0.05;
      propsOpacity.value = entry.mesh.material.opacity != null ? entry.mesh.material.opacity : 1.0;
      propsWireframe.checked = !!entry.mesh.material.wireframe;
    } else {
      propsPanel.style.display = 'none';
      if (noSelectionMsg) noSelectionMsg.style.display = 'block';
    }
  } else {
    transform.detach();
    propsPanel.style.display = 'none';
    if (noSelectionMsg) noSelectionMsg.style.display = 'block';
  }
  renderLayerList();
}

function focusCameraOnSelection() {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry) return;
  const targetPos = new THREE.Vector3();
  entry.mesh.getWorldPosition(targetPos);
  orbit.target.copy(targetPos);
  
  const offset = activeCamera.position.clone().sub(orbit.target);
  if (offset.lengthSq() < 1) offset.set(120, 100, 160);
  else offset.normalize().multiplyScalar(180);
  activeCamera.position.copy(targetPos).add(offset);
  orbit.update();
}

propsColor.addEventListener('input', () => {
  if (selectedId != null) setColor(selectedId, propsColor.value);
});
propsColor.addEventListener('change', () => { pushHistory(); });

propsRoughness.addEventListener('input', () => {
  if (selectedId != null) {
    const entry = sceneObjects.get(selectedId);
    if (entry && entry.mesh.material) entry.mesh.material.roughness = parseFloat(propsRoughness.value);
  }
});
propsRoughness.addEventListener('change', () => { pushHistory(); });

propsMetalness.addEventListener('input', () => {
  if (selectedId != null) {
    const entry = sceneObjects.get(selectedId);
    if (entry && entry.mesh.material) entry.mesh.material.metalness = parseFloat(propsMetalness.value);
  }
});
propsMetalness.addEventListener('change', () => { pushHistory(); });

propsOpacity.addEventListener('input', () => {
  if (selectedId != null) {
    const entry = sceneObjects.get(selectedId);
    if (entry && entry.mesh.material) {
      const val = parseFloat(propsOpacity.value);
      entry.mesh.material.opacity = val;
      entry.mesh.material.transparent = val < 1.0;
    }
  }
});
propsOpacity.addEventListener('change', () => { pushHistory(); });

propsWireframe.addEventListener('change', () => {
  if (selectedId != null) {
    const entry = sceneObjects.get(selectedId);
    if (entry && entry.mesh.material) {
      entry.mesh.material.wireframe = propsWireframe.checked;
      pushHistory();
    }
  }
});

alignOriginBtn.addEventListener('click', () => {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry) return;
  entry.mesh.position.x = 0;
  entry.mesh.position.z = 0;
  pushHistory();
});

alignGroundBtn.addEventListener('click', () => {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry || entry.kind === 'null') return;
  const box = new THREE.Box3().setFromObject(entry.mesh);
  const minY = box.min.y;
  entry.mesh.position.y -= minY;
  pushHistory();
});

focusCamBtn.addEventListener('click', focusCameraOnSelection);

const cloneSymBtn = document.getElementById('cloneSymBtn');
if (cloneSymBtn) {
  cloneSymBtn.addEventListener('click', () => {
    if (selectedId != null) cloneObjectSymmetry(selectedId);
  });
}

const deleteObjBtn = document.getElementById('deleteObjBtn');
if (deleteObjBtn) {
  deleteObjBtn.addEventListener('click', () => {
    if (selectedId != null) removeObject(selectedId);
  });
}

shadowToggle.addEventListener('change', () => {
  renderer.shadowMap.enabled = shadowToggle.checked;
});

toggleSidePanelBtn.addEventListener('click', () => {
  const collapsed = rightPanel.classList.toggle('collapsed');
  document.body.classList.toggle('side-collapsed', collapsed);
  toggleSidePanelBtn.textContent = collapsed ? '◀' : '▶';
  // Redimensionar canvas al cambiar panel
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h);
  perspCam.aspect = w / h;
  perspCam.updateProjectionMatrix();
});

// --- Lógica de Menús Desplegables Header ---
document.querySelectorAll('.dropdown .dropbtn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = btn.parentElement;
    const isShow = dropdown.classList.contains('show');
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('show'));
    if (!isShow) dropdown.classList.add('show');
  });
});
window.addEventListener('click', () => {
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('show'));
});

const menuUndoBtn = document.getElementById('menuUndoBtn');
const menuRedoBtn = document.getElementById('menuRedoBtn');
if (menuUndoBtn) menuUndoBtn.addEventListener('click', () => undoBtn.click());
if (menuRedoBtn) menuRedoBtn.addEventListener('click', () => redoBtn.click());

// --- Lógica de Pestañas del Panel Derecho ---
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const targetId = btn.dataset.tab;
    const targetContent = document.getElementById(targetId);
    if (targetContent) targetContent.classList.add('active');
  });
});

function renderLayerList() {
  layerList.innerHTML = '';
  const items = Array.from(sceneObjects.values());
  layerEmpty.style.display = items.length ? 'none' : 'block';
  const selectedEntry = selectedId != null ? sceneObjects.get(selectedId) : null;
  const selectedIsGroup = !!(selectedEntry && selectedEntry.kind === 'null');
  const { rootIds, childrenOf } = buildTree();

  // Recorre el arbol en profundidad (cada figura sale justo debajo de su
  // grupo) en vez de la lista plana de antes -- asi el acordeon (cerrar un
  // grupo esconde de verdad lo de adentro) tiene sentido.
  function renderRow(id) {
    const entry = sceneObjects.get(id);
    if (!entry) return;
    const row = document.createElement('div');
    row.className = 'layer-row' + (entry.id === selectedId ? ' active' : '') + (entry.kind === 'null' ? ' is-group' : '');
    row.style.marginLeft = (depthOf(entry) * 14) + 'px';

    const top = document.createElement('div');
    top.className = 'layer-top';

    if (entry.kind === 'null') {
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'collapse-btn';
      collapseBtn.textContent = entry.collapsed ? '▶' : '▼';
      collapseBtn.title = entry.collapsed ? 'Mostrar lo de adentro del grupo' : 'Cerrar el grupo (ocultar lo de adentro)';
      collapseBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleCollapse(entry.id); });
      top.appendChild(collapseBtn);
    }

    const label = document.createElement('span');
    label.className = 'layer-label';
    label.textContent = (entry.parentId != null ? '↳ ' : '') + (entry.name || KIND_LABEL[entry.kind] || entry.kind);
    top.appendChild(label);

    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'layer-btn';
    eyeBtn.textContent = entry.visible ? '👁' : '🚫';
    eyeBtn.title = entry.visible ? 'Ocultar' : 'Mostrar';
    eyeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleVisible(entry.id); });
    top.appendChild(eyeBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'layer-btn';
    delBtn.textContent = '🗑';
    delBtn.title = 'Borrar';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); removeObject(entry.id); });
    top.appendChild(delBtn);

    row.appendChild(top);

    // Segunda fila: acciones menos frecuentes (orden, nombre, clonar,
    // agrupar) -- separadas de la primera para que no queden 8 botones
    // apretados en una sola linea de 220px.
    const actions = document.createElement('div');
    actions.className = 'layer-actions';

    const upBtn = document.createElement('button');
    upBtn.className = 'layer-btn';
    upBtn.textContent = '⬆️';
    upBtn.title = 'Subir en la lista';
    upBtn.addEventListener('click', (e) => { e.stopPropagation(); moveObject(entry.id, -1); });
    actions.appendChild(upBtn);

    const downBtn = document.createElement('button');
    downBtn.className = 'layer-btn';
    downBtn.textContent = '⬇️';
    downBtn.title = 'Bajar en la lista';
    downBtn.addEventListener('click', (e) => { e.stopPropagation(); moveObject(entry.id, 1); });
    actions.appendChild(downBtn);

    const renameBtn = document.createElement('button');
    renameBtn.className = 'layer-btn';
    renameBtn.textContent = '✏️';
    renameBtn.title = 'Cambiar nombre';
    renameBtn.addEventListener('click', (e) => { e.stopPropagation(); renameObject(entry.id); });
    actions.appendChild(renameBtn);

    const cloneBtn = document.createElement('button');
    cloneBtn.className = 'layer-btn';
    cloneBtn.textContent = '📋';
    cloneBtn.title = 'Clonar';
    cloneBtn.addEventListener('click', (e) => { e.stopPropagation(); cloneObject(entry.id); });
    actions.appendChild(cloneBtn);

    if (selectedIsGroup && entry.id !== selectedId) {
      const groupBtn = document.createElement('button');
      groupBtn.className = 'layer-btn';
      groupBtn.textContent = '🔗';
      groupBtn.title = 'Meter en el grupo seleccionado';
      groupBtn.addEventListener('click', (e) => { e.stopPropagation(); groupInto(entry.id, selectedId); });
      actions.appendChild(groupBtn);
    }

    if (entry.parentId != null) {
      const ungroupBtn = document.createElement('button');
      ungroupBtn.className = 'layer-btn';
      ungroupBtn.textContent = '🔓';
      ungroupBtn.title = 'Sacar del grupo';
      ungroupBtn.addEventListener('click', (e) => { e.stopPropagation(); ungroup(entry.id); });
      actions.appendChild(ungroupBtn);
    }

    row.appendChild(actions);
    row.addEventListener('click', () => selectObject(entry.id));
    layerList.appendChild(row);

    if (entry.kind === 'null' && !entry.collapsed) {
      const kids = childrenOf.get(entry.id) || [];
      kids.forEach(renderRow);
    }
  }

  rootIds.forEach(renderRow);
}

// --- Color del objeto seleccionado ---
propsColor.addEventListener('input', () => {
  if (selectedId != null) setColor(selectedId, propsColor.value);
});
propsColor.addEventListener('change', () => { pushHistory(); });

// --- Luz (un solo slider, sin azimuth/elevación manual) ---
lightRange.addEventListener('input', () => {
  const factor = parseFloat(lightRange.value) || 1;
  dirLight.intensity = BASE_DIR_INTENSITY * factor;
  ambientLight.intensity = BASE_AMBIENT_INTENSITY * factor;
});

// --- Deshacer / rehacer ---
let history = [];
let historyIndex = -1;

function snapshotScene() {
  return Array.from(sceneObjects.values()).map(e => {
    const s = {
      id: e.id, kind: e.kind, visible: e.visible, parentId: e.parentId != null ? e.parentId : null,
      name: e.name || null, collapsed: !!e.collapsed,
      px: e.mesh.position.x, py: e.mesh.position.y, pz: e.mesh.position.z,
      rx: e.mesh.rotation.x, ry: e.mesh.rotation.y, rz: e.mesh.rotation.z,
      sx: e.mesh.scale.x, sy: e.mesh.scale.y, sz: e.mesh.scale.z,
      color: e.mesh.material ? e.mesh.material.color.getHex() : null,
      roughness: e.mesh.material ? e.mesh.material.roughness : null,
      metalness: e.mesh.material ? e.mesh.material.metalness : null,
      opacity: e.mesh.material ? e.mesh.material.opacity : null,
      wireframe: e.mesh.material ? !!e.mesh.material.wireframe : null
    };
    if (e.kind === 'hair' && e.mesh.geometry) {
      s.hairGeometry = serializeGeometry(e.mesh.geometry);
    } else if (e.sculpted && e.mesh.geometry && e.mesh.geometry.attributes.position) {
      // Solo se guardan los vertices de las figuras que de verdad se
      // esculpieron -- las demas se reconstruyen con su geometria de
      // siempre, mas liviano para el historial de deshacer/rehacer.
      s.sculptPositions = Array.from(e.mesh.geometry.attributes.position.array);
    }
    return s;
  });
}

function rebuildSceneFrom(snap) {
  transform.detach();
  sceneObjects.forEach(e => { scene.remove(e.mesh); disposeEntry(e); });
  sceneObjects.clear();
  let maxId = 0;
  // Primera pasada: crear todo suelto (a nivel raiz) con su transform local
  // ya cargado.
  snap.forEach(s => {
    const extraOpts = {
      roughness: s.roughness,
      metalness: s.metalness,
      opacity: s.opacity,
      wireframe: s.wireframe,
      geometryData: s.hairGeometry
    };
    const built = buildObject(s.kind, s.color != null ? s.color : undefined, extraOpts);
    built.node.position.set(s.px, s.py, s.pz);
    built.node.rotation.set(s.rx, s.ry, s.rz);
    built.node.scale.set(s.sx, s.sy, s.sz);
    built.node.visible = s.visible;
    let sculpted = false;
    if (s.kind !== 'hair' && s.sculptPositions && built.node.geometry && built.node.geometry.attributes.position &&
        built.node.geometry.attributes.position.array.length === s.sculptPositions.length) {
      built.node.geometry.attributes.position.array.set(s.sculptPositions);
      built.node.geometry.attributes.position.needsUpdate = true;
      built.node.geometry.computeVertexNormals();
      built.node.geometry.computeBoundingSphere();
      sculpted = true;
    }
    scene.add(built.node);
    built.pickMesh.userData.ownerId = s.id;
    sceneObjects.set(s.id, { id: s.id, kind: s.kind, mesh: built.node, pickMesh: built.pickMesh, visible: s.visible, parentId: s.parentId != null ? s.parentId : null, sculpted, name: s.name || null, collapsed: !!s.collapsed });
    if (s.id > maxId) maxId = s.id;
  });
  // Segunda pasada: aplicar quien esta adentro de que grupo -- usa .add()
  // (no .attach()) porque el transform local ya es el correcto, guardado
  // tal cual en el paso anterior.
  sceneObjects.forEach(e => {
    if (e.parentId != null && sceneObjects.has(e.parentId)) {
      sceneObjects.get(e.parentId).mesh.add(e.mesh);
    }
  });
  objIdCounter = maxId + 1;
  selectedId = null;
  propsPanel.classList.remove('show');
  renderLayerList();
}

function restoreSnapshot(snap) {
  rebuildSceneFrom(snap);
  updateHistoryButtons();
}

function pushHistory() {
  history = history.slice(0, historyIndex + 1);
  history.push(snapshotScene());
  if (history.length > 60) history.shift();
  historyIndex = history.length - 1;
  updateHistoryButtons();
}

function updateHistoryButtons() {
  undoBtn.disabled = historyIndex <= 0;
  redoBtn.disabled = historyIndex >= history.length - 1;
}

undoBtn.addEventListener('click', () => {
  if (historyIndex <= 0) return;
  historyIndex--;
  restoreSnapshot(history[historyIndex]);
});
redoBtn.addEventListener('click', () => {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  restoreSnapshot(history[historyIndex]);
});
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === 'z') { e.preventDefault(); undoBtn.click(); }
    if (e.key.toLowerCase() === 'y') { e.preventDefault(); redoBtn.click(); }
    return;
  }

  const key = e.key.toLowerCase();
  if (e.shiftKey && key === 'd') {
    e.preventDefault();
    if (selectedId != null) cloneObject(selectedId);
    return;
  }

  if (key === 'g') { e.preventDefault(); setMode('translate'); }
  else if (key === 'r') { e.preventDefault(); setMode('rotate'); }
  else if (key === 's') { e.preventDefault(); setMode('scale'); }
  else if (key === 'f') { e.preventDefault(); focusCameraOnSelection(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedId != null) {
      e.preventDefault();
      removeObject(selectedId);
    }
  }
});

// --- Guardar / abrir proyectos (localStorage, sin cuenta por ahora) ---
const STORAGE_KEY = 'editor3d_projects';

function loadProjectsMap() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveProjectsMap(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }
  catch (e) { alert('No se pudo guardar (¿memoria del navegador llena?).'); }
}

function saveProjectAs(name) {
  const map = loadProjectsMap();
  map[name] = { savedAt: Date.now(), data: snapshotScene() };
  saveProjectsMap(map);
}

function renderProjectListModal() {
  const map = loadProjectsMap();
  const names = Object.keys(map).sort((a, b) => (map[b].savedAt || 0) - (map[a].savedAt || 0));
  projectListModal.innerHTML = '';
  projectListEmpty.style.display = names.length ? 'none' : 'block';
  names.forEach(name => {
    const row = document.createElement('div');
    row.className = 'proj-row';

    const label = document.createElement('span');
    label.className = 'proj-name';
    label.textContent = name;
    row.appendChild(label);

    const openRowBtn = document.createElement('button');
    openRowBtn.className = 'layer-btn';
    openRowBtn.textContent = '📂';
    openRowBtn.title = 'Abrir';
    openRowBtn.addEventListener('click', () => {
      rebuildSceneFrom(map[name].data);
      // Cargar un proyecto arranca un historial de deshacer nuevo — no
      // tendría sentido "deshacer" hasta el diseño anterior que ni tiene
      // que ver con este.
      history = [snapshotScene()];
      historyIndex = 0;
      updateHistoryButtons();
      openModal.classList.remove('show');
    });
    row.appendChild(openRowBtn);

    const delRowBtn = document.createElement('button');
    delRowBtn.className = 'layer-btn';
    delRowBtn.textContent = '🗑';
    delRowBtn.title = 'Borrar guardado';
    delRowBtn.addEventListener('click', () => {
      if (!confirm(`¿Borrar "${name}"? No se puede deshacer.`)) return;
      const m = loadProjectsMap();
      delete m[name];
      saveProjectsMap(m);
      renderProjectListModal();
    });
    row.appendChild(delRowBtn);

    projectListModal.appendChild(row);
  });
}

saveBtn.addEventListener('click', () => {
  const name = prompt('¿Cómo se llama este diseño?', 'Mi diseño');
  if (!name) return;
  saveProjectAs(name.trim() || 'Mi diseño');
});
openBtn.addEventListener('click', () => {
  renderProjectListModal();
  openModal.classList.add('show');
});
closeOpenModal.addEventListener('click', () => openModal.classList.remove('show'));
openModal.addEventListener('click', (e) => { if (e.target === openModal) openModal.classList.remove('show'); });

// --- Exportar imagen PNG (fondo transparente, sin grilla ni gizmo) ---
exportBtn.addEventListener('click', () => {
  const wasSelected = selectedId;
  transform.detach();
  grid.visible = false;
  // Si estabamos en modo "4 vistas" el renderer quedo con scissor/viewport
  // de un cuadrante -- para exportar la imagen completa hay que resetearlo.
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, wrap.clientWidth, wrap.clientHeight);
  const prevAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, activeCamera);

  const dataUrl = renderer.domElement.toDataURL('image/png');

  renderer.setClearColor(0x2b2f33, prevAlpha || 1);
  grid.visible = true;
  if (wasSelected != null) selectObject(wasSelected);
  renderer.render(scene, activeCamera);

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `mi-diseno-3d-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

// --- Exportar 3D OBJ ---
function exportToOBJ() {
  let output = `# Exportado desde 3DPro Editor\n# Fecha: ${new Date().toLocaleString()}\n\n`;
  let vertexOffset = 1;
  let normalOffset = 1;
  let uvOffset = 1;

  sceneObjects.forEach((entry, id) => {
    if (!entry.visible || entry.kind === 'null' || !entry.mesh) return;

    const mesh = entry.mesh;
    const name = entry.name || (KIND_LABEL[entry.kind] + '_' + id);
    output += `o ${name.replace(/\s+/g, '_')}\n`;

    const geometry = mesh.geometry.clone();
    mesh.updateMatrixWorld(true);
    geometry.applyMatrix4(mesh.matrixWorld);

    const posAttr = geometry.attributes.position;
    const normAttr = geometry.attributes.normal;
    const uvAttr = geometry.attributes.uv;
    const indexAttr = geometry.index;

    if (!posAttr) return;

    for (let i = 0; i < posAttr.count; i++) {
      output += `v ${posAttr.getX(i).toFixed(4)} ${posAttr.getY(i).toFixed(4)} ${posAttr.getZ(i).toFixed(4)}\n`;
    }

    if (normAttr) {
      for (let i = 0; i < normAttr.count; i++) {
        output += `vn ${normAttr.getX(i).toFixed(4)} ${normAttr.getY(i).toFixed(4)} ${normAttr.getZ(i).toFixed(4)}\n`;
      }
    }

    if (uvAttr) {
      for (let i = 0; i < uvAttr.count; i++) {
        output += `vt ${uvAttr.getX(i).toFixed(4)} ${uvAttr.getY(i).toFixed(4)}\n`;
      }
    }

    if (indexAttr) {
      const arr = indexAttr.array;
      for (let i = 0; i < arr.length; i += 3) {
        const v1 = arr[i] + vertexOffset;
        const v2 = arr[i + 1] + vertexOffset;
        const v3 = arr[i + 2] + vertexOffset;
        if (normAttr && uvAttr) {
          const n1 = arr[i] + normalOffset, n2 = arr[i + 1] + normalOffset, n3 = arr[i + 2] + normalOffset;
          const t1 = arr[i] + uvOffset, t2 = arr[i + 1] + uvOffset, t3 = arr[i + 2] + uvOffset;
          output += `f ${v1}/${t1}/${n1} ${v2}/${t2}/${n2} ${v3}/${t3}/${n3}\n`;
        } else if (normAttr) {
          const n1 = arr[i] + normalOffset, n2 = arr[i + 1] + normalOffset, n3 = arr[i + 2] + normalOffset;
          output += `f ${v1}//${n1} ${v2}//${n2} ${v3}//${n3}\n`;
        } else {
          output += `f ${v1} ${v2} ${v3}\n`;
        }
      }
    }

    vertexOffset += posAttr.count;
    if (normAttr) normalOffset += normAttr.count;
    if (uvAttr) uvOffset += uvAttr.count;
    output += `\n`;
  });

  const blob = new Blob([output], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mi-modelo-3d-${Date.now()}.obj`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

exportObjBtn.addEventListener('click', exportToOBJ);

exportJsonBtn.addEventListener('click', () => {
  const jsonStr = JSON.stringify({ version: '3dpro-1.0', savedAt: Date.now(), data: snapshotScene() }, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `proyecto-3dpro-${Date.now()}.3dpro`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

importJsonBtn.addEventListener('click', () => importJsonInput.click());

importJsonInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      const data = parsed.data || parsed;
      if (Array.isArray(data)) {
        rebuildSceneFrom(data);
        history = [snapshotScene()];
        historyIndex = 0;
        updateHistoryButtons();
        alert('¡Proyecto cargado exitosamente!');
      } else {
        alert('Archivo de proyecto no válido.');
      }
    } catch (err) {
      alert('Error al leer el archivo JSON.');
    }
  };
  reader.readAsText(file);
  importJsonInput.value = '';
});

// --- Botones "Agregar" ---
document.querySelectorAll('.abtn').forEach(btn => {
  btn.addEventListener('click', () => addPrimitive(btn.dataset.add));
});

// --- Selección por toque/click en el canvas ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function onPick(clientX, clientY) {
  let rect, cam;
  if (fourViewMode) {
    const q = quadrantAt(clientX, clientY);
    rect = quadrantRectDOM(q);
    cam = GRID_CAMS[q];
  } else {
    rect = renderer.domElement.getBoundingClientRect();
    cam = activeCamera;
  }
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, cam);
  const pickable = Array.from(sceneObjects.values()).filter(o => o.visible).map(o => o.pickMesh);
  const hits = raycaster.intersectObjects(pickable, false);
  if (hits.length) {
    const ownerId = hits[0].object.userData.ownerId;
    selectObject(ownerId != null ? ownerId : null);
  } else if (toolMode !== 'sculpt') {
    // en modo Esculpir, tocar el fondo es para orbitar y ver otro angulo --
    // no tiene que deseleccionar la figura que se esta esculpiendo.
    selectObject(null);
  }
}

// --- Esculpir (empujar / hundir / suavizar / pellizcar la superficie, como
// un mini-ZBrush) ---
let brushType = 'push';
let sculptDragging = false;
let pendingSculptPoint = null; // ultimo toque recibido, se aplica una vez por frame
const adjacencyCache = new Map(); // geometry.uuid -> lista de vecinos por vertice (para el pincel de Suavizar)

function getPointerRayContext(clientX, clientY) {
  if (fourViewMode) {
    const q = quadrantAt(clientX, clientY);
    return { rect: quadrantRectDOM(q), cam: GRID_CAMS[q] };
  }
  return { rect: renderer.domElement.getBoundingClientRect(), cam: activeCamera };
}

function sculptRayLocalPoint(entry, clientX, clientY) {
  const { rect, cam } = getPointerRayContext(clientX, clientY);
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, cam);
  const hits = raycaster.intersectObject(entry.mesh, false);
  if (!hits.length) return null;
  return entry.mesh.worldToLocal(hits[0].point.clone());
}

// Vecinos directos de cada vertice (a partir de los triangulos de la
// geometria) -- se arma una sola vez por geometria y se reusa, para que el
// pincel de Suavizar sea rapido (promediar solo los vecinos reales, no
// buscar entre TODOS los vertices cada vez).
let hairDragging = false;
let hairPoints = []; // puntos del trazo en curso, en espacio MUNDO
let hairRefDistance = 200; // profundidad de referencia para cuando el trazo se despega de una superficie
let pendingHairPoint = null;
let hairPreviewMesh = null;

function nextHairPoint(clientX, clientY) {
  const { rect, cam } = getPointerRayContext(clientX, clientY);
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, cam);
  const pickable = Array.from(sceneObjects.values()).filter(o => o.visible).map(o => o.pickMesh);
  const hits = raycaster.intersectObjects(pickable, false);
  if (hits.length) {
    hairRefDistance = hits[0].distance;
    return hits[0].point.clone();
  }
  const p = new THREE.Vector3();
  raycaster.ray.at(hairRefDistance, p);
  return p;
}

function clearHairPreview() {
  if (!hairPreviewMesh) return;
  scene.remove(hairPreviewMesh);
  hairPreviewMesh.geometry.dispose();
  hairPreviewMesh.material.dispose();
  hairPreviewMesh = null;
}

function updateHairPreview() {
  if (hairPoints.length < 2) return;
  const geo = buildTaperedTubeGeometry(hairPoints, HAIR_ROOT_RADIUS, HAIR_TIP_RADIUS);
  if (!hairPreviewMesh) {
    hairPreviewMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: HAIR_DEFAULT_COLOR, roughness: 0.6, side: THREE.DoubleSide }));
    scene.add(hairPreviewMesh);
  } else {
    hairPreviewMesh.geometry.dispose();
    hairPreviewMesh.geometry = geo;
  }
}

function createHairObjectFromPoints(pts) {
  const origin = pts[0].clone();
  const localPoints = pts.map(p => p.clone().sub(origin));
  const geo = buildTaperedTubeGeometry(localPoints, HAIR_ROOT_RADIUS, HAIR_TIP_RADIUS);
  const mat = new THREE.MeshStandardMaterial({ color: HAIR_DEFAULT_COLOR, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });
  mat.castShadow = true; mat.receiveShadow = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.position.copy(origin);
  scene.add(mesh);
  const id = objIdCounter++;
  mesh.userData.ownerId = id;
  sceneObjects.set(id, { id, kind: 'hair', mesh, pickMesh: mesh, visible: true, parentId: null, sculpted: false, name: null, collapsed: false });
  return id;
}

function finishHairStroke() {
  clearHairPreview();
  if (hairPoints.length < 2) { hairPoints = []; return; }
  const mainId = createHairObjectFromPoints(hairPoints);

  if (symmetryXInput && symmetryXInput.checked) {
    const symPoints = hairPoints.map(p => new THREE.Vector3(-p.x, p.y, p.z));
    createHairObjectFromPoints(symPoints);
  }

  hairPoints = [];
  renderLayerList();
  selectObject(mainId);
  pushHistory();
}

wrap.addEventListener('pointerdown', (e) => {
  if (toolMode !== 'hair') return;
  clearHairPreview();
  hairPoints = [nextHairPoint(e.clientX, e.clientY)];
  hairDragging = true;
  orbit.enabled = false;
  pendingHairPoint = { clientX: e.clientX, clientY: e.clientY };
}, { capture: true });

window.addEventListener('pointermove', (e) => {
  if (!hairDragging) return;
  pendingHairPoint = { clientX: e.clientX, clientY: e.clientY };
});

window.addEventListener('pointerup', () => {
  if (!hairDragging) return;
  hairDragging = false;
  pendingHairPoint = null;
  orbit.enabled = true;
  finishHairStroke();
});

function getAdjacency(geometry) {
  let adj = adjacencyCache.get(geometry.uuid);
  if (adj) return adj;
  const count = geometry.attributes.position.count;
  adj = new Array(count);
  for (let i = 0; i < count; i++) adj[i] = new Set();
  const index = geometry.index;
  if (index) {
    const arr = index.array;
    for (let i = 0; i < arr.length; i += 3) {
      const a = arr[i], b = arr[i + 1], c = arr[i + 2];
      adj[a].add(b); adj[a].add(c);
      adj[b].add(a); adj[b].add(c);
      adj[c].add(a); adj[c].add(b);
    }
  }
  adjacencyCache.set(geometry.uuid, adj);
  return adj;
}

function applySculptStrokeSingle(entry, localPoint, brush, size, strength) {
  const geo = entry.mesh.geometry;
  const posAttr = geo.attributes.position;
  const normAttr = geo.attributes.normal;
  const radius = size;

  if (brush === 'smooth') {
    const adj = getAdjacency(geo);
    const original = posAttr.array.slice();
    for (let i = 0; i < posAttr.count; i++) {
      const vx = original[i * 3], vy = original[i * 3 + 1], vz = original[i * 3 + 2];
      const dx = vx - localPoint.x, dy = vy - localPoint.y, dz = vz - localPoint.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > radius) continue;
      const falloff = 1 - dist / radius;
      const neighbors = adj[i];
      if (!neighbors || neighbors.size === 0) continue;
      let ax = 0, ay = 0, az = 0;
      neighbors.forEach(n => { ax += original[n * 3]; ay += original[n * 3 + 1]; az += original[n * 3 + 2]; });
      const cnt = neighbors.size;
      ax /= cnt; ay /= cnt; az /= cnt;
      const k = falloff * strength * 0.15;
      posAttr.setXYZ(i, vx + (ax - vx) * k, vy + (ay - vy) * k, vz + (az - vz) * k);
    }
  } else if (brush === 'flatten') {
    let avgX = 0, avgY = 0, avgZ = 0;
    let avgNx = 0, avgNy = 0, avgNz = 0;
    let count = 0;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i), vy = posAttr.getY(i), vz = posAttr.getZ(i);
      const dx = vx - localPoint.x, dy = vy - localPoint.y, dz = vz - localPoint.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= radius) {
        avgX += vx; avgY += vy; avgZ += vz;
        if (normAttr) { avgNx += normAttr.getX(i); avgNy += normAttr.getY(i); avgNz += normAttr.getZ(i); }
        count++;
      }
    }
    if (count > 0) {
      avgX /= count; avgY /= count; avgZ /= count;
      let norm = new THREE.Vector3(avgNx, avgNy, avgNz).normalize();
      if (norm.lengthSq() < 0.001) norm.set(0, 1, 0);

      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i), vy = posAttr.getY(i), vz = posAttr.getZ(i);
        const dx = vx - localPoint.x, dy = vy - localPoint.y, dz = vz - localPoint.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > radius) continue;
        const t = 1 - dist / radius;
        const falloff = t * t * (3 - 2 * t);
        const distToPlane = (vx - avgX) * norm.x + (vy - avgY) * norm.y + (vz - avgZ) * norm.z;
        const k = falloff * strength * 0.2;
        posAttr.setXYZ(i, vx - norm.x * distToPlane * k, vy - norm.y * distToPlane * k, vz - norm.z * distToPlane * k);
      }
    }
  } else {
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i), vy = posAttr.getY(i), vz = posAttr.getZ(i);
      const dx = vx - localPoint.x, dy = vy - localPoint.y, dz = vz - localPoint.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > radius) continue;
      const t = 1 - dist / radius;
      const falloff = t * t * (3 - 2 * t);

      if (brush === 'pinch') {
        const k = falloff * strength * 0.08;
        posAttr.setXYZ(i, vx + (localPoint.x - vx) * k, vy + (localPoint.y - vy) * k, vz + (localPoint.z - vz) * k);
      } else {
        const nx = normAttr.getX(i), ny = normAttr.getY(i), nz = normAttr.getZ(i);
        const dir = brush === 'pull' ? -1 : 1;
        const k = falloff * strength * 0.6 * dir;
        posAttr.setXYZ(i, vx + nx * k, vy + ny * k, vz + nz * k);
      }
    }
  }

  posAttr.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  entry.sculpted = true;
}

function applySculptStroke(entry, localPoint, brush, size, strength) {
  applySculptStrokeSingle(entry, localPoint, brush, size, strength);
  if (symmetryXInput && symmetryXInput.checked) {
    const symPoint = localPoint.clone();
    symPoint.x = -symPoint.x;
    applySculptStrokeSingle(entry, symPoint, brush, size, strength);
  }
}

// Detectar el inicio de un trazo de escultura ANTES de que OrbitControls/
// TransformControls procesen el mismo toque (mismo truco que ya se usa
// para el enrutado de cuadrantes en "4 vistas": un listener en fase de
// "captura" sobre #canvasWrap, un ancestro del canvas).
wrap.addEventListener('pointerdown', (e) => {
  if (toolMode !== 'sculpt' || selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry || entry.kind === 'null') return; // un Nulo no tiene superficie para esculpir
  const local = sculptRayLocalPoint(entry, e.clientX, e.clientY);
  if (!local) return; // el toque no cayo sobre la figura seleccionada -- que orbite el fondo como siempre
  sculptDragging = true;
  orbit.enabled = false;
  pendingSculptPoint = { clientX: e.clientX, clientY: e.clientY };
}, { capture: true });

window.addEventListener('pointermove', (e) => {
  if (!sculptDragging) return;
  pendingSculptPoint = { clientX: e.clientX, clientY: e.clientY };
});

window.addEventListener('pointerup', () => {
  if (!sculptDragging) return;
  sculptDragging = false;
  pendingSculptPoint = null;
  orbit.enabled = true;
  pushHistory(); // guarda el estado esculpido para poder deshacerlo
});

brushRow.querySelectorAll('[data-brush]').forEach(b => {
  b.addEventListener('click', () => {
    brushType = b.dataset.brush;
    brushRow.querySelectorAll('[data-brush]').forEach(bb => bb.classList.toggle('active', bb === b));
  });
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (transform.dragging) return;
  if (toolMode === 'hair') return; // en modo Pelo, tocar dibuja -- no selecciona
  onPick(e.clientX, e.clientY);
});

// En modo "4 vistas", antes de que OrbitControls/TransformControls procesen
// el mismo toque hay que decidir a que camara (cuadrante) corresponde --
// por eso este listener va en la fase de "captura" sobre #canvasWrap (un
// ancestro del canvas), que se dispara ANTES de que el evento llegue al
// canvas donde estan enganchados esos controles.
wrap.addEventListener('pointerdown', (e) => {
  if (!fourViewMode) return;
  const q = quadrantAt(e.clientX, e.clientY);
  if (q !== activeQuadrant) setActiveQuadrant(q);
}, { capture: true });

// --- Botonera de modos (mover / rotar / escalar / esculpir / pelo) ---
const modeButtons = document.querySelectorAll('.tbtn[data-mode]');
const defaultToolOptions = document.getElementById('defaultToolOptions');
const statusInfo = document.getElementById('statusInfo');
const MODE_NAMES = {
  translate: 'Mover (G)',
  rotate: 'Rotar (R)',
  scale: 'Escalar (S)',
  sculpt: 'Esculpir (Pincel)',
  hair: 'Dibujar Pelo'
};

function syncCanvasTop() {
  handleResize();
}

function setMode(mode) {
  toolMode = mode;
  modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  if (statusInfo) statusInfo.textContent = `Editor 3D - Modo ${MODE_NAMES[mode] || mode}`;

  if (mode === 'sculpt') {
    transform.detach();
    brushRow.style.display = 'flex';
    if (defaultToolOptions) defaultToolOptions.style.display = 'none';
  } else if (mode === 'hair') {
    transform.detach();
    brushRow.style.display = 'none';
    if (defaultToolOptions) defaultToolOptions.style.display = 'flex';
  } else {
    brushRow.style.display = 'none';
    if (defaultToolOptions) defaultToolOptions.style.display = 'flex';
    transform.setMode(mode);
    if (selectedId != null) {
      const entry = sceneObjects.get(selectedId);
      if (entry) transform.attach(entry.mesh);
    }
  }
  syncCanvasTop();
}
modeButtons.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
setMode('translate');

// --- Vistas de camara (Frente/Atras/Izquierda/Derecha/Arriba/Abajo + 3D) ---
// "3D" usa la camara de perspectiva de siempre (rotar libre con el dedo).
// Las otras seis usan la camara ortografica -- sin distorsion de
// perspectiva, para que sirvan para alinear cosas con precision (por eso
// las pidio Andres: "diseños perfectos"). Se puede seguir orbitando desde
// cualquiera de ellas, no quedan bloqueadas; el boton solo las encuadra.
const VIEW_TARGET = new THREE.Vector3(0, 20, 0);
const VIEWS = {
  perspective: { ortho: false, pos: [180, 160, 260], up: [0, 1, 0] },
  front:       { ortho: true,  pos: [0, 20, 300],   up: [0, 1, 0] },
  back:        { ortho: true,  pos: [0, 20, -300],  up: [0, 1, 0] },
  left:        { ortho: true,  pos: [-300, 20, 0],  up: [0, 1, 0] },
  right:       { ortho: true,  pos: [300, 20, 0],   up: [0, 1, 0] },
  top:         { ortho: true,  pos: [0, 320, 0.001], up: [0, 0, -1] },
  bottom:      { ortho: true,  pos: [0, -280, 0.001], up: [0, 0, 1] }
};

const viewButtons = document.querySelectorAll('.vbtn');

// Reasigna la camara "activa" (la que usan el orbitado, el gizmo y la
// seleccion por toque) -- centraliza el ajuste del _quat/_quatInverse de
// OrbitControls que antes vivia solo dentro de setView(), para poder
// reusarlo tambien cuando se cambia de cuadrante en modo "4 vistas".
function useCamera(cam) {
  activeCamera = cam;
  orbit.object = cam;
  // OrbitControls calcula su matematica de orbita en un espacio donde
  // "arriba" siempre es +Y, usando una rotacion (_quat/_quatInverse) que
  // arma UNA SOLA VEZ en el constructor a partir del up de la camara
  // original -- no se recalcula sola si despues le cambiamos el objeto o
  // el up (como pasa en Arriba/Abajo, que usan un up distinto para no caer
  // justo en el "polo"). Se rearma a mano ahora, replicando lo mismo que
  // hace el constructor, para que orbitar desde esas vistas no se sienta
  // raro/inestable.
  orbit._quat.setFromUnitVectors(cam.up, new THREE.Vector3(0, 1, 0));
  orbit._quatInverse.copy(orbit._quat).invert();
  orbit.target.copy(VIEW_TARGET);
  orbit.update();
  transform.camera = cam;

  // Las camaras ortograficas (Frente/Izquierda/Arriba/Atras/Derecha/Abajo)
  // son vistas "planas" para alinear con precision -- no tiene sentido
  // poder rotarlas fuera de ese encuadre, si no dejan de servir para eso.
  // Solo la camara de perspectiva (vista libre) se puede orbitar; en las
  // demas, arrastrar con un dedo desplaza la vista (pan) en vez de
  // rotarla, y el pellizco/rueda sigue haciendo zoom igual que antes.
  const isPersp = (cam === perspCam);
  orbit.enableRotate = isPersp;
  orbit.touches.ONE = isPersp ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
  orbit.mouseButtons.LEFT = isPersp ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
}

function setView(key) {
  const v = VIEWS[key];
  if (!v) return;
  const cam = v.ortho ? orthoCam : perspCam;
  cam.up.set(v.up[0], v.up[1], v.up[2]);
  cam.position.set(v.pos[0], v.pos[1], v.pos[2]);
  cam.lookAt(VIEW_TARGET);

  transform.viewport = null;
  useCamera(cam);
  currentViewKey = key;

  viewButtons.forEach(b => b.classList.toggle('active', b.dataset.view === key));
}

viewButtons.forEach(b => b.addEventListener('click', () => {
  if (fourViewMode) {
    fourViewMode = false;
    wrap.classList.remove('four-view');
    fourViewBtn.classList.remove('active');
  }
  setView(b.dataset.view);
}));

// --- Modo "4 vistas a la vez" (como Cinema4D): Perspectiva / Frente /
// Izquierda / Arriba, todas dibujadas juntas en un solo canvas dividido en
// cuatro. Las camaras de Frente/Izquierda/Arriba quedan fijas (no son las
// mismas que usa el boton de una sola vista); tocar dentro de un cuadrante
// hace que ese pase a ser el "activo" para orbitar/seleccionar/mover.
function setupGridCam(cam, viewKey) {
  const v = VIEWS[viewKey];
  cam.up.set(v.up[0], v.up[1], v.up[2]);
  cam.position.set(v.pos[0], v.pos[1], v.pos[2]);
  cam.lookAt(VIEW_TARGET);
}
setupGridCam(gridFrontCam, 'front');
setupGridCam(gridLeftCam, 'left');
setupGridCam(gridTopCam, 'top');

const GRID_CAMS = { tl: perspCam, tr: gridFrontCam, bl: gridLeftCam, br: gridTopCam };

function quadrantAt(clientX, clientY) {
  const rect = wrap.getBoundingClientRect();
  const isRight = (clientX - rect.left) >= rect.width / 2;
  const isBottom = (clientY - rect.top) >= rect.height / 2;
  if (!isRight && !isBottom) return 'tl';
  if (isRight && !isBottom) return 'tr';
  if (!isRight && isBottom) return 'bl';
  return 'br';
}

function quadrantRectDOM(q) {
  const rect = wrap.getBoundingClientRect();
  const halfW = rect.width / 2, halfH = rect.height / 2;
  const left = (q === 'tr' || q === 'br') ? rect.left + halfW : rect.left;
  const top = (q === 'bl' || q === 'br') ? rect.top + halfH : rect.top;
  return { left, top, width: halfW, height: halfH };
}

// Mismo rectangulo que quadrantRectDOM pero en el sistema de coordenadas
// que usan renderer.setViewport/setScissor y TransformControls.viewport:
// pixeles CSS con origen abajo-izquierda (WebGL), no arriba-izquierda
// (DOM). Se comparte entre el render de las 4 vistas y el ajuste de
// TransformControls para que nunca queden desincronizados.
function quadrantGLRect(q, w, h) {
  const hw = Math.round(w / 2), hh = Math.round(h / 2);
  switch (q) {
    case 'tl': return { x: 0,  y: hh, w: hw,     h: h - hh };
    case 'tr': return { x: hw, y: hh, w: w - hw, h: h - hh };
    case 'bl': return { x: 0,  y: 0,  w: hw,     h: hh };
    default:   return { x: hw, y: 0,  w: w - hw, h: hh }; // 'br'
  }
}

function setActiveQuadrant(q) {
  const cam = GRID_CAMS[q];
  if (!cam) return;
  activeQuadrant = q;
  useCamera(cam);
  // TransformControls trae de fabrica una propiedad "viewport" pensada
  // justo para esto (varias camaras compartiendo un canvas con
  // setViewport/setScissor) -- sin ella, calcula donde toca el dedo usando
  // el canvas COMPLETO, entonces el gizmo se arrastraba mal en cualquier
  // cuadrante que no fuera el canvas entero.
  const r = quadrantGLRect(q, wrap.clientWidth, wrap.clientHeight);
  transform.viewport = new THREE.Vector4(r.x, r.y, r.w, r.h);
  // El gizmo (TransformControls) recalcula la posicion/escala REAL de sus
  // manijas (la que se usa para detectar el arrastre) recien cuando se lo
  // renderiza -- eso pasa una vez por cuadro, en el prox requestAnimationFrame.
  // Si el dedo toca justo el gizmo en el MISMO toque que cambia de
  // cuadrante (antes de que corra ese proximo cuadro), todavia estaria
  // calibrado para el cuadrante ANTERIOR y el arrastre fallaria o agarraria
  // el eje que no es. Se fuerza el recalculo aca mismo, en el momento de
  // cambiar de cuadrante (este listener corre en fase de captura, ANTES
  // que TransformControls procese el mismo toque), para que ya este listo.
  if (transformHelper.parent !== scene) scene.add(transformHelper);
  transformHelper.updateMatrixWorld();
}

// OrbitControls calcula cuanto paneas dividiendo el arrastre del dedo por
// el ANCHO/ALTO COMPLETO del canvas (asume que la camara siempre llena toda
// la pantalla). En el modo "4 vistas" cada camara solo dibuja en un cuarto
// del canvas, asi que sin corregir esto el paneo queda mucho mas duro/lento
// de lo que se ve en pantalla (a veces ni se nota que se movio). Se "parcha"
// _pan (metodo privado, pero accesible, mismo truco que ya se usa con
// _quat/_quatInverse) para escalarlo segun el tamano real del cuadrante
// activo.
const orbitPanOriginal = orbit._pan.bind(orbit);
orbit._pan = function (deltaX, deltaY) {
  if (!fourViewMode) { orbitPanOriginal(deltaX, deltaY); return; }
  const r = quadrantGLRect(activeQuadrant, wrap.clientWidth, wrap.clientHeight);
  orbitPanOriginal(deltaX * (wrap.clientWidth / r.w), deltaY * (wrap.clientHeight / r.h));
};

const fourViewBtn = document.getElementById('fourViewBtn');
fourViewBtn.addEventListener('click', () => {
  fourViewMode = !fourViewMode;
  wrap.classList.toggle('four-view', fourViewMode);
  fourViewBtn.classList.toggle('active', fourViewMode);
  if (fourViewMode) {
    viewButtons.forEach(b => b.classList.remove('active'));
    setActiveQuadrant('tl');
  } else {
    setView(currentViewKey);
  }
});

// --- Resize ---
function handleResize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  const aspect = w / h;
  perspCam.aspect = aspect;
  perspCam.updateProjectionMatrix();
  // Los cuadrantes del modo "4 vistas" miden la mitad de ancho y la mitad
  // de alto que el canvas completo, asi que conservan el mismo aspect --
  // por eso orthoCam y las tres camaras fijas de la grilla usan el mismo
  // calculo de encuadre.
  [orthoCam, gridFrontCam, gridLeftCam, gridTopCam].forEach(cam => {
    cam.left = -ORTHO_HALF_HEIGHT * aspect;
    cam.right = ORTHO_HALF_HEIGHT * aspect;
    cam.top = ORTHO_HALF_HEIGHT;
    cam.bottom = -ORTHO_HALF_HEIGHT;
    cam.updateProjectionMatrix();
  });
  renderer.setSize(w, h);
  if (fourViewMode) {
    const r = quadrantGLRect(activeQuadrant, w, h);
    transform.viewport = new THREE.Vector4(r.x, r.y, r.w, r.h);
  }
}
window.addEventListener('resize', handleResize);

// El gizmo de mover/rotar/escalar (TransformControls) es UN SOLO objeto
// compartido -- no hay una copia independiente por camara. Su geometria de
// verdad (la que se usa para detectar el arrastre, no solo como se dibuja)
// se recalcula cada vez que se lo renderiza, segun la camara que tenga
// asignada en ESE instante. Si se dibujara en las 4 vistas todas seguidas
// (como se hacia antes), quedaria calibrado solo para la ULTIMA camara del
// barrido -- por eso el arrastre solo funcionaba en el cuadrante que
// justo quedaba al final ("Arriba"), y fallaba en cualquier otro (como
// "Frente"). La solucion (probada con pruebas automaticas arrastrando el
// gizmo en los 4 cuadrantes) es sacarlo de la escena mientras se dibujan
// los otros tres, y devolverlo solo para el cuadrante ACTIVO -- asi su
// geometria de arrastre nunca se calibra con una camara que no sea esa.
// Como efecto secundario (bueno): el gizmo ahora se ve solo en el
// cuadrante activo en vez de en los 4 mal calibrado, lo que de paso deja
// mas claro en cual se esta trabajando.
function renderFourView() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setScissorTest(true);
  const helperWasIn = transformHelper.parent === scene;
  if (helperWasIn) scene.remove(transformHelper);
  ['tl', 'tr', 'bl', 'br'].forEach(q => {
    const r = quadrantGLRect(q, w, h);
    const cam = GRID_CAMS[q];
    renderer.setViewport(r.x, r.y, r.w, r.h);
    renderer.setScissor(r.x, r.y, r.w, r.h);
    const isActive = q === activeQuadrant;
    if (isActive && helperWasIn) {
      transform.camera = cam;
      scene.add(transformHelper);
    }
    renderer.render(scene, cam);
    if (isActive && helperWasIn) scene.remove(transformHelper);
  });
  if (helperWasIn) scene.add(transformHelper);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
}

function animate() {
  requestAnimationFrame(animate);
  orbit.update();
  if (sculptDragging && pendingSculptPoint && selectedId != null) {
    const entry = sceneObjects.get(selectedId);
    if (entry && entry.kind !== 'null') {
      const local = sculptRayLocalPoint(entry, pendingSculptPoint.clientX, pendingSculptPoint.clientY);
      if (local) applySculptStroke(entry, local, brushType, parseFloat(brushSizeInput.value), parseFloat(brushStrengthInput.value));
    }
  }
  if (hairDragging && pendingHairPoint) {
    const p = nextHairPoint(pendingHairPoint.clientX, pendingHairPoint.clientY);
    const last = hairPoints[hairPoints.length - 1];
    if (!last || last.distanceTo(p) >= HAIR_MIN_SPACING) {
      hairPoints.push(p);
      updateHairPreview();
    }
  }
  // Live symmetry: for every mirror object, track the original's local transform
  sceneObjects.forEach(entry => {
    if (!entry.isMirrorOf) return;
    const srcEntry = sceneObjects.get(entry.isMirrorOf);
    if (!srcEntry) return;
    // Mirror position: flip X relative to parent (Null center)
    entry.mesh.position.set(
      -srcEntry.mesh.position.x,
      srcEntry.mesh.position.y,
      srcEntry.mesh.position.z
    );
    // Mirror rotation: flip Y axis
    entry.mesh.rotation.set(
      srcEntry.mesh.rotation.x,
      -srcEntry.mesh.rotation.y,
      srcEntry.mesh.rotation.z
    );
    // Mirror scale: flip X
    entry.mesh.scale.set(
      -Math.abs(srcEntry.mesh.scale.x),
      srcEntry.mesh.scale.y,
      srcEntry.mesh.scale.z
    );
  });

  if (fourViewMode) {
    renderFourView();
    transform.camera = activeCamera; // deja la camara "activa" lista para el picking/gizmo del cuadrante tocado
  } else {
    renderer.render(scene, activeCamera);
  }
}
animate();

syncCanvasTop(); // deja el alto del canvas acorde a la barra de arriba (2 o 3 filas) y los limites de orthoCam listos
setView('perspective');
pushHistory(); // estado inicial (escena vacía), para poder deshacer hasta el principio

// --- PWA: registrar el service worker para que se pueda instalar ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// =====================================================================
// CLONADOR DE MATRIZ (Linear / Circular / Grid)
// =====================================================================
const arrayModal   = document.getElementById('arrayModal');
const arrayMode    = document.getElementById('arrayMode');
const arrayCount   = document.getElementById('arrayCount');
const arrayLinearOpts   = document.getElementById('arrayLinearOpts');
const arrayCircularOpts = document.getElementById('arrayCircularOpts');
const arrayGridOpts     = document.getElementById('arrayGridOpts');
const arrayApplyBtn  = document.getElementById('arrayApplyBtn');
const arrayCancelBtn = document.getElementById('arrayCancelBtn');
const arrayCloneBtn  = document.getElementById('arrayCloneBtn');

// Show/hide sub-options when mode changes
if (arrayMode) {
  arrayMode.addEventListener('change', () => {
    arrayLinearOpts.style.display   = arrayMode.value === 'linear'   ? 'flex' : 'none';
    arrayCircularOpts.style.display = arrayMode.value === 'circular' ? 'flex' : 'none';
    arrayGridOpts.style.display     = arrayMode.value === 'grid'     ? 'flex' : 'none';
  });
}

if (arrayCloneBtn) {
  arrayCloneBtn.addEventListener('click', () => {
    if (selectedId == null) return;
    arrayModal.classList.add('show');
  });
}
if (arrayCancelBtn) arrayCancelBtn.addEventListener('click', () => arrayModal.classList.remove('show'));
arrayModal && arrayModal.addEventListener('click', e => { if (e.target === arrayModal) arrayModal.classList.remove('show'); });

// Helper: deep-clone a sceneObject entry into the scene
function cloneEntryAt(src, positionWorld) {
  const colorHex = src.mesh.material ? src.mesh.material.color.getHex() : undefined;
  const extraOpts = {
    roughness: src.mesh.material ? src.mesh.material.roughness : undefined,
    metalness: src.mesh.material ? src.mesh.material.metalness : undefined,
    opacity:   src.mesh.material ? src.mesh.material.opacity   : undefined,
    wireframe: src.mesh.material ? src.mesh.material.wireframe : undefined,
  };
  if (src.kind === 'hair') extraOpts.geometryData = serializeGeometry(src.mesh.geometry);
  const built = buildObject(src.kind, colorHex, extraOpts);
  built.node.rotation.copy(src.mesh.rotation);
  built.node.scale.copy(src.mesh.scale);
  if (src.kind !== 'hair') copySculptIfAny(src, built.node);
  built.node.position.copy(positionWorld);
  scene.add(built.node);
  const newId = objIdCounter++;
  built.pickMesh.userData.ownerId = newId;
  sceneObjects.set(newId, {
    id: newId, kind: src.kind, mesh: built.node, pickMesh: built.pickMesh,
    visible: true, parentId: null, sculpted: !!src.sculpted,
    name: src.name ? src.name + ' (copia)' : null, collapsed: false
  });
  return newId;
}

// Create a Null group and parent all given IDs into it
function groupIds(ids, groupName) {
  const nullBuilt = buildObject('null', undefined, {});
  scene.add(nullBuilt.node);
  const nullId = objIdCounter++;
  nullBuilt.pickMesh.userData.ownerId = nullId;
  sceneObjects.set(nullId, {
    id: nullId, kind: 'null', mesh: nullBuilt.node, pickMesh: nullBuilt.pickMesh,
    visible: true, parentId: null, sculpted: false,
    name: groupName, collapsed: false
  });
  ids.forEach(id => {
    const e = sceneObjects.get(id);
    if (!e) return;
    nullBuilt.node.attach(e.mesh);
    e.parentId = nullId;
  });
  return nullId;
}

if (arrayApplyBtn) {
  arrayApplyBtn.addEventListener('click', () => {
    const src = sceneObjects.get(selectedId);
    if (!src) { arrayModal.classList.remove('show'); return; }

    const mode  = arrayMode.value;
    const count = Math.max(1, Math.min(100, parseInt(arrayCount.value) || 3));
    const srcPos = new THREE.Vector3();
    src.mesh.getWorldPosition(srcPos);
    const srcLabel = src.name || KIND_LABEL[src.kind] || src.kind;

    const createdIds = [selectedId]; // include original

    if (mode === 'linear') {
      const ox = parseFloat(document.getElementById('arrayOffsetX').value) || 80;
      const oy = parseFloat(document.getElementById('arrayOffsetY').value) || 0;
      const oz = parseFloat(document.getElementById('arrayOffsetZ').value) || 0;
      for (let i = 1; i <= count; i++) {
        const pos = srcPos.clone().add(new THREE.Vector3(ox * i, oy * i, oz * i));
        createdIds.push(cloneEntryAt(src, pos));
      }
      const nullId = groupIds(createdIds, `🔁 Lineal (${srcLabel})`);
      renderLayerList(); selectObject(nullId); pushHistory();

    } else if (mode === 'circular') {
      const radius   = parseFloat(document.getElementById('arrayRadius').value) || 120;
      const axis     = document.getElementById('arrayAxis').value;
      const doRotate = document.getElementById('arrayRotateCopies').checked;
      const total    = count + 1; // include original position
      const angleStep = (Math.PI * 2) / total;

      // Reposition the original to first slot on the circle
      const angle0 = 0;
      const firstPos = srcPos.clone();
      if (axis === 'y') { firstPos.x = srcPos.x + Math.cos(angle0) * radius; firstPos.z = srcPos.z + Math.sin(angle0) * radius; }
      else if (axis === 'x') { firstPos.y = srcPos.y + Math.cos(angle0) * radius; firstPos.z = srcPos.z + Math.sin(angle0) * radius; }
      else { firstPos.x = srcPos.x + Math.cos(angle0) * radius; firstPos.y = srcPos.y + Math.sin(angle0) * radius; }
      src.mesh.position.copy(firstPos);

      for (let i = 1; i < total; i++) {
        const a = angleStep * i;
        const pos = srcPos.clone();
        if (axis === 'y') { pos.x = srcPos.x + Math.cos(a) * radius; pos.z = srcPos.z + Math.sin(a) * radius; }
        else if (axis === 'x') { pos.y = srcPos.y + Math.cos(a) * radius; pos.z = srcPos.z + Math.sin(a) * radius; }
        else { pos.x = srcPos.x + Math.cos(a) * radius; pos.y = srcPos.y + Math.sin(a) * radius; }
        const newId = cloneEntryAt(src, pos);
        if (doRotate) {
          const e = sceneObjects.get(newId);
          if (e) {
            if (axis === 'y') e.mesh.rotation.y = src.mesh.rotation.y + a;
            else if (axis === 'x') e.mesh.rotation.x = src.mesh.rotation.x + a;
            else e.mesh.rotation.z = src.mesh.rotation.z + a;
          }
        }
        createdIds.push(newId);
      }
      const nullId = groupIds(createdIds, `🔁 Circular (${srcLabel})`);
      renderLayerList(); selectObject(nullId); pushHistory();

    } else if (mode === 'grid') {
      const gx = Math.max(1, parseInt(document.getElementById('arrayGridX').value) || 3);
      const gz = Math.max(1, parseInt(document.getElementById('arrayGridZ').value) || 3);
      const gy = Math.max(1, parseInt(document.getElementById('arrayGridY').value) || 1);
      const sx = parseFloat(document.getElementById('arrayGridSepX').value) || 80;
      const sz = parseFloat(document.getElementById('arrayGridSepZ').value) || 80;
      const sy = parseFloat(document.getElementById('arrayGridSepY').value) || 80;
      // Center the grid around the original
      const startX = srcPos.x - (gx - 1) * sx / 2;
      const startY = srcPos.y;
      const startZ = srcPos.z - (gz - 1) * sz / 2;
      let first = true;
      for (let iy = 0; iy < gy; iy++) {
        for (let iz = 0; iz < gz; iz++) {
          for (let ix = 0; ix < gx; ix++) {
            const pos = new THREE.Vector3(startX + ix * sx, startY + iy * sy, startZ + iz * sz);
            if (first) { src.mesh.position.copy(pos); first = false; continue; }
            createdIds.push(cloneEntryAt(src, pos));
          }
        }
      }
      const nullId = groupIds(createdIds, `🔁 Cuadrícula (${srcLabel})`);
      renderLayerList(); selectObject(nullId); pushHistory();
    }

    arrayModal.classList.remove('show');
  });
}
