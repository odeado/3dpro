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
wrap.appendChild(renderer.domElement);

const BASE_DIR_INTENSITY = 1.1;
const BASE_AMBIENT_INTENSITY = 0.45;
const dirLight = new THREE.DirectionalLight(0xffffff, BASE_DIR_INTENSITY);
dirLight.position.set(120, 200, 150);
scene.add(dirLight);
const ambientLight = new THREE.AmbientLight(0xffffff, BASE_AMBIENT_INTENSITY);
scene.add(ambientLight);

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
  if (kind === 'hair') {
    const geo = extra && extra.geometryData ? geometryFromSerialized(extra.geometryData) : new THREE.BufferGeometry();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex != null ? colorHex : HAIR_DEFAULT_COLOR, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    return { node: mesh, pickMesh: mesh };
  }
  const geo = geometryFor(kind);
  const mat = new THREE.MeshStandardMaterial({ color: colorHex != null ? colorHex : DEFAULT_COLOR, roughness: 0.5, metalness: 0.05 });
  if (kind === 'plane') mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  return { node: mesh, pickMesh: mesh };
}

let placeAngle = 0;
function nextPlacement() {
  const radius = 110;
  const p = { x: Math.cos(placeAngle) * radius, y: 40, z: Math.sin(placeAngle) * radius };
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
  sceneObjects.set(id, { id, kind, mesh: built.node, pickMesh: built.pickMesh, visible: true, parentId: null, sculpted: false });
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
  const built = src.kind === 'hair'
    ? buildObject('hair', colorHex, { geometryData: serializeGeometry(src.mesh.geometry) })
    : buildObject(src.kind, colorHex);
  built.node.position.copy(src.mesh.position).add(new THREE.Vector3(24, 0, 24));
  built.node.rotation.copy(src.mesh.rotation);
  built.node.scale.copy(src.mesh.scale);
  const copiedSculpt = src.kind === 'hair' ? false : copySculptIfAny(src, built.node);
  scene.add(built.node);
  const newId = objIdCounter++;
  built.pickMesh.userData.ownerId = newId;
  sceneObjects.set(newId, { id: newId, kind: src.kind, mesh: built.node, pickMesh: built.pickMesh, visible: true, parentId: null, sculpted: copiedSculpt });
  renderLayerList();
  selectObject(newId);
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

function selectObject(id) {
  selectedId = id;
  const entry = id != null ? sceneObjects.get(id) : null;
  if (entry) {
    if (toolMode === 'sculpt' || toolMode === 'hair') transform.detach(); else transform.attach(entry.mesh);
    if (entry.mesh.material) {
      propsPanel.classList.add('show');
      propsColor.value = '#' + entry.mesh.material.color.getHexString();
    } else {
      propsPanel.classList.remove('show');
    }
  } else {
    transform.detach();
    propsPanel.classList.remove('show');
  }
  renderLayerList();
}

function renderLayerList() {
  layerList.innerHTML = '';
  const items = Array.from(sceneObjects.values());
  layerEmpty.style.display = items.length ? 'none' : 'block';
  const selectedEntry = selectedId != null ? sceneObjects.get(selectedId) : null;
  const selectedIsGroup = !!(selectedEntry && selectedEntry.kind === 'null');

  items.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'layer-row' + (entry.id === selectedId ? ' active' : '') + (entry.kind === 'null' ? ' is-group' : '');
    row.style.marginLeft = (depthOf(entry) * 14) + 'px';

    const label = document.createElement('span');
    label.className = 'layer-label';
    label.textContent = (entry.parentId != null ? '↳ ' : '') + (KIND_LABEL[entry.kind] || entry.kind);
    row.appendChild(label);

    // Meter esta figura dentro del grupo (Nulo) que este seleccionado --
    // solo aparece cuando hay un grupo seleccionado y esta fila no es ese
    // mismo grupo.
    if (selectedIsGroup && entry.id !== selectedId) {
      const groupBtn = document.createElement('button');
      groupBtn.className = 'layer-btn';
      groupBtn.textContent = '🔗';
      groupBtn.title = 'Meter en el grupo seleccionado';
      groupBtn.addEventListener('click', (e) => { e.stopPropagation(); groupInto(entry.id, selectedId); });
      row.appendChild(groupBtn);
    }

    // Sacar del grupo (solo aparece si esta figura esta adentro de uno).
    if (entry.parentId != null) {
      const ungroupBtn = document.createElement('button');
      ungroupBtn.className = 'layer-btn';
      ungroupBtn.textContent = '🔓';
      ungroupBtn.title = 'Sacar del grupo';
      ungroupBtn.addEventListener('click', (e) => { e.stopPropagation(); ungroup(entry.id); });
      row.appendChild(ungroupBtn);
    }

    const cloneBtn = document.createElement('button');
    cloneBtn.className = 'layer-btn';
    cloneBtn.textContent = '📋';
    cloneBtn.title = 'Clonar';
    cloneBtn.addEventListener('click', (e) => { e.stopPropagation(); cloneObject(entry.id); });
    row.appendChild(cloneBtn);

    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'layer-btn';
    eyeBtn.textContent = entry.visible ? '👁' : '🚫';
    eyeBtn.title = entry.visible ? 'Ocultar' : 'Mostrar';
    eyeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleVisible(entry.id); });
    row.appendChild(eyeBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'layer-btn';
    delBtn.textContent = '🗑';
    delBtn.title = 'Borrar';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); removeObject(entry.id); });
    row.appendChild(delBtn);

    row.addEventListener('click', () => selectObject(entry.id));
    layerList.appendChild(row);
  });
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
      px: e.mesh.position.x, py: e.mesh.position.y, pz: e.mesh.position.z,
      rx: e.mesh.rotation.x, ry: e.mesh.rotation.y, rz: e.mesh.rotation.z,
      sx: e.mesh.scale.x, sy: e.mesh.scale.y, sz: e.mesh.scale.z,
      color: e.mesh.material ? e.mesh.material.color.getHex() : null
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
    const built = s.kind === 'hair'
      ? buildObject('hair', s.color != null ? s.color : undefined, { geometryData: s.hairGeometry })
      : buildObject(s.kind, s.color != null ? s.color : undefined);
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
    sceneObjects.set(s.id, { id: s.id, kind: s.kind, mesh: built.node, pickMesh: built.pickMesh, visible: s.visible, parentId: s.parentId != null ? s.parentId : null, sculpted });
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
  if (!e.ctrlKey && !e.metaKey) return;
  if (e.key === 'z') { e.preventDefault(); undoBtn.click(); }
  if (e.key === 'y') { e.preventDefault(); redoBtn.click(); }
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

function finishHairStroke() {
  clearHairPreview();
  if (hairPoints.length < 2) { hairPoints = []; return; } // toque sin arrastre: no crea nada
  const origin = hairPoints[0].clone();
  const localPoints = hairPoints.map(p => p.clone().sub(origin));
  const geo = buildTaperedTubeGeometry(localPoints, HAIR_ROOT_RADIUS, HAIR_TIP_RADIUS);
  const mat = new THREE.MeshStandardMaterial({ color: HAIR_DEFAULT_COLOR, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(origin);
  scene.add(mesh);
  const id = objIdCounter++;
  mesh.userData.ownerId = id;
  sceneObjects.set(id, { id, kind: 'hair', mesh, pickMesh: mesh, visible: true, parentId: null, sculpted: false });
  hairPoints = [];
  renderLayerList();
  selectObject(id);
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

function applySculptStroke(entry, localPoint, brush, size, strength) {
  const geo = entry.mesh.geometry;
  const posAttr = geo.attributes.position;
  const normAttr = geo.attributes.normal;
  const radius = size;

  if (brush === 'smooth') {
    const adj = getAdjacency(geo);
    const original = posAttr.array.slice(); // leer todo antes de escribir nada, para que el promedio no se contamine a mitad de camino
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
  } else {
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i), vy = posAttr.getY(i), vz = posAttr.getZ(i);
      const dx = vx - localPoint.x, dy = vy - localPoint.y, dz = vz - localPoint.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > radius) continue;
      const t = 1 - dist / radius;
      const falloff = t * t * (3 - 2 * t); // smoothstep -- borde de pincel mas natural

      if (brush === 'pinch') {
        const k = falloff * strength * 0.08;
        posAttr.setXYZ(i, vx + (localPoint.x - vx) * k, vy + (localPoint.y - vy) * k, vz + (localPoint.z - vz) * k);
      } else {
        // empujar (afuera) / hundir (adentro): a lo largo de la normal del vertice
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

brushRow.querySelectorAll('.tbtn[data-brush]').forEach(b => {
  b.addEventListener('click', () => {
    brushType = b.dataset.brush;
    brushRow.querySelectorAll('.tbtn[data-brush]').forEach(bb => bb.classList.toggle('active', bb === b));
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

// --- Botonera de modos (mover / rotar / escalar / esculpir) ---
const modeButtons = document.querySelectorAll('.tbtn[data-mode]');
function syncCanvasTop() {
  wrap.style.top = toolbar.offsetHeight + 'px';
  handleResize();
}
function setMode(mode) {
  toolMode = mode;
  modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  if (mode === 'sculpt' || mode === 'hair') {
    // ninguno de los dos usa el gizmo de mover/rotar/escalar -- Esculpir
    // deforma con el dedo, Pelo dibuja con el dedo.
    transform.detach();
    brushRow.style.display = mode === 'sculpt' ? 'flex' : 'none';
  } else {
    brushRow.style.display = 'none';
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

function renderFourView() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setScissorTest(true);
  ['tl', 'tr', 'bl', 'br'].forEach(q => {
    const r = quadrantGLRect(q, w, h);
    const cam = GRID_CAMS[q];
    renderer.setViewport(r.x, r.y, r.w, r.h);
    renderer.setScissor(r.x, r.y, r.w, r.h);
    transform.camera = cam; // asi el gizmo se ve del tamano correcto en cada cuadrante
    renderer.render(scene, cam);
  });
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
