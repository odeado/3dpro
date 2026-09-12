// Fase 3: color por objeto, luz fija con un slider simple, clonar (en vez
// de copiar/pegar con portapapeles, un boton "Clonar" hace lo mismo con un
// solo toque, mas simple para una nena que un menu contextual de touch) y
// deshacer/rehacer (clave para el desliz de "toque mal y desaparecio todo").

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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b2f33);

const camera = new THREE.PerspectiveCamera(50, wrap.clientWidth / wrap.clientHeight, 0.1, 2000);
camera.position.set(180, 160, 260);

const renderer = new THREE.WebGLRenderer({ antialias: true });
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

scene.add(new THREE.GridHelper(400, 20, 0x555555, 0x3d4146));

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 20, 0);
orbit.enableDamping = true;

const transform = new TransformControls(camera, renderer.domElement);
transform.size = 1.3;
scene.add(transform.getHelper ? transform.getHelper() : transform);
transform.addEventListener('dragging-changed', (e) => {
  orbit.enabled = !e.value;
  if (!e.value) pushHistory(); // se soltó el gizmo: guardar el estado nuevo para poder deshacerlo
});

const DEFAULT_COLOR = 0xe0762f;

const sceneObjects = new Map(); // id -> { id, kind, mesh, visible }
let objIdCounter = 1;
let selectedId = null;

const KIND_LABEL = { cube: '🧊 Cubo', sphere: '⚪ Esfera', cylinder: '🥫 Cilindro', cone: '🔺 Cono', plane: '▭ Plano' };

function geometryFor(kind) {
  switch (kind) {
    case 'sphere': return new THREE.SphereGeometry(42, 32, 24);
    case 'cylinder': return new THREE.CylinderGeometry(36, 36, 78, 32);
    case 'cone': return new THREE.ConeGeometry(42, 78, 32);
    case 'plane': return new THREE.PlaneGeometry(90, 90, 1, 1);
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

// "Clonar" en vez de copiar/pegar con portapapeles: un solo toque duplica
// la figura ahí mismo, corrida un poco al costado. Para lo que pidió Andres
// (que su hija pueda repetir una forma) resuelve lo mismo sin necesitar un
// menú contextual táctil (long-press choca fácil con el orbit de cámara).
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
// Pila simple de snapshots serializables (posición/rotación/escala/color/
// visibilidad de cada objeto). Se guarda un snapshot nuevo después de cada
// acción confirmada (agregar, borrar, clonar, soltar el gizmo, cerrar el
// selector de color) — nunca en medio de un arrastre, para no inundar el
// historial con un estado por frame.
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

function restoreSnapshot(snap) {
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
  updateHistoryButtons();
}

function pushHistory() {
  history = history.slice(0, historyIndex + 1);
  history.push(snapshotScene());
  if (history.length > 60) history.shift(); // tope simple para no crecer sin límite en una sesión larga
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
  raycaster.setFromCamera(pointer, camera);
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

// --- Resize ---
function handleResize() {
  camera.aspect = wrap.clientWidth / wrap.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
}
window.addEventListener('resize', handleResize);

function animate() {
  requestAnimationFrame(animate);
  orbit.update();
  renderer.render(scene, camera);
}
animate();

pushHistory(); // estado inicial (escena vacía), para poder deshacer hasta el principio
