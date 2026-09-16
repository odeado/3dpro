// Fase 4: guardar/abrir proyectos (localStorage, sin cuenta todavia),
// exportar imagen PNG transparente, e instalable como PWA (manifest.json +
// sw.js, registrado al final de este archivo). Se suma tambien el Toroide
// como forma (util para bocas/ojos: aplastado con Escalar queda como un
// aro o una media luna).

import * as THREE from 'three';
import { OrbitControls } from './vendor/three-addons/OrbitControls.js';
import { TransformControls } from './vendor/three-addons/TransformControls.js';
import { FontLoader } from './vendor/three-addons/loaders/FontLoader.js';
import { TextGeometry } from './vendor/three-addons/geometries/TextGeometry.js';

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
const hairRow = document.getElementById('hairRow');
const hairRootRadiusInput = document.getElementById('hairRootRadius');
const hairTipRadiusInput = document.getElementById('hairTipRadius');

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
  hair: '💇 Pelo', spline: '🧵 Curva', lathe: '🥂 Revolución', tube: '🧴 Tubo', extrude: '📐 Extrusión', text: '🔤 Texto 3D'
};

// 'spline' (curva editable, sin generador aplicado todavia) y 'lathe' (ya
// convertida en un solido de revolucion) comparten con 'hair' el mismo
// mecanismo de fondo: su geometria no sale de una formula fija (como un
// cubo o una esfera), sino que hay que guardarla/reconstruirla entera --
// asi que en todos los lugares donde el codigo ya sabia tratar 'hair'
// distinto (clonar, guardar/deshacer, exportar), se trata igual a estos
// tipos ('lathe' y 'tube', ambos generados a partir de una curva). Funcion
// centralizada para no repetir la lista en cada lugar.
function isCustomGeomKind(kind) {
  return kind === 'hair' || kind === 'spline' || kind === 'lathe' || kind === 'tube' || kind === 'extrude' || kind === 'text';
}

// "let" (no "const"): los deslizadores de grosor en la barra de contexto
// del modo Pelo cambian estos valores en vivo (ver hairRootRadiusInput /
// hairTipRadiusInput mas abajo), asi el usuario controla que tan grueso
// sale cada trazo nuevo -- antes estaban fijos y por eso el pelo se veia
// siempre igual de grueso ("como ramas").
let HAIR_ROOT_RADIUS = 4;
let HAIR_TIP_RADIUS = 0.6;
const HAIR_DEFAULT_COLOR = 0x3b2415;
const HAIR_MIN_SPACING = 4; // unidades: no agregar un punto nuevo del trazo si esta muy cerca del anterior
const SPLINE_DEFAULT_COLOR = 0x4fa8e8; // celeste: para distinguir la curva "de guia" de una figura solida
const SPLINE_PREVIEW_RADIUS = 3; // grosor (mm) del tubo delgado que representa la curva antes de aplicar un generador
const TUBE_DEFAULT_ROOT_RADIUS = 14; // grosor por defecto al aplicar el generador Tubo (mango/asa/marco tipico)
const TUBE_DEFAULT_TIP_RADIUS = 14;
const TUBE_DEFAULT_RADIAL_SEGMENTS = 10;
const EXTRUDE_DEFAULT_DEPTH = 24;
const EXTRUDE_DEFAULT_BEVEL_SIZE = 2;

// --- Texto 3D: varias tipografias para elegir (pedido explicito: "varias
// fuentes para elegir", no una sola por defecto) -- son los clasicos .json
// "typeface" que ya trae three.js de ejemplo, cada uno con su contorno de
// letras ya vectorizado (no hace falta convertir nada nuevo). Se precargan
// todas apenas arranca la app, en paralelo y sin bloquear el resto, para
// que despues cambiar de fuente en Atributos sea instantaneo.
const FONT_SOURCES = {
  helvetiker: { label: 'Redonda', url: './vendor/fonts/helvetiker_regular.typeface.json' },
  helvetiker_bold: { label: 'Redonda Negrita', url: './vendor/fonts/helvetiker_bold.typeface.json' },
  optimer: { label: 'Geométrica', url: './vendor/fonts/optimer_regular.typeface.json' },
  gentilis: { label: 'Clásica', url: './vendor/fonts/gentilis_regular.typeface.json' },
  droid_sans: { label: 'Moderna', url: './vendor/fonts/droid_sans_regular.typeface.json' },
};
const TEXT_DEFAULT_FONT = 'helvetiker';
const TEXT_DEFAULT_TEXT = 'Hola';
const TEXT_DEFAULT_SIZE = 60;
const TEXT_DEFAULT_DEPTH = 20;
const TEXT_DEFAULT_BEVEL_SIZE = 1.5;

const fontLoader = new FontLoader();
const fontCache = {};        // fontKey -> Font ya cargada
const fontLoadPromises = {}; // fontKey -> Promise (para no pedirla dos veces)
function loadFont(key) {
  const src = FONT_SOURCES[key] ? key : TEXT_DEFAULT_FONT;
  if (fontCache[src]) return Promise.resolve(fontCache[src]);
  if (fontLoadPromises[src]) return fontLoadPromises[src];
  fontLoadPromises[src] = new Promise((resolve) => {
    fontLoader.load(FONT_SOURCES[src].url, (font) => { fontCache[src] = font; resolve(font); },
      undefined, (err) => { console.error('No se pudo cargar la tipografia', src, err); resolve(null); });
  });
  return fontLoadPromises[src];
}
Object.keys(FONT_SOURCES).forEach(k => loadFont(k)); // precarga de entrada, en paralelo

// Arma la geometria 3D de un texto con la tipografia ya cargada -- si la
// tipografia pedida todavia no esta lista, devuelve una geometria vacia (el
// llamador se encarga de reconstruir de nuevo cuando termine de cargar).
function buildTextGeometry(text, fontKey, size, depth, bevelEnabled, bevelSize) {
  const font = fontCache[fontKey] || fontCache[TEXT_DEFAULT_FONT];
  if (!font || !text) return new THREE.BufferGeometry();
  const geo = new TextGeometry(text, {
    font, size, depth, curveSegments: 8,
    bevelEnabled: !!bevelEnabled,
    bevelThickness: bevelEnabled ? bevelSize : 0,
    bevelSize: bevelEnabled ? bevelSize : 0,
    bevelSegments: 2,
  });
  geo.computeBoundingBox();
  // El texto arranca con su origen en la esquina inferior izquierda de la
  // primera letra -- se centra en su propio medio para que el gizmo y los
  // tiradores queden en el centro, igual que en cualquier otra figura.
  const bb = geo.boundingBox;
  geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -(bb.max.z + bb.min.z) / 2);
  geo.computeVertexNormals();
  return geo;
}

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

// Recorre 'points' (una lista de puntos con .clone(), Vector2 o Vector3)
// tramo por tramo y arma una lista MAS FINA de puntos siguiendo el
// contorno: por defecto pasa LISO (Catmull-Rom, bisel redondo) por cada
// punto, pero si 'sharp[i]' es true para uno de los dos puntos de un
// tramo, ESE tramo sale como linea RECTA -- asi un punto marcado "esquina
// dura" no se redondea, igual que el punto "corner" de un editor de
// vectores tipo Illustrator (a diferencia del punto "smooth" que sigue
// curvando liso). Sirve tanto para la linea guia de la Curva como para el
// contorno que arma la Extrusion -- por eso trabaja en generico, no sabe
// nada de "spline" ni de "extrude".
function sampleCurveWithCorners(points, closed, sharp, samplesPerSeg) {
  const n = points.length;
  if (n < 2) return points.map(p => p.clone());
  samplesPerSeg = samplesPerSeg || 8;
  const at = (i) => closed ? points[((i % n) + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  const isSharp = (i) => !!(sharp && sharp[((i % n) + n) % n]);
  const segCount = closed ? n : n - 1;
  const out = [];
  for (let i = 0; i < segCount; i++) {
    const p0 = at(i), p1 = at(i + 1);
    if (isSharp(i) || isSharp(i + 1)) {
      // Esquina dura de cualquiera de los dos extremos del tramo: recto.
      out.push(p0.clone());
    } else {
      // Los dos extremos son "lisos": se arma un Catmull-Rom local con los
      // 2 vecinos de cada lado y se toma SOLO el tramo del medio (p0->p1),
      // que corresponde a t en [1/3, 2/3) cuando se le pasan 4 puntos.
      const local = new THREE.CatmullRomCurve3([at(i - 1).clone(), p0.clone(), p1.clone(), at(i + 2).clone()], false);
      for (let s = 0; s < samplesPerSeg; s++) {
        out.push(local.getPoint((1 / 3) + (s / samplesPerSeg) * (1 / 3)));
      }
    }
  }
  out.push((closed ? at(0) : at(segCount)).clone());
  return out;
}

// Una Curva/Spline TODAVIA SIN CONVERTIR no es una figura solida de verdad
// -- es solo una guia, igual que en Cinema4D/Blender se ve como una linea
// finita, no como un tubo grueso. Esta funcion arma esa geometria de linea
// (suavizada con el mismo Catmull-Rom que ya usa el resto del Spline,
// salvo en los puntos marcados como "esquina dura" via 'sharp' -- ver
// sampleCurveWithCorners); "closed" la cierra en loop (para poder usarla
// con el generador de Extrusion). Se usa tanto para el trazo en
// construccion como para el objeto 'spline' ya terminado -- y se vuelve a
// llamar cada vez que se arrastra/agrega/saca un punto o se cambia si un
// punto es esquina dura o lisa.
function buildSplineLineGeometry(points, closed, sharp) {
  if (!points || points.length < 2) {
    const pts = points && points.length === 1 ? [points[0].clone(), points[0].clone()] : [];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }
  const spaced = sampleCurveWithCorners(points, !!closed, sharp, 8);
  return new THREE.BufferGeometry().setFromPoints(spaced);
}

// Crea el objeto THREE.Line de una Curva a partir de su geometria ya armada
// -- centraliza el material para que el trazo en construccion, el objeto
// terminado y la reconstruccion al deshacer/clonar se vean siempre igual.
function buildSplineLineObject(geo, colorHex) {
  const mat = new THREE.LineBasicMaterial({ color: colorHex != null ? colorHex : SPLINE_DEFAULT_COLOR });
  return new THREE.Line(geo, mat);
}

// Un Pelo no tiene una "forma de fabrica" como un cubo o una esfera -- su
// geometria sale entera del trazo dibujado. Para poder reconstruirlo (al
// deshacer/rehacer, abrir un proyecto guardado, o clonarlo) se guarda/
// restaura el buffer completo (posiciones, normales, uvs, indice), no solo
// un puñado de parametros.
function serializeGeometry(geo) {
  return {
    position: Array.from(geo.attributes.position.array),
    // Una Curva/Spline sin convertir se ve ahora como THREE.Line/LineLoop --
    // esa geometria solo tiene atributo "position" (sin normal/uv), a
    // diferencia de un solido de verdad. Se guarda null en ese caso.
    normal: geo.attributes.normal ? Array.from(geo.attributes.normal.array) : null,
    uv: geo.attributes.uv ? Array.from(geo.attributes.uv.array) : null,
    index: geo.index ? Array.from(geo.index.array) : null
  };
}

function geometryFromSerialized(data) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(data.position, 3));
  if (data.normal) geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normal, 3));
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

  if (kind === 'spline') {
    // Una Curva sin convertir todavia no es un solido -- se ve como una
    // linea fina (THREE.Line), no como una malla con caras. El estado
    // "cerrada" ya viene horneado en la geometria guardada/serializada.
    const geo = extra && extra.geometryData ? geometryFromSerialized(extra.geometryData) : new THREE.BufferGeometry();
    const line = buildSplineLineObject(geo, colorHex);
    return { node: line, pickMesh: line };
  }

  if (isCustomGeomKind(kind)) {
    const geo = extra && extra.geometryData ? geometryFromSerialized(extra.geometryData) : new THREE.BufferGeometry();
    const defaultColor = kind === 'hair' ? HAIR_DEFAULT_COLOR : (kind === 'spline' ? SPLINE_DEFAULT_COLOR : DEFAULT_COLOR);
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex != null ? colorHex : defaultColor,
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
  if (kind === 'text') { addTextPrimitive(); return; }
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

// El Texto 3D no arma su geometria con una formula fija como un cubo --
// necesita esperar a que la tipografia elegida termine de cargar (async) y
// despues generar el contorno de cada letra con TextGeometry. Por eso tiene
// su propia funcion de creacion en vez de pasar por buildObject() directo.
async function addTextPrimitive() {
  const font = await loadFont(TEXT_DEFAULT_FONT);
  const built = buildObject('text', undefined, {});
  built.node.geometry.dispose();
  built.node.geometry = font
    ? buildTextGeometry(TEXT_DEFAULT_TEXT, TEXT_DEFAULT_FONT, TEXT_DEFAULT_SIZE, TEXT_DEFAULT_DEPTH, false, TEXT_DEFAULT_BEVEL_SIZE)
    : new THREE.BufferGeometry();
  const pos = nextPlacement();
  built.node.position.set(pos.x, pos.y, pos.z);
  scene.add(built.node);
  const id = objIdCounter++;
  built.pickMesh.userData.ownerId = id;
  sceneObjects.set(id, {
    id, kind: 'text', mesh: built.node, pickMesh: built.pickMesh, visible: true, parentId: null, sculpted: false, name: null, collapsed: false,
    text: TEXT_DEFAULT_TEXT, fontKey: TEXT_DEFAULT_FONT, textSize: TEXT_DEFAULT_SIZE, textDepth: TEXT_DEFAULT_DEPTH, textBevel: false, textBevelSize: TEXT_DEFAULT_BEVEL_SIZE
  });
  renderLayerList();
  selectObject(id);
  pushHistory();
}

// Reconstruye la geometria de un Texto 3D ya existente a partir de sus
// parametros actuales (entry.text/fontKey/textSize/textDepth/textBevel...)
// -- se llama cada vez que se toca cualquiera de los controles en vivo de
// Atributos, para que el cambio se vea al instante.
function rebuildTextGeometry(entry) {
  if (!entry || entry.kind !== 'text') return;
  const geo = buildTextGeometry(entry.text, entry.fontKey, entry.textSize, entry.textDepth, entry.textBevel, entry.textBevelSize);
  entry.mesh.geometry.dispose();
  entry.mesh.geometry = geo;
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
  // Igual que en updateClonerLive(): si esta figura esta adentro de un
  // grupo/Nulo/clonador, su padre real no es "scene" -- "scene.remove()"
  // no la encuentra ahi y no hace nada, dejandola visible para siempre
  // aunque ya se haya borrado del panel. "removeFromParent()" la saca de
  // donde este colgada de verdad.
  entry.mesh.removeFromParent();
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
  if (isCustomGeomKind(src.kind)) {
    extraOpts.geometryData = serializeGeometry(src.mesh.geometry);
  }
  if (src.kind === 'spline') extraOpts.closed = !!src.closed;
  const built = buildObject(src.kind, colorHex, extraOpts);
  built.node.position.copy(src.mesh.position).add(new THREE.Vector3(24, 0, 24));
  built.node.rotation.copy(src.mesh.rotation);
  built.node.scale.copy(src.mesh.scale);
  const copiedSculpt = isCustomGeomKind(src.kind) ? false : copySculptIfAny(src, built.node);
  scene.add(built.node);
  const newId = objIdCounter++;
  built.pickMesh.userData.ownerId = newId;
  sceneObjects.set(newId, { id: newId, kind: src.kind, mesh: built.node, pickMesh: built.pickMesh, visible: true, parentId: null, sculpted: copiedSculpt, name: src.name ? (src.name + ' (copia)') : null, collapsed: false, splinePoints: src.splinePoints ? src.splinePoints.map(p => p.clone()) : undefined, splineSharp: src.splineSharp ? src.splineSharp.slice() : undefined, closed: !!src.closed, latheSegments: src.latheSegments, latheCaps: src.latheCaps !== false, tubeRootRadius: src.tubeRootRadius, tubeTipRadius: src.tubeTipRadius, tubeRadialSegments: src.tubeRadialSegments, extrudeDepth: src.extrudeDepth, extrudeBevel: src.extrudeBevel, extrudeBevelSize: src.extrudeBevelSize, text: src.text, fontKey: src.fontKey, textSize: src.textSize, textDepth: src.textDepth, textBevel: src.textBevel, textBevelSize: src.textBevelSize });
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
  if (isCustomGeomKind(src.kind)) extraOpts.geometryData = serializeGeometry(src.mesh.geometry);

  // 1. Crear el objeto espejo con material idéntico
  const mirror = buildObject(src.kind, colorHex, extraOpts);
  mirror.node.position.set(0, 0, 0);
  mirror.node.rotation.set(src.mesh.rotation.x, -src.mesh.rotation.y, -src.mesh.rotation.z);
  mirror.node.scale.copy(src.mesh.scale);
  if (mirror.node.material && src.mesh.material) {
    mirror.node.material = src.mesh.material.clone();
    mirror.node.material.side = THREE.FrontSide;
    mirror.node.material.needsUpdate = true;
  }

  let copiedSculpt = false;
  if (src.kind !== 'hair' && mirror.node.geometry && src.mesh.geometry) {
    mirror.node.geometry = src.mesh.geometry.clone();
    const geo = mirror.node.geometry;
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) posAttr.setX(i, -posAttr.getX(i));
    
    // Invertir orden de vértices en los triángulos (winding) para que las normales apunten hacia afuera
    if (geo.index) {
      const idxArr = geo.index.array;
      for (let i = 0; i < idxArr.length; i += 3) {
        const tmp = idxArr[i + 1];
        idxArr[i + 1] = idxArr[i + 2];
        idxArr[i + 2] = tmp;
      }
      geo.index.needsUpdate = true;
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    copiedSculpt = !!src.sculpted;
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
const matSection = document.getElementById('matSection');
const dimRow = document.getElementById('dimRow');
const symPropsSection = document.getElementById('symPropsSection');
const clonerPropsSection = document.getElementById('clonerPropsSection');
const textPropsSection = document.getElementById('textPropsSection');

// Transform inputs
const posX = document.getElementById('posX');
const posY = document.getElementById('posY');
const posZ = document.getElementById('posZ');
const rotX = document.getElementById('rotX');
const rotY = document.getElementById('rotY');
const rotZ = document.getElementById('rotZ');
const sizeX = document.getElementById('sizeX');
const sizeY = document.getElementById('sizeY');
const sizeZ = document.getElementById('sizeZ');

function updateTransformInputs() {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry || !entry.mesh) return;

  if (document.activeElement && [posX, posY, posZ, rotX, rotY, rotZ, sizeX, sizeY, sizeZ].includes(document.activeElement)) {
    return;
  }

  const p = entry.mesh.position;
  if (posX) posX.value = p.x.toFixed(1).replace(/\.0$/, '');
  if (posY) posY.value = p.y.toFixed(1).replace(/\.0$/, '');
  if (posZ) posZ.value = p.z.toFixed(1).replace(/\.0$/, '');

  const r = entry.mesh.rotation;
  if (rotX) rotX.value = THREE.MathUtils.radToDeg(r.x).toFixed(1).replace(/\.0$/, '');
  if (rotY) rotY.value = THREE.MathUtils.radToDeg(r.y).toFixed(1).replace(/\.0$/, '');
  if (rotZ) rotZ.value = THREE.MathUtils.radToDeg(r.z).toFixed(1).replace(/\.0$/, '');

  if (entry.mesh.geometry) {
    if (!entry.mesh.geometry.boundingBox) entry.mesh.geometry.computeBoundingBox();
    const bb = entry.mesh.geometry.boundingBox;
    const baseW = Math.max(0.1, bb.max.x - bb.min.x);
    const baseH = Math.max(0.1, bb.max.y - bb.min.y);
    const baseD = Math.max(0.1, bb.max.z - bb.min.z);
    if (sizeX) sizeX.value = (baseW * Math.abs(entry.mesh.scale.x)).toFixed(1).replace(/\.0$/, '');
    if (sizeY) sizeY.value = (baseH * Math.abs(entry.mesh.scale.y)).toFixed(1).replace(/\.0$/, '');
    if (sizeZ) sizeZ.value = (baseD * Math.abs(entry.mesh.scale.z)).toFixed(1).replace(/\.0$/, '');
    if (dimRow) dimRow.style.display = 'flex';
  } else {
    if (dimRow) dimRow.style.display = 'none';
  }
}

// Input listeners for Transform & Dimensions
[posX, posY, posZ].forEach((inp, idx) => {
  if (!inp) return;
  const axes = ['x', 'y', 'z'];
  inp.addEventListener('input', () => {
    if (selectedId == null) return;
    const entry = sceneObjects.get(selectedId);
    if (!entry) return;
    const val = parseFloat(inp.value);
    if (!isNaN(val)) entry.mesh.position[axes[idx]] = val;
    refreshSplinePointHandles(); // si se esta editando una Curva/Revolucion/Tubo/Extrusion, sus bolitas tienen que seguir a la figura tambien al mover por numero (mismo motivo que Centrar/Al suelo)
  });
  inp.addEventListener('change', () => pushHistory());
});

[rotX, rotY, rotZ].forEach((inp, idx) => {
  if (!inp) return;
  const axes = ['x', 'y', 'z'];
  inp.addEventListener('input', () => {
    if (selectedId == null) return;
    const entry = sceneObjects.get(selectedId);
    if (!entry) return;
    const val = parseFloat(inp.value);
    if (!isNaN(val)) entry.mesh.rotation[axes[idx]] = THREE.MathUtils.degToRad(val);
    refreshSplinePointHandles();
  });
  inp.addEventListener('change', () => pushHistory());
});

[sizeX, sizeY, sizeZ].forEach((inp, idx) => {
  if (!inp) return;
  const axes = ['x', 'y', 'z'];
  inp.addEventListener('input', () => {
    if (selectedId == null) return;
    const entry = sceneObjects.get(selectedId);
    if (!entry || !entry.mesh.geometry) return;
    const val = parseFloat(inp.value);
    if (!isNaN(val) && val > 0) {
      if (!entry.mesh.geometry.boundingBox) entry.mesh.geometry.computeBoundingBox();
      const bb = entry.mesh.geometry.boundingBox;
      const baseSizes = [
        Math.max(0.1, bb.max.x - bb.min.x),
        Math.max(0.1, bb.max.y - bb.min.y),
        Math.max(0.1, bb.max.z - bb.min.z)
      ];
      
      const oldScale = entry.mesh.scale[axes[idx]];
      const oldSize = baseSizes[idx] * Math.abs(oldScale);
      const newScale = val / baseSizes[idx];
      const delta = (val - oldSize);

      // Crece manteniendo fija la base
      entry.mesh.position[axes[idx]] += delta / 2;
      entry.mesh.scale[axes[idx]] = newScale;

      if (snapEnabled) {
        applyLiveFurnitureSnap(selectedId);
      }
      updateTransformInputs();
      updateHandles(selectedId);
      refreshSplinePointHandles();
    }
  });
  inp.addEventListener('change', () => pushHistory());
});

transform.addEventListener('objectChange', () => {
  if (snapEnabled && selectedId != null) {
    applyLiveFurnitureSnap(selectedId);
  }
  updateTransformInputs();
});

// El gizmo clasico de TransformControls (los brazos de colores) y los
// tiradores directos en mm (las bolitas en el centro de cada cara) hacen
// lo mismo en modo Escalar -- tenerlos prendidos los dos a la vez hacia
// facil agarrar el equivocado sin darse cuenta. Esta funcion decide cual
// gizmo clasico mostrar (o ninguno) segun el modo actual; se usa en vez de
// repetir "transform.attach(...)" suelto en cada lugar que puede cambiar
// la seleccion o el modo.
function syncTransformGizmo(entry) {
  // En modo Curva el gizmo clasico (flechas de mover) no tiene sentido --
  // ahi se arrastran las bolitas de los puntos, no el objeto entero -- y
  // mostrarlo de encima solo ensucia la vista (se superponia con las
  // bolitas y la guia del eje). Mismo criterio que ya usan Esculpir/Pelo.
  if (entry && toolMode !== 'sculpt' && toolMode !== 'hair' && toolMode !== 'scale' && toolMode !== 'spline') {
    transform.attach(entry.mesh);
  } else {
    transform.detach();
  }
}

function selectObject(id) {
  selectedId = id;
  const entry = id != null ? sceneObjects.get(id) : null;
  if (entry) {
    syncTransformGizmo(entry);
    propsPanel.style.display = 'flex';
    if (noSelectionMsg) noSelectionMsg.style.display = 'none';

    // Update Transform & Dimensions
    updateTransformInputs();

    // Material properties
    if (entry.mesh.material) {
      if (matSection) matSection.style.display = 'block';
      propsColor.value = '#' + entry.mesh.material.color.getHexString();
      propsRoughness.value = entry.mesh.material.roughness != null ? entry.mesh.material.roughness : 0.5;
      propsMetalness.value = entry.mesh.material.metalness != null ? entry.mesh.material.metalness : 0.05;
      propsOpacity.value = entry.mesh.material.opacity != null ? entry.mesh.material.opacity : 1.0;
      propsWireframe.checked = !!entry.mesh.material.wireframe;
    } else {
      if (matSection) matSection.style.display = 'none';
    }

    // Symmetry modifier properties
    if (symPropsSection) {
      const isSym = entry.symmetrySourceId != null || (entry.parentId && sceneObjects.get(entry.parentId)?.symmetrySourceId != null);
      symPropsSection.style.display = isSym ? 'block' : 'none';
      if (isSym) {
        const symEntry = entry.symmetrySourceId != null ? entry : sceneObjects.get(entry.parentId);
        const symAxisSelect = document.getElementById('symAxisSelect');
        const symOffsetInput = document.getElementById('symOffsetInput');
        if (symAxisSelect) symAxisSelect.value = symEntry.symAxis || 'x';
        if (symOffsetInput) symOffsetInput.value = symEntry.symOffset || 0;
      }
    }

    // Cloner modifier properties
    if (clonerPropsSection) {
      const isCloner = entry.clonerMode != null || (entry.parentId && sceneObjects.get(entry.parentId)?.clonerMode != null);
      clonerPropsSection.style.display = isCloner ? 'block' : 'none';
      if (isCloner) {
        const clonerEntry = entry.clonerMode != null ? entry : sceneObjects.get(entry.parentId);
        const clonerModeSelect = document.getElementById('clonerModeSelect');
        const clonerCountInput = document.getElementById('clonerCountInput');
        const clonerCountVal = document.getElementById('clonerCountVal');
        const clonerSepX = document.getElementById('clonerSepX');
        const clonerSepY = document.getElementById('clonerSepY');
        const clonerSepZ = document.getElementById('clonerSepZ');
        const clonerRadiusInput = document.getElementById('clonerRadiusInput');
        const clonerRadiusVal = document.getElementById('clonerRadiusVal');
        const clonerRotCheck = document.getElementById('clonerRotCheck');
        const clonerLinearRow = document.getElementById('clonerLinearRow');
        const clonerCircularRow = document.getElementById('clonerCircularRow');

        if (clonerModeSelect) clonerModeSelect.value = clonerEntry.clonerMode || 'linear';
        if (clonerCountInput) clonerCountInput.value = clonerEntry.clonerCount || 3;
        if (clonerCountVal) clonerCountVal.textContent = clonerEntry.clonerCount || 3;
        if (clonerSepX) clonerSepX.value = clonerEntry.sepX != null ? clonerEntry.sepX : 80;
        if (clonerSepY) clonerSepY.value = clonerEntry.sepY != null ? clonerEntry.sepY : 0;
        if (clonerSepZ) clonerSepZ.value = clonerEntry.sepZ != null ? clonerEntry.sepZ : 0;
        if (clonerRadiusInput) clonerRadiusInput.value = clonerEntry.radius != null ? clonerEntry.radius : 120;
        if (clonerRadiusVal) clonerRadiusVal.textContent = clonerEntry.radius != null ? clonerEntry.radius : 120;
        if (clonerRotCheck) clonerRotCheck.checked = clonerEntry.rotCopies !== false;

        const isLinear = (clonerEntry.clonerMode || 'linear') === 'linear';
        if (clonerLinearRow) clonerLinearRow.style.display = isLinear ? 'flex' : 'none';
        if (clonerCircularRow) clonerCircularRow.style.display = isLinear ? 'none' : 'flex';
      }
    }

    // Generador de Revolucion (Lathe): el boton para aplicarlo solo tiene
    // sentido sobre una curva ('spline') todavia sin convertir; una vez
    // aplicado, en su lugar aparece el control en vivo de "Segmentos" --
    // mismo patron que Simetria/Clonador (parametros del generador
    // siempre editables despues en Atributos, no solo al crearlo).
    if (latheApplyBtn) latheApplyBtn.style.display = (entry.kind === 'spline') ? 'flex' : 'none';
    const latheSegmentsRow = document.getElementById('latheSegmentsRow');
    if (latheSegmentsRow) {
      latheSegmentsRow.style.display = (entry.kind === 'lathe') ? 'block' : 'none';
      if (entry.kind === 'lathe') {
        const latheSegmentsInput = document.getElementById('latheSegmentsInput');
        const latheSegmentsVal = document.getElementById('latheSegmentsVal');
        const segs = entry.latheSegments || 32;
        if (latheSegmentsInput) latheSegmentsInput.value = segs;
        if (latheSegmentsVal) latheSegmentsVal.textContent = segs;
        const latheCapsCheckEl = document.getElementById('latheCapsCheck');
        if (latheCapsCheckEl) latheCapsCheckEl.checked = (entry.latheCaps !== false); // por defecto prendido (igual que Cinema4D)
      }
    }

    // Generador de Tubo: mismo patron que Revolucion -- el boton para
    // aplicarlo aparece sobre una curva sin convertir todavia, y una vez
    // aplicado aparecen los 3 controles en vivo (grosor raiz/punta,
    // segmentos radiales) en su lugar.
    const tubeApplyBtnEl = document.getElementById('tubeApplyBtn');
    if (tubeApplyBtnEl) tubeApplyBtnEl.style.display = (entry.kind === 'spline') ? 'flex' : 'none';
    const tubeParamsRow = document.getElementById('tubeParamsRow');
    if (tubeParamsRow) {
      tubeParamsRow.style.display = (entry.kind === 'tube') ? 'block' : 'none';
      if (entry.kind === 'tube') {
        const tubeRootInput = document.getElementById('tubeRootRadiusInput');
        const tubeRootVal = document.getElementById('tubeRootRadiusVal');
        const tubeTipInput = document.getElementById('tubeTipRadiusInput');
        const tubeTipVal = document.getElementById('tubeTipRadiusVal');
        const tubeSegInput = document.getElementById('tubeRadialSegInput');
        const tubeSegVal = document.getElementById('tubeRadialSegVal');
        const root = entry.tubeRootRadius != null ? entry.tubeRootRadius : TUBE_DEFAULT_ROOT_RADIUS;
        const tip = entry.tubeTipRadius != null ? entry.tubeTipRadius : TUBE_DEFAULT_TIP_RADIUS;
        const segs = entry.tubeRadialSegments || TUBE_DEFAULT_RADIAL_SEGMENTS;
        if (tubeRootInput) tubeRootInput.value = root;
        if (tubeRootVal) tubeRootVal.textContent = root;
        if (tubeTipInput) tubeTipInput.value = tip;
        if (tubeTipVal) tubeTipVal.textContent = tip;
        if (tubeSegInput) tubeSegInput.value = segs;
        if (tubeSegVal) tubeSegVal.textContent = segs;
      }
    }

    // Generador de Extrusión: mismo patron -- boton sobre una curva
    // cerrada sin convertir, y una vez aplicado los controles en vivo de
    // profundidad y bisel en su lugar.
    const extrudeApplyBtnEl = document.getElementById('extrudeApplyBtn');
    if (extrudeApplyBtnEl) extrudeApplyBtnEl.style.display = (entry.kind === 'spline') ? 'flex' : 'none';
    const extrudeParamsRow = document.getElementById('extrudeParamsRow');
    if (extrudeParamsRow) {
      extrudeParamsRow.style.display = (entry.kind === 'extrude') ? 'block' : 'none';
      if (entry.kind === 'extrude') {
        const extrudeDepthInput = document.getElementById('extrudeDepthInput');
        const extrudeDepthVal = document.getElementById('extrudeDepthVal');
        const extrudeBevelCheck = document.getElementById('extrudeBevelCheck');
        const extrudeBevelSizeInput = document.getElementById('extrudeBevelSizeInput');
        const extrudeBevelSizeVal = document.getElementById('extrudeBevelSizeVal');
        const depth = entry.extrudeDepth != null ? entry.extrudeDepth : EXTRUDE_DEFAULT_DEPTH;
        const bsize = entry.extrudeBevelSize != null ? entry.extrudeBevelSize : EXTRUDE_DEFAULT_BEVEL_SIZE;
        if (extrudeDepthInput) extrudeDepthInput.value = depth;
        if (extrudeDepthVal) extrudeDepthVal.textContent = depth;
        if (extrudeBevelCheck) extrudeBevelCheck.checked = !!entry.extrudeBevel;
        if (extrudeBevelSizeInput) extrudeBevelSizeInput.value = bsize;
        if (extrudeBevelSizeVal) extrudeBevelSizeVal.textContent = bsize;
      }
    }

    // Texto 3D: contenido, tipografia, tamaño, profundidad y bisel, todo
    // editable en vivo (misma regla de siempre: todo parametro del
    // generador queda disponible despues en Atributos, no solo al crearlo).
    if (textPropsSection) {
      textPropsSection.style.display = (entry.kind === 'text') ? 'block' : 'none';
      if (entry.kind === 'text') {
        const textContentInput = document.getElementById('textContentInput');
        const textFontSelect = document.getElementById('textFontSelect');
        const textSizeInput = document.getElementById('textSizeInput');
        const textSizeVal = document.getElementById('textSizeVal');
        const textDepthInput = document.getElementById('textDepthInput');
        const textDepthVal = document.getElementById('textDepthVal');
        const textBevelCheck = document.getElementById('textBevelCheck');
        const textBevelSizeInput = document.getElementById('textBevelSizeInput');
        const textBevelSizeVal = document.getElementById('textBevelSizeVal');
        if (textContentInput) textContentInput.value = entry.text != null ? entry.text : TEXT_DEFAULT_TEXT;
        if (textFontSelect) textFontSelect.value = entry.fontKey || TEXT_DEFAULT_FONT;
        const size = entry.textSize != null ? entry.textSize : TEXT_DEFAULT_SIZE;
        const depth = entry.textDepth != null ? entry.textDepth : TEXT_DEFAULT_DEPTH;
        const bsize = entry.textBevelSize != null ? entry.textBevelSize : TEXT_DEFAULT_BEVEL_SIZE;
        if (textSizeInput) textSizeInput.value = size;
        if (textSizeVal) textSizeVal.textContent = size;
        if (textDepthInput) textDepthInput.value = depth;
        if (textDepthVal) textDepthVal.textContent = depth;
        if (textBevelCheck) textBevelCheck.checked = !!entry.textBevel;
        if (textBevelSizeInput) textBevelSizeInput.value = bsize;
        if (textBevelSizeVal) textBevelSizeVal.textContent = bsize;
      }
    }

    // Si estamos en modo Curva, mostrar/ocultar las bolitas de edicion de
    // puntos segun si lo seleccionado tiene puntos editables -- una Curva
    // sin convertir, o una ya convertida en Revolucion/Tubo/Extrusion (se
    // puede volver a entrar a ajustarla en cualquier momento).
    if (toolMode === 'spline') {
      if (canEditSplinePoints(entry)) startSplinePointEdit(id);
      else stopSplinePointEdit();
    }

  } else {
    transform.detach();
    propsPanel.style.display = 'none';
    if (noSelectionMsg) noSelectionMsg.style.display = 'block';
    if (toolMode === 'spline') stopSplinePointEdit();
  }
  updateHandles(id);
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
    if (entry && entry.mesh) {
      const val = parseFloat(propsOpacity.value);
      entry.mesh.traverse(child => {
        if (child.material) {
          child.material.opacity = val;
          child.material.transparent = val < 1.0;
          child.material.depthWrite = true;
          child.material.needsUpdate = true;
        }
      });
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
  updateHandles(selectedId); // los tiradores de Escalar quedan pegados a las caras -- si no se refrescan, se quedan flotando en el lugar viejo
  refreshSplinePointHandles(); // las bolitas de editar puntos de una Curva/Revolucion/Tubo/Extrusion tambien quedan pegadas al lugar viejo si no se refrescan (mismo motivo que los tiradores de Escalar)
  pushHistory();
});

alignGroundBtn.addEventListener('click', () => {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry || entry.kind === 'null') return;
  const box = new THREE.Box3().setFromObject(entry.mesh);
  const minY = box.min.y;
  entry.mesh.position.y -= minY;
  updateHandles(selectedId);
  refreshSplinePointHandles();
  pushHistory();
});

focusCamBtn.addEventListener('click', focusCameraOnSelection);

// --- Ajuste de Pivote / Eje (Base, Centro, Tope, Izquierda, Derecha, Frente) ---
function setPivot(id, alignX, alignY, alignZ) {
  if (id == null) return;
  const entry = sceneObjects.get(id);
  if (!entry) return;

  if (entry.kind === 'null') {
    // Para Nulo / Grupo / Clonador / Simetría
    const children = Array.from(sceneObjects.values()).filter(e => e.parentId === id);
    if (children.length === 0) return;

    const groupBBox = new THREE.Box3();
    children.forEach(c => groupBBox.expandByObject(c.mesh));

    const targetW = new THREE.Vector3();
    targetW.x = alignX === 'min' ? groupBBox.min.x : (alignX === 'max' ? groupBBox.max.x : (alignX === 'center' ? (groupBBox.min.x + groupBBox.max.x) / 2 : entry.mesh.position.x));
    targetW.y = alignY === 'min' ? groupBBox.min.y : (alignY === 'max' ? groupBBox.max.y : (alignY === 'center' ? (groupBBox.min.y + groupBBox.max.y) / 2 : entry.mesh.position.y));
    targetW.z = alignZ === 'min' ? groupBBox.min.z : (alignZ === 'max' ? groupBBox.max.z : (alignZ === 'center' ? (groupBBox.min.z + groupBBox.max.z) / 2 : entry.mesh.position.z));

    // Desacoplar temporalmente los hijos conservando su posición en el mundo
    children.forEach(c => scene.attach(c.mesh));
    entry.mesh.position.copy(targetW);
    // Re-acoplar los hijos bajo el nuevo centro del Nulo
    children.forEach(c => {
      entry.mesh.attach(c.mesh);
      c.parentId = id;
    });

  } else if (entry.mesh.geometry) {
    const geo = entry.mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox;

    // Punto de pivote objetivo en espacio local
    const targetOffset = new THREE.Vector3(
      alignX === 'min' ? bb.min.x : (alignX === 'max' ? bb.max.x : (alignX === 'center' ? (bb.min.x + bb.max.x) / 2 : 0)),
      alignY === 'min' ? bb.min.y : (alignY === 'max' ? bb.max.y : (alignY === 'center' ? (bb.min.y + bb.max.y) / 2 : 0)),
      alignZ === 'min' ? bb.min.z : (alignZ === 'max' ? bb.max.z : (alignZ === 'center' ? (bb.min.z + bb.max.z) / 2 : 0))
    );

    if (targetOffset.lengthSq() > 0.00001) {
      geo.translate(-targetOffset.x, -targetOffset.y, -targetOffset.z);
      if (geo.attributes.position) geo.attributes.position.needsUpdate = true;
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      geo.computeVertexNormals();
      entry.sculpted = true; // Guarda los vértices modificados en el snapshot

      // Si es una Curva/Revolucion/Tubo/Extrusion, sus puntos de control
      // (entry.splinePoints) tambien estan en espacio LOCAL -- si no se
      // corren junto con la geometria, quedan desalineados del nuevo
      // origen y la proxima vez que se arrastre/agregue/saque un punto
      // (regenerateEntryFromPoints) el solido se reconstruye desde el
      // origen VIEJO, haciendo que la figura "salte" de lugar.
      if (entry.splinePoints) {
        entry.splinePoints.forEach(p => p.sub(targetOffset));
      }

      // Compensar la posición del objeto para que visualmente permanezca en su lugar exacto
      const deltaWorld = targetOffset.clone().applyEuler(entry.mesh.rotation).multiply(entry.mesh.scale);
      entry.mesh.position.add(deltaWorld);
    }
  }

  syncTransformGizmo(entry);
  updateHandles(selectedId); // cambiar el pivote tambien mueve la figura -- refrescar los tiradores igual que en Centrar/Al suelo
  refreshSplinePointHandles(); // idem para las bolitas de editar puntos de una Curva/Revolucion/Tubo/Extrusion
  updateTransformInputs();
  pushHistory();
}

const pivotBaseBtn = document.getElementById('pivotBaseBtn');
const pivotCenterBtn = document.getElementById('pivotCenterBtn');
const pivotTopBtn = document.getElementById('pivotTopBtn');
const pivotLeftBtn = document.getElementById('pivotLeftBtn');
const pivotRightBtn = document.getElementById('pivotRightBtn');
const pivotFrontBtn = document.getElementById('pivotFrontBtn');

if (pivotBaseBtn) pivotBaseBtn.addEventListener('click', () => setPivot(selectedId, null, 'min', null));
if (pivotCenterBtn) pivotCenterBtn.addEventListener('click', () => setPivot(selectedId, 'center', 'center', 'center'));
if (pivotTopBtn) pivotTopBtn.addEventListener('click', () => setPivot(selectedId, null, 'max', null));
if (pivotLeftBtn) pivotLeftBtn.addEventListener('click', () => setPivot(selectedId, 'min', null, null));
if (pivotRightBtn) pivotRightBtn.addEventListener('click', () => setPivot(selectedId, 'max', null, null));
if (pivotFrontBtn) pivotFrontBtn.addEventListener('click', () => setPivot(selectedId, null, null, 'max'));

// // =====================================================================
// 3D REAL-TIME DIMENSION & DISTANCE HUD + INTERACTIVE TIRADORES (HANDLES)
// =====================================================================
const dimensionHud = document.getElementById('dimensionHud');

// Línea punteada 3D para medir distancias y holguras
const dashedLinePositions = new Float32Array(6);
const dashedLineGeo = new THREE.BufferGeometry();
dashedLineGeo.setAttribute('position', new THREE.BufferAttribute(dashedLinePositions, 3));
const dashedLineMat = new THREE.LineDashedMaterial({
  color: 0x00e5ff,
  dashSize: 6,
  gapSize: 4,
  depthTest: false,
  transparent: true,
  opacity: 0.95
});
const dashedGuideLine = new THREE.Line(dashedLineGeo, dashedLineMat);
dashedGuideLine.visible = false;
dashedGuideLine.renderOrder = 999;
scene.add(dashedGuideLine);

function setDashedLine(p1, p2) {
  dashedLinePositions[0] = p1.x;
  dashedLinePositions[1] = p1.y;
  dashedLinePositions[2] = p1.z;
  dashedLinePositions[3] = p2.x;
  dashedLinePositions[4] = p2.y;
  dashedLinePositions[5] = p2.z;
  dashedLineGeo.attributes.position.needsUpdate = true;
  dashedGuideLine.computeLineDistances();
  dashedGuideLine.visible = true;
}

function hideDashedLine() {
  if (dashedGuideLine) dashedGuideLine.visible = false;
}

// Proyección de 3D a coordenadas 2D del Canvas
function project3DToScreen(worldPos) {
  if (!worldPos) return { x: -9999, y: -9999, visible: false };
  const p = worldPos.clone().project(activeCamera);
  const rect = wrap.getBoundingClientRect();
  const x = (p.x * 0.5 + 0.5) * rect.width;
  const y = (-(p.y * 0.5) + 0.5) * rect.height;
  return { x, y, visible: p.z < 1 };
}

let activeHudBadges = [];

function clearDimensionHUD() {
  if (dimensionHud) dimensionHud.innerHTML = '';
  activeHudBadges = [];
  hideDashedLine();
  hideSnapGuides();
}

function showHudBadge(id, text, worldPos, type = 'size', isTope = false) {
  if (!dimensionHud) return;
  let badge = document.getElementById(`hud_badge_${id}`);
  if (!badge) {
    badge = document.createElement('div');
    badge.id = `hud_badge_${id}`;
    badge.className = `hud-badge hud-badge-${type}`;
    dimensionHud.appendChild(badge);
  }
  badge.className = `hud-badge hud-badge-${type}` + (isTope ? ' tope' : '') + (type === 'size' ? ' active-orange' : '');
  badge.innerHTML = text;
  badge.dataset.worldX = worldPos.x;
  badge.dataset.worldY = worldPos.y;
  badge.dataset.worldZ = worldPos.z;

  const screen = project3DToScreen(worldPos);
  if (screen.visible) {
    badge.style.display = 'flex';
    badge.style.left = `${screen.x}px`;
    badge.style.top = `${screen.y}px`;
  } else {
    badge.style.display = 'none';
  }

  if (!activeHudBadges.includes(badge)) activeHudBadges.push(badge);
}

function updateHUDPositions() {
  if (activeHudBadges.length === 0) return;
  activeHudBadges.forEach(badge => {
    const wx = parseFloat(badge.dataset.worldX);
    const wy = parseFloat(badge.dataset.worldY);
    const wz = parseFloat(badge.dataset.worldZ);
    if (!isNaN(wx)) {
      const screen = project3DToScreen(new THREE.Vector3(wx, wy, wz));
      if (screen.visible) {
        badge.style.display = 'flex';
        badge.style.left = `${screen.x}px`;
        badge.style.top = `${screen.y}px`;
      } else {
        badge.style.display = 'none';
      }
    }
  });
}

// --- Guías Visuales de Contacto Magnético (Imán Celeste #00e5ff) ---
const snapGuideGeo = new THREE.BoxGeometry(1, 1, 1);
const snapGuideMat = new THREE.MeshBasicMaterial({
  color: 0x00e5ff,
  wireframe: true,
  transparent: true,
  opacity: 0.95,
  depthTest: false
});
const snapGuideMesh = new THREE.Mesh(snapGuideGeo, snapGuideMat);
snapGuideMesh.visible = false;
snapGuideMesh.renderOrder = 999;
scene.add(snapGuideMesh);

const snapPlaneGeo = new THREE.PlaneGeometry(1, 1);
const snapPlaneMat = new THREE.MeshBasicMaterial({
  color: 0x00e5ff,
  transparent: true,
  opacity: 0.45,
  side: THREE.DoubleSide,
  depthTest: false
});
const snapPlaneMesh = new THREE.Mesh(snapPlaneGeo, snapPlaneMat);
snapPlaneMesh.visible = false;
snapPlaneMesh.renderOrder = 998;
scene.add(snapPlaneMesh);

function showSnapGuide(contactBox) {
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  contactBox.getCenter(center);
  contactBox.getSize(size);

  snapGuideMesh.position.copy(center);
  snapGuideMesh.scale.set(Math.max(1, size.x), Math.max(1, size.y), Math.max(1, size.z));
  snapGuideMesh.visible = true;

  snapPlaneMesh.position.copy(center);
  snapPlaneMesh.scale.set(Math.max(1, size.x || size.z), Math.max(1, size.y || size.z));
  snapPlaneMesh.visible = true;
}

function hideSnapGuides() {
  if (snapGuideMesh) snapGuideMesh.visible = false;
  if (snapPlaneMesh) snapPlaneMesh.visible = false;
}

// =====================================================================
// INTERACTIVE FACE/EDGE HANDLES (TIRADORES 3D DIRECTOS)
// =====================================================================
const handleGroup = new THREE.Group();
handleGroup.renderOrder = 997;
scene.add(handleGroup);

const handleDefinitions = [
  { id: 'handle_right',  axis: 'x', dir: 1,  name: 'Der',   color: 0xeb5757 },
  { id: 'handle_left',   axis: 'x', dir: -1, name: 'Izq',   color: 0xeb5757 },
  { id: 'handle_top',    axis: 'y', dir: 1,  name: 'Arriba',color: 0x27ae60 },
  { id: 'handle_bottom', axis: 'y', dir: -1, name: 'Abajo', color: 0x27ae60 },
  { id: 'handle_front',  axis: 'z', dir: 1,  name: 'Frente',color: 0x2d9cdb },
  { id: 'handle_back',   axis: 'z', dir: -1, name: 'Atrás', color: 0x2d9cdb }
];

const handleMeshes = [];
const handleGeo = new THREE.BoxGeometry(6, 6, 6);

handleDefinitions.forEach(def => {
  const mat = new THREE.MeshBasicMaterial({
    color: def.color,
    depthTest: false,
    transparent: true,
    opacity: 0.95
  });
  const mesh = new THREE.Mesh(handleGeo, mat);
  mesh.userData = { isHandle: true, def };
  
  const wireGeo = new THREE.EdgesGeometry(handleGeo);
  const wireMat = new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false });
  const wire = new THREE.LineSegments(wireGeo, wireMat);
  mesh.add(wire);

  handleGroup.add(mesh);
  handleMeshes.push(mesh);
});

function updateHandles(id) {
  if (id == null) {
    handleGroup.visible = false;
    return;
  }
  // Tiradores SOLO en modo Escalar
  if (toolMode !== 'scale') {
    handleGroup.visible = false;
    return;
  }
  const entry = sceneObjects.get(id);
  if (!entry || entry.kind === 'null' || !entry.mesh.geometry) {
    handleGroup.visible = false;
    return;
  }

  const geo = entry.mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;

  const lCenter = new THREE.Vector3(
    (bb.min.x + bb.max.x) / 2,
    (bb.min.y + bb.max.y) / 2,
    (bb.min.z + bb.max.z) / 2
  );

  entry.mesh.updateMatrixWorld(true);

  handleMeshes.forEach(mesh => {
    const def = mesh.userData.def;
    const lPos = lCenter.clone();
    if (def.axis === 'x') lPos.x = (def.dir === 1 ? bb.max.x : bb.min.x);
    else if (def.axis === 'y') lPos.y = (def.dir === 1 ? bb.max.y : bb.min.y);
    else if (def.axis === 'z') lPos.z = (def.dir === 1 ? bb.max.z : bb.min.z);

    const wPos = lPos.clone().applyMatrix4(entry.mesh.matrixWorld);
    mesh.position.copy(wPos);
    mesh.quaternion.copy(entry.mesh.quaternion);
  });

  handleGroup.visible = true;
}

// Estado de Arrastre de Tiradores
let isDraggingHandle = false;
let activeDragHandle = null;
let dragStartPointer = { clientX: 0, clientY: 0 };
let dragStartPos = new THREE.Vector3();
let dragStartScale = new THREE.Vector3();
let dragStartSize = 100;
let dragBaseDimensions = { w: 100, h: 100, d: 100 };
let dragScreenDir = new THREE.Vector2();
let dragMmPerPixel = 1;
// Cara OPUESTA a la que se esta arrastrando (ver comentario en
// startHandleDrag): es la que se mantiene fija en su lugar mientras se
// redimensiona, sin importar donde este puesto el pivot en ese momento.
let dragAnchorLocal = 0;
let dragAnchorPos = 0;

function startHandleDrag(handleMesh, clientX, clientY) {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry || !entry.mesh.geometry) return;

  isDraggingHandle = true;
  activeDragHandle = handleMesh.userData.def;
  orbit.enabled = false;
  transform.detach();

  // Ocultar los otros tiradores durante el arrastre para no saturar la vista
  handleMeshes.forEach(m => {
    m.visible = (m === handleMesh);
  });

  dragStartPointer = { clientX, clientY };
  dragStartPos.copy(entry.mesh.position);
  dragStartScale.copy(entry.mesh.scale);

  const bb = entry.mesh.geometry.boundingBox || new THREE.Box3().setFromBufferAttribute(entry.mesh.geometry.attributes.position);
  dragBaseDimensions = {
    w: Math.max(0.1, bb.max.x - bb.min.x),
    h: Math.max(0.1, bb.max.y - bb.min.y),
    d: Math.max(0.1, bb.max.z - bb.min.z)
  };

  const axis = activeDragHandle.axis;
  const baseSize = axis === 'x' ? dragBaseDimensions.w : (axis === 'y' ? dragBaseDimensions.h : dragBaseDimensions.d);
  dragStartSize = baseSize * Math.abs(dragStartScale[axis]);

  // Cada bolita tiene que redimensionar HACIA SU LADO, dejando fija la cara
  // OPUESTA -- sin importar donde este puesto el pivot actual (Base/Centro/
  // Izq/Der/etc. en "Mover Eje/Pivote"). Antes se dejaba fijo el PIVOT en
  // vez de la cara opuesta: con pivot Centro eso hacia que arrastrar
  // cualquier bolita estirara la figura de los DOS lados a la vez (ya que
  // ambas caras estan a la misma distancia del centro); con el pivot en un
  // costado, la bolita de ESE costado no hacia nada notorio (esa cara
  // coincide con el pivot, que nunca se mueve) y la bolita del otro
  // extremo estiraba raro. Fijar la cara opuesta a la que se arrastra
  // (en vez de fijar el pivot) es lo que se espera de un tirador de
  // redimensionar en cualquier programa de diseño, y funciona igual sin
  // importar el pivot elegido.
  const dir = activeDragHandle.dir;
  dragAnchorLocal = (dir === 1) ? bb.min[axis] : bb.max[axis];
  dragAnchorPos = dragStartPos[axis] + dragAnchorLocal * dragStartScale[axis];

  // Vector unitario 3D del tirador en coordenadas del mundo
  const handleDirWorld = new THREE.Vector3();
  if (axis === 'x') handleDirWorld.set(activeDragHandle.dir, 0, 0);
  else if (axis === 'y') handleDirWorld.set(0, activeDragHandle.dir, 0);
  else handleDirWorld.set(0, 0, activeDragHandle.dir);
  handleDirWorld.applyQuaternion(entry.mesh.quaternion).normalize();

  // Proyectar este vector a la pantalla para mapear el movimiento del cursor 1:1 en mm
  const p0 = project3DToScreen(handleMesh.position);
  const p1 = project3DToScreen(handleMesh.position.clone().add(handleDirWorld.clone().multiplyScalar(50)));
  const screenVec = new THREE.Vector2(p1.x - p0.x, p1.y - p0.y);
  const screenLen = screenVec.length();
  if (screenLen > 0.001) {
    dragScreenDir.copy(screenVec).normalize();
    dragMmPerPixel = 50 / screenLen;
  } else {
    dragScreenDir.set(1, 0);
    dragMmPerPixel = 1;
  }
}

function onHandleDrag(clientX, clientY) {
  if (!isDraggingHandle || !activeDragHandle || selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry) return;

  const def = activeDragHandle;
  const axis = def.axis;
  const dir  = def.dir;

  // Delta del mouse proyectado sobre la dirección del eje en pantalla
  const mouseDelta = new THREE.Vector2(
    clientX - dragStartPointer.clientX,
    clientY - dragStartPointer.clientY
  );
  const deltaPixels = mouseDelta.dot(dragScreenDir);
  let deltaMM = deltaPixels * dragMmPerPixel;

  // Nuevo tamaño crudo
  let newSize = Math.max(1, dragStartSize + deltaMM);
  if (snapEnabled) {
    newSize = Math.max(snapGridStep, Math.round(newSize / snapGridStep) * snapGridStep);
  }

  const baseSize = axis === 'x' ? dragBaseDimensions.w
                 : axis === 'y' ? dragBaseDimensions.h
                 : dragBaseDimensions.d;

  // ── Lógica de anclaje en la CARA OPUESTA ─────────────────────────────────
  // dragAnchorLocal/dragAnchorPos (calculados una vez en startHandleDrag)
  // son la cara de ENFRENTE de la que se está arrastrando -- es la que se
  // mantiene fija en su lugar mientras se redimensiona, sin importar dónde
  // esté puesto el pivot actual. Ver el comentario largo en startHandleDrag.
  const bb = entry.mesh.geometry.boundingBox;

  // Escala nueva
  const newScale = newSize / baseSize;
  entry.mesh.scale[axis] = newScale;

  // La cara opuesta (el ancla) es la que NO se mueve -- se recalcula la
  // posición para que, con la escala nueva, esa cara quede exactamente
  // donde estaba antes de empezar a arrastrar.
  entry.mesh.position[axis] = dragAnchorPos - dragAnchorLocal * newScale;

  // Borde activo en world-space (para HUD y snap)
  entry.mesh.updateMatrixWorld(true);
  const currentBox = new THREE.Box3().setFromObject(entry.mesh);
  const currentEdgePos = dir === 1 ? currentBox.max[axis] : currentBox.min[axis];

  // ── Snap a borde vecino ───────────────────────────────────────────────────
  const snapDist = snapEnabled ? (snapGridStep || 10) : 6;
  let nearestTargetEdge = null;
  let minRemDist = Infinity;

  sceneObjects.forEach((other, otherId) => {
    if (otherId === selectedId || other.kind === 'null' || !other.visible) return;
    if (isDescendantOf(otherId, selectedId) || isDescendantOf(selectedId, otherId)) return;
    const boxB = new THREE.Box3().setFromObject(other.mesh);
    const candidates = [boxB.min[axis], boxB.max[axis]];
    if (axis === 'y') candidates.push(0);
    candidates.forEach(targetVal => {
      const rem = Math.abs(targetVal - currentEdgePos);
      if (rem < minRemDist) { minRemDist = rem; nearestTargetEdge = targetVal; }
    });
  });

  let isTope = false;
  if (nearestTargetEdge !== null && minRemDist <= snapDist) {
    isTope = true;
    // Igual que arriba, pero calculando qué escala hace que el borde
    // arrastrado llegue EXACTO al borde vecino, mantiniendo la cara
    // opuesta (el ancla) fija: borde_arrastrado = ancla_pos + dir *
    // baseSize * scale (la distancia entre ambas caras en espacio local
    // es siempre baseSize, sea cual sea el lado que se esté arrastrando).
    if (baseSize > 0.001) {
      const requiredScale = (dir * (nearestTargetEdge - dragAnchorPos)) / baseSize;
      if (requiredScale > 0.001) {
        newSize = requiredScale * baseSize;
        entry.mesh.scale[axis] = requiredScale;
        entry.mesh.position[axis] = dragAnchorPos - dragAnchorLocal * requiredScale;
        entry.mesh.updateMatrixWorld(true);
      }
    }
    minRemDist = 0;
  }

  // ── HUD badges ───────────────────────────────────────────────────────────
  entry.mesh.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(entry.mesh);
  const finalEdgePos = dir === 1 ? finalBox.max[axis] : finalBox.min[axis];
  const hudCenter = finalBox.getCenter(new THREE.Vector3());
  const handlePos = hudCenter.clone();
  handlePos[axis] = finalEdgePos;

  showHudBadge('size', `${Math.round(newSize)} <span class="hud-icon">✎</span>`, handlePos, 'size');

  if (nearestTargetEdge !== null) {
    const p1 = handlePos.clone();
    const p2 = handlePos.clone();
    p2[axis] = nearestTargetEdge;
    setDashedLine(p1, p2);
    const midPos = p1.clone().add(p2).multiplyScalar(0.5);
    showHudBadge('rem', isTope ? `0 TOPE` : `${Math.round(minRemDist)} mm`, midPos, 'rem', isTope);
  } else {
    hideDashedLine();
    const b = document.getElementById('hud_badge_rem');
    if (b) b.style.display = 'none';
  }

  updateHandles(selectedId);
  updateTransformInputs();
}

function stopHandleDrag() {
  if (!isDraggingHandle) return;
  isDraggingHandle = false;
  activeDragHandle = null;
  orbit.enabled = true;
  handleMeshes.forEach(m => { m.visible = true; });
  clearDimensionHUD();
  if (selectedId != null) {
    const entry = sceneObjects.get(selectedId);
    syncTransformGizmo(entry);
    updateHandles(selectedId);
  }
  pushHistory();
}

function applyLiveFurnitureSnap(id) {
  const entry = sceneObjects.get(id);
  if (!entry || entry.kind === 'null') {
    hideSnapGuides();
    return;
  }

  const snapDist = snapGridStep || 10;
  const boxA = new THREE.Box3().setFromObject(entry.mesh);
  let snapped = false;
  let snapContactBox = null;

  // 1. Snap al suelo (Y = 0)
  if (Math.abs(boxA.min.y) <= snapDist) {
    const diff = boxA.min.y;
    entry.mesh.position.y -= diff;
    boxA.min.y -= diff;
    boxA.max.y -= diff;
    snapped = true;
    snapContactBox = new THREE.Box3(
      new THREE.Vector3(boxA.min.x, -0.5, boxA.min.z),
      new THREE.Vector3(boxA.max.x, 0.5, boxA.max.z)
    );
  }

  // 2. Snap magnético de caras y esquinas a otros objetos vecinos
  sceneObjects.forEach((other, otherId) => {
    if (otherId === id || other.kind === 'null' || !other.visible) return;
    if (isDescendantOf(otherId, id) || isDescendantOf(id, otherId)) return;

    const boxB = new THREE.Box3().setFromObject(other.mesh);

    const overlapX = (boxA.min.x < boxB.max.x + snapDist) && (boxA.max.x > boxB.min.x - snapDist);
    const overlapY = (boxA.min.y < boxB.max.y + snapDist) && (boxA.max.y > boxB.min.y - snapDist);
    const overlapZ = (boxA.min.z < boxB.max.z + snapDist) && (boxA.max.z > boxB.min.z - snapDist);

    // X Face contact
    if (overlapY && overlapZ) {
      if (Math.abs(boxA.max.x - boxB.min.x) <= snapDist) {
        const diff = boxA.max.x - boxB.min.x;
        entry.mesh.position.x -= diff;
        boxA.min.x -= diff; boxA.max.x -= diff;
        snapped = true;
        snapContactBox = new THREE.Box3(
          new THREE.Vector3(boxB.min.x - 0.5, Math.max(boxA.min.y, boxB.min.y), Math.max(boxA.min.z, boxB.min.z)),
          new THREE.Vector3(boxB.min.x + 0.5, Math.min(boxA.max.y, boxB.max.y), Math.min(boxA.max.z, boxB.max.z))
        );
      } else if (Math.abs(boxA.min.x - boxB.max.x) <= snapDist) {
        const diff = boxA.min.x - boxB.max.x;
        entry.mesh.position.x -= diff;
        boxA.min.x -= diff; boxA.max.x -= diff;
        snapped = true;
        snapContactBox = new THREE.Box3(
          new THREE.Vector3(boxB.max.x - 0.5, Math.max(boxA.min.y, boxB.min.y), Math.max(boxA.min.z, boxB.min.z)),
          new THREE.Vector3(boxB.max.x + 0.5, Math.min(boxA.max.y, boxB.max.y), Math.min(boxA.max.z, boxB.max.z))
        );
      }
    }

    // Y Face contact (apilado de muebles / tablas)
    if (overlapX && overlapZ) {
      if (Math.abs(boxA.min.y - boxB.max.y) <= snapDist) {
        const diff = boxA.min.y - boxB.max.y;
        entry.mesh.position.y -= diff;
        boxA.min.y -= diff; boxA.max.y -= diff;
        snapped = true;
        snapContactBox = new THREE.Box3(
          new THREE.Vector3(Math.max(boxA.min.x, boxB.min.x), boxB.max.y - 0.5, Math.max(boxA.min.z, boxB.min.z)),
          new THREE.Vector3(Math.min(boxA.max.x, boxB.max.x), boxB.max.y + 0.5, Math.min(boxA.max.z, boxB.max.z))
        );
      } else if (Math.abs(boxA.max.y - boxB.min.y) <= snapDist) {
        const diff = boxA.max.y - boxB.min.y;
        entry.mesh.position.y -= diff;
        boxA.min.y -= diff; boxA.max.y -= diff;
        snapped = true;
        snapContactBox = new THREE.Box3(
          new THREE.Vector3(Math.max(boxA.min.x, boxB.min.x), boxB.min.y - 0.5, Math.max(boxA.min.z, boxB.min.z)),
          new THREE.Vector3(Math.min(boxA.max.x, boxB.max.x), boxB.min.y + 0.5, Math.min(boxA.max.z, boxB.max.z))
        );
      }
    }

    // Z Face contact
    if (overlapX && overlapY) {
      if (Math.abs(boxA.max.z - boxB.min.z) <= snapDist) {
        const diff = boxA.max.z - boxB.min.z;
        entry.mesh.position.z -= diff;
        boxA.min.z -= diff; boxA.max.z -= diff;
        snapped = true;
        snapContactBox = new THREE.Box3(
          new THREE.Vector3(Math.max(boxA.min.x, boxB.min.x), Math.max(boxA.min.y, boxB.min.y), boxB.min.z - 0.5),
          new THREE.Vector3(Math.min(boxA.max.x, boxB.max.x), Math.min(boxA.max.y, boxB.max.y), boxB.min.z + 0.5)
        );
      } else if (Math.abs(boxA.min.z - boxB.max.z) <= snapDist) {
        const diff = boxA.min.z - boxB.max.z;
        entry.mesh.position.z -= diff;
        boxA.min.z -= diff; boxA.max.z -= diff;
        snapped = true;
        snapContactBox = new THREE.Box3(
          new THREE.Vector3(Math.max(boxA.min.x, boxB.min.x), Math.max(boxA.min.y, boxB.min.y), boxB.max.z - 0.5),
          new THREE.Vector3(Math.min(boxA.max.x, boxB.max.x), Math.min(boxA.max.y, boxB.max.y), boxB.min.z + 0.5)
        );
      }
    }
  });

  if (snapped && snapContactBox) {
    showSnapGuide(snapContactBox);
  } else {
    hideSnapGuides();
  }
}

// --- Modo Imán (Snapping) ---
let snapEnabled = false;
let snapGridStep = 10;
const snapToggleBtn = document.getElementById('snapToggleBtn');
const snapGridSelect = document.getElementById('snapGridSelect');

function updateSnapping() {
  if (snapEnabled) {
    transform.setTranslationSnap(snapGridStep);
    transform.setRotationSnap(THREE.MathUtils.degToRad(15));
  } else {
    transform.setTranslationSnap(null);
    transform.setRotationSnap(null);
    hideSnapGuides();
  }
}

if (snapToggleBtn) {
  snapToggleBtn.addEventListener('click', () => {
    snapEnabled = !snapEnabled;
    snapToggleBtn.textContent = snapEnabled ? '🧲 Imán: ON' : '🧲 Imán: OFF';
    snapToggleBtn.classList.toggle('active-cyan', snapEnabled);
    updateSnapping();
  });
}

if (snapGridSelect) {
  snapGridSelect.addEventListener('change', () => {
    snapGridStep = parseFloat(snapGridSelect.value) || 10;
    updateSnapping();
  });
}

transform.addEventListener('dragging-changed', (e) => {
  orbit.enabled = !e.value;
  if (!e.value) {
    if (snapEnabled && selectedId != null) {
      applyLiveFurnitureSnap(selectedId);
    }
    clearDimensionHUD();
    pushHistory();
  }
});

// Medición de separación en vivo durante el desplazamiento (Translate)
transform.addEventListener('objectChange', () => {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry || entry.kind === 'null') return;

  if (snapEnabled) {
    applyLiveFurnitureSnap(selectedId);
  }
  updateTransformInputs();
  updateHandles(selectedId);

  // Si estamos moviendo (Translate), calcular distancia al mueble/piso más cercano
  if (toolMode === 'translate') {
    const boxA = new THREE.Box3().setFromObject(entry.mesh);
    const centerA = boxA.getCenter(new THREE.Vector3());

    let closestDist = Infinity;
    let pointStart = null;
    let pointEnd = null;

    // Distancia vertical a tabla inferior o suelo
    sceneObjects.forEach((other, otherId) => {
      if (otherId === selectedId || other.kind === 'null' || !other.visible) return;
      if (isDescendantOf(otherId, selectedId) || isDescendantOf(selectedId, otherId)) return;

      const boxB = new THREE.Box3().setFromObject(other.mesh);
      const overlapXZ = (boxA.min.x < boxB.max.x) && (boxA.max.x > boxB.min.x) && (boxA.min.z < boxB.max.z) && (boxA.max.z > boxB.min.z);

      if (overlapXZ && boxA.min.y >= boxB.max.y) {
        const gap = boxA.min.y - boxB.max.y;
        if (gap < closestDist) {
          closestDist = gap;
          pointStart = new THREE.Vector3(centerA.x, boxB.max.y, centerA.z);
          pointEnd = new THREE.Vector3(centerA.x, boxA.min.y, centerA.z);
        }
      }
    });

    if (!pointStart && boxA.min.y > 0) {
      closestDist = boxA.min.y;
      pointStart = new THREE.Vector3(centerA.x, 0, centerA.z);
      pointEnd = new THREE.Vector3(centerA.x, boxA.min.y, centerA.z);
    }

    if (pointStart && pointEnd && closestDist > 0.5) {
      setDashedLine(pointStart, pointEnd);
      const midPos = pointStart.clone().add(pointEnd).multiplyScalar(0.5);
      showHudBadge('dist', `${Math.round(closestDist)} mm`, midPos, 'dist');
    } else {
      hideDashedLine();
      const b = document.getElementById('hud_badge_dist');
      if (b) b.style.display = 'none';
    }
  }
});

// --- Modificador Simetría en Vivo ---
const symAxisSelect = document.getElementById('symAxisSelect');
const symOffsetInput = document.getElementById('symOffsetInput');
const symBakeBtn = document.getElementById('symBakeBtn');

// Convierte 'x'/'y'/'z' al indice 0/1/2 que usan .getX/.getY/.getZ, etc.
function symAxisIndex(axis) {
  return axis === 'y' ? 1 : (axis === 'z' ? 2 : 0);
}

// Vuelve a armar la geometria del espejo, invertida sobre el eje elegido en
// symEntry.symAxis, a partir de la geometria ACTUAL de la figura original
// (asi conserva cualquier esculpido que tenga el original, igual que al
// crear la simetria por primera vez). Antes, "Eje de Espejo" solo guardaba
// el valor elegido pero nunca volvia a armar el espejo -- por eso cambiar
// de X a Y o Z no cambiaba nada en pantalla.
function remirrorSymmetry(symEntry) {
  const srcId = symEntry.symmetrySourceId;
  const src = sceneObjects.get(srcId);
  if (!src) return;
  if (isCustomGeomKind(src.kind)) return; // el pelo/curva/revolucion no tienen una formula fija -- no se pueden re-espejar sin repetir el trazo/generador
  let mirrorEntry = null;
  sceneObjects.forEach(e => { if (e.parentId === symEntry.id && e.isMirrorOf === srcId) mirrorEntry = e; });
  if (!mirrorEntry || !mirrorEntry.mesh.geometry || !src.mesh.geometry) return;

  const ax = symAxisIndex(symEntry.symAxis);
  const geo = src.mesh.geometry.clone();
  const posAttr = geo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    if (ax === 0) posAttr.setX(i, -posAttr.getX(i));
    else if (ax === 1) posAttr.setY(i, -posAttr.getY(i));
    else posAttr.setZ(i, -posAttr.getZ(i));
  }
  // Invertir el orden de vertices en los triangulos (winding) para que las
  // normales sigan apuntando hacia afuera -- espejar sobre CUALQUIER eje
  // invierte la orientacion (handedness) del mismo modo, asi que el arreglo
  // es el mismo sin importar cual eje se haya elegido.
  if (geo.index) {
    const idxArr = geo.index.array;
    for (let i = 0; i < idxArr.length; i += 3) {
      const tmp = idxArr[i + 1];
      idxArr[i + 1] = idxArr[i + 2];
      idxArr[i + 2] = tmp;
    }
    geo.index.needsUpdate = true;
  }
  posAttr.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  mirrorEntry.mesh.geometry.dispose();
  mirrorEntry.mesh.geometry = geo;
  mirrorEntry.sculpted = !!src.sculpted;
}

if (symAxisSelect) {
  symAxisSelect.addEventListener('change', () => {
    if (selectedId == null) return;
    const entry = sceneObjects.get(selectedId);
    const symEntry = (entry && entry.symmetrySourceId != null) ? entry : (entry?.parentId ? sceneObjects.get(entry.parentId) : null);
    if (symEntry && symEntry.symmetrySourceId != null) {
      symEntry.symAxis = symAxisSelect.value;
      // Cambiar el eje no solo tiene que afectar hacia donde se mueve el
      // espejo en vivo (eso ya lo lee animate() de symEntry.symAxis) -- la
      // FORMA del espejo tambien esta invertida sobre un eje especifico
      // (se armo mirando el eje que estaba elegido en ese momento), asi que
      // hay que rehacer esa geometria mirada desde el eje nuevo.
      remirrorSymmetry(symEntry);
      pushHistory();
    }
  });
}

if (symOffsetInput) {
  symOffsetInput.addEventListener('input', () => {
    if (selectedId == null) return;
    const entry = sceneObjects.get(selectedId);
    const symEntry = (entry && entry.symmetrySourceId != null) ? entry : (entry?.parentId ? sceneObjects.get(entry.parentId) : null);
    if (symEntry && symEntry.symmetrySourceId != null) {
      symEntry.symOffset = parseFloat(symOffsetInput.value) || 0;
    }
  });
  symOffsetInput.addEventListener('change', () => pushHistory());
}

if (symBakeBtn) {
  symBakeBtn.addEventListener('click', () => {
    if (selectedId == null) return;
    const entry = sceneObjects.get(selectedId);
    const symEntry = (entry && entry.symmetrySourceId != null) ? entry : (entry?.parentId ? sceneObjects.get(entry.parentId) : null);
    if (symEntry && symEntry.symmetrySourceId != null) {
      symEntry.symmetrySourceId = null;
      sceneObjects.forEach(e => {
        if (e.parentId === symEntry.id) e.isMirrorOf = null;
      });
      symEntry.name = symEntry.name.replace('🪞 Simetría', '🗂️ Grupo');
      renderLayerList();
      selectObject(symEntry.id);
      pushHistory();
    }
  });
}

// --- Modificador Clonador en Vivo ---
function updateClonerLive(clonerEntry) {
  if (!clonerEntry || !clonerEntry.clonerMode) return;
  const srcId = clonerEntry.clonerSourceId;
  const src = sceneObjects.get(srcId);
  if (!src) return;

  if (clonerEntry.clonerChildIds) {
    clonerEntry.clonerChildIds.forEach(cid => {
      const e = sceneObjects.get(cid);
      if (e) {
        // OJO: estas copias NO son hijas directas de "scene" -- son hijas
        // del Nulo del clonador (clonerEntry.mesh), por eso "scene.remove()"
        // no hacia nada (silenciosamente, sin error): buscaba la copia entre
        // los hijos de scene, no la encontraba ahi, y no la sacaba de donde
        // realmente estaba. Asi, cada vez que se reconstruia el clonador
        // (bajar la cantidad, cambiar separacion o radio, cambiar de modo),
        // las copias "viejas" se borraban del Map de sceneObjects pero
        // seguian colgadas del Nulo y se seguian viendo en pantalla para
        // siempre -- se iban acumulando en vez de reemplazarse.
        // "removeFromParent()" saca al mesh de CUALQUIER padre que tenga
        // en ese momento (el Nulo, en este caso), asi que arregla esto sin
        // importar donde este colgado.
        e.mesh.removeFromParent();
        disposeEntry(e);
        sceneObjects.delete(cid);
      }
    });
  }
  clonerEntry.clonerChildIds = [];
  clonerEntry._lastSrcPos = null;
  clonerEntry._lastSrcRot = null;

  const mode = clonerEntry.clonerMode || 'linear';
  const count = clonerEntry.clonerCount || 3;
  const srcPos = new THREE.Vector3();
  src.mesh.getWorldPosition(srcPos);

  if (mode === 'linear') {
    const ox = clonerEntry.sepX != null ? clonerEntry.sepX : 80;
    const oy = clonerEntry.sepY != null ? clonerEntry.sepY : 0;
    const oz = clonerEntry.sepZ != null ? clonerEntry.sepZ : 0;
    for (let i = 1; i <= count; i++) {
      const pos = srcPos.clone().add(new THREE.Vector3(ox * i, oy * i, oz * i));
      const newId = cloneEntryAt(src, pos);
      const e = sceneObjects.get(newId);
      if (e) {
        clonerEntry.mesh.attach(e.mesh);
        e.parentId = clonerEntry.id;
        clonerEntry.clonerChildIds.push(newId);
      }
    }
  } else if (mode === 'circular') {
    const radius = clonerEntry.radius != null ? clonerEntry.radius : 120;
    const total = count + 1;
    const angleStep = (Math.PI * 2) / total;
    for (let i = 1; i < total; i++) {
      const a = angleStep * i;
      const pos = new THREE.Vector3(srcPos.x + Math.cos(a) * radius, srcPos.y, srcPos.z + Math.sin(a) * radius);
      const newId = cloneEntryAt(src, pos);
      const e = sceneObjects.get(newId);
      if (e) {
        if (clonerEntry.rotCopies !== false) e.mesh.rotation.y = src.mesh.rotation.y + a;
        clonerEntry.mesh.attach(e.mesh);
        e.parentId = clonerEntry.id;
        clonerEntry.clonerChildIds.push(newId);
      }
    }
  } else if (mode === 'grid') {
    const gx = clonerEntry.gridX || 3;
    const gy = clonerEntry.gridY || 1;
    const gz = clonerEntry.gridZ || 3;
    const sx = clonerEntry.sepX != null ? clonerEntry.sepX : 80;
    const sy = clonerEntry.sepY != null ? clonerEntry.sepY : 80;
    const sz = clonerEntry.sepZ != null ? clonerEntry.sepZ : 80;
    const startX = srcPos.x - (gx - 1) * sx / 2;
    const startY = srcPos.y;
    const startZ = srcPos.z - (gz - 1) * sz / 2;
    let first = true;
    for (let iy = 0; iy < gy; iy++) {
      for (let iz = 0; iz < gz; iz++) {
        for (let ix = 0; ix < gx; ix++) {
          if (first) { first = false; continue; } // el primer casillero es el objeto original
          const pos = new THREE.Vector3(startX + ix * sx, startY + iy * sy, startZ + iz * sz);
          const newId = cloneEntryAt(src, pos);
          const e = sceneObjects.get(newId);
          if (e) {
            clonerEntry.mesh.attach(e.mesh);
            e.parentId = clonerEntry.id;
            clonerEntry.clonerChildIds.push(newId);
          }
        }
      }
    }
  }

  renderLayerList();
}

// Cada cuadro (60x por segundo): mueve/rota/escala/recolorea los hijos ya
// creados de un clonador para que sigan al objeto original en vivo, sin
// tocar clonerChildIds ni recrear nada -- eso es trabajo de updateClonerLive()
// y solo debe pasar cuando el usuario cambia un parametro propio del
// clonador (cantidad, separacion, radio, modo, rotar copias).
// Como el original y todas las copias son hermanos dentro del mismo Null
// (ver groupIds), basta con comparar la posicion/rotacion LOCAL del
// original contra la que tenia el cuadro anterior y aplicar esa misma
// diferencia a cada copia -- así se respeta la formula de cada modo
// (lineal/circular/cuadricula) sin tener que repetirla aqui.
function syncClonerChildrenLive(clonerEntry) {
  const src = sceneObjects.get(clonerEntry.clonerSourceId);
  if (!src || !clonerEntry.clonerChildIds || !clonerEntry.clonerChildIds.length) {
    clonerEntry._lastSrcPos = null;
    clonerEntry._lastSrcRot = null;
    return;
  }

  const curPos = src.mesh.position;
  const curRot = src.mesh.rotation;

  if (!clonerEntry._lastSrcPos) {
    // Primera vez que vemos este clonador (o recien reconstruido): solo
    // guardamos la base, sin mover nada, para no dar un salto visual.
    clonerEntry._lastSrcPos = curPos.clone();
    clonerEntry._lastSrcRot = { x: curRot.x, y: curRot.y, z: curRot.z };
  } else {
    const dx = curPos.x - clonerEntry._lastSrcPos.x;
    const dy = curPos.y - clonerEntry._lastSrcPos.y;
    const dz = curPos.z - clonerEntry._lastSrcPos.z;
    const drx = curRot.x - clonerEntry._lastSrcRot.x;
    const dry = curRot.y - clonerEntry._lastSrcRot.y;
    const drz = curRot.z - clonerEntry._lastSrcRot.z;
    if (dx || dy || dz || drx || dry || drz) {
      clonerEntry.clonerChildIds.forEach(cid => {
        const c = sceneObjects.get(cid);
        if (!c) return;
        c.mesh.position.x += dx; c.mesh.position.y += dy; c.mesh.position.z += dz;
        c.mesh.rotation.x += drx; c.mesh.rotation.y += dry; c.mesh.rotation.z += drz;
      });
      clonerEntry._lastSrcPos.set(curPos.x, curPos.y, curPos.z);
      clonerEntry._lastSrcRot.x = curRot.x; clonerEntry._lastSrcRot.y = curRot.y; clonerEntry._lastSrcRot.z = curRot.z;
    }
  }

  // La escala y el material nunca tienen un offset distinto por copia
  // (cloneEntryAt siempre copia el material y la escala tal cual del
  // original al crear), asi que un copiado directo cada cuadro es exacto
  // y mas simple que llevar otra diferencia acumulada.
  const srcMat = src.mesh.material;
  clonerEntry.clonerChildIds.forEach(cid => {
    const c = sceneObjects.get(cid);
    if (!c) return;
    c.mesh.scale.copy(src.mesh.scale);
    if (srcMat && c.mesh.material) {
      c.mesh.material.color.copy(srcMat.color);
      c.mesh.material.roughness = srcMat.roughness;
      c.mesh.material.metalness = srcMat.metalness;
      c.mesh.material.opacity = srcMat.opacity;
      c.mesh.material.transparent = srcMat.opacity < 1.0;
      c.mesh.material.wireframe = srcMat.wireframe;
    }
  });
}

function getActiveCloner() {
  if (selectedId == null) return null;
  const entry = sceneObjects.get(selectedId);
  if (!entry) return null;
  if (entry.clonerMode != null) return entry;
  if (entry.parentId) {
    const p = sceneObjects.get(entry.parentId);
    if (p && p.clonerMode != null) return p;
  }
  return null;
}

const clonerModeSelect = document.getElementById('clonerModeSelect');
const clonerCountInput = document.getElementById('clonerCountInput');
const clonerCountVal = document.getElementById('clonerCountVal');
const clonerSepX = document.getElementById('clonerSepX');
const clonerSepY = document.getElementById('clonerSepY');
const clonerSepZ = document.getElementById('clonerSepZ');
const clonerRadiusInput = document.getElementById('clonerRadiusInput');
const clonerRadiusVal = document.getElementById('clonerRadiusVal');
const clonerRotCheck = document.getElementById('clonerRotCheck');
const clonerBakeBtn = document.getElementById('clonerBakeBtn');

if (clonerModeSelect) {
  clonerModeSelect.addEventListener('change', () => {
    const cloner = getActiveCloner();
    if (!cloner) return;
    cloner.clonerMode = clonerModeSelect.value;
    const isLinear = cloner.clonerMode === 'linear';
    const clonerLinearRow = document.getElementById('clonerLinearRow');
    const clonerCircularRow = document.getElementById('clonerCircularRow');
    if (clonerLinearRow) clonerLinearRow.style.display = isLinear ? 'flex' : 'none';
    if (clonerCircularRow) clonerCircularRow.style.display = isLinear ? 'none' : 'flex';
    updateClonerLive(cloner);
    pushHistory();
  });
}

if (clonerCountInput) {
  clonerCountInput.addEventListener('input', () => {
    const cloner = getActiveCloner();
    if (!cloner) return;
    cloner.clonerCount = parseInt(clonerCountInput.value) || 3;
    if (clonerCountVal) clonerCountVal.textContent = cloner.clonerCount;
    updateClonerLive(cloner);
  });
  clonerCountInput.addEventListener('change', () => pushHistory());
}

[clonerSepX, clonerSepY, clonerSepZ].forEach((inp, idx) => {
  if (!inp) return;
  const keys = ['sepX', 'sepY', 'sepZ'];
  inp.addEventListener('input', () => {
    const cloner = getActiveCloner();
    if (!cloner) return;
    cloner[keys[idx]] = parseFloat(inp.value) || 0;
    updateClonerLive(cloner);
  });
  inp.addEventListener('change', () => pushHistory());
});

const latheSegmentsInput = document.getElementById('latheSegmentsInput');
const latheSegmentsVal = document.getElementById('latheSegmentsVal');
if (latheSegmentsInput) {
  latheSegmentsInput.addEventListener('input', () => {
    if (selectedId == null) return;
    const entry = sceneObjects.get(selectedId);
    if (!entry || entry.kind !== 'lathe') return;
    const segs = parseInt(latheSegmentsInput.value) || 32;
    if (latheSegmentsVal) latheSegmentsVal.textContent = segs;
    applyLathe(entry, segs);
  });
  latheSegmentsInput.addEventListener('change', () => pushHistory());
}

// "🔘 Tapas" -- ver applyLathe/buildLatheCapGeometry: si el perfil de la
// curva no toca el eje de Revolucion (radio > 0) en la punta de abajo o de
// arriba, esa punta queda como un circulo ABIERTO (un aro hueco por dentro,
// no un solido) salvo que se cierre con un disco chato -- igual que las
// tapas de Inicio/Fin de un Lathe NURBS en Cinema4D (activadas por defecto
// ahi tambien). Reportado por Andres comparando con una captura de
// Cinema4D del mismo proyecto.
const latheCapsCheck = document.getElementById('latheCapsCheck');
if (latheCapsCheck) latheCapsCheck.addEventListener('change', () => {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry || entry.kind !== 'lathe') return;
  entry.latheCaps = latheCapsCheck.checked;
  applyLathe(entry, entry.latheSegments);
  pushHistory();
});

const tubeRootRadiusInput = document.getElementById('tubeRootRadiusInput');
const tubeRootRadiusVal = document.getElementById('tubeRootRadiusVal');
const tubeTipRadiusInput = document.getElementById('tubeTipRadiusInput');
const tubeTipRadiusVal = document.getElementById('tubeTipRadiusVal');
const tubeRadialSegInput = document.getElementById('tubeRadialSegInput');
const tubeRadialSegVal = document.getElementById('tubeRadialSegVal');

function liveTubeUpdate() {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry || entry.kind !== 'tube') return;
  const root = parseFloat(tubeRootRadiusInput.value) || 0.5;
  const tip = parseFloat(tubeTipRadiusInput.value) || 0.5;
  const segs = parseInt(tubeRadialSegInput.value) || TUBE_DEFAULT_RADIAL_SEGMENTS;
  if (tubeRootRadiusVal) tubeRootRadiusVal.textContent = root;
  if (tubeTipRadiusVal) tubeTipRadiusVal.textContent = tip;
  if (tubeRadialSegVal) tubeRadialSegVal.textContent = segs;
  applyTube(entry, root, tip, segs);
}
[tubeRootRadiusInput, tubeTipRadiusInput, tubeRadialSegInput].forEach(inp => {
  if (!inp) return;
  inp.addEventListener('input', liveTubeUpdate);
  inp.addEventListener('change', () => pushHistory());
});

const extrudeDepthInput = document.getElementById('extrudeDepthInput');
const extrudeDepthVal = document.getElementById('extrudeDepthVal');
const extrudeBevelCheck = document.getElementById('extrudeBevelCheck');
const extrudeBevelSizeInput = document.getElementById('extrudeBevelSizeInput');
const extrudeBevelSizeVal = document.getElementById('extrudeBevelSizeVal');

function liveExtrudeUpdate() {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry || entry.kind !== 'extrude') return;
  const depth = parseFloat(extrudeDepthInput.value) || 1;
  const bevel = !!extrudeBevelCheck.checked;
  const bsize = parseFloat(extrudeBevelSizeInput.value) || 0;
  if (extrudeDepthVal) extrudeDepthVal.textContent = depth;
  if (extrudeBevelSizeVal) extrudeBevelSizeVal.textContent = bsize;
  applyExtrude(entry, depth, bevel, bsize);
}
[extrudeDepthInput, extrudeBevelCheck, extrudeBevelSizeInput].forEach(inp => {
  if (!inp) return;
  inp.addEventListener('input', liveExtrudeUpdate);
  inp.addEventListener('change', () => pushHistory());
});

// --- Texto 3D: contenido, tipografia, tamaño, profundidad, bisel (todo en vivo) ---
const textContentInput = document.getElementById('textContentInput');
const textFontSelect = document.getElementById('textFontSelect');
const textSizeInput = document.getElementById('textSizeInput');
const textSizeVal = document.getElementById('textSizeVal');
const textDepthInput = document.getElementById('textDepthInput');
const textDepthVal = document.getElementById('textDepthVal');
const textBevelCheck = document.getElementById('textBevelCheck');
const textBevelSizeInput = document.getElementById('textBevelSizeInput');
const textBevelSizeVal = document.getElementById('textBevelSizeVal');

function liveTextUpdate() {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry || entry.kind !== 'text') return;
  entry.text = textContentInput.value || '';
  entry.textSize = parseFloat(textSizeInput.value) || 1;
  entry.textDepth = parseFloat(textDepthInput.value) || 0.1;
  entry.textBevel = !!textBevelCheck.checked;
  entry.textBevelSize = parseFloat(textBevelSizeInput.value) || 0;
  if (textSizeVal) textSizeVal.textContent = entry.textSize;
  if (textDepthVal) textDepthVal.textContent = entry.textDepth;
  if (textBevelSizeVal) textBevelSizeVal.textContent = entry.textBevelSize;
  rebuildTextGeometry(entry);
  updateHandles(entry.id);
}
[textContentInput, textSizeInput, textDepthInput, textBevelCheck, textBevelSizeInput].forEach(inp => {
  if (!inp) return;
  inp.addEventListener('input', liveTextUpdate);
  inp.addEventListener('change', () => pushHistory());
});
if (textFontSelect) {
  textFontSelect.addEventListener('change', () => {
    if (selectedId == null) return;
    const entry = sceneObjects.get(selectedId);
    if (!entry || entry.kind !== 'text') return;
    const key = textFontSelect.value;
    const entryId = entry.id;
    entry.fontKey = key;
    loadFont(key).then(() => {
      // Puede que el usuario ya haya cambiado de seleccion o de fuente para
      // cuando la tipografia termina de cargar -- se vuelve a buscar la
      // MISMA figura por su id (no por "selectedId", que puede haber
      // cambiado) y se confirma que siga pidiendo esta fuente, para no
      // pisar otra figura ni una eleccion mas nueva del usuario.
      const stillEntry = sceneObjects.get(entryId);
      if (stillEntry && stillEntry.kind === 'text' && stillEntry.fontKey === key) {
        rebuildTextGeometry(stillEntry);
        updateHandles(stillEntry.id);
      }
    });
    pushHistory();
  });
}

if (clonerRadiusInput) {
  clonerRadiusInput.addEventListener('input', () => {
    const cloner = getActiveCloner();
    if (!cloner) return;
    cloner.radius = parseFloat(clonerRadiusInput.value) || 120;
    if (clonerRadiusVal) clonerRadiusVal.textContent = cloner.radius;
    updateClonerLive(cloner);
  });
  clonerRadiusInput.addEventListener('change', () => pushHistory());
}

if (clonerRotCheck) {
  clonerRotCheck.addEventListener('change', () => {
    const cloner = getActiveCloner();
    if (!cloner) return;
    cloner.rotCopies = clonerRotCheck.checked;
    updateClonerLive(cloner);
    pushHistory();
  });
}

if (clonerBakeBtn) {
  clonerBakeBtn.addEventListener('click', () => {
    const cloner = getActiveCloner();
    if (!cloner) return;
    cloner.clonerMode = null;
    cloner.clonerChildIds = null;
    cloner.name = cloner.name.replace('🔁', '🗂️');
    renderLayerList();
    selectObject(cloner.id);
    pushHistory();
  });
}

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

function updateCanvasDimensions() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (w <= 0 || h <= 0) return;
  renderer.setSize(w, h);
  perspCam.aspect = w / h;
  perspCam.updateProjectionMatrix();
  if (typeof syncQuadrantCameras === 'function' && fourViewMode) {
    syncQuadrantCameras();
  }
}

// Observador automático de tamaño para expandir/contraer el canvas 3D fluidamente
if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => updateCanvasDimensions());
  ro.observe(wrap);
}
window.addEventListener('resize', updateCanvasDimensions);

toggleSidePanelBtn.addEventListener('click', () => {
  const collapsed = rightPanel.classList.toggle('collapsed');
  document.body.classList.toggle('side-collapsed', collapsed);
  toggleSidePanelBtn.textContent = collapsed ? '◀' : '▶';
  updateCanvasDimensions();
  setTimeout(updateCanvasDimensions, 220);
});

// --- Version comoda para celular ---
// En pantalla angosta, el panel derecho (pensado para tablet/escritorio)
// se convierte en una bandeja que se desliza ENCIMA del visor 3D en vez de
// empujarlo a una tira angosta (ver CSS "@media (max-width: 720px)" en
// index.html). Tocar el fondo oscuro detras del panel lo cierra, igual que
// tocar el boton ▶/◀ de siempre.
const panelBackdrop = document.getElementById('panelBackdrop');
if (panelBackdrop) {
  panelBackdrop.addEventListener('click', () => toggleSidePanelBtn.click());
}
// Al abrir la app en un celular, arranca con el panel cerrado para ver el
// 3D de entrada -- se abre tocando el boton ▶ cuando hace falta.
if (window.innerWidth <= 720 && !rightPanel.classList.contains('collapsed')) {
  toggleSidePanelBtn.click();
}

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
      wireframe: e.mesh.material ? !!e.mesh.material.wireframe : null,
      clonerMode: e.clonerMode || null,
      clonerCount: e.clonerCount != null ? e.clonerCount : null,
      clonerSourceId: e.clonerSourceId != null ? e.clonerSourceId : null,
      clonerChildIds: e.clonerChildIds ? [...e.clonerChildIds] : null,
      sepX: e.sepX != null ? e.sepX : null,
      sepY: e.sepY != null ? e.sepY : null,
      sepZ: e.sepZ != null ? e.sepZ : null,
      radius: e.radius != null ? e.radius : null,
      rotCopies: e.rotCopies != null ? e.rotCopies : null,
      symmetrySourceId: e.symmetrySourceId != null ? e.symmetrySourceId : null,
      symAxis: e.symAxis || null,
      symOffset: e.symOffset != null ? e.symOffset : null,
      isMirrorOf: e.isMirrorOf != null ? e.isMirrorOf : null
    };
    if (isCustomGeomKind(e.kind) && e.mesh.geometry) {
      s.hairGeometry = serializeGeometry(e.mesh.geometry);
      if (e.splinePoints) {
        s.splinePoints = e.splinePoints.map(p => [p.x, p.y, p.z]);
        s.splineSharp = e.splineSharp ? e.splineSharp.slice() : e.splinePoints.map(() => false);
        s.closed = !!e.closed;
        s.latheSegments = e.latheSegments != null ? e.latheSegments : null;
        s.latheCaps = e.latheCaps !== false;
        s.tubeRootRadius = e.tubeRootRadius != null ? e.tubeRootRadius : null;
        s.tubeTipRadius = e.tubeTipRadius != null ? e.tubeTipRadius : null;
        s.tubeRadialSegments = e.tubeRadialSegments != null ? e.tubeRadialSegments : null;
        s.extrudeDepth = e.extrudeDepth != null ? e.extrudeDepth : null;
        s.extrudeBevel = e.extrudeBevel != null ? e.extrudeBevel : null;
        s.extrudeBevelSize = e.extrudeBevelSize != null ? e.extrudeBevelSize : null;
      }
      if (e.kind === 'text') {
        s.text = e.text != null ? e.text : null;
        s.fontKey = e.fontKey || null;
        s.textSize = e.textSize != null ? e.textSize : null;
        s.textDepth = e.textDepth != null ? e.textDepth : null;
        s.textBevel = e.textBevel != null ? e.textBevel : null;
        s.textBevelSize = e.textBevelSize != null ? e.textBevelSize : null;
      }
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
      geometryData: s.hairGeometry,
      closed: !!s.closed
    };
    const built = buildObject(s.kind, s.color != null ? s.color : undefined, extraOpts);
    built.node.position.set(s.px, s.py, s.pz);
    built.node.rotation.set(s.rx, s.ry, s.rz);
    built.node.scale.set(s.sx, s.sy, s.sz);
    built.node.visible = s.visible;
    let sculpted = false;
    if (!isCustomGeomKind(s.kind) && s.sculptPositions && built.node.geometry && built.node.geometry.attributes.position &&
        built.node.geometry.attributes.position.array.length === s.sculptPositions.length) {
      built.node.geometry.attributes.position.array.set(s.sculptPositions);
      built.node.geometry.attributes.position.needsUpdate = true;
      built.node.geometry.computeVertexNormals();
      built.node.geometry.computeBoundingSphere();
      sculpted = true;
    }
    scene.add(built.node);
    built.pickMesh.userData.ownerId = s.id;
    sceneObjects.set(s.id, {
      id: s.id, kind: s.kind, mesh: built.node, pickMesh: built.pickMesh,
      visible: s.visible, parentId: s.parentId != null ? s.parentId : null,
      sculpted, name: s.name || null, collapsed: !!s.collapsed,
      clonerMode: s.clonerMode || null,
      clonerCount: s.clonerCount != null ? s.clonerCount : null,
      clonerSourceId: s.clonerSourceId != null ? s.clonerSourceId : null,
      clonerChildIds: s.clonerChildIds ? [...s.clonerChildIds] : null,
      sepX: s.sepX, sepY: s.sepY, sepZ: s.sepZ,
      radius: s.radius, rotCopies: s.rotCopies,
      symmetrySourceId: s.symmetrySourceId != null ? s.symmetrySourceId : null,
      symAxis: s.symAxis, symOffset: s.symOffset,
      isMirrorOf: s.isMirrorOf != null ? s.isMirrorOf : null,
      splinePoints: s.splinePoints ? s.splinePoints.map(a => new THREE.Vector3(a[0], a[1], a[2])) : undefined,
      splineSharp: s.splineSharp ? s.splineSharp.slice() : undefined,
      closed: !!s.closed,
      latheSegments: s.latheSegments != null ? s.latheSegments : undefined,
      latheCaps: s.latheCaps !== false,
      tubeRootRadius: s.tubeRootRadius != null ? s.tubeRootRadius : undefined,
      tubeTipRadius: s.tubeTipRadius != null ? s.tubeTipRadius : undefined,
      tubeRadialSegments: s.tubeRadialSegments != null ? s.tubeRadialSegments : undefined,
      extrudeDepth: s.extrudeDepth != null ? s.extrudeDepth : undefined,
      extrudeBevel: s.extrudeBevel != null ? s.extrudeBevel : undefined,
      extrudeBevelSize: s.extrudeBevelSize != null ? s.extrudeBevelSize : undefined,
      text: s.text != null ? s.text : undefined,
      fontKey: s.fontKey || undefined,
      textSize: s.textSize != null ? s.textSize : undefined,
      textDepth: s.textDepth != null ? s.textDepth : undefined,
      textBevel: s.textBevel != null ? s.textBevel : undefined,
      textBevelSize: s.textBevelSize != null ? s.textBevelSize : undefined
    });
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

// Mientras se esta DIBUJANDO un trazo de Curva nuevo (splineEditingId
// todavia null), deshacer/rehacer aplican al trazo en construccion en vez
// de al historial general -- ver splineDraftHistory mas abajo (declarado
// junto al resto del estado de Curva). Esta funcion se llama tanto desde
// el historial general (pushHistory/restoreSnapshot) como desde el
// historial de trazo (pushSplineDraftHistory/restoreSplineDraftState), asi
// los botones (y los atajos Ctrl+Z/Ctrl+Y, que dependen de que el boton NO
// este disabled) siempre reflejan cual de los dos historiales esta activo
// en este momento.
function updateHistoryButtons() {
  const draftMode = (toolMode === 'spline' && splineEditingId == null);
  undoBtn.disabled = (draftMode && splinePoints.length > 0) ? false : (historyIndex <= 0);
  redoBtn.disabled = (draftMode && splineDraftHistoryIndex < splineDraftHistory.length - 1) ? false : (historyIndex >= history.length - 1);
}

undoBtn.addEventListener('click', () => {
  if (toolMode === 'spline' && splineEditingId == null && splinePoints.length > 0) {
    undoSplineDraft();
    return;
  }
  if (historyIndex <= 0) return;
  historyIndex--;
  restoreSnapshot(history[historyIndex]);
});
redoBtn.addEventListener('click', () => {
  if (toolMode === 'spline' && splineEditingId == null && splineDraftHistoryIndex < splineDraftHistory.length - 1) {
    redoSplineDraft();
    return;
  }
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
raycaster.params.Line.threshold = 6; // las Curvas/Splines ahora se ven como una linea fina -- sin esto serian casi imposibles de tocar con el dedo
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

// =====================================================================
// SPLINE / CURVA: puntos editables para armar una linea curva, base para
// los generadores que se construyen sobre ella (Revolucion/Lathe primero;
// Tubo/Sweep y Extrusion despues) -- el mismo concepto que "Curva" en
// Blender o "Spline" en Cinema4D, con sus modificadores/NURBS.
//
// A diferencia del Pelo (un trazo continuo de una sola vez, que queda fijo
// para siempre), el Spline es de PUNTOS DISCRETOS: cada toque agrega UN
// punto nuevo, y una vez terminada la curva se puede volver a entrar y
// ARRASTRAR cualquier punto para ajustarlo (bolitas, mismo estilo tactil
// que los tiradores de redimensionar) o agregar mas puntos al final
// tocando en el aire. Sin manijas tipo Bezier (mas simple para el dedo) --
// la curva se suaviza sola entre puntos con Catmull-Rom, igual que ya hace
// el Pelo por dentro.
// =====================================================================
let splinePoints = [];      // world-space, curva EN CONSTRUCCION (antes de "Finalizar Curva")
let splineDraftSharp = [];  // paralelo a splinePoints: true = ese punto del trazo en construccion es esquina dura
let splinePreviewMesh = null;
let splineEditingId = null; // id del objeto (spline/lathe/tube/extrude) cuyos puntos se estan mostrando/editando ahora
let activeSplinePointIndex = -1; // ultimo punto tocado/agregado (arrastrando o con "+ punto") -- a ese le aplica el toggle "Punto duro"
const splinePointGroup = new THREE.Group();
scene.add(splinePointGroup);
let splinePointMeshes = [];
const SPLINE_POINT_COLOR_FIRST = 0x88dd88;   // primer punto de la curva
const SPLINE_POINT_COLOR_SMOOTH = 0xffcc44;  // punto liso (bisel redondo, el comportamiento de siempre)
const SPLINE_POINT_COLOR_SHARP = 0xff6644;   // punto marcado como esquina dura (90 grados, sin curvar)

// Guia del eje de Revolucion: una linea vertical punteada en X=0,Z=0 (con
// una flechita en cada punta, como en Cinema4D) para que se entienda de un
// vistazo "donde esta la mitad" al dibujar el perfil de una copa/florero --
// la distancia de cada punto a ESTA linea es lo que despues se vuelve el
// radio al aplicar Revolucion. Solo se muestra en modo Curva.
const axisGuideGroup = new THREE.Group();
axisGuideGroup.visible = false;
scene.add(axisGuideGroup);
(function buildAxisGuide() {
  const H = 220;
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -H, 0), new THREE.Vector3(0, H, 0)]);
  const lineMat = new THREE.LineDashedMaterial({ color: 0xffb020, dashSize: 8, gapSize: 5, transparent: true, opacity: 0.85 });
  const line = new THREE.Line(lineGeo, lineMat);
  line.computeLineDistances();
  axisGuideGroup.add(line);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffb020 });
  const arrowTop = new THREE.Mesh(new THREE.ConeGeometry(4.5, 14, 10), arrowMat);
  arrowTop.position.set(0, H, 0);
  axisGuideGroup.add(arrowTop);
  const arrowBottom = new THREE.Mesh(new THREE.ConeGeometry(4.5, 14, 10), arrowMat);
  arrowBottom.position.set(0, -H, 0);
  arrowBottom.rotation.x = Math.PI;
  axisGuideGroup.add(arrowBottom);
})();
function updateAxisGuideVisibility() {
  axisGuideGroup.visible = (toolMode === 'spline');
}
let draggingSplinePointIndex = -1;
const splineFinishBtn = document.getElementById('splineFinishBtn');
const splinePointCountEl = document.getElementById('splinePointCount');
const latheApplyBtn = document.getElementById('latheApplyBtn');

// Una vez que se le aplico un generador (Revolucion/Tubo/Extrusion) a una
// Curva, sigue guardando sus puntos editables -- por eso se puede volver a
// entrar a tocarlos despues, no solo mientras todavia es un 'spline' sin
// convertir. La linea guia en si (kind 'spline') tambien se puede reeditar,
// claro.
function canEditSplinePoints(entry) {
  return !!(entry && entry.splinePoints && (entry.kind === 'spline' || entry.kind === 'lathe' || entry.kind === 'tube' || entry.kind === 'extrude'));
}

// Un diseño guardado ANTES de que existiera "Punto duro" (o clonado por el
// Clonador de matriz, que no copia splineSharp -- ver cloneEntryAt) no
// trae entry.splineSharp, o puede haber quedado mas corto/largo que
// splinePoints tras agregar/sacar puntos en versiones viejas -- esto lo
// arma/ajusta al vuelo (todo liso/false por defecto) antes de usarlo.
function ensureSplineSharpArray(entry) {
  if (!entry || !entry.splinePoints) return;
  if (!entry.splineSharp) { entry.splineSharp = entry.splinePoints.map(() => false); return; }
  while (entry.splineSharp.length < entry.splinePoints.length) entry.splineSharp.push(false);
  if (entry.splineSharp.length > entry.splinePoints.length) entry.splineSharp.length = entry.splinePoints.length;
}

// La primera vez que se le aplica un generador a una Curva sin convertir,
// su objeto en escena pasa de ser una THREE.Line/LineLoop (la guia fina)
// a necesitar una THREE.Mesh de verdad (con caras, para poder rellenarse
// de solido) -- esta funcion hace ese cambio de "tipo" una sola vez,
// conservando posicion/rotacion/escala y el id del objeto. Si ya es un
// Mesh (porque el generador se esta volviendo a aplicar en vivo, p.ej. al
// arrastrar un punto de una Revolucion ya convertida), no hace nada.
function ensureSolidMeshForGenerator(entry) {
  if (entry.mesh.isMesh) return;
  const oldMesh = entry.mesh;
  const wasEditingTransform = (transform.object === oldMesh);
  const mesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshStandardMaterial({
      color: (oldMesh.material && oldMesh.material.color) ? oldMesh.material.color.getHex() : SPLINE_DEFAULT_COLOR,
      roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide
    })
  );
  mesh.position.copy(oldMesh.position);
  mesh.quaternion.copy(oldMesh.quaternion);
  mesh.scale.copy(oldMesh.scale);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.ownerId = entry.id;
  if (wasEditingTransform) transform.detach();
  scene.add(mesh);
  scene.remove(oldMesh);
  oldMesh.geometry.dispose();
  if (oldMesh.material) oldMesh.material.dispose();
  entry.mesh = mesh;
  entry.pickMesh = mesh;
}

function clearSplinePreview() {
  if (!splinePreviewMesh) return;
  scene.remove(splinePreviewMesh);
  splinePreviewMesh.geometry.dispose();
  splinePreviewMesh.material.dispose();
  splinePreviewMesh = null;
}

// Si esta prendido "Cerrar Curva" mientras se dibuja el trazo nuevo (antes
// de "Finalizar Curva"), la vista previa ya se ve como loop cerrado -- se
// resetea cada vez que se arranca un trazo nuevo.
let splineDraftClosed = false;
const splineClosedCheck = document.getElementById('splineClosedCheck');
// El toggle "📐 Punto duro (90°)" -- ver syncSplineSharpCheckbox mas abajo.
const splineSharpCheck = document.getElementById('splineSharpCheck');

// --- Deshacer/rehacer MIENTRAS SE DIBUJA un trazo nuevo (antes de
// "Finalizar Curva") -- pedido explicito: "falta que pueda deshacer... al
// crear puntos de spline". Es un historial APARTE del historial general de
// la escena (history/historyIndex, mas arriba): mientras se dibuja todavia
// no existe ningun objeto en sceneObjects para snapshotear -- splinePoints/
// splineDraftSharp/splineDraftClosed son solo variables sueltas en memoria
// hasta que se aprieta "Finalizar Curva". Se guarda una copia de las 3 en
// cada paso (agregar un punto, arrastrar uno existente, marcarlo duro/liso,
// cerrar la curva) y deshacer/rehacer solo restaura esa copia -- no toca
// para nada el historial general ni ningun objeto real de la escena.
let splineDraftHistory = [];
let splineDraftHistoryIndex = -1;
function cloneSplineDraftState() {
  return {
    points: splinePoints.map(p => p.clone()),
    sharp: splineDraftSharp.slice(),
    closed: splineDraftClosed,
    activeIndex: activeSplinePointIndex // que punto quedaba seleccionado en ESE momento (para el toggle Punto duro)
  };
}
function pushSplineDraftHistory() {
  splineDraftHistory = splineDraftHistory.slice(0, splineDraftHistoryIndex + 1);
  splineDraftHistory.push(cloneSplineDraftState());
  splineDraftHistoryIndex = splineDraftHistory.length - 1;
  updateHistoryButtons();
}
function restoreSplineDraftState(state) {
  splinePoints = state.points.map(p => p.clone());
  splineDraftSharp = state.sharp.slice();
  splineDraftClosed = state.closed;
  // El punto activo (para el toggle Punto duro) se restaura tal cual estaba
  // en ESE paso -- si simplemente se pusiera "el ultimo punto" aca, deshacer/
  // rehacer despues de haber tocado/arrastrado un punto que NO es el ultimo
  // dejaria el toggle apuntando al punto equivocado.
  activeSplinePointIndex = (typeof state.activeIndex === 'number') ? state.activeIndex : splinePoints.length - 1;
  if (splineClosedCheck) splineClosedCheck.checked = splineDraftClosed;
  updateSplinePreview();
  syncSplineSharpCheckbox();
  updateHistoryButtons();
}
// Deshacer: si todavia no habia ningun paso previo guardado (por ejemplo,
// se deshace justo despues del primerisimo punto), vacia el trazo del todo
// -- es lo mas intuitivo ("deshacer" en el primer paso vuelve a foja cero,
// igual que en cualquier editor). OJO: splineDraftHistory NO se vacia aca
// (queda con sus pasos guardados) para que "rehacer" despues pueda volver a
// traer el primer punto -- solo se resetea el INDICE a -1.
function undoSplineDraft() {
  if (splineDraftHistoryIndex <= 0) {
    splineDraftHistoryIndex = -1;
    splinePoints = [];
    splineDraftSharp = [];
    splineDraftClosed = false;
    activeSplinePointIndex = -1;
    if (splineClosedCheck) splineClosedCheck.checked = false;
    updateSplinePreview();
    syncSplineSharpCheckbox();
    updateHistoryButtons();
    return;
  }
  splineDraftHistoryIndex--;
  restoreSplineDraftState(splineDraftHistory[splineDraftHistoryIndex]);
}
function redoSplineDraft() {
  if (splineDraftHistoryIndex >= splineDraftHistory.length - 1) return;
  splineDraftHistoryIndex++;
  restoreSplineDraftState(splineDraftHistory[splineDraftHistoryIndex]);
}

// Mientras se esta dibujando (antes de "Finalizar Curva"), se ve una
// bolita por cada punto ya puesto -- antes solo se veia la LINEA
// conectando todo, y era dificil saber donde habia quedado cada toque
// exacto ("parece que haces a ciegas", reportado). Reusa el mismo grupo/
// arreglo que refreshSplinePointHandles (splinePointGroup/splinePointMeshes)
// porque nunca coinciden en el tiempo: esto se usa mientras se dibuja un
// trazo nuevo (splineEditingId todavia null), lo otro mientras se edita
// una curva ya existente.
function refreshDraftPointHandles() {
  clearSplinePointHandles();
  splinePoints.forEach((p, i) => {
    const sharp = !!splineDraftSharp[i];
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(6, 10, 8),
      new THREE.MeshBasicMaterial({ color: i === 0 ? SPLINE_POINT_COLOR_FIRST : (sharp ? SPLINE_POINT_COLOR_SHARP : SPLINE_POINT_COLOR_SMOOTH), depthTest: false })
    );
    mesh.renderOrder = 999;
    mesh.position.copy(p); // splinePoints ya esta en espacio MUNDO mientras se dibuja
    mesh.userData.pointIndex = i;
    splinePointGroup.add(mesh);
    splinePointMeshes.push(mesh);
  });
}

function updateSplinePreview() {
  if (splinePointCountEl) splinePointCountEl.textContent = splinePoints.length + ' punto' + (splinePoints.length === 1 ? '' : 's');
  refreshDraftPointHandles();
  if (splinePoints.length < 2) return;
  const geo = buildSplineLineGeometry(splinePoints, splineDraftClosed, splineDraftSharp);
  if (!splinePreviewMesh) {
    splinePreviewMesh = buildSplineLineObject(geo, SPLINE_DEFAULT_COLOR);
    scene.add(splinePreviewMesh);
  } else {
    splinePreviewMesh.geometry.dispose();
    splinePreviewMesh.geometry = geo;
  }
}

function createSplineObjectFromPoints(pts, closed, sharp) {
  const origin = pts[0].clone();
  const localPoints = pts.map(p => p.clone().sub(origin));
  const sharpCopy = pts.map((_, i) => !!(sharp && sharp[i]));
  const geo = buildSplineLineGeometry(localPoints, closed, sharpCopy);
  const mesh = buildSplineLineObject(geo, SPLINE_DEFAULT_COLOR);
  mesh.position.copy(origin);
  scene.add(mesh);
  const id = objIdCounter++;
  mesh.userData.ownerId = id;
  sceneObjects.set(id, { id, kind: 'spline', mesh, pickMesh: mesh, visible: true, parentId: null, sculpted: false, name: null, collapsed: false, splinePoints: localPoints, closed: !!closed, splineSharp: sharpCopy });
  return id;
}

function finishSplineDraw() {
  clearSplinePreview();
  if (splinePoints.length < 2) { splinePoints = []; splineDraftSharp = []; splineDraftClosed = false; splineDraftHistory = []; splineDraftHistoryIndex = -1; if (splineClosedCheck) splineClosedCheck.checked = false; updateSplinePreview(); if (splinePointCountEl) splinePointCountEl.textContent = ''; return; }
  const id = createSplineObjectFromPoints(splinePoints, splineDraftClosed, splineDraftSharp);
  splinePoints = [];
  splineDraftSharp = [];
  splineDraftClosed = false;
  // Se resetea el historial del trazo ya terminado -- si no, el PROXIMO
  // trazo nuevo heredaria pasos de deshacer que ya no tienen sentido (serian
  // de una curva distinta, ya convertida en objeto real).
  splineDraftHistory = [];
  splineDraftHistoryIndex = -1;
  if (splineClosedCheck) splineClosedCheck.checked = false;
  if (splinePointCountEl) splinePointCountEl.textContent = '';
  renderLayerList();
  selectObject(id);
  pushHistory();
  // OJO: antes esto llamaba a startSplinePointEdit(id) para "dejar los
  // puntos listos para ajustar de una". El problema (reportado: "no me
  // finaliza la curva") es que mientras splineEditingId siga apuntando a
  // ESTA curva, el pointerdown de mas abajo (linea ~3482) sigue agregando
  // cada toque nuevo COMO PUNTO DE LA MISMA CURVA en vez de arrancar la
  // curva siguiente -- entonces nunca se podia "terminar" y arrancar otra.
  // Por eso ahora se llama a stopSplinePointEdit(): la curva queda
  // terminada y el proximo toque arranca un trazo nuevo. Para volver a
  // tocar los puntos de ESTA curva mas adelante, se la selecciona (panel
  // de capas) y se vuelve a apretar la herramienta Curva -- eso ya entra
  // solo en modo edicion de puntos (ver setMode('spline') mas abajo).
  stopSplinePointEdit();
}
if (splineFinishBtn) splineFinishBtn.addEventListener('click', finishSplineDraw);

// --- Edicion de los puntos de un Spline ya creado (o de una Revolucion/
// Tubo/Extrusion generados a partir de uno) ---
function clearSplinePointHandles() {
  splinePointMeshes.forEach(m => { splinePointGroup.remove(m); m.geometry.dispose(); m.material.dispose(); });
  splinePointMeshes = [];
}

function refreshSplinePointHandles() {
  clearSplinePointHandles();
  if (splineEditingId == null) return;
  const entry = sceneObjects.get(splineEditingId);
  if (!canEditSplinePoints(entry)) { splineEditingId = null; return; }
  ensureSplineSharpArray(entry);
  entry.mesh.updateMatrixWorld(true);
  entry.splinePoints.forEach((p, i) => {
    const world = p.clone().applyMatrix4(entry.mesh.matrixWorld);
    const sharp = !!entry.splineSharp[i];
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(6, 10, 8),
      new THREE.MeshBasicMaterial({ color: i === 0 ? SPLINE_POINT_COLOR_FIRST : (sharp ? SPLINE_POINT_COLOR_SHARP : SPLINE_POINT_COLOR_SMOOTH), depthTest: false })
    );
    mesh.renderOrder = 999;
    mesh.position.copy(world);
    mesh.userData.pointIndex = i;
    splinePointGroup.add(mesh);
    splinePointMeshes.push(mesh);
  });
}

function startSplinePointEdit(id) {
  splineEditingId = id;
  activeSplinePointIndex = -1;
  refreshSplinePointHandles();
  syncSplineClosedCheckbox();
  syncSplineSharpCheckbox();
  updateHistoryButtons(); // entrar a editar una curva ya existente sale del "modo trazo nuevo" -- deshacer/rehacer vuelven a ser los del historial general
}

function stopSplinePointEdit() {
  splineEditingId = null;
  activeSplinePointIndex = -1;
  clearSplinePointHandles();
  syncSplineClosedCheckbox();
  syncSplineSharpCheckbox();
  updateHistoryButtons();
}

// El toggle "🔒 Cerrar Curva" refleja/edita distintas cosas segun el
// contexto: el trazo NUEVO en construccion (splineDraftClosed), una Curva
// ya creada sin convertir todavia (entry.closed), o queda deshabilitado
// si se estan editando los puntos de una Revolucion/Tubo/Extrusion ya
// generados (ahi "cerrar" ya no tiene efecto -- el generador ya decidio
// eso al convertir la curva).
function syncSplineClosedCheckbox() {
  if (!splineClosedCheck) return;
  if (splineEditingId != null) {
    const entry = sceneObjects.get(splineEditingId);
    if (entry && entry.kind === 'spline') {
      splineClosedCheck.disabled = false;
      splineClosedCheck.checked = !!entry.closed;
      return;
    }
    splineClosedCheck.disabled = true;
    splineClosedCheck.checked = false;
    return;
  }
  splineClosedCheck.disabled = false;
  splineClosedCheck.checked = splineDraftClosed;
}
if (splineClosedCheck) splineClosedCheck.addEventListener('change', () => {
  if (splineEditingId != null) {
    const entry = sceneObjects.get(splineEditingId);
    if (entry && entry.kind === 'spline') {
      entry.closed = splineClosedCheck.checked;
      rebuildSplineGeometry(entry);
      pushHistory();
      return;
    }
  }
  splineDraftClosed = splineClosedCheck.checked;
  updateSplinePreview();
  pushSplineDraftHistory();
});

// El toggle "📐 Punto duro (90°)" aplica al ULTIMO punto tocado/agregado
// (activeSplinePointIndex), no a la curva entera como "Cerrar Curva" --
// cada punto tiene su propio bisel liso/duro. A diferencia de "Cerrar
// Curva", esto SI tiene sentido para Revolucion/Tubo/Extrusion ya
// convertidos (el perfil sigue siendo el mismo, solo cambia si se
// redondea o no en ese punto) -- por eso usa canEditSplinePoints en vez
// de exigir kind==='spline'. Se deshabilita solo si no hay ningun punto
// activo todavia (recien entrando a editar, antes de tocar/agregar uno).
function syncSplineSharpCheckbox() {
  if (!splineSharpCheck) return;
  if (splineEditingId != null) {
    const entry = sceneObjects.get(splineEditingId);
    if (entry && canEditSplinePoints(entry) && activeSplinePointIndex >= 0) {
      ensureSplineSharpArray(entry);
      splineSharpCheck.disabled = false;
      splineSharpCheck.checked = !!entry.splineSharp[activeSplinePointIndex];
      return;
    }
    splineSharpCheck.disabled = true;
    splineSharpCheck.checked = false;
    return;
  }
  // Todavia dibujando el trazo nuevo: aplica al ultimo punto puesto.
  if (activeSplinePointIndex >= 0 && activeSplinePointIndex < splineDraftSharp.length) {
    splineSharpCheck.disabled = false;
    splineSharpCheck.checked = !!splineDraftSharp[activeSplinePointIndex];
    return;
  }
  splineSharpCheck.disabled = true;
  splineSharpCheck.checked = false;
}
if (splineSharpCheck) splineSharpCheck.addEventListener('change', () => {
  if (activeSplinePointIndex < 0) return;
  if (splineEditingId != null) {
    const entry = sceneObjects.get(splineEditingId);
    if (!entry || !canEditSplinePoints(entry)) return;
    ensureSplineSharpArray(entry);
    entry.splineSharp[activeSplinePointIndex] = splineSharpCheck.checked;
    regenerateEntryFromPoints(entry);
    refreshSplinePointHandles();
    pushHistory();
    return;
  }
  if (activeSplinePointIndex < splineDraftSharp.length) {
    splineDraftSharp[activeSplinePointIndex] = splineSharpCheck.checked;
    updateSplinePreview();
    pushSplineDraftHistory();
  }
});

// Solo tiene sentido para una curva TODAVIA SIN CONVERTIR (kind 'spline'):
// vuelve a armar su linea guia. Si ya se le aplico un generador, hay que
// rehacer ESE generador en cambio -- ver regenerateEntryFromPoints().
function rebuildSplineGeometry(entry) {
  ensureSplineSharpArray(entry);
  const geo = buildSplineLineGeometry(entry.splinePoints, entry.closed, entry.splineSharp);
  entry.mesh.geometry.dispose();
  entry.mesh.geometry = geo;
}

// Punto unico por el que pasan drag/agregar/sacar un punto: si la curva ya
// es una Revolucion/Tubo/Extrusion, hay que volver a correr ESE generador
// (con los mismos parametros que ya tenia) para que el solido seonga al
// dia; si todavia es una guia sin convertir, alcanza con rehacer la linea.
function regenerateEntryFromPoints(entry) {
  if (entry.kind === 'lathe') { applyLathe(entry, entry.latheSegments); return; }
  if (entry.kind === 'tube') { applyTube(entry, entry.tubeRootRadius, entry.tubeTipRadius, entry.tubeRadialSegments); return; }
  if (entry.kind === 'extrude') { applyExtrude(entry, entry.extrudeDepth, entry.extrudeBevel, entry.extrudeBevelSize); return; }
  rebuildSplineGeometry(entry);
}

let splineDragging = false;
// Plano de arrastre fijado al empezar a tocar un punto -- ver comentario
// dentro de startSplinePointDrag.
let splineDragPlane = null;
function startSplinePointDrag(mesh, cam) {
  draggingSplinePointIndex = mesh.userData.pointIndex;
  activeSplinePointIndex = mesh.userData.pointIndex; // ese punto queda "activo" para el toggle de Punto duro
  syncSplineSharpCheckbox();
  splineDragging = true;
  orbit.enabled = false;
  // Se fija un plano que pasa por la posicion ACTUAL del punto, de frente
  // a la camara activa en este instante -- en una vista ortografica
  // (Izquierda/Frente/Arriba) ese plano coincide EXACTO con el plano de
  // esa vista, asi arrastrar el punto solo lo mueve "arriba/abajo" o "al
  // lado" (las 2 direcciones que se ven en pantalla), nunca de golpe
  // hacia adelante/atras de la pantalla. Antes se reusaba el mismo
  // raycast que usa Pelo (nextHairPoint), pensado para PEGARSE a
  // cualquier superficie que el rayo encuentre en el medio -- una vez
  // que la curva ya es un solido de verdad (Revolucion/Tubo/Extrusion),
  // su propio bulto quedaba en el medio del rayo y el punto saltaba a
  // esa superficie en vez de moverse parejo (reportado: "se mueven por
  // todos lados").
  const camForPlane = cam || (fourViewMode ? GRID_CAMS[activeQuadrant] : activeCamera);
  const camDir = new THREE.Vector3();
  camForPlane.getWorldDirection(camDir);
  splineDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, mesh.position);
}

function onSplinePointDrag(clientX, clientY) {
  if (draggingSplinePointIndex < 0 || !splineDragPlane) return;
  const { rect, cam } = getPointerRayContext(clientX, clientY);
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, cam);
  const worldPoint = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(splineDragPlane, worldPoint)) return; // camara casi de canto contra el plano -- no deberia pasar en la practica
  if (splineEditingId != null) {
    const entry = sceneObjects.get(splineEditingId);
    if (!entry) return;
    const local = entry.mesh.worldToLocal(worldPoint);
    entry.splinePoints[draggingSplinePointIndex].copy(local);
    regenerateEntryFromPoints(entry);
    refreshSplinePointHandles();
    return;
  }
  // Arrastrando un punto YA PUESTO de un trazo NUEVO todavia sin terminar
  // (splineEditingId sigue null): splinePoints ya esta en espacio MUNDO
  // mientras se dibuja, asi que se copia el punto de interseccion directo,
  // sin pasar por worldToLocal (eso es solo para objetos ya creados con su
  // propia matriz de transformacion).
  if (draggingSplinePointIndex < splinePoints.length) {
    splinePoints[draggingSplinePointIndex].copy(worldPoint);
    updateSplinePreview();
  }
}

function stopSplinePointDrag() {
  if (draggingSplinePointIndex < 0) return;
  const wasEditingExisting = (splineEditingId != null);
  draggingSplinePointIndex = -1;
  splineDragging = false;
  splineDragPlane = null;
  orbit.enabled = true;
  if (wasEditingExisting) pushHistory();
  else pushSplineDraftHistory();
}

// Doble toque sobre una bolita de un punto YA PUESTO de un trazo NUEVO
// todavia sin terminar (splineEditingId sigue null) -- mismo gesto y misma
// regla (no dejar menos de 2 puntos) que removeSplinePointAt, pero sobre el
// trazo en construccion en vez de sobre un objeto ya creado.
function removeDraftPointAt(index) {
  if (splinePoints.length <= 2) return;
  splinePoints.splice(index, 1);
  splineDraftSharp.splice(index, 1);
  activeSplinePointIndex = -1; // los indices se corrieron
  updateSplinePreview();
  syncSplineSharpCheckbox();
  pushSplineDraftHistory();
}

function removeSplinePointAt(entry, index) {
  if (entry.splinePoints.length <= 2) return; // no dejar una curva con menos de 2 puntos
  entry.splinePoints.splice(index, 1);
  if (entry.splineSharp) entry.splineSharp.splice(index, 1);
  activeSplinePointIndex = -1; // los indices se corrieron -- no queda claro cual "seguia siendo" el mismo punto
  regenerateEntryFromPoints(entry);
  refreshSplinePointHandles();
  syncSplineSharpCheckbox();
  pushHistory();
}

// Tocar: si se toca una bolita existente, arranca el arrastre de ese punto;
// si no hay ninguna bolita tocada pero se esta editando una curva ya
// creada, el toque AGREGA un punto nuevo al final; si no hay ninguna curva
// en edicion, el toque agrega un punto al trazo NUEVO que se esta armando.
// Ojo: las bolitas SOLO son tocables (arrastrables) mientras se esta
// EDITANDO una curva ya existente (splineEditingId != null) -- mientras
// se esta DIBUJANDO un trazo nuevo tambien se ven bolitas (ver
// refreshDraftPointHandles, para no "dibujar a ciegas"), pero son solo
// una referencia visual: tocar cerca de una de ellas sigue agregando el
// siguiente punto del trazo, no la arrastra.
wrap.addEventListener('pointerdown', (e) => {
  if (toolMode !== 'spline') return;
  const { rect, cam } = getPointerRayContext(e.clientX, e.clientY);
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, cam);
  // Las bolitas ahora son tocables/arrastrables tanto editando una curva ya
  // existente COMO mientras se dibuja un trazo nuevo -- pedido explicito:
  // "poder seleccionar puntos ya hechos para editar posicion o dejarlo
  // punto duro" (antes esto solo funcionaba despues de "Finalizar Curva").
  const hits = raycaster.intersectObjects(splinePointMeshes, false);
  if (hits.length > 0) {
    e.stopPropagation();
    startSplinePointDrag(hits[0].object, cam);
    return;
  }
  if (splineEditingId != null) {
    const entry = sceneObjects.get(splineEditingId);
    if (entry) { addSplinePointAtEndFromScreen(entry, e.clientX, e.clientY); return; }
  }
  const p = nextHairPoint(e.clientX, e.clientY);
  splinePoints.push(p);
  splineDraftSharp.push(false);
  activeSplinePointIndex = splinePoints.length - 1; // el punto recien puesto queda "activo" para el toggle de Punto duro
  syncSplineSharpCheckbox();
  updateSplinePreview();
  pushSplineDraftHistory();
}, { capture: true });

function addSplinePointAtEndFromScreen(entry, clientX, clientY) {
  // Mismo criterio que arrastrar un punto (ver startSplinePointDrag): el
  // punto nuevo se agrega sobre el plano de cara a la camara actual que
  // pasa por el ULTIMO punto ya existente, no sobre lo primero que el
  // rayo encuentre -- asi sigue en el mismo plano "chato" que el resto
  // del perfil en vez de pegarse a la superficie del propio solido.
  const { rect, cam } = getPointerRayContext(clientX, clientY);
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, cam);
  entry.mesh.updateMatrixWorld(true);
  const lastLocal = entry.splinePoints[entry.splinePoints.length - 1];
  const refWorld = lastLocal ? lastLocal.clone().applyMatrix4(entry.mesh.matrixWorld) : entry.mesh.getWorldPosition(new THREE.Vector3());
  const camDir = new THREE.Vector3();
  cam.getWorldDirection(camDir);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, refWorld);
  const worldPoint = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, worldPoint)) return;
  const local = entry.mesh.worldToLocal(worldPoint);
  entry.splinePoints.push(local);
  ensureSplineSharpArray(entry);
  activeSplinePointIndex = entry.splinePoints.length - 1; // el punto recien agregado queda "activo" para el toggle de Punto duro
  regenerateEntryFromPoints(entry);
  refreshSplinePointHandles();
  syncSplineSharpCheckbox();
  pushHistory();
}

// Doble toque sobre una bolita: saca ese punto de la curva (si quedan mas
// de 2). Mismo gesto que "borrar" en la mayoria de editores de curvas --
// funciona tanto editando una curva ya existente como sobre un trazo nuevo
// todavia sin terminar.
wrap.addEventListener('dblclick', (e) => {
  if (toolMode !== 'spline') return;
  const { rect, cam } = getPointerRayContext(e.clientX, e.clientY);
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, cam);
  const hits = raycaster.intersectObjects(splinePointMeshes, false);
  if (hits.length === 0) return;
  const idx = hits[0].object.userData.pointIndex;
  if (splineEditingId != null) {
    const entry = sceneObjects.get(splineEditingId);
    if (entry) removeSplinePointAt(entry, idx);
    return;
  }
  removeDraftPointAt(idx);
});

// =====================================================================
// GENERADOR: REVOLUCION / LATHE -- convierte la curva en un solido
// girandola 360 grados, igual que "Lathe NURBS" en Cinema4D o el
// modificador "Screw"/spin en Blender: sirve para copas, floreros,
// cuencos, botellas -- cualquier figura que sea igual mirada desde
// cualquier lado alrededor de un eje vertical.
// La distancia de cada punto al eje Y (hypot(x,z), sin importar si la
// curva se dibujo en la vista Frente o Izquierda) se usa como radio, y su
// altura (y) como la altura del perfil -- se ordenan de abajo hacia
// arriba, que es como three.js espera el perfil de un LatheGeometry.
// =====================================================================
function latheProfileFromPoints(points) {
  const profile = points
    .map(p => new THREE.Vector2(Math.max(0.01, Math.hypot(p.x, p.z)), p.y))
    .sort((a, b) => a.y - b.y);
  // Evitar segmentos de altura identica (LatheGeometry no soporta un radio
  // "saltando" en el mismo Y) -- se separan por una fraccion de mm.
  for (let i = 1; i < profile.length; i++) {
    if (profile[i].y <= profile[i - 1].y) profile[i].y = profile[i - 1].y + 0.01;
  }
  return profile;
}

// Junta varias BufferGeometry INDEXADAS en una sola (posiciones, normales,
// UV e indices, todo desplazado correctamente) -- version chica hecha a
// mano en vez de importar el modulo entero de BufferGeometryUtils, ya que
// solo hace falta para este caso puntual (pegarle las tapas al Lathe).
function mergeIndexedGeometries(geometries) {
  const positions = [], normals = [], uvs = [], indices = [];
  let vertexOffset = 0;
  for (const g of geometries) {
    const posAttr = g.getAttribute('position');
    const normAttr = g.getAttribute('normal');
    const uvAttr = g.getAttribute('uv');
    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      if (normAttr) normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      if (uvAttr) uvs.push(uvAttr.getX(i), uvAttr.getY(i));
    }
    const idx = g.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + vertexOffset);
    } else {
      for (let i = 0; i < posAttr.count; i++) indices.push(i + vertexOffset);
    }
    vertexOffset += posAttr.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length === positions.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length === (positions.length / 3) * 2) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
}

// Disco chato que tapa una punta del Lathe (arriba o abajo) -- un abanico
// de triangulos desde el centro (0, y, 0) hasta el circulo de radio "radius"
// a esa altura, con la misma cantidad de divisiones ("segs") que el
// costado para que se vea prolijo. "facingUp" decide para que lado mira
// (arriba=+Y, abajo=-Y) -- afecta tanto la normal como el orden de los
// vertices de cada triangulo (si el orden no coincide con la normal, esa
// cara queda invisible de ese lado con material.side=FrontSide).
function buildLatheCapGeometry(radius, y, segs, facingUp) {
  const positions = [0, y, 0];
  const normals = [0, facingUp ? 1 : -1, 0];
  const uvs = [0.5, 0.5];
  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    const x = Math.cos(theta) * radius, z = Math.sin(theta) * radius;
    positions.push(x, y, z);
    normals.push(0, facingUp ? 1 : -1, 0);
    uvs.push(0.5 + Math.cos(theta) * 0.5, 0.5 + Math.sin(theta) * 0.5);
  }
  const indices = [];
  for (let i = 1; i <= segs; i++) {
    const center = 0, a = i, b = i + 1;
    if (facingUp) indices.push(center, b, a); else indices.push(center, a, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function applyLathe(entry, segments) {
  // Acepta tanto una curva sin convertir todavia ('spline', la primera vez
  // que se aplica el generador) como una ya convertida ('lathe', cuando
  // el slider de "Segmentos" en Atributos la vuelve a generar en vivo con
  // otro valor) -- ambas conservan splinePoints para poder rehacerla.
  if (!entry || (entry.kind !== 'spline' && entry.kind !== 'lathe') || !entry.splinePoints || entry.splinePoints.length < 2) return;
  ensureSolidMeshForGenerator(entry);
  const segs = segments != null ? segments : (entry.latheSegments || 32);
  const profile = latheProfileFromPoints(entry.splinePoints);
  const sideGeo = new THREE.LatheGeometry(profile, segs);
  sideGeo.computeVertexNormals();
  // "Tapas" (prendido por defecto, igual que Cinema4D): si el perfil no
  // toca el eje de Revolucion (radio > 0) en la punta de abajo y/o de
  // arriba, esa punta queda como un circulo ABIERTO -- un aro hueco por
  // dentro en vez de un solido de verdad. Reportado por Andres comparando
  // con una captura de Cinema4D del mismo proyecto ("segun mis calculos
  // como esta el spline no deberia crearse como una tapa? si es 360?").
  // Si el radio en esa punta ya es ~0 (el perfil vuelve solo al eje, como
  // el pie de una copa), no hace falta tapa -- ya cierra solo, sin agujero.
  const LATHE_CAP_EPS = 0.05;
  const capsOn = (entry.latheCaps !== false);
  const parts = [sideGeo];
  if (capsOn) {
    const bottom = profile[0], top = profile[profile.length - 1];
    if (bottom.x > LATHE_CAP_EPS) parts.push(buildLatheCapGeometry(bottom.x, bottom.y, segs, false));
    if (top.x > LATHE_CAP_EPS) parts.push(buildLatheCapGeometry(top.x, top.y, segs, true));
  }
  const geo = parts.length > 1 ? mergeIndexedGeometries(parts) : sideGeo;
  entry.mesh.geometry.dispose();
  entry.mesh.geometry = geo;
  entry.mesh.material.side = THREE.FrontSide;
  entry.kind = 'lathe';
  entry.latheSegments = segs;
  renderLayerList();
  updateHandles(entry.id);
}
if (latheApplyBtn) latheApplyBtn.addEventListener('click', () => {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  applyLathe(entry, entry ? entry.latheSegments : undefined);
  selectObject(selectedId); // refresca Atributos: ahora es 'lathe', no 'spline'
  pushHistory();
});

// =====================================================================
// GENERADOR: TUBO / SWEEP -- convierte la curva en un tubo solido con
// grosor ajustable en la raiz y en la punta, igual que el modificador
// "Sweep" de Cinema4D o "Extrude along curve" en Blender: sirve para
// mangos, asas, cuernos, colas, marcos, aros -- cualquier figura larga
// que siga una linea curva. Reusa el mismo builder que ya usa Pelo
// (buildTaperedTubeGeometry), solo que sobre los puntos EDITABLES del
// Spline en vez de un trazo fijo -- por eso, a diferencia del Pelo, sus
// tres parametros quedan siempre editables en vivo desde Atributos.
// =====================================================================
function applyTube(entry, rootRadius, tipRadius, radialSegments) {
  // Igual que applyLathe: acepta una curva sin convertir ('spline', la
  // primera vez que se aplica el generador) o una ya convertida ('tube',
  // cuando los deslizadores de Atributos la regeneran en vivo con otro
  // grosor/segmentos) -- ambas conservan splinePoints para poder rehacerla.
  if (!entry || (entry.kind !== 'spline' && entry.kind !== 'tube') || !entry.splinePoints || entry.splinePoints.length < 2) return;
  ensureSolidMeshForGenerator(entry);
  const root = rootRadius != null ? rootRadius : (entry.tubeRootRadius != null ? entry.tubeRootRadius : TUBE_DEFAULT_ROOT_RADIUS);
  const tip = tipRadius != null ? tipRadius : (entry.tubeTipRadius != null ? entry.tubeTipRadius : TUBE_DEFAULT_TIP_RADIUS);
  const segs = radialSegments != null ? radialSegments : (entry.tubeRadialSegments || TUBE_DEFAULT_RADIAL_SEGMENTS);
  const geo = buildTaperedTubeGeometry(entry.splinePoints, root, tip, segs);
  entry.mesh.geometry.dispose();
  entry.mesh.geometry = geo;
  entry.kind = 'tube';
  entry.tubeRootRadius = root;
  entry.tubeTipRadius = tip;
  entry.tubeRadialSegments = segs;
  renderLayerList();
  updateHandles(entry.id);
}
const tubeApplyBtn = document.getElementById('tubeApplyBtn');
if (tubeApplyBtn) tubeApplyBtn.addEventListener('click', () => {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  applyTube(entry, TUBE_DEFAULT_ROOT_RADIUS, TUBE_DEFAULT_TIP_RADIUS, TUBE_DEFAULT_RADIAL_SEGMENTS);
  selectObject(selectedId); // refresca Atributos: ahora es 'tube', no 'spline'
  pushHistory();
});

// =====================================================================
// GENERADOR: EXTRUSION -- toma una curva CERRADA (dibujada plana, en
// cualquiera de las 3 vistas ortogonales: Frente, Izquierda o Arriba) y le
// da volumen empujandola derecho hacia adelante, igual que el modificador
// "Extrude" de Cinema4D/Blender: sirve para letras, logos, llaveros,
// estrellas, cualquier forma plana recortada con espesor.
// Como la curva puede haberse dibujado en cualquiera de las 3 vistas, se
// detecta sola cual de los 3 ejes (x/y/z) quedo practicamente constante
// (la "profundidad" de esa vista) -- los otros dos ejes son la forma en 2D,
// y la extrusion avanza sobre el eje detectado. Mismo truco de
// "no importa la vista" que ya usa latheProfileFromPoints.
// =====================================================================
function extrudeProfileFromPoints(points, sharp) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y), zs = points.map(p => p.z);
  const rangeX = Math.max(...xs) - Math.min(...xs);
  const rangeY = Math.max(...ys) - Math.min(...ys);
  const rangeZ = Math.max(...zs) - Math.min(...zs);
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

  let axis, flatValue, shape2D;
  if (rangeX <= rangeY && rangeX <= rangeZ) {
    axis = 'x'; flatValue = avg(xs);
    shape2D = points.map(p => new THREE.Vector2(-p.z, p.y)); // vista Izquierda
  } else if (rangeY <= rangeX && rangeY <= rangeZ) {
    axis = 'y'; flatValue = avg(ys);
    shape2D = points.map(p => new THREE.Vector2(p.x, -p.z)); // vista Arriba
  } else {
    axis = 'z'; flatValue = avg(zs);
    shape2D = points.map(p => new THREE.Vector2(p.x, p.y)); // vista Frente
  }

  // Recorre el contorno CERRADO con sampleCurveWithCorners: liso
  // (Catmull-Rom) salvo en los puntos marcados "esquina dura" via 'sharp',
  // que salen rectos -- antes SIEMPRE se suavizaba entero con Catmull-Rom,
  // por eso un perfil rectangular (para hacer, p.ej., un cubo) salia con
  // las esquinas redondeadas sin remedio (reportado: "si creo un cubo me
  // sale redondo").
  const vec3ForShape = shape2D.map(v => new THREE.Vector3(v.x, v.y, 0));
  const smoothCount = Math.max(3, Math.ceil(Math.max(24, shape2D.length * 8) / shape2D.length));
  const sampled = sampleCurveWithCorners(vec3ForShape, true, sharp, smoothCount);
  const points2D = sampled.map(v => new THREE.Vector2(v.x, v.y));
  return { axis, flatValue, points2D };
}

function applyExtrude(entry, depth, bevelEnabled, bevelSize) {
  // Igual que applyLathe/applyTube: acepta 'spline' (primera vez) o
  // 'extrude' (cuando los deslizadores de Atributos la regeneran en vivo).
  if (!entry || (entry.kind !== 'spline' && entry.kind !== 'extrude') || !entry.splinePoints || entry.splinePoints.length < 3) return;
  ensureSolidMeshForGenerator(entry);
  const d = depth != null ? depth : (entry.extrudeDepth != null ? entry.extrudeDepth : EXTRUDE_DEFAULT_DEPTH);
  const bevel = bevelEnabled != null ? bevelEnabled : (entry.extrudeBevel != null ? entry.extrudeBevel : false);
  const bsize = bevelSize != null ? bevelSize : (entry.extrudeBevelSize != null ? entry.extrudeBevelSize : EXTRUDE_DEFAULT_BEVEL_SIZE);
  ensureSplineSharpArray(entry);
  const profile = extrudeProfileFromPoints(entry.splinePoints, entry.splineSharp);

  const shape = new THREE.Shape();
  profile.points2D.forEach((p, i) => { if (i === 0) shape.moveTo(p.x, p.y); else shape.lineTo(p.x, p.y); });
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d, bevelEnabled: bevel, bevelThickness: bevel ? bsize : 0, bevelSize: bevel ? bsize : 0, bevelSegments: 3, curveSegments: 12
  });
  // La extrusion sale siempre sobre el eje local Z (0..depth) -- se rota
  // para que ese eje coincida con el eje real detectado (x/y/z), y se
  // centra sobre el valor original de ese eje para que quede en el mismo
  // lugar donde se dibujo la curva, no pegada a un costado.
  if (profile.axis === 'x') { geo.rotateY(Math.PI / 2); geo.translate(profile.flatValue - d / 2, 0, 0); }
  else if (profile.axis === 'y') { geo.rotateX(-Math.PI / 2); geo.translate(0, profile.flatValue - d / 2, 0); }
  else { geo.translate(0, 0, profile.flatValue - d / 2); }
  geo.computeVertexNormals();

  entry.mesh.geometry.dispose();
  entry.mesh.geometry = geo;
  entry.mesh.material.side = THREE.FrontSide;
  entry.kind = 'extrude';
  entry.extrudeDepth = d;
  entry.extrudeBevel = bevel;
  entry.extrudeBevelSize = bsize;
  renderLayerList();
  updateHandles(entry.id);
}
const extrudeApplyBtn = document.getElementById('extrudeApplyBtn');
if (extrudeApplyBtn) extrudeApplyBtn.addEventListener('click', () => {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (entry && entry.splinePoints && entry.splinePoints.length < 3) {
    alert('Hacen falta al menos 3 puntos para cerrar la forma y darle volumen con Extrusión.');
    return;
  }
  applyExtrude(entry, EXTRUDE_DEFAULT_DEPTH, false, EXTRUDE_DEFAULT_BEVEL_SIZE);
  selectObject(selectedId); // refresca Atributos: ahora es 'extrude', no 'spline'
  pushHistory();
});

// Interacción de Tiradores Directos (Push-Pull Handles)
wrap.addEventListener('pointerdown', (e) => {
  if (handleGroup.visible && selectedId != null && !transform.dragging && toolMode !== 'sculpt' && toolMode !== 'hair') {
    const { rect, cam } = getPointerRayContext(e.clientX, e.clientY);
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, cam);
    const hits = raycaster.intersectObjects(handleMeshes, false);
    if (hits.length > 0) {
      e.stopPropagation();
      startHandleDrag(hits[0].object, e.clientX, e.clientY); // ← pasar coordenadas
      return;
    }
  }
}, { capture: true });

wrap.addEventListener('pointerdown', (e) => {
  if (toolMode !== 'hair') return;
  clearHairPreview();
  hairPoints = [nextHairPoint(e.clientX, e.clientY)];
  hairDragging = true;
  orbit.enabled = false;
  pendingHairPoint = { clientX: e.clientX, clientY: e.clientY };
}, { capture: true });

window.addEventListener('pointermove', (e) => {
  if (isDraggingHandle) {
    onHandleDrag(e.clientX, e.clientY);
    return;
  }
  if (splineDragging) {
    onSplinePointDrag(e.clientX, e.clientY);
    return;
  }
  if (!hairDragging && !sculptDragging && handleGroup.visible && selectedId != null) {
    const { rect, cam } = getPointerRayContext(e.clientX, e.clientY);
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, cam);
    const hits = raycaster.intersectObjects(handleMeshes, false);
    if (hits.length > 0) {
      const def = hits[0].object.userData.def;
      wrap.style.cursor = def.axis === 'y' ? 'ns-resize' : (def.axis === 'x' ? 'ew-resize' : 'nwse-resize');
    } else {
      wrap.style.cursor = 'default';
    }
  }
  if (!hairDragging) return;
  pendingHairPoint = { clientX: e.clientX, clientY: e.clientY };
});

window.addEventListener('pointerup', () => {
  if (isDraggingHandle) {
    stopHandleDrag();
  }
  if (splineDragging) {
    stopSplinePointDrag();
  }
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

function syncSymmetryMirrorsFor(srcId) {
  const srcEntry = sceneObjects.get(srcId);
  if (!srcEntry || !srcEntry.mesh || !srcEntry.mesh.geometry) return;
  sceneObjects.forEach(e => {
    if (e.isMirrorOf === srcId && e.mesh && e.mesh.geometry) {
      // Igual que en animate(): que eje espejar lo dice symAxis del Nulo de
      // Simetria (padre de este espejo), no siempre X. El orden de los
      // triangulos (winding) ya quedo arreglado una vez al crear/rearmar el
      // espejo (remirrorSymmetry) y no cambia al esculpir, asi que aca solo
      // hace falta invertir la componente del eje correcto por vertice.
      const symEntry = e.parentId != null ? sceneObjects.get(e.parentId) : null;
      const ax = symAxisIndex(symEntry ? symEntry.symAxis : 'x');
      const srcPos = srcEntry.mesh.geometry.attributes.position;
      const dstPos = e.mesh.geometry.attributes.position;
      if (srcPos && dstPos && srcPos.count === dstPos.count) {
        for (let i = 0; i < srcPos.count; i++) {
          const vx = srcPos.getX(i), vy = srcPos.getY(i), vz = srcPos.getZ(i);
          dstPos.setXYZ(i, ax === 0 ? -vx : vx, ax === 1 ? -vy : vy, ax === 2 ? -vz : vz);
        }
        dstPos.needsUpdate = true;
        e.mesh.geometry.computeVertexNormals();
        e.mesh.geometry.computeBoundingSphere();
        e.sculpted = true;
      }
    }
  });
}

function applySculptStroke(entry, localPoint, brush, size, strength) {
  const centers = [{ pt: localPoint, signX: 1 }];
  if (symmetryXInput && symmetryXInput.checked) {
    centers.push({ pt: new THREE.Vector3(-localPoint.x, localPoint.y, localPoint.z), signX: -1 });
  }

  const geo = entry.mesh.geometry;
  const posAttr = geo.attributes.position;
  const normAttr = geo.attributes.normal;
  const radius = size;
  const count = posAttr.count;

  if (brush === 'smooth') {
    const adj = getAdjacency(geo);
    const original = posAttr.array.slice();
    for (let i = 0; i < count; i++) {
      const vx = original[i * 3], vy = original[i * 3 + 1], vz = original[i * 3 + 2];
      let maxFalloff = 0;
      centers.forEach(c => {
        const dx = vx - c.pt.x, dy = vy - c.pt.y, dz = vz - c.pt.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist <= radius) maxFalloff = Math.max(maxFalloff, 1 - dist / radius);
      });
      if (maxFalloff <= 0) continue;
      const neighbors = adj[i];
      if (!neighbors || neighbors.size === 0) continue;
      let ax = 0, ay = 0, az = 0;
      neighbors.forEach(n => { ax += original[n * 3]; ay += original[n * 3 + 1]; az += original[n * 3 + 2]; });
      const cnt = neighbors.size;
      ax /= cnt; ay /= cnt; az /= cnt;
      const k = maxFalloff * strength * 0.15;
      posAttr.setXYZ(i, vx + (ax - vx) * k, vy + (ay - vy) * k, vz + (az - vz) * k);
    }
  } else if (brush === 'flatten') {
    centers.forEach(c => {
      let avgX = 0, avgY = 0, avgZ = 0;
      let avgNx = 0, avgNy = 0, avgNz = 0;
      let cnt = 0;
      for (let i = 0; i < count; i++) {
        const vx = posAttr.getX(i), vy = posAttr.getY(i), vz = posAttr.getZ(i);
        const dx = vx - c.pt.x, dy = vy - c.pt.y, dz = vz - c.pt.z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= radius) {
          avgX += vx; avgY += vy; avgZ += vz;
          if (normAttr) { avgNx += normAttr.getX(i); avgNy += normAttr.getY(i); avgNz += normAttr.getZ(i); }
          cnt++;
        }
      }
      if (cnt > 0) {
        avgX /= cnt; avgY /= cnt; avgZ /= cnt;
        let norm = new THREE.Vector3(avgNx, avgNy, avgNz).normalize();
        if (norm.lengthSq() < 0.001) norm.set(0, 1, 0);
        for (let i = 0; i < count; i++) {
          const vx = posAttr.getX(i), vy = posAttr.getY(i), vz = posAttr.getZ(i);
          const dx = vx - c.pt.x, dy = vy - c.pt.y, dz = vz - c.pt.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > radius) continue;
          const t = 1 - dist / radius;
          const falloff = t * t * (3 - 2 * t);
          const distToPlane = (vx - avgX) * norm.x + (vy - avgY) * norm.y + (vz - avgZ) * norm.z;
          const k = falloff * strength * 0.2;
          posAttr.setXYZ(i, vx - norm.x * distToPlane * k, vy - norm.y * distToPlane * k, vz - norm.z * distToPlane * k);
        }
      }
    });
  } else {
    const origPos = posAttr.array.slice();
    for (let i = 0; i < count; i++) {
      const vx = origPos[i * 3], vy = origPos[i * 3 + 1], vz = origPos[i * 3 + 2];
      let totalDx = 0, totalDy = 0, totalDz = 0;
      centers.forEach(c => {
        const dx = vx - c.pt.x, dy = vy - c.pt.y, dz = vz - c.pt.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > radius) return;
        const t = 1 - dist / radius;
        const falloff = t * t * (3 - 2 * t);
        if (brush === 'pinch') {
          const k = falloff * strength * 0.08;
          totalDx += (c.pt.x - vx) * k;
          totalDy += (c.pt.y - vy) * k;
          totalDz += (c.pt.z - vz) * k;
        } else {
          const nx = normAttr ? normAttr.getX(i) : 0;
          const ny = normAttr ? normAttr.getY(i) : 1;
          const nz = normAttr ? normAttr.getZ(i) : 0;
          const dir = brush === 'pull' ? -1 : 1;
          const k = falloff * strength * 0.6 * dir;
          totalDx += nx * k;
          totalDy += ny * k;
          totalDz += nz * k;
        }
      });
      if (totalDx !== 0 || totalDy !== 0 || totalDz !== 0) {
        posAttr.setXYZ(i, vx + totalDx, vy + totalDy, vz + totalDz);
      }
    }
  }

  posAttr.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  entry.sculpted = true;

  syncSymmetryMirrorsFor(entry.id);
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

if (hairRootRadiusInput) {
  hairRootRadiusInput.addEventListener('input', () => {
    HAIR_ROOT_RADIUS = parseFloat(hairRootRadiusInput.value);
    updateHairPreview(); // si hay un trazo en curso, se ve el grosor nuevo al toque
  });
}
if (hairTipRadiusInput) {
  hairTipRadiusInput.addEventListener('input', () => {
    HAIR_TIP_RADIUS = parseFloat(hairTipRadiusInput.value);
    updateHairPreview();
  });
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (transform.dragging) return;
  if (toolMode === 'hair' || toolMode === 'spline') return; // en modo Pelo/Curva, tocar dibuja -- no selecciona
  onPick(e.clientX, e.clientY);
});

// En modo "4 vistas", antes de que OrbitControls/TransformControls procesen
// el mismo toque hay que decidir a que camara (cuadrante) corresponde --
// por eso este listener va en la fase de "captura" sobre #canvasWrap (un
// ancestro del canvas), que se dispara ANTES de que el evento llegue al
// canvas donde estan enganchados esos controles.
wrap.addEventListener('pointerdown', (e) => {
  if (!fourViewMode) return;
  // Si ya hay un dedo abajo (por ejemplo, arrastrando/orbitando en otro
  // cuadrante) y llega un SEGUNDO toque simultaneo (un pellizco de zoom, o
  // un dedo de mas apoyado sin querer junto al lapiz), ese segundo toque
  // NO es "isPrimary" -- no debe cambiar de camara activa a mitad de un
  // gesto que todavia esta en curso. Cambiarla ahi (reasignando
  // orbit.object) deja pendiente el giro/paneo que se estaba acumulando
  // para la camara VIEJA y se lo aplica de golpe a la camara NUEVA cuando
  // useCamera() llama a orbit.update() -- eso desalineaba para siempre una
  // de las camaras fijas (Frente/Izquierda/Arriba), que no se supone que
  // roten nunca.
  if (!e.isPrimary) return;
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
  hair: 'Dibujar Pelo',
  spline: 'Curva / Spline'
};

function syncCanvasTop() {
  handleResize();
}

function setMode(mode) {
  const prevMode = toolMode;
  if (prevMode === 'spline' && mode !== 'spline') {
    // Salir del modo Curva sin terminarla: se descarta el trazo a medio
    // hacer (si habia uno) y se esconden las bolitas de edicion -- igual
    // que Esculpir/Pelo no dejan un pincel "a medio pasar" prendido.
    clearSplinePreview();
    splinePoints = [];
    splineDraftSharp = [];
    splineDraftHistory = [];
    splineDraftHistoryIndex = -1;
    stopSplinePointEdit();
  }
  toolMode = mode;
  modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  if (statusInfo) statusInfo.textContent = `Editor 3D - Modo ${MODE_NAMES[mode] || mode}`;

  if (mode === 'sculpt') {
    transform.detach();
    brushRow.style.display = 'flex';
    if (hairRow) hairRow.style.display = 'none';
    if (splineFinishBtn) splineFinishBtn.parentElement.style.display = 'none';
    if (defaultToolOptions) defaultToolOptions.style.display = 'none';
  } else if (mode === 'hair') {
    transform.detach();
    brushRow.style.display = 'none';
    if (hairRow) hairRow.style.display = 'flex';
    if (splineFinishBtn) splineFinishBtn.parentElement.style.display = 'none';
    if (defaultToolOptions) defaultToolOptions.style.display = 'none';
  } else if (mode === 'spline') {
    transform.detach();
    brushRow.style.display = 'none';
    if (hairRow) hairRow.style.display = 'none';
    if (splineFinishBtn) splineFinishBtn.parentElement.style.display = 'flex';
    if (defaultToolOptions) defaultToolOptions.style.display = 'none';
    // Si ya hay una Curva (o una Revolucion/Tubo/Extrusion generados a
    // partir de una) seleccionada, entrar directo a editar sus puntos.
    if (selectedId != null) {
      const entry = sceneObjects.get(selectedId);
      if (canEditSplinePoints(entry)) startSplinePointEdit(selectedId);
      else { syncSplineClosedCheckbox(); updateHistoryButtons(); }
    } else {
      syncSplineClosedCheckbox();
      updateHistoryButtons();
    }
  } else if (mode === 'scale') {
    // Los tiradores directos (con mm e iman) son el unico control de
    // escalar ahora -- se apaga el gizmo clasico para que no queden los
    // dos superpuestos en el mismo lugar.
    transform.detach();
    brushRow.style.display = 'none';
    if (hairRow) hairRow.style.display = 'none';
    if (splineFinishBtn) splineFinishBtn.parentElement.style.display = 'none';
    if (defaultToolOptions) defaultToolOptions.style.display = 'flex';
  } else {
    brushRow.style.display = 'none';
    if (hairRow) hairRow.style.display = 'none';
    if (splineFinishBtn) splineFinishBtn.parentElement.style.display = 'none';
    if (defaultToolOptions) defaultToolOptions.style.display = 'flex';
    transform.setMode(mode);
    if (selectedId != null) {
      const entry = sceneObjects.get(selectedId);
      if (entry) transform.attach(entry.mesh);
    }
  }
  // Actualizar tiradores: solo se ven en modo scale
  updateHandles(selectedId);
  updateAxisGuideVisibility(); // la guia del eje de Revolucion solo se ve en modo Curva
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
  // Con "enableDamping" prendido (para que orbitar se sienta suave),
  // OrbitControls NUNCA descarta de golpe el giro/paneo/zoom que quedo "en
  // el aire" al soltar el dedo (_sphericalDelta/_panOffset/_scale) -- los
  // va apagando de a poco, multiplicandolos por (1-dampingFactor) en CADA
  // cuadro de animate(), durante varios cuadros mas despues de soltar. Si
  // se cambia de camara ANTES de que ese resto termine de apagarse (por
  // ejemplo: orbitar la vista 3D, soltar, y enseguida tocar el cuadrante
  // Izquierda para trabajar ahi -- un gesto de lo mas normal), la porcion
  // de giro/paneo que todavia quedaba pendiente de la camara VIEJA se le
  // aplica de golpe a la camara NUEVA en el proximo cuadro -- y como las
  // camaras fijas (Frente/Izquierda/Arriba/etc.) nunca se vuelven a
  // reposicionar solas, quedan desalineadas PARA SIEMPRE con ese empujon,
  // aunque nunca se las haya tocado a proposito (bug reportado: "el
  // izquierdo aun se mueve"). Ya se habia arreglado un caso parecido de
  // esto mismo (un segundo dedo simultaneo cambiando de cuadrante a mitad
  // de gesto, ver mas abajo) pero ese arreglo no cubria ESTE camino, mucho
  // mas comun, de un giro ya TERMINADO (dedo levantado) cuyo resto por
  // amortiguar todavia no llego a cero. Se descarta ese resto de una vez
  // (en vez de dejar que seguir decayendo solo) cada vez que se cambia de
  // camara, para que un cambio de vista/cuadrante siempre arranque "limpio".
  orbit._sphericalDelta.set(0, 0, 0);
  orbit._panOffset.set(0, 0, 0);
  orbit._scale = 1;
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
    restoreQuadView(); // no dejar un cuadrante "maximizado" pegado si se sale por este boton en vez de por "Volver a 4 vistas"
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

// Si no es null, ESE cuadrante ocupa todo el canvas (los otros 3 quedan
// escondidos, no destruidos) -- el boton "⛶" de cada cuadrante lo prende,
// "Volver a 4 vistas" lo apaga. Sigue siendo "modo 4 vistas" por dentro
// (fourViewMode no cambia), solo que se dibuja/toca uno solo por vez.
let maximizedQuadrant = null;

function quadrantAt(clientX, clientY) {
  if (maximizedQuadrant) return maximizedQuadrant;
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
  if (maximizedQuadrant) return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
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
  if (maximizedQuadrant) return { x: 0, y: 0, w, h };
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
    restoreQuadView(); // si se salia del modo 4 vistas con un cuadrante maximizado, no dejarlo "pegado"
    setView(currentViewKey);
  }
});

// Boton "⛶" en la esquina de cada cuadrante: lo agranda a pantalla
// completa sin salir del modo 4 vistas (las otras 3 camaras siguen ahi,
// solo escondidas) -- "Volver a 4 vistas" deshace esto.
document.querySelectorAll('.vp-max-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = btn.dataset.q;
    maximizedQuadrant = q;
    wrap.classList.add('quad-maximized');
    setActiveQuadrant(q);
    handleResize(); // recalcula transform.viewport para el rect a pantalla completa
  });
});
function restoreQuadView() {
  if (!maximizedQuadrant) return;
  maximizedQuadrant = null;
  wrap.classList.remove('quad-maximized');
  handleResize(); // vuelve transform.viewport al cuarto que le toca al cuadrante activo
}
const quadRestoreBtn = document.getElementById('quadRestoreBtn');
if (quadRestoreBtn) quadRestoreBtn.addEventListener('click', restoreQuadView);

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
// asignada en ESE instante (`transform.camera`). El bug original (arreglado
// antes) era que ese `transform.camera` se REASIGNABA a cada una de las 4
// camaras por turno dentro de este mismo barrido de render -- asi que al
// terminar el cuadro, siempre quedaba calibrado para la ULTIMA camara del
// barrido fijo ('br' = "Arriba"), sin importar en que cuadrante estuviera
// tocando el dedo. `setActiveQuadrant()` es el UNICO lugar que cambia
// `transform.camera` ahora (ver esa funcion) -- por eso ya no hace falta
// sacar el gizmo de la escena durante este barrido para evitar que se
// recalibre mal: como `transform.camera` nunca se toca aca, se lo puede
// dejar SIEMPRE en la escena y que las 4 camaras lo dibujen, sin volver a
// romper el arrastre (que sigue funcionando solo en el cuadrante activo,
// que es el unico al que _pan/viewport/transform.camera estan calibrados).
// Antes (sept. 2026) el gizmo se sacaba de la escena en los otros 3
// cuadrantes como forma de garantizar la calibracion -- pero eso lo hacia
// "desaparecer" cada vez que se miraba un cuadrante que no fuera el activo,
// que es justo lo que Andres reporto como molesto ("se sale", "no se ve en
// todas las camaras a la vez"). Como la calibracion ya no depende de este
// barrido, mostrarlo en los 4 a la vez es seguro.
function renderFourView() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (maximizedQuadrant) {
    // Un cuadrante "maximizado" dibuja solo, a pantalla completa -- las
    // otras 3 camaras ni se renderizan (no hace falta scissor de sobra).
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
    renderer.render(scene, GRID_CAMS[maximizedQuadrant]);
    return;
  }
  renderer.setScissorTest(true);
  ['tl', 'tr', 'bl', 'br'].forEach(q => {
    const r = quadrantGLRect(q, w, h);
    const cam = GRID_CAMS[q];
    renderer.setViewport(r.x, r.y, r.w, r.h);
    renderer.setScissor(r.x, r.y, r.w, r.h);
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
  // Live symmetry: for every mirror object, track the original's local transform
  sceneObjects.forEach(entry => {
    if (!entry.isMirrorOf) return;
    const srcEntry = sceneObjects.get(entry.isMirrorOf);
    if (!srcEntry) return;
    // El Nulo de Simetria (padre de este espejo) guarda que eje usar
    // (symAxis) y cuanta separacion extra del centro pedir (symOffset) --
    // antes esto se leia en ningun lado y siempre se espejaba fijo sobre X
    // sin separacion, por eso "Eje de Espejo" y "Separacion Centro" no
    // hacian nada visible.
    const symEntry = entry.parentId != null ? sceneObjects.get(entry.parentId) : null;
    const ax = symAxisIndex(symEntry ? symEntry.symAxis : 'x');
    const offset = (symEntry && symEntry.symOffset) ? symEntry.symOffset : 0;
    // Mirror position: invertir SOLO el eje elegido, y sumarle la separacion
    // pedida hacia el mismo lado en el que ya esta el original (o hacia +
    // si el original esta justo en el centro, offset 0 en ese eje).
    const srcP = [srcEntry.mesh.position.x, srcEntry.mesh.position.y, srcEntry.mesh.position.z];
    const side = Math.sign(srcP[ax]) || 1;
    const mirrorP = srcP.slice();
    mirrorP[ax] = -srcP[ax] - side * offset;
    entry.mesh.position.set(mirrorP[0], mirrorP[1], mirrorP[2]);
    // Mirror rotation: negar los DOS componentes que no son el eje elegido
    // (el mismo truco que antes, pero generalizado: espejar sobre X negaba
    // Y/Z, espejar sobre Y negaria X/Z, espejar sobre Z negaria X/Y).
    const srcR = [srcEntry.mesh.rotation.x, srcEntry.mesh.rotation.y, srcEntry.mesh.rotation.z];
    const mirrorR = srcR.map((v, i) => (i === ax ? v : -v));
    entry.mesh.rotation.set(mirrorR[0], mirrorR[1], mirrorR[2]);
    // Mirror scale: positive scale (no negative scale culling)
    entry.mesh.scale.set(
      srcEntry.mesh.scale.x,
      srcEntry.mesh.scale.y,
      srcEntry.mesh.scale.z
    );
    if (srcEntry.mesh.material && entry.mesh.material) {
      entry.mesh.material.opacity = srcEntry.mesh.material.opacity;
      entry.mesh.material.transparent = srcEntry.mesh.material.opacity < 1.0;
      entry.mesh.material.side = THREE.DoubleSide;
      entry.mesh.material.color.copy(srcEntry.mesh.material.color);
      entry.mesh.material.roughness = srcEntry.mesh.material.roughness;
      entry.mesh.material.metalness = srcEntry.mesh.material.metalness;
      entry.mesh.material.wireframe = srcEntry.mesh.material.wireframe;
    }
  });

  // Live clonador: los hijos existentes del clonador (matriz/lineal/circular)
  // siguen al objeto original en posicion/rotacion/escala/material SIN
  // destruir y recrear nada -- eso queda solo para cuando se toca un
  // parametro propio del clonador (cantidad, separacion, radio, modo).
  sceneObjects.forEach(entry => {
    if (entry.clonerMode == null) return;
    syncClonerChildrenLive(entry);
  });

  if (fourViewMode) {
    renderFourView();
    transform.camera = activeCamera; // deja la camara "activa" lista para el picking/gizmo del cuadrante tocado
  } else {
    renderer.render(scene, activeCamera);
  }
  updateHUDPositions();
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
    // Si la figura elegida ya es el Clonador, su original, o una de sus
    // copias, NO hay que crear un Clonador nuevo encima (quedaria uno
    // anidado adentro del otro, duplicando figuras sin querer) -- hay que
    // llevar al usuario al que YA existe, que se edita en vivo (cantidad,
    // separacion, radio, modo) desde la pestaña Atributos.
    const existing = getActiveCloner();
    if (existing) {
      if (existing.id !== selectedId) selectObject(existing.id);
      const attrTabBtn = document.querySelector('.tab-btn[data-tab="tabAttributes"]');
      if (attrTabBtn) attrTabBtn.click();
      alert('Esta figura ya tiene un Clonador aplicado. Para cambiar cantidad, separación, radio o modo, hacelo desde la pestaña Atributos (los cambios se ven al instante) en vez de crear otro.');
      return;
    }
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
  if (isCustomGeomKind(src.kind)) extraOpts.geometryData = serializeGeometry(src.mesh.geometry);
  if (src.kind === 'spline') extraOpts.closed = !!src.closed;
  const built = buildObject(src.kind, colorHex, extraOpts);
  built.node.rotation.copy(src.mesh.rotation);
  built.node.scale.copy(src.mesh.scale);
  if (!isCustomGeomKind(src.kind)) copySculptIfAny(src, built.node);
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

// Create a Null group, center its pivot on all children, and parent all given IDs into it
function groupIds(ids, groupName, metadata = {}) {
  const nullBuilt = buildObject('null', undefined, {});

  // Calcular el centro geométrico de todas las figuras
  const groupBBox = new THREE.Box3();
  ids.forEach(id => {
    const e = sceneObjects.get(id);
    if (e) groupBBox.expandByObject(e.mesh);
  });
  const center = new THREE.Vector3();
  groupBBox.getCenter(center);
  nullBuilt.node.position.copy(center);

  scene.add(nullBuilt.node);
  const nullId = objIdCounter++;
  nullBuilt.pickMesh.userData.ownerId = nullId;
  const nullEntry = {
    id: nullId, kind: 'null', mesh: nullBuilt.node, pickMesh: nullBuilt.pickMesh,
    visible: true, parentId: null, sculpted: false,
    name: groupName, collapsed: false,
    ...metadata
  };
  sceneObjects.set(nullId, nullEntry);

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
      const nullId = groupIds(createdIds, `🔁 Lineal (${srcLabel})`, {
        clonerMode: 'linear',
        clonerCount: count,
        clonerSourceId: selectedId,
        clonerChildIds: createdIds.filter(id => id !== selectedId),
        sepX: ox,
        sepY: oy,
        sepZ: oz
      });
      renderLayerList();
      selectObject(nullId);
      pushHistory();

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
      const nullId = groupIds(createdIds, `🔁 Circular (${srcLabel})`, {
        clonerMode: 'circular',
        clonerCount: count,
        clonerSourceId: selectedId,
        clonerChildIds: createdIds.filter(id => id !== selectedId),
        radius: radius,
        rotCopies: doRotate
      });
      renderLayerList();
      selectObject(nullId);
      pushHistory();

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
      const nullId = groupIds(createdIds, `🔁 Cuadrícula (${srcLabel})`, {
        clonerMode: 'grid',
        clonerCount: count,
        clonerSourceId: selectedId,
        clonerChildIds: createdIds.filter(id => id !== selectedId),
        sepX: sx,
        sepY: sy,
        sepZ: sz,
        gridX: gx,
        gridY: gy,
        gridZ: gz
      });
      renderLayerList();
      selectObject(nullId);
      pushHistory();
    }

    arrayModal.classList.remove('show');
  });
}

// =====================================================================
// FEATURE 1: BLOQUEAR / DESBLOQUEAR OBJETO
// =====================================================================
const lockToggleBtn = document.getElementById('lockToggleBtn');

function updateLockBtn(id) {
  if (!lockToggleBtn) return;
  const entry = id != null ? sceneObjects.get(id) : null;
  if (!entry) { lockToggleBtn.textContent = '🔓 Libre'; lockToggleBtn.style.color = ''; lockToggleBtn.style.borderColor = ''; return; }
  lockToggleBtn.textContent  = entry.locked ? '🔒 Bloqueado' : '🔓 Libre';
  lockToggleBtn.style.color  = entry.locked ? '#f87171' : '';
  lockToggleBtn.style.borderColor = entry.locked ? '#ef4444' : '';
}

if (lockToggleBtn) {
  lockToggleBtn.addEventListener('click', () => {
    if (selectedId == null) return;
    const entry = sceneObjects.get(selectedId);
    if (!entry) return;
    entry.locked = !entry.locked;
    if (entry.locked) {
      transform.detach();
      handleGroup.visible = false;
    } else {
      syncTransformGizmo(entry);
      updateHandles(selectedId);
    }
    updateLockBtn(selectedId);
    pushHistory();
  });
}

transform.addEventListener('mouseDown', () => {
  if (selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (entry && entry.locked) { transform.detach(); }
});

// =====================================================================
// FEATURE 2: W/H/D BADGE PERMANENTE AL SELECCIONAR
// =====================================================================
function updateWHDBadge() {
  if (selectedId == null || isDraggingHandle) {
    const b = document.getElementById('hud_badge_whd');
    if (b) b.style.display = 'none';
    return;
  }
  const entry = sceneObjects.get(selectedId);
  if (!entry || entry.kind === 'null' || !entry.mesh.geometry) {
    const b = document.getElementById('hud_badge_whd');
    if (b) b.style.display = 'none';
    return;
  }
  entry.mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(entry.mesh);
  const sz  = box.getSize(new THREE.Vector3());
  const topPos = box.getCenter(new THREE.Vector3());
  topPos.y = box.max.y + 10;
  showHudBadge('whd', `\u25a0 ${Math.round(sz.x)} \xd7 ${Math.round(sz.y)} \xd7 ${Math.round(sz.z)} mm`, topPos, 'whd');
}

const _origUpdateHUDPos = updateHUDPositions;
updateHUDPositions = function() {
  _origUpdateHUDPos();
  updateWHDBadge();
  updateLockBtn(selectedId);
};

// =====================================================================
// FEATURE 3: ALT + DRAG PARA DUPLICAR
// =====================================================================
const altDragTooltip = document.getElementById('altDragTooltip');
let altKeyHeld = false;

window.addEventListener('keydown', e => {
  if (e.key === 'Alt') {
    altKeyHeld = true;
    if (selectedId != null && altDragTooltip) altDragTooltip.style.display = 'block';
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => {
  if (e.key === 'Alt') {
    altKeyHeld = false;
    if (altDragTooltip) altDragTooltip.style.display = 'none';
  }
});

function cloneEntryByEntry(src) {
  const colorHex = src.mesh.material ? src.mesh.material.color.getHex() : undefined;
  const opts = {
    roughness: src.mesh.material ? src.mesh.material.roughness : undefined,
    metalness: src.mesh.material ? src.mesh.material.metalness : undefined,
    opacity:   src.mesh.material ? src.mesh.material.opacity   : undefined,
    wireframe: src.mesh.material ? src.mesh.material.wireframe : undefined,
  };
  if (isCustomGeomKind(src.kind)) opts.geometryData = serializeGeometry(src.mesh.geometry);
  const built = buildObject(src.kind, colorHex, opts);
  built.node.position.copy(src.mesh.position);
  built.node.rotation.copy(src.mesh.rotation);
  built.node.scale.copy(src.mesh.scale);
  if (!isCustomGeomKind(src.kind)) copySculptIfAny(src, built.node);
  const parentEntry = src.parentId != null ? sceneObjects.get(src.parentId) : null;
  if (parentEntry) { parentEntry.mesh.attach(built.node); } else { scene.add(built.node); }
  const newId = objIdCounter++;
  built.pickMesh.userData.ownerId = newId;
  sceneObjects.set(newId, {
    id: newId, kind: src.kind, mesh: built.node, pickMesh: built.pickMesh,
    visible: true, parentId: src.parentId, sculpted: !!src.sculpted,
    name: src.name ? src.name + ' (copia)' : null, collapsed: false
  });
  renderLayerList();
  return newId;
}

wrap.addEventListener('pointerdown', (e) => {
  if (!altKeyHeld || toolMode !== 'translate' || selectedId == null) return;
  const entry = sceneObjects.get(selectedId);
  if (!entry || entry.locked || entry.kind === 'null') return;
  const { rect, cam } = getPointerRayContext(e.clientX, e.clientY);
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, cam);
  const allPick = [];
  sceneObjects.forEach(ent => { if (ent.pickMesh) allPick.push(ent.pickMesh); });
  const hits = raycaster.intersectObjects(allPick, false);
  if (!hits.length || hits[0].object.userData.ownerId !== selectedId) return;
  e.stopPropagation();
  const newId = cloneEntryByEntry(entry);
  selectObject(newId);
  altKeyHeld = false;
  if (altDragTooltip) altDragTooltip.style.display = 'none';
  pushHistory();
}, { capture: true });

// =====================================================================
// FEATURE 4: LISTA DE PIEZAS
// =====================================================================
const partsListModal    = document.getElementById('partsListModal');
const partsListContent  = document.getElementById('partsListContent');
const partsListBtn      = document.getElementById('partsListBtn');
const partsListCopyBtn  = document.getElementById('partsListCopyBtn');
const partsListCloseBtn = document.getElementById('partsListCloseBtn');

function buildPartsList() {
  const rows = [];
  sceneObjects.forEach(entry => {
    if (!entry.visible || entry.kind === 'null' || entry.kind === 'hair' || entry.kind === 'spline') return;
    if (!entry.mesh.geometry) return;
    entry.mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(entry.mesh);
    const sz  = box.getSize(new THREE.Vector3());
    rows.push({ name: entry.name || KIND_LABEL[entry.kind] || entry.kind, w: Math.round(sz.x), h: Math.round(sz.y), d: Math.round(sz.z) });
  });
  return rows;
}

function showPartsList() {
  if (!partsListModal || !partsListContent) return;
  const rows = buildPartsList();
  if (!rows.length) {
    partsListContent.innerHTML = '<p style="color:#5c6370;font-size:13px;">No hay piezas en la escena.</p>';
  } else {
    let html = '<table id="partsTable"><thead><tr><th>#</th><th>Nombre</th><th>Ancho mm</th><th>Alto mm</th><th>Prof. mm</th></tr></thead><tbody>';
    rows.forEach((r, i) => {
      html += `<tr><td>${i+1}</td><td>${r.name}</td><td class="parts-total">${r.w}</td><td class="parts-total">${r.h}</td><td class="parts-total">${r.d}</td></tr>`;
    });
    html += '</tbody></table>';
    partsListContent.innerHTML = html;
  }
  partsListModal.classList.add('show');
}

if (partsListBtn)      partsListBtn.addEventListener('click', showPartsList);
if (partsListCloseBtn) partsListCloseBtn.addEventListener('click', () => partsListModal.classList.remove('show'));
if (partsListModal)    partsListModal.addEventListener('click', e => { if (e.target === partsListModal) partsListModal.classList.remove('show'); });
if (partsListCopyBtn) {
  partsListCopyBtn.addEventListener('click', () => {
    const rows = buildPartsList();
    const txt  = ['#\tNombre\tAncho\tAlto\tProf.', ...rows.map((r, i) => `${i+1}\t${r.name}\t${r.w}\t${r.h}\t${r.d}`)].join('\n');
    navigator.clipboard.writeText(txt).then(() => {
      partsListCopyBtn.textContent = '✅ Copiado';
      setTimeout(() => { partsListCopyBtn.textContent = '📋 Copiar texto'; }, 2000);
    });
  });
}

// =====================================================================
// FEATURE 5: EXPORTAR OBJ
// =====================================================================
const exportObjBtnEl = document.getElementById('exportObjBtn');
if (exportObjBtnEl) exportObjBtnEl.addEventListener('click', exportSceneAsOBJ);

function exportSceneAsOBJ() {
  let objStr = '# Exportado desde 3DPro\n\n';
  let vOffset = 1;
  sceneObjects.forEach(entry => {
    if (!entry.visible || entry.kind === 'null' || entry.kind === 'hair' || entry.kind === 'spline') return;
    if (!entry.mesh.geometry) return;
    const objName = (entry.name || KIND_LABEL[entry.kind] || entry.kind).replace(/\s+/g, '_');
    objStr += `o ${objName}\n`;
    const geo = entry.mesh.geometry.clone();
    geo.applyMatrix4(entry.mesh.matrixWorld);
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    if (!pos) { geo.dispose(); return; }
    for (let i = 0; i < pos.count; i++)
      objStr += `v ${pos.getX(i).toFixed(3)} ${pos.getY(i).toFixed(3)} ${pos.getZ(i).toFixed(3)}\n`;
    if (nrm)
      for (let i = 0; i < nrm.count; i++)
        objStr += `vn ${nrm.getX(i).toFixed(4)} ${nrm.getY(i).toFixed(4)} ${nrm.getZ(i).toFixed(4)}\n`;
    if (geo.index) {
      const idx = geo.index;
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i)+vOffset, b = idx.getX(i+1)+vOffset, c = idx.getX(i+2)+vOffset;
        objStr += nrm ? `f ${a}//${a} ${b}//${b} ${c}//${c}\n` : `f ${a} ${b} ${c}\n`;
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        const a = i+vOffset, b = i+1+vOffset, c = i+2+vOffset;
        objStr += nrm ? `f ${a}//${a} ${b}//${b} ${c}//${c}\n` : `f ${a} ${b} ${c}\n`;
      }
    }
    vOffset += pos.count;
    objStr += '\n';
    geo.dispose();
  });
  const blob = new Blob([objStr], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = '3DPro_escena.obj';
  a.click(); URL.revokeObjectURL(url);
}
