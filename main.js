// Fase 1-2: escena con primitivas dinámicas + lista de capas + gizmo de
// mover/rotar/escalar (heredado del spike de Fase 0, ya probado con lápiz
// en la tablet). Sin colores/luz configurable ni deshacer todavía — eso es
// Fase 3.

import * as THREE from 'three';
import { OrbitControls } from './vendor/three-addons/OrbitControls.js';
import { TransformControls } from './vendor/three-addons/TransformControls.js';

const wrap = document.getElementById('canvasWrap');
const layerList = document.getElementById('layerList');
const layerEmpty = document.getElementById('layerEmpty');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b2f33);

const camera = new THREE.PerspectiveCamera(50, wrap.clientWidth / wrap.clientHeight, 0.1, 2000);
camera.position.set(180, 160, 260);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(wrap.clientWidth, wrap.clientHeight);
wrap.appendChild(renderer.domElement);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(120, 200, 150);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.45));

scene.add(new THREE.GridHelper(400, 20, 0x555555, 0x3d4146));

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 20, 0);
orbit.enableDamping = true;

const transform = new TransformControls(camera, renderer.domElement);
transform.size = 1.3;
scene.add(transform.getHelper ? transform.getHelper() : transform);
transform.addEventListener('dragging-changed', (e) => { orbit.enabled = !e.value; });

const DEFAULT_COLOR = 0xe0762f;

// --- Manejo de objetos de la escena (equivalente simplificado del
// sceneObjects Map de renderer/scene3d-engine.mjs) ---
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

// Reparte los objetos nuevos en un círculo en vez de apilarlos siempre en
// el mismo punto (mismo problema que resuelve nextPlacementOffset() en el
// motor de Andres, versión simple).
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
}

function toggleVisible(id) {
  const entry = sceneObjects.get(id);
  if (!entry) return;
  entry.visible = !entry.visible;
  entry.mesh.visible = entry.visible;
  if (!entry.visible && selectedId === id) selectObject(null);
  renderLayerList();
}

function selectObject(id) {
  selectedId = id;
  const entry = id != null ? sceneObjects.get(id) : null;
  if (entry) transform.attach(entry.mesh);
  else transform.detach();
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

renderLayerList();
