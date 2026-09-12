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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b2f33);

const perspCam = new THREE.PerspectiveCamera(50, wrap.clientWidth / wrap.clientHeight, 0.1, 2000);
perspCam.position.set(180, 160, 260);

// Camara ortografica para las vistas Frente/Atras/Izquierda/Derecha/Arriba/
// Abajo -- sin la distorsion de perspectiva, para que sirvan de verdad para
// alinear cosas ("disenios perfectos"), no solo la vista libre en 3D.
const ORTHO_HALF_HEIGHT = 220;
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);

let activeCamera = perspCam;

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

const KIND_LABEL = {
  cube: '🧊 Cubo', sphere: '⚪ Esfera', cylinder: '🥫 Cilindro',
  cone: '🔺 Cono', plane: '▭ Plano', torus: '🍩 Toroide'
};

function geometryFor(kind) {
  switch (kind) {
    case 'sphere': return new THREE.SphereGeometry(42, 32, 24);
    case 'cylinder': return new THREE.CylinderGeometry(36, 36, 78, 32);
    case 'cone': return new THREE.ConeGeometry(42, 78, 32);
    case 'plane': return new THREE.PlaneGeometry(90, 90, 1, 1);
    case 'torus': return new THREE.TorusGeometry(42, 15, 20, 48);
    case 'cube':
    default: return new THREE.BoxGeometry(66, 66, 66);
  }
}

let placeAngle = 0;
function nextPlacement() {
  const radius = 110;
  const p = { x: Math.cos(placeAngle) * radius, y: 40, z: Math.sin(placeAngle) * radius };
  placeAngle += Math.PI / 3;
  return p;
}

function addPrimitive(kind) {
  const geo = geometryFor(kind);
  const mat = new THREE.MeshStandardMaterial({ color: DEFAULT_COLOR, roughness: 0.5, metalness: 0.05 });
  if (kind === 'plane') mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  const pos = nextPlacement();
  mesh.position.set(pos.x, pos.y, pos.z);
  scene.add(mesh);
  const id = objIdCounter++;
  sceneObjects.set(id, { id, kind, mesh, visible: true });
  renderLayerList();
  selectObject(id);
  pushHistory();
}

function removeObject(id) {
  const entry = sceneObjects.get(id);
  if (!entry) return;
  scene.remove(entry.mesh);
  entry.mesh.geometry.dispose();
  entry.mesh.material.dispose();
  sceneObjects.delete(id);
  if (selectedId === id) selectObject(null);
  renderLayerList();
  pushHistory();
}

function cloneObject(id) {
  const src = sceneObjects.get(id);
  if (!src) return;
  const geo = src.mesh.geometry.clone();
  const mat = src.mesh.material.clone();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(src.mesh.position).add(new THREE.Vector3(24, 0, 24));
  mesh.rotation.copy(src.mesh.rotation);
  mesh.scale.copy(src.mesh.scale);
  scene.add(mesh);
  const newId = objIdCounter++;
  sceneObjects.set(newId, { id: newId, kind: src.kind, mesh, visible: true });
  renderLayerList();
  selectObject(newId);
  pushHistory();
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
  if (!entry) return;
  entry.mesh.material.color.set(hex);
}

function selectObject(id) {
  selectedId = id;
  const entry = id != null ? sceneObjects.get(id) : null;
  if (entry) {
    transform.attach(entry.mesh);
    propsPanel.classList.add('show');
    propsColor.value = '#' + entry.mesh.material.color.getHexString();
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
  items.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'layer-row' + (entry.id === selectedId ? ' active' : '');

    const label = document.createElement('span');
    label.className = 'layer-label';
    label.textContent = KIND_LABEL[entry.kind] || entry.kind;
    row.appendChild(label);

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
  return Array.from(sceneObjects.values()).map(e => ({
    id: e.id, kind: e.kind, visible: e.visible,
    px: e.mesh.position.x, py: e.mesh.position.y, pz: e.mesh.position.z,
    rx: e.mesh.rotation.x, ry: e.mesh.rotation.y, rz: e.mesh.rotation.z,
    sx: e.mesh.scale.x, sy: e.mesh.scale.y, sz: e.mesh.scale.z,
    color: e.mesh.material.color.getHex()
  }));
}

function rebuildSceneFrom(snap) {
  transform.detach();
  sceneObjects.forEach(e => { scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); });
  sceneObjects.clear();
  let maxId = 0;
  snap.forEach(s => {
    const geo = geometryFor(s.kind);
    const mat = new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.5, metalness: 0.05 });
    if (s.kind === 'plane') mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(s.px, s.py, s.pz);
    mesh.rotation.set(s.rx, s.ry, s.rz);
    mesh.scale.set(s.sx, s.sy, s.sz);
    mesh.visible = s.visible;
    scene.add(mesh);
    sceneObjects.set(s.id, { id: s.id, kind: s.kind, mesh, visible: s.visible });
    if (s.id > maxId) maxId = s.id;
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
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, activeCamera);
  const pickable = Array.from(sceneObjects.values()).filter(o => o.visible).map(o => o.mesh);
  const hits = raycaster.intersectObjects(pickable, false);
  if (hits.length) {
    const hitEntry = Array.from(sceneObjects.values()).find(o => o.mesh === hits[0].object);
    selectObject(hitEntry ? hitEntry.id : null);
  } else {
    selectObject(null);
  }
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (transform.dragging) return;
  onPick(e.clientX, e.clientY);
});

// --- Botonera de modos (mover / rotar / escalar) ---
const modeButtons = document.querySelectorAll('.tbtn');
function setMode(mode) {
  transform.setMode(mode);
  modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
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

function setView(key) {
  const v = VIEWS[key];
  if (!v) return;
  const cam = v.ortho ? orthoCam : perspCam;
  cam.up.set(v.up[0], v.up[1], v.up[2]);
  cam.position.set(v.pos[0], v.pos[1], v.pos[2]);
  cam.lookAt(VIEW_TARGET);

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

  viewButtons.forEach(b => b.classList.toggle('active', b.dataset.view === key));
}

viewButtons.forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

// --- Resize ---
function handleResize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  const aspect = w / h;
  perspCam.aspect = aspect;
  perspCam.updateProjectionMatrix();
  orthoCam.left = -ORTHO_HALF_HEIGHT * aspect;
  orthoCam.right = ORTHO_HALF_HEIGHT * aspect;
  orthoCam.top = ORTHO_HALF_HEIGHT;
  orthoCam.bottom = -ORTHO_HALF_HEIGHT;
  orthoCam.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', handleResize);

function animate() {
  requestAnimationFrame(animate);
  orbit.update();
  renderer.render(scene, activeCamera);
}
animate();

handleResize(); // deja los limites de orthoCam listos antes del primer uso
setView('perspective');
pushHistory(); // estado inicial (escena vacía), para poder deshacer hasta el principio

// --- PWA: registrar el service worker para que se pueda instalar ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
