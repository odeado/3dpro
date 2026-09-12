// Spike Fase 0: confirmar que el gizmo de mover/rotar/escalar de three.js
// (TransformControls) se siente bien con dedo/lápiz en la tablet, antes de
// construir el resto del editor. Nada de esto es UI final — es solo la
// prueba de la parte más riesgosa.

import * as THREE from 'three';
import { OrbitControls } from './vendor/three-addons/OrbitControls.js';
import { TransformControls } from './vendor/three-addons/TransformControls.js';

const wrap = document.getElementById('canvasWrap');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b2f33);

const camera = new THREE.PerspectiveCamera(50, wrap.clientWidth / wrap.clientHeight, 0.1, 2000);
camera.position.set(180, 160, 260);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(wrap.clientWidth, wrap.clientHeight);
wrap.appendChild(renderer.domElement);

// Luz simple tipo "estudio de fotos", nada configurable en este spike.
const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(120, 200, 150);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.45));

const grid = new THREE.GridHelper(400, 20, 0x555555, 0x3d4146);
scene.add(grid);

// Cámara orbitable con el fondo (mismo patrón que ya usás en Escena 3D).
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 20, 0);
orbit.enableDamping = true;

// Dos figuras para poder probar selección + gizmo en más de un objeto.
function makeMesh(geo, colorHex, x) {
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 40, 0);
  scene.add(mesh);
  return mesh;
}
const cube = makeMesh(new THREE.BoxGeometry(66, 66, 66), 0xe0762f, -80);
const sphere = makeMesh(new THREE.SphereGeometry(42, 32, 24), 0xe0762f, 80);
const pickable = [cube, sphere];

// --- Gizmo de transformación ---
const transform = new TransformControls(camera, renderer.domElement);
transform.size = 1.3; // un poco más grande que el default: más fácil de agarrar con el dedo/lápiz
scene.add(transform.getHelper ? transform.getHelper() : transform); // getHelper() en versiones nuevas de three.js

// Mientras se arrastra un handle del gizmo, hay que apagar el orbit —
// si no, tocar una flecha también rota la cámara al mismo tiempo.
transform.addEventListener('dragging-changed', (e) => {
  orbit.enabled = !e.value;
});

let selected = null;
function select(mesh) {
  selected = mesh;
  if (mesh) transform.attach(mesh);
  else transform.detach();
}

// Selección por toque/click: raycast contra las figuras (no contra el gizmo,
// que maneja sus propios eventos aparte).
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function onPick(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickable, false);
  if (hits.length) select(hits[0].object);
  else select(null);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  // Si el pointerdown es sobre el propio gizmo, TransformControls ya lo
  // captura y "dragging-changed" se dispara — no tocar la selección ahí,
  // solo cuando el toque es sobre el fondo/figuras.
  if (transform.dragging) return;
  onPick(e.clientX, e.clientY);
});

// --- Botonera de modos (mover / rotar / escalar) ---
const buttons = document.querySelectorAll('.tbtn');
function setMode(mode) {
  transform.setMode(mode);
  buttons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
}
buttons.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
setMode('translate');

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = wrap.clientWidth / wrap.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
});

function animate() {
  requestAnimationFrame(animate);
  orbit.update();
  renderer.render(scene, camera);
}
animate();
