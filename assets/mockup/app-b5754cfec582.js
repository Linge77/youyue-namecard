import * as THREE from './vendor/r170/three.module.js';
import {OrbitControls} from './vendor/r170/controls/OrbitControls.js';
import {GLTFLoader} from './vendor/r170/loaders/GLTFLoader.js';
import {RoomEnvironment} from './vendor/r170/environments/RoomEnvironment.js';
import {styles,markup} from './view-6c38ab78e822.js';
const mount=document.getElementById('mk-root');
if(!mount)throw new Error('未找到物料样机工作区。');
const mockupRoot=mount.shadowRoot||mount.attachShadow({mode:'open'});
mockupRoot.innerHTML='<style>'+styles+'</style>'+markup;
const mockupGlobals={SHIRT_PHOTO_DATA_URL:new URL('./shirt-photo-23f9100a0235.png',import.meta.url).href};
let mockupActive=false;
/*
 * Procedural 3D mockup models for the standalone Three.js test page.
 * The page owns the artwork texture. Every printable surface below exposes
 * its MeshStandardMaterial through the returned `surfaces` array.
 */
(function (global) {
  'use strict';

  function mat(THREE, color, options) {
    options = options || {};
    return new THREE.MeshStandardMaterial(Object.assign({
      color: color,
      roughness: options.roughness == null ? 0.58 : options.roughness,
      metalness: options.metalness == null ? 0 : options.metalness,
      side: options.side == null ? THREE.FrontSide : options.side
    }, options));
  }

  function pushSurface(surfaces, material, aspect, label) {
    surfaces.push({ material: material, aspect: aspect, label: label || 'print surface' });
  }

  function addPlanePair(THREE, group, geometry, front, back, surfaces, aspect, position, rotation) {
    var frontMesh = new THREE.Mesh(geometry, front);
    frontMesh.position.copy(position || new THREE.Vector3());
    if (rotation) frontMesh.rotation.copy(rotation);
    group.add(frontMesh);
    if (back) {
      var backMesh = new THREE.Mesh(geometry.clone(), back);
      backMesh.position.copy(position || new THREE.Vector3());
      if (rotation) backMesh.rotation.copy(rotation);
      group.add(backMesh);
    }
    pushSurface(surfaces, front, geometry.parameters && geometry.parameters.width / geometry.parameters.height || aspect, 'front');
    return frontMesh;
  }

  function booklet(THREE) {
    var group = new THREE.Group();
    var surfaces = [];
    var width = 1.36, height = 1.86, depth = 0.11;
    var edge = mat(THREE, 0xf2f1ed, { roughness: 0.86 });
    var front = mat(THREE, 0xffffff, { roughness: 0.78 });
    var back = mat(THREE, 0xe6e4df, { roughness: 0.9 });
    var side = mat(THREE, 0xd6d3cb, { roughness: 0.88 });
    var materials = [side, side, edge, edge, front, back];
    var book = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials);
    book.position.set(0, height / 2 + 0.045, 0);
    book.rotation.set(-0.035, -0.11, -0.035);
    group.add(book);
    pushSurface(surfaces, front, width / height, 'book cover front (+Z)');

    // Page layers make the thickness read in side views without adding any
    // texture to the reverse cover.
    var page = mat(THREE, 0xfaf9f5, { roughness: 0.96 });
    for (var i = 0; i < 3; i++) {
      var pageMesh = new THREE.Mesh(new THREE.BoxGeometry(width - 0.04, height - 0.05, 0.014), page);
      pageMesh.position.set(0, height / 2 + 0.045, -0.073 - i * 0.014);
      pageMesh.rotation.copy(book.rotation);
      group.add(pageMesh);
    }
    group.rotation.y = 0.08;
    return { group: group, surfaces: surfaces, label: '画册 / 书本', camera: { position: [2.7, 2.2, 3.5], target: [0, 0.95, 0] }, dimensions: { width: width, height: height, depth: depth }, hints: { frontOnly: true } };
  }

  function curvedPaper(THREE) {
    var group = new THREE.Group();
    var surfaces = [];
    var width = 1.45, height = 1.93, segmentsX = 32, segmentsY = 48;
    var geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
    var pos = geometry.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var y = pos.getY(i);
      var edge = Math.abs(x / (width / 2));
      var bend = -0.045 * Math.pow(edge, 2) + 0.026 * Math.sin((y / height + 0.5) * Math.PI * 2);
      pos.setZ(i, bend);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    var front = mat(THREE, 0xffffff, { roughness: 0.68, side: THREE.FrontSide });
    var back = mat(THREE, 0xf4f2ec, { roughness: 0.86, side: THREE.BackSide });
    var paper = addPlanePair(THREE, group, geometry, front, back, surfaces, width / height, new THREE.Vector3(0, height / 2 + 0.05, 0), new THREE.Euler(-0.08, 0.12, -0.035));
    paper.castShadow = true;
    group.rotation.y = -0.08;
    return { group: group, surfaces: surfaces, label: 'A4 纸张', camera: { position: [2.8, 2.2, 3.7], target: [0, 1.0, 0] }, dimensions: { width: width, height: height, depth: 0.08 }, hints: { curved: true, segments: [segmentsX, segmentsY] } };
  }

  function banner(THREE) {
    var group = new THREE.Group();
    var surfaces = [];
    var width = 0.8, height = 1.8;
    var front = mat(THREE, 0xffffff, { roughness: 0.72 });
    var back = mat(THREE, 0xf0f0ed, { roughness: 0.86, side: THREE.BackSide });
    var bannerGeo = new THREE.PlaneGeometry(width, height, 2, 4);
    var panel = addPlanePair(THREE, group, bannerGeo, front, back, surfaces, width / height, new THREE.Vector3(0, height / 2 + 0.28, 0.02), new THREE.Euler(0, 0, 0));
    panel.castShadow = true;
    // Top and bottom roll tubes.
    var metal = mat(THREE, 0x9aa2a9, { roughness: 0.31, metalness: 0.83 });
    var roll = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, width + 0.08, 24), metal);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, height + 0.28, 0.01);
    group.add(roll);
    var bottom = roll.clone();
    bottom.position.y = 0.28;
    group.add(bottom);
    // A compact X support, placed behind the print plane.
    var poleGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.63, 12);
    var leftPole = new THREE.Mesh(poleGeo, metal);
    leftPole.position.set(-0.3, 0.96, -0.11);
    leftPole.rotation.z = 0.25;
    group.add(leftPole);
    var rightPole = leftPole.clone();
    rightPole.position.x = 0.3;
    rightPole.rotation.z = -0.25;
    group.add(rightPole);
    var foot = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.045, 0.22), mat(THREE, 0x3b4147, { roughness: 0.42, metalness: 0.72 }));
    foot.position.set(0, 0.08, -0.13);
    group.add(foot);
    var footFront = foot.clone();
    footFront.position.z = 0.04;
    footFront.scale.x = 0.84;
    group.add(footFront);
    group.rotation.y = 0.03;
    return { group: group, surfaces: surfaces, label: '易拉宝 · 80 × 180', camera: { position: [2.35, 1.55, 3.3], target: [0, 1.15, 0] }, dimensions: { width: width, height: height, depth: 0.28 }, hints: { printRatio: '80:180', reversible: true, support: 'x-stand' } };
  }

  function clothSurface(THREE, width, height, frontSide) {
    var nx = 28, ny = 30;
    var positions = [], uvs = [], indices = [];
    for (var j = 0; j <= ny; j++) {
      var v = j / ny;
      for (var i = 0; i <= nx; i++) {
        var u = i / nx;
        var x = (u - 0.5) * width;
        var y = v * height;
        var fold = 0.025 * Math.sin(u * Math.PI * 7 + v * 1.5) * Math.sin(v * Math.PI);
        var bulge = 0.035 * Math.sin(u * Math.PI) - 0.025 * Math.cos(v * Math.PI * 2) * Math.sin(u * Math.PI);
        var z = (frontSide ? 1 : -1) * (0.05 + fold + bulge);
        positions.push(x, y, z);
        uvs.push(u, v);
      }
    }
    for (var y = 0; y < ny; y++) {
      for (var x = 0; x < nx; x++) {
        var a = y * (nx + 1) + x, b = a + 1, c = a + nx + 1, d = c + 1;
        if (frontSide) indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
    }
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function bag(THREE) {
    var group = new THREE.Group();
    var surfaces = [];
    var width = 1.5, height = 1.62;
    var front = mat(THREE, 0xffffff, { roughness: 0.91 });
    var back = mat(THREE, 0xf7f6f2, { roughness: 0.95, side: THREE.BackSide });
    var frontGeo = clothSurface(THREE, width, height, true);
    var backGeo = clothSurface(THREE, width, height, false);
    var bodyFront = new THREE.Mesh(frontGeo, front);
    bodyFront.position.set(0, 0.12, 0);
    bodyFront.castShadow = true;
    group.add(bodyFront);
    var bodyBack = new THREE.Mesh(backGeo, back);
    bodyBack.position.set(0, 0.12, 0);
    group.add(bodyBack);
    pushSurface(surfaces, front, width / height, 'bag front');
    var cloth = mat(THREE, 0xe9e7df, { roughness: 0.95 });
    var sideL = new THREE.Mesh(new THREE.BoxGeometry(0.065, height, 0.12), cloth);
    sideL.position.set(-width / 2, 0.12 + height / 2, 0);
    group.add(sideL);
    var sideR = sideL.clone();
    sideR.position.x = width / 2;
    group.add(sideR);
    var bottom = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, 0.06, 0.14), cloth);
    bottom.position.set(0, 0.12, 0);
    group.add(bottom);
    // Woven handles rise above the bag and bend naturally.
    var handleMat = mat(THREE, 0xddd9cf, { roughness: 0.98 });
    function handle(x) {
      var curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, 1.63, 0),
        new THREE.Vector3(x * 1.12, 2.03, -0.01),
        new THREE.Vector3(x * 0.74, 2.38, -0.01),
        new THREE.Vector3(0, 2.47, -0.01),
        new THREE.Vector3(-x * 0.74, 2.38, -0.01),
        new THREE.Vector3(-x * 1.12, 2.03, -0.01),
        new THREE.Vector3(-x, 1.63, 0)
      ]);
      var mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.038, 10, false), handleMat);
      mesh.position.z = -0.03;
      group.add(mesh);
    }
    handle(0.47);
    group.rotation.y = -0.08;
    return { group: group, surfaces: surfaces, label: '手提袋', camera: { position: [2.7, 2.1, 3.6], target: [0, 1.15, 0] }, dimensions: { width: width, height: 2.47, depth: 0.18 }, hints: { cloth: true, folds: true, gltfHook: 'loadCustomBagModel' } };
  }

  function phone(THREE) {
    var group = new THREE.Group();
    var surfaces = [];
    var width = 0.88, height = 1.92, depth = 0.12;
    var bodyMat = mat(THREE, 0x15171c, { roughness: 0.32, metalness: 0.48 });
    var frame = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
    frame.position.y = height / 2 + 0.04;
    frame.castShadow = true;
    group.add(frame);
    var screen = mat(THREE, 0xffffff, { roughness: 0.4, metalness: 0.05 });
    var screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.69), screen);
    screenMesh.position.set(0, height / 2 + 0.04, depth / 2 + 0.008);
    group.add(screenMesh);
    pushSurface(surfaces, screen, 9 / 19.5, 'phone screen');
    var glass = mat(THREE, 0x20242a, { roughness: 0.24, metalness: 0.58 });
    var cameraBump = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.19, 0.045), glass);
    cameraBump.position.set(-0.22, height - 0.2, -depth / 2 - 0.025);
    group.add(cameraBump);
    var button = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.035), glass);
    button.position.set(width / 2 + 0.018, height - 0.56, 0);
    group.add(button);
    group.rotation.y = -0.08;
    return { group: group, surfaces: surfaces, label: '手机页面动效', camera: { position: [2.3, 1.85, 3.1], target: [0, 1.0, 0] }, dimensions: { width: width, height: height, depth: depth }, hints: { screenRatio: '9:19.5', motion: true } };
  }

  function createMockupModel(THREE, type) {
    switch (type) {
      case 'a4': return curvedPaper(THREE);
      case 'banner':
      case 'rollup': return banner(THREE);
      case 'bag': return bag(THREE);
      case 'phone': return phone(THREE);
      case 'booklet':
      case 'workbook':
      default: return booklet(THREE);
    }
  }

  global.createMockupModel = createMockupModel;
})(mockupGlobals);

/* Opaque, outward-wound tote with independent front / back / shared-side UVs. */
(function (global) {
  'use strict';

  global.createBagV2 = function createBagV2(THREE) {
    const group = new THREE.Group();
    group.name = 'ToteBagV2';
    const surfaces = [];
    const width = 1.52, height = 1.60, base = 0.075, top = base + height;
    const makeMaterial = (color, opts) => new THREE.MeshStandardMaterial(Object.assign({
      color, roughness: 0.93, metalness: 0, side: THREE.FrontSide,
      transparent: false, opacity: 1
    }, opts || {}));
    const frontMat = makeMaterial(0xfffefa);
    const backMat = makeMaterial(0xfffefa);
    const sideRightMat = makeMaterial(0xf7f5ef);
    const sideLeftMat = makeMaterial(0xf7f5ef);
    const liningMat = makeMaterial(0xdcd8cd);
    const seamMat = makeMaterial(0xd7d3c8);
    const handleMat = makeMaterial(0xeeeae0);

    // The same edge functions are used by neighboring panels: no gaps when
    // orbiting around the bag. Top is gently pinched; bottom corners are soft.
    function halfWidth(v) { return width * 0.5 * (0.955 + 0.045 * Math.sin(v * Math.PI)); }
    function halfDepth(v) { return 0.185 + 0.025 * Math.sin(v * Math.PI) - 0.022 * v; }
    function yAt(v) { return base + v * height; }
    function panelPoint(u, v, front) {
      const x = (front ? (u - 0.5) : (0.5 - u)) * halfWidth(v) * 2;
      const envelope = Math.sin(Math.PI * u);
      const bulge = 0.049 * envelope * Math.sin(Math.PI * v);
      const wrinkles = 0.008 * Math.sin(u * Math.PI * 10 + 1.7 * v) * envelope * Math.sin(Math.PI * v);
      const hangingFold = 0.008 * Math.sin(u * Math.PI * 4 - v * 2) * envelope * Math.sin(Math.PI * v);
      const z = (front ? 1 : -1) * (halfDepth(v) + bulge + wrinkles + hangingFold);
      return new THREE.Vector3(x, yAt(v), z);
    }
    function sidePoint(u, v, right) {
      const z = (right ? (0.5 - u) : (u - 0.5)) * halfDepth(v) * 2;
      // A subtle inset gusset, kept smooth and closed at panel boundaries.
      const inset = 0.018 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
      return new THREE.Vector3((right ? 1 : -1) * (halfWidth(v) - inset), yAt(v), z);
    }

    function gridGeometry(sample, nx, ny, reverse) {
      const positions = [], uv = [], indices = [];
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const u = i / nx, v = j / ny, p = sample(u, v);
        positions.push(p.x, p.y, p.z); uv.push(u, v);
      }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
        if (reverse) indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(indices); g.computeVertexNormals();
      return g;
    }
    function mesh(name, geo, material) {
      const m = new THREE.Mesh(geo, material);
      m.name = name; m.castShadow = true; m.receiveShadow = true; group.add(m);
      return m;
    }
    function addPanel(name, sample, material, slot, aspect, nx) {
      const outside = gridGeometry(sample, nx || 36, 40, false);
      const m = mesh(name, outside, material);
      surfaces.push({ material, mesh: m, aspect, slot });
      // Distinct inward-facing blank lining. It never shares the uploaded map.
      const innerSample = (u, v) => {
        const p = sample(u, v);
        p.x *= 0.994; p.z *= 0.970; p.y += 0.002;
        return p;
      };
      mesh(name + '-lining', gridGeometry(innerSample, nx || 36, 40, true), liningMat);
      return m;
    }
    const frontMesh = addPanel('bag-print-front', (u, v) => panelPoint(u, v, true), frontMat, 'bagFront', width / height);
    const backMesh = addPanel('bag-print-back', (u, v) => panelPoint(u, v, false), backMat, 'bagBack', width / height);
    addPanel('bag-print-right', (u, v) => sidePoint(u, v, true), sideRightMat, 'bagSide', (halfDepth(0.5) * 2) / height, 16);
    addPanel('bag-print-left', (u, v) => sidePoint(u, v, false), sideLeftMat, 'bagSide', (halfDepth(0.5) * 2) / height, 16);

    // Bottom lies below the outer panels, with a matching opaque interior base.
    const bottomGeo = new THREE.BoxGeometry(halfWidth(0) * 2, 0.020, halfDepth(0) * 2);
    const bottom = mesh('bag-closed-bottom', bottomGeo, makeMaterial(0xe8e4d9));
    bottom.position.set(0, base - 0.002, 0);
    const innerBottom = mesh('bag-inner-bottom', new THREE.PlaneGeometry(halfWidth(0) * 1.97, halfDepth(0) * 1.92), liningMat);
    innerBottom.rotation.x = -Math.PI / 2; innerBottom.position.y = base + 0.011;

    function tube(name, points, radius, material, segments) {
      const curve = new THREE.CatmullRomCurve3(points);
      return mesh(name, new THREE.TubeGeometry(curve, segments || 48, radius, 6, false), material || seamMat);
    }
    // Slim seam piping replaces the old thick vertical support beams.
    for (const front of [true, false]) {
      for (const v of [0.018, 0.952, 0.985]) {
        const pts = [];
        for (let i = 0; i <= 40; i++) {
          const p = panelPoint(i / 40, v, front); p.z += front ? 0.003 : -0.003; pts.push(p);
        }
        tube('bag-' + (front ? 'front' : 'back') + '-hem-' + v, pts, v === 0.985 ? 0.006 : 0.0018);
      }
    }
    for (const xSign of [-1, 1]) for (const zSign of [-1, 1]) {
      const pts = [];
      for (let j = 0; j <= 36; j++) {
        const v = j / 36;
        pts.push(new THREE.Vector3(xSign * halfWidth(v), yAt(v), zSign * halfDepth(v)));
      }
      tube('bag-corner-seam', pts, 0.0032);
    }

    // A folded rim covers the thin panel/lining thickness while leaving the
    // bag mouth open. Each strip is a small 3D surface, not a texture overlay.
    for (const front of [true, false]) {
      mesh('bag-rim-' + (front ? 'front' : 'back'), gridGeometry((u, v) => {
        const p = panelPoint(u, 1, front);
        p.z *= 1 - v * 0.03;
        p.x *= 1 - v * 0.006;
        return p;
      }, 36, 1, front), makeMaterial(0xe8e3d8, { side: THREE.DoubleSide }));
    }
    for (const right of [true, false]) {
      mesh('bag-side-rim', gridGeometry((u, v) => {
        const p = sidePoint(u, 1, right);
        p.x *= 1 - v * 0.006; p.z *= 1 - v * 0.03;
        return p;
      }, 16, 1, false), makeMaterial(0xe8e3d8, { side: THREE.DoubleSide }));
    }

    function addHandle(front) {
      const sign = front ? 1 : -1;
      const z = sign * 0.193;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.445, top - 0.105, z),
        new THREE.Vector3(-0.474, top + 0.20, z + sign * 0.026),
        new THREE.Vector3(-0.392, top + 0.56, z + sign * 0.047),
        new THREE.Vector3(0, top + 0.72, z + sign * 0.055),
        new THREE.Vector3(0.392, top + 0.56, z + sign * 0.047),
        new THREE.Vector3(0.474, top + 0.20, z + sign * 0.026),
        new THREE.Vector3(0.445, top - 0.105, z)
      ]);
      const segments = 72, strapWidth = 0.083, strapDepth = 0.012;
      const positions = [], indices = [], uv = [];
      // Swept rectangular strap: flat woven webbing, rather than a rope tube.
      for (let i = 0; i <= segments; i++) {
        const t = i / segments, p = curve.getPoint(t), tangent = curve.getTangent(t);
        const n = new THREE.Vector3(tangent.y, -tangent.x, 0).normalize();
        for (const corner of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
          positions.push(p.x + n.x * corner[0] * strapWidth / 2, p.y + n.y * corner[0] * strapWidth / 2, p.z + corner[1] * strapDepth / 2);
          uv.push(corner[0] > 0 ? 1 : 0, t);
        }
      }
      // With the clockwise cross-section used above, a,b,c produces the
      // exterior for each ring quad. DoubleSide also protects tiny edge-on
      // sections during orbital viewing, without making the body transparent.
      for (let i = 0; i < segments; i++) for (let k = 0; k < 4; k++) {
        const a = i * 4 + k, b = i * 4 + (k + 1) % 4, c = a + 4, d = b + 4;
        indices.push(a, c, b, b, c, d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(indices); geo.computeVertexNormals();
      mesh('bag-' + (front ? 'front' : 'back') + '-flat-handle', geo, handleMat);
      // Small stitched attachment patches sit on the exterior, below the rim.
      for (const sx of [-1, 1]) {
        const patch = mesh('bag-handle-attachment', new THREE.BoxGeometry(0.09, 0.15, 0.012), handleMat);
        patch.position.set(sx * 0.445, top - 0.075, sign * (halfDepth(0.95) + 0.008));
      }
    }
    addHandle(false); addHandle(true);

    // Expose topology diagnostics used by the local validation script.
    function meanNormal(geometry) {
      const a = geometry.attributes.normal;
      const result = [0, 0, 0];
      for (let i = 0; i < a.count; i++) { result[0] += a.getX(i); result[1] += a.getY(i); result[2] += a.getZ(i); }
      return result.map(n => n / a.count);
    }
    group.userData.surfaceNormals = {
      front: meanNormal(frontMesh.geometry), back: meanNormal(backMesh.geometry),
      right: meanNormal(surfaces[2].mesh.geometry), left: meanNormal(surfaces[3].mesh.geometry)
    };
    group.rotation.y = 0;
    return {
      group, surfaces, label: '手提袋 · 三面设计',
      camera: { position: [2.45, 1.85, 3.65], target: [0, 1.18, 0] },
      dimensions: { width, height: top + 0.72, depth: halfDepth(0.5) * 2 },
      hints: { cloth: true, folds: true, opaque: true, artSlots: ['bagFront', 'bagBack', 'bagSide'], gltfHook: 'loadCustomBagModel' }
    };
  };
})(mockupGlobals);

/* Procedural, independently mapped phone and crew-neck T-shirt. */
(function (global) {
  'use strict';
  function material(THREE, color, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({color:color,roughness:.66,metalness:0},extra||{}));
  }
  function roundedShape(THREE,w,h,r) {
    var s=new THREE.Shape(),x=-w/2,y=-h/2;
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
    s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
    s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
    return s;
  }
  function roundSolid(THREE,w,h,d,r,mat) {
    var bevel=Math.min(.009,d*.15),g=new THREE.ExtrudeGeometry(roundedShape(THREE,w-bevel*2,h-bevel*2,r-bevel),{depth:d-bevel*2,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,steps:1,curveSegments:16});
    g.translate(0,0,-(d-bevel*2)/2);g.computeVertexNormals();
    return new THREE.Mesh(g,mat);
  }
  function roundedFace(THREE,w,h,r,mat) {
    var g=new THREE.ShapeGeometry(roundedShape(THREE,w,h,r),20),p=g.attributes.position,uv=g.attributes.uv;
    for(var i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/w+.5,p.getY(i)/h+.5);
    uv.needsUpdate=true;
    return new THREE.Mesh(g,mat);
  }
  function createPhoneV2(THREE) {
    var group=new THREE.Group(),body=new THREE.Group(),w=.93,h=1.98,d=.105;
    group.add(body);body.position.y=h/2+.025;
    var metal=material(THREE,0xaeb4bc,{roughness:.24,metalness:.88});
    var black=material(THREE,0x07090b,{roughness:.25,metalness:.18});
    var rear=material(THREE,0xe1e5e9,{roughness:.48,metalness:.24});
    body.add(roundSolid(THREE,w,h,d,.145,metal));
    var back=roundedFace(THREE,w-.022,h-.025,.137,rear);back.position.z=-d/2-.001;back.rotation.y=Math.PI;body.add(back);
    var bezel=roundedFace(THREE,w-.018,h-.021,.137,black);bezel.position.z=d/2+.001;body.add(bezel);
    var sw=w-.065,sh=h-.065;
    var print=material(THREE,0xf6f8fa,{roughness:.37,metalness:0});
    var screen=roundedFace(THREE,sw,sh,.113,print);screen.position.z=d/2+.003;screen.name='phone-screen-print';body.add(screen);
    var island=roundedFace(THREE,.254,.064,.031,black);island.position.set(0,h/2-.079,d/2+.005);body.add(island);
    var lensMat=material(THREE,0x16314d,{roughness:.13,metalness:.35});
    var islandLens=new THREE.Mesh(new THREE.CircleGeometry(.012,24),lensMat);islandLens.position.set(.089,h/2-.079,d/2+.006);body.add(islandLens);
    // Back-facing camera plate with real lenses, visible when the model turns.
    var plate=roundSolid(THREE,.414,.441,.034,.102,material(THREE,0xc5cbd2,{roughness:.3,metalness:.55}));
    plate.position.set(-.214,.694,-d/2-.02);body.add(plate);
    var coords=[[-.305,.793],[-.305,.601],[-.119,.697]];
    coords.forEach(function(p){
      var ring=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.025,40),metal);ring.rotation.x=Math.PI/2;ring.position.set(p[0],p[1],-.098);body.add(ring);
      var rim=new THREE.Mesh(new THREE.CircleGeometry(.066,40),black);rim.rotation.y=Math.PI;rim.position.set(p[0],p[1],-.112);body.add(rim);
      var glass=new THREE.Mesh(new THREE.CircleGeometry(.049,40),lensMat);glass.rotation.y=Math.PI;glass.position.set(p[0],p[1],-.113);body.add(glass);
      var pupil=new THREE.Mesh(new THREE.CircleGeometry(.028,32),material(THREE,0x03090e,{roughness:.08,metalness:.3}));pupil.rotation.y=Math.PI;pupil.position.set(p[0]-.003,p[1]-.004,-.114);body.add(pupil);
      var glint=new THREE.Mesh(new THREE.CircleGeometry(.008,16),material(THREE,0x526a88,{roughness:.16,metalness:.15}));glint.rotation.y=Math.PI;glint.position.set(p[0]+.016,p[1]+.018,-.115);body.add(glint);
    });
    var flash=new THREE.Mesh(new THREE.CircleGeometry(.022,28),material(THREE,0xf3eddd,{roughness:.5}));flash.rotation.y=Math.PI;flash.position.set(-.123,.824,-.094);body.add(flash);
    var lidar=new THREE.Mesh(new THREE.CircleGeometry(.018,24),black);lidar.rotation.y=Math.PI;lidar.position.set(-.119,.57,-.094);body.add(lidar);
    function button(x,y,height){var b=roundSolid(THREE,.018,height,.045,.008,metal);b.position.set(x,y,-.002);body.add(b)}
    button(w/2+.006,.34,.21);button(-w/2-.006,.45,.14);button(-w/2-.006,.22,.14);button(-w/2-.006,.68,.08);
    // Subtle antenna breaks at the rail. No branding is baked into the phone.
    var band=material(THREE,0x555e69,{roughness:.6,metalness:.1});
    [-1,1].forEach(function(side){[-.77,.77].forEach(function(y){var m=new THREE.Mesh(new THREE.BoxGeometry(.012,.013,.09),band);m.position.set(side*(w/2-.001),y,0);body.add(m)})});
    var home=roundedFace(THREE,.25,.009,.0045,material(THREE,0x3e4248,{roughness:.55}));home.position.set(0,-h/2+.041,d/2+.005);body.add(home);
    group.traverse(function(n){if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});
    return {group:group,surfaces:[{material:print,aspect:sw/sh,slot:'main',mesh:screen}],label:'圆角金属手机',camera:{position:[1.72,1.48,3.85],target:[0,1.02,0]},dimensions:{width:w,height:h,depth:d},hints:{screenRatio:'约 9:20',phoneStyle:'rounded-metal',threeViews:true}};
  }

  function shirtOutline(THREE,back) {
    var s=new THREE.Shape();
    s.moveTo(-.31,2.15);
    s.quadraticCurveTo(-.51,2.105,-.69,2.02);
    s.quadraticCurveTo(-.86,1.975,-1.015,1.86);
    s.lineTo(-1.255,1.43);s.quadraticCurveTo(-1.12,1.345,-.974,1.30);
    s.lineTo(-.755,1.57);s.quadraticCurveTo(-.69,1.46,-.683,1.27);
    s.quadraticCurveTo(-.63,.66,-.675,.095);
    s.quadraticCurveTo(-.36,.035,0,.065);s.quadraticCurveTo(.36,.035,.675,.095);
    s.quadraticCurveTo(.63,.66,.683,1.27);s.quadraticCurveTo(.69,1.46,.755,1.57);
    s.lineTo(.974,1.30);s.quadraticCurveTo(1.12,1.345,1.255,1.43);
    s.lineTo(1.015,1.86);s.quadraticCurveTo(.86,1.975,.69,2.02);
    s.quadraticCurveTo(.51,2.105,.31,2.15);
    if(back){s.bezierCurveTo(.25,2.105,.17,2.105,0,2.105);s.bezierCurveTo(-.17,2.105,-.25,2.105,-.31,2.15);}
    else{s.bezierCurveTo(.30,1.99,.17,1.925,0,1.925);s.bezierCurveTo(-.17,1.925,-.30,1.99,-.31,2.15);}
    return s;
  }
  function shirtZ(x,y) {
    // Low-frequency cloth volume and subtle folds run down the torso; shoulder
    // and sleeve thickness taper so a side view reads as fabric, not a box.
    var body=Math.max(0,1-Math.pow(Math.min(Math.abs(x)/.74,1),2));
    var z=.072+.085*body*Math.sin(Math.PI*Math.max(.02,Math.min(.98,y/2.2)));
    var hemFade=Math.min(1,Math.max(0,y/.35));
    z+=.012*Math.sin(10*x+1.1*y)*Math.sin(1.8*y)*hemFade;
    z+=.008*Math.sin(20*x-1.8*y)*(1-body)*hemFade;
    if(Math.abs(x)>.74)z=.048+.015*Math.cos(y*8+x*7);
    return z;
  }
  function shirtBackY(x,y) {
    // A continuous, strictly monotone Y warp raises the rear neckline. The
    // earlier threshold produced a discontinuity and folded a few triangles.
    var t=Math.max(0,Math.min(1,(y-1.60)/.31));
    return y+.18*(1-Math.min(1,Math.abs(x)/.31))*t*t*(3-2*t);
  }
  function subdividedCap(THREE,shape,back) {
    var flat=new THREE.ShapeGeometry(shape,16),pos=flat.attributes.position,ix=flat.index,triangles=[];
    function split(a,b,c,n){if(!n){triangles.push(a,b,c);return}var ab=[(a[0]+b[0])/2,(a[1]+b[1])/2],bc=[(b[0]+c[0])/2,(b[1]+c[1])/2],ca=[(c[0]+a[0])/2,(c[1]+a[1])/2];split(a,ab,ca,n-1);split(ab,b,bc,n-1);split(ca,bc,c,n-1);split(ab,bc,ca,n-1)}
    for(var i=0;i<ix.count;i+=3){var a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2);split([pos.getX(a),pos.getY(a)],[pos.getX(b),pos.getY(b)],[pos.getX(c),pos.getY(c)],3)}
    var unique=new Map(),p=[],uv=[],indices=[];
    triangles.forEach(function(v){var key=v[0].toFixed(7)+','+v[1].toFixed(7),ind=unique.get(key);if(ind===undefined){ind=p.length/3;unique.set(key,ind);p.push(v[0],v[1],(back?-1:1)*shirtZ(v[0],v[1]));uv.push(v[0]/2.51+.5,v[1]/2.2)}indices.push(ind)});
    if(back)for(var j=0;j<indices.length;j+=3){var t=indices[j+1];indices[j+1]=indices[j+2];indices[j+2]=t}
    var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();flat.dispose();return g;
  }
  function createShirtV2(THREE) {
    var group=new THREE.Group(),shape=shirtOutline(THREE),cloth=material(THREE,0xf5f5f2,{roughness:.97}),inner=material(THREE,0xe3e4e0,{roughness:1});
    var front=new THREE.Mesh(subdividedCap(THREE,shape,false),cloth),back=new THREE.Mesh(subdividedCap(THREE,shirtOutline(THREE,true),true),cloth);
    front.name='tshirt-body-front';back.name='tshirt-body-back';group.add(front,back);
    var outline=shape.getPoints(32);if(THREE.ShapeUtils.isClockWise(outline))outline.reverse();
    var p=[],indices=[];
    for(var i=0;i<outline.length;i++){
      var a=outline[i],z=shirtZ(a.x,a.y),by=shirtBackY(a.x,a.y);
      p.push(a.x,a.y,z,a.x,by,-z);
    }
    for(var j=0;j<outline.length-1;j++){
      var a=outline[j],b=outline[j+1];
      // The collar remains an opening between the front and rear panels.
      if(a.y>1.915&&b.y>1.915&&Math.abs(a.x)<.32&&Math.abs(b.x)<.32)continue;
      var f=j*2,n=(j+1)*2;indices.push(f,f+1,n,n,f+1,n+1);
    }
    var sides=new THREE.BufferGeometry();sides.setAttribute('position',new THREE.Float32BufferAttribute(p,3));sides.setIndex(indices);sides.computeVertexNormals();group.add(new THREE.Mesh(sides,inner));
    // Collar follows the front scoop and shallower rear neckline.
    var collarPts=[];
    for(var k=0;k<65;k++){
      var t=k/64*Math.PI*2,x=.31*Math.cos(t),z=.091*Math.sin(t),y=2.15-(Math.sin(t)>=0?.225:.035)*Math.abs(Math.sin(t));
      collarPts.push(new THREE.Vector3(x,y,z));
    }
    var collarCurve=new THREE.CatmullRomCurve3(collarPts,true),rib=material(THREE,0xebede9,{roughness:1});
    var collar=new THREE.Mesh(new THREE.TubeGeometry(collarCurve,96,.024,8,true),rib);group.add(collar);
    // Fine seams are real curves and remain attached during rotation.
    function seam(points,rad){var c=new THREE.CatmullRomCurve3(points),m=new THREE.Mesh(new THREE.TubeGeometry(c,48,rad||.0045,5,false),rib);group.add(m)}
    var hem=[];for(var h=0;h<=28;h++){var x=-.65+h/28*1.3,y=.105+.012*Math.cos(x*6);hem.push(new THREE.Vector3(x,y,shirtZ(x,y)+.001))}seam(hem,.004);
    [-1,1].forEach(function(sign){var line=[];for(var n=0;n<=14;n++){var u=n/14,x=sign*(.988+.245*u),y=1.323+.115*u;line.push(new THREE.Vector3(x,y,shirtZ(x,y)+.001))}seam(line,.005)});
    var logoMat=material(THREE,0xffffff,{roughness:.97,transparent:true,alphaTest:.03,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    var logo=new THREE.Mesh(new THREE.PlaneGeometry(.58,.25,24,10),logoMat);logo.name='tshirt-chest-logo';logo.position.y=1.66;logo.visible=false;logo.renderOrder=2;group.add(logo);
    function setLogoSize(w,h){var pos=logo.geometry.attributes.position,uv=logo.geometry.attributes.uv;for(var q=0;q<pos.count;q++){var x=(uv.getX(q)-.5)*w,y=(uv.getY(q)-.5)*h;pos.setXYZ(q,x,y,shirtZ(x,y+logo.position.y)+.003)}pos.needsUpdate=true;logo.geometry.computeVertexNormals();logo.geometry.computeBoundingBox();logo.geometry.computeBoundingSphere()}
    setLogoSize(.58,.25);
    group.traverse(function(n){if(n.isMesh){n.castShadow=n!==logo;n.receiveShadow=true}});
    return {group:group,surfaces:[{material:logoMat,aspect:.58/.25,slot:'shirtLogo',mesh:logo,fit:'logo',maxWidth:.58,maxHeight:.25,setSize:setLogoSize}],label:'短袖 T 恤 · 胸前 Logo',camera:{position:[1.1,1.6,4.75],target:[0,1.1,0]},dimensions:{width:2.51,height:2.18,depth:.31},hints:{shirt:true,chestLogo:true,logoMaxWidth:.58,logoMaxHeight:.25}};
  }
  global.createPhoneV2=createPhoneV2;
  global.createShirtV2=createShirtV2;
})(mockupGlobals);

/* Compact hardback: covers and pages share the same coordinate frame.
 * The left spine is an integrated curved shell; the right edge is paper.
 */
(function(global){
  'use strict';
  global.createBookV3=function createBookV3(THREE){
    const group=new THREE.Group();group.name='HardbackBookV3';
    const H=1.90,spineX=-.60,rightX=.675,r=.10,board=.013;
    const innerZ=r-board,pageInset=.019,pageRight=rightX-.021;
    const standard=(color,options)=>new THREE.MeshStandardMaterial(Object.assign({color,roughness:.83,metalness:0,side:THREE.FrontSide,opacity:1,transparent:false},options||{}));
    const front=standard(0xffffff),back=standard(0xffffff),spine=standard(0xffffff,{roughness:.78});
    const coverEdge=standard(0xf1f0ec),insideCover=standard(0xefeee8);
    const paper=standard(0xfaf9f5,{roughness:.96}),pageLine=standard(0xd8d5cd,{roughness:1});
    const add=(name,geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(x||0,y||0,z||0);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};

    // Actual cover boards sandwich a single page block. Cover +Z and -Z are
    // the only printed board faces. Nothing is offset beyond the back cover.
    const width=rightX-spineX,centerX=(rightX+spineX)/2;
    const frontBoard=add('book-print-front',new THREE.BoxGeometry(width,H,board),[coverEdge,coverEdge,coverEdge,coverEdge,front,insideCover],centerX,H/2,r-board/2);
    const backBoard=add('book-print-back',new THREE.BoxGeometry(width,H,board),[coverEdge,coverEdge,coverEdge,coverEdge,insideCover,back],centerX,H/2,-r+board/2);
    const pageLeft=spineX+.004,pageWidth=pageRight-pageLeft,pageHeight=H-2*pageInset;
    add('book-page-block',new THREE.BoxGeometry(pageWidth,pageHeight,innerZ*2),paper,(pageRight+pageLeft)/2,H/2,0);

    // Half-cylinder whose u increases from the back to the front. Viewed from
    // the left (-X), letters read left-to-right, and v always increases upward.
    const seg=64,rows=4,p=[],uv=[],indices=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=seg;i++){
      const u=i/seg,v=j/rows,theta=(1-u)*Math.PI;
      p.push(spineX-r*Math.sin(theta),v*H,r*Math.cos(theta));uv.push(u,v);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<seg;i++){
      const a=j*(seg+1)+i,b=a+1,c=a+seg+1,d=c+1;indices.push(a,b,c,b,d,c);
    }
    const spineGeo=new THREE.BufferGeometry();spineGeo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));spineGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));spineGeo.setIndex(indices);spineGeo.computeVertexNormals();
    const spineMesh=add('book-print-spine',spineGeo,spine);
    // Close top and bottom of the rounded binding. These are unprinted edges.
    function bindingCap(top){
      const positions=[spineX,top?H:0,0],ix=[];
      for(let i=0;i<=seg;i++){const theta=i/seg*Math.PI;positions.push(spineX-r*Math.sin(theta),top?H:0,r*Math.cos(theta));}
      for(let i=0;i<seg;i++)top?ix.push(0,i+2,i+1):ix.push(0,i+1,i+2);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(ix);g.computeVertexNormals();return g;
    }
    add('book-binding-top',bindingCap(true),coverEdge);
    add('book-binding-bottom',bindingCap(false),coverEdge);
    // A blank inner binding backs the page block at its joined left edge.
    add('book-inner-binding',new THREE.BoxGeometry(.009,pageHeight,innerZ*2),insideCover,spineX+.0015,H/2,0);

    // Very fine paper separations run across the page stack (Z). They are not
    // floating mock covers: all lines sit on top of the existing page edges.
    for(let i=1;i<37;i++){
      const z=-innerZ+i/37*(innerZ*2);
      add('book-foreedge-page-line',new THREE.BoxGeometry(.0007,pageHeight-.004,.00055),pageLine,pageRight+.0002,H/2,z);
      add('book-top-page-line',new THREE.BoxGeometry(pageWidth-.012,.00055,.00055),pageLine,(pageRight+pageLeft)/2,H-pageInset+.0002,z);
      add('book-bottom-page-line',new THREE.BoxGeometry(pageWidth-.012,.00055,.00055),pageLine,(pageRight+pageLeft)/2,pageInset-.0002,z);
    }

    const surfaces=[
      {slot:'bookFront',material:front,mesh:frontBoard,aspect:width/H,label:'封面'},
      {slot:'bookBack',material:back,mesh:backBoard,aspect:width/H,label:'封底'},
      {slot:'bookSpine',material:spine,mesh:spineMesh,aspect:Math.PI*r/H,label:'书脊（单侧）'}
    ];
    return {group,surfaces,label:'精装书 · 封面 / 封底 / 书脊',camera:{position:[-1.65,1.38,3.75],target:[-.01,.95,0]},dimensions:{width:rightX-spineX+r,height:H,depth:r*2},hints:{hardback:true,spineSide:'left',artSlots:['bookFront','bookBack','bookSpine'],pageBlock:true}};
  };
})(mockupGlobals);

/* Artwork-only color handling. Texture upload and output encoding stay in sRGB. */
(function(global){
  const params={brightness:{value:1},contrast:{value:1},saturation:{value:1},faithful:{value:1}};
  const header=`
    uniform float mockupBrightness;
    uniform float mockupContrast;
    uniform float mockupSaturation;
    uniform float mockupFaithful;
    vec3 mockupToSRGB(vec3 c){
      c=max(c,vec3(0.0));
      return mix(12.92*c,1.055*pow(c,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));
    }
    vec3 mockupToLinear(vec3 c){
      c=clamp(c,0.0,1.0);
      return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));
    }
    vec3 mockupAdjust(vec3 source){
      vec3 c=mockupToSRGB(source);
      float grey=dot(c,vec3(0.2126,0.7152,0.0722));
      c=mix(vec3(grey),c,mockupSaturation);
      c=(c-0.5)*mockupContrast+0.5;
      c*=mockupBrightness;
      return mockupToLinear(c);
    }
  `;
  function configure(material,{contain=false,hasMap=false}={}){
    material.toneMapped=!hasMap||params.faithful.value<.5;
    material.onBeforeCompile=shader=>{
      shader.uniforms.mockupBrightness=params.brightness;shader.uniforms.mockupContrast=params.contrast;shader.uniforms.mockupSaturation=params.saturation;shader.uniforms.mockupFaithful=params.faithful;
      shader.fragmentShader=header+shader.fragmentShader;
      const mapChunk=`
        #include <map_fragment>
        #ifdef USE_MAP
          ${contain?'bool mockupInside=vMapUv.x>=0.0&&vMapUv.x<=1.0&&vMapUv.y>=0.0&&vMapUv.y<=1.0;':'bool mockupInside=true;'}
          if(mockupInside){diffuseColor.rgb=mockupAdjust(diffuseColor.rgb);}
          else{diffuseColor=vec4(1.0,1.0,1.0,diffuseColor.a);}
        #endif
      `;
      const colorChunk=`
        #ifdef USE_MAP
          if(mockupFaithful>0.5){
            // Retain only gentle achromatic shading. Never boost print pixels
            // beyond their adjusted source or whiten them with specular light.
            float sourceLuma=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
            float shadedLuma=dot(totalDiffuse,vec3(0.2126,0.7152,0.0722));
            float boundedShade=clamp(shadedLuma/max(sourceLuma,0.00001),0.65,1.0);
            outgoingLight=diffuseColor.rgb*mix(1.0,boundedShade,0.24);
          }
        #endif
        #include <opaque_fragment>
      `;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',mapChunk).replace('#include <opaque_fragment>',colorChunk);
    };
    material.customProgramCacheKey=()=>contain?'mockup-color-v3-contained':'mockup-color-v3-cropped';
    material.needsUpdate=true;
  }
  function readControls(){
    for(const [name,id] of [['brightness','artBrightness'],['contrast','artContrast'],['saturation','artSaturation']]){
      const value=Number(mockupRoot.getElementById(id).value);params[name].value=value/100;mockupRoot.getElementById(id+'Value').textContent=value+'%';
    }
    const faithful=mockupRoot.getElementById('colorMode').value==='faithful';params.faithful.value=faithful?1:0;
    mockupRoot.getElementById('colorModeNote').textContent=faithful?'优先保留原图色彩，减轻偏亮与褪色；保留轻微立体阴影。':'应用摄影棚光影与反射，贴图色彩会随光照变化。';
  }
  function bind(getSurfaces){
    function setMode(){readControls();getSurfaces().forEach(s=>{s.material.toneMapped=!s.material.map||params.faithful.value<.5;s.material.needsUpdate=true;});}
    ['artBrightness','artContrast','artSaturation'].forEach(id=>mockupRoot.getElementById(id).addEventListener('input',readControls));
    mockupRoot.getElementById('colorMode').addEventListener('change',setMode);
    mockupRoot.getElementById('resetColorBtn').addEventListener('click',()=>{mockupRoot.getElementById('colorMode').value='faithful';['artBrightness','artContrast','artSaturation'].forEach(id=>mockupRoot.getElementById(id).value=100);setMode();});
    readControls();
  }
  global.MockupColor={configure,bind,params};
})(mockupGlobals);

/* Photo-based T-shirt proofing. Deliberately fixed views, not a 360-degree model.
 * API: createShirtPhotoV5({canvas, photoURL, getArtwork, getColor, getLayout,
 *                         onReady, onError})
 * artwork: {image: HTMLImageElement|ImageBitmap|HTMLCanvasElement, name} | null
 * color:   {brightness:1, contrast:1, saturation:1}; artwork only, not the photo
 * layout:  {scale:1, x:0, y:0}; offsets in original photograph pixels
 * return:  {ready: Promise, isReady, draw({view,width,height,pixelRatio}), dispose}
 */
(function(global){
'use strict';
global.createShirtPhotoV5=function createShirtPhotoV5(options){
  const {canvas,photoURL,getArtwork=()=>null,getColor=()=>({}),getLayout=()=>({}),onReady=()=>{},onError=()=>{}}=options;
  const context=canvas.getContext('2d',{alpha:false});
  if(!context)throw new Error('浏览器无法创建 T 恤效果图画布。');
  const photo=new Image(),composite=document.createElement('canvas'),patch=document.createElement('canvas');
  const merged=composite.getContext('2d',{willReadFrequently:true}),patchContext=patch.getContext('2d',{willReadFrequently:true});
  let ready=false,disposed=false,photoPixels=null,lastFrame=null,cache=null,resolveReady,rejectReady;
  const promise=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  // Consumers can rely on onError without producing an unhandled rejection.
  promise.catch(()=>{});
  const W=1536,H=1024;
  const crops={three:[0,0,W,H],front:[0,0,604,H],right:[604,0,334,H],left:[604,0,334,H],back:[938,0,598,H]};
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
  const imageSize=image=>[image?.naturalWidth||image?.videoWidth||image?.width||0,image?.naturalHeight||image?.videoHeight||image?.height||0];
  function read(){
    const artwork=getArtwork(),image=artwork?.image||null,[iw,ih]=imageSize(image),color=getColor()||{},layout=getLayout()||{};
    return {image,iw,ih,brightness:clamp(finite(color.brightness,1),.5,1.5),contrast:clamp(finite(color.contrast,1),.5,1.5),saturation:clamp(finite(color.saturation,1),0,1.7),scale:clamp(finite(layout.scale,1),.5,1.3),x:clamp(finite(layout.x,0),-80,80),y:clamp(finite(layout.y,0),-60,100)};
  }
  function same(a,b){return a&&Object.keys(b).every(key=>a[key]===b[key]);}
  function compose(){
    const state=read();if(same(cache,state))return;cache=state;
    merged.clearRect(0,0,W,H);merged.drawImage(photo,0,0,W,H);
    if(!state.image||!state.iw||!state.ih)return;
    const ratio=state.iw/state.ih,width=Math.min(145,75*ratio)*state.scale,height=width/ratio;
    const left=310+state.x-width/2,top=265+state.y-height/2;
    const pw=Math.max(1,Math.ceil(width)),ph=Math.max(1,Math.ceil(height));
    patch.width=pw;patch.height=ph;patchContext.imageSmoothingEnabled=true;patchContext.imageSmoothingQuality='high';
    patchContext.drawImage(state.image,0,0,pw,ph);
    const imageData=patchContext.getImageData(0,0,pw,ph),pixels=imageData.data;
    // Multiply print color by the underlying photographed cotton. This preserves
    // weave/fold shading and alpha; a transparent logo never gains a white box.
    for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){
      const i=(y*pw+x)*4;if(!pixels[i+3])continue;
      const px=clamp(Math.round(left+(x+.5)*width/pw),0,W-1),py=clamp(Math.round(top+(y+.5)*height/ph),0,H-1),j=(py*W+px)*4;
      const r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255,luma=.2126*r+.7152*g+.0722*b;
      for(let c=0;c<3;c++){
        const original=pixels[i+c]/255,saturated=luma+(original-luma)*state.saturation;
        const adjusted=clamp(((saturated-.5)*state.contrast+.5)*state.brightness,0,1);
        pixels[i+c]=Math.round(adjusted*photoPixels[j+c]);
      }
    }
    patchContext.putImageData(imageData,0,0);merged.drawImage(patch,left,top,width,height);
  }
  function draw(frame={}){
    if(disposed)return;lastFrame=frame;
    const width=Math.max(1,Math.round(finite(frame.width,canvas.clientWidth||1))),height=Math.max(1,Math.round(finite(frame.height,canvas.clientHeight||1))),dpr=clamp(finite(frame.pixelRatio,1),1,2);
    const pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);
    if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
    context.setTransform(dpr,0,0,dpr,0,0);context.fillStyle='#e9edf1';context.fillRect(0,0,width,height);
    if(!ready)return;
    compose();
    const crop=crops[frame.view]||crops.three,[sx,sy,sw,sh]=crop,scale=Math.min(width/sw,height/sh),dw=sw*scale,dh=sh*scale;
    context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    context.drawImage(composite,sx,sy,sw,sh,(width-dw)/2,(height-dh)/2,dw,dh);
  }
  photo.onload=()=>{
    if(disposed)return;
    try{
      composite.width=W;composite.height=H;merged.drawImage(photo,0,0,W,H);photoPixels=merged.getImageData(0,0,W,H).data;ready=true;
      if(lastFrame)draw(lastFrame);resolveReady(api);onReady(api);
    }catch(error){ready=false;rejectReady(error);onError(error);}
  };
  photo.onerror=()=>{if(disposed)return;const error=new Error('T 恤穿着照片加载失败，请刷新后重试。');rejectReady(error);onError(error);};
  function dispose(){
    if(disposed)return;disposed=true;ready=false;photo.onload=photo.onerror=null;photoPixels=null;cache=null;lastFrame=null;
    composite.width=composite.height=patch.width=patch.height=1;
    rejectReady(new Error('T 恤效果图预览已关闭。'));
  }
  const api={ready:promise,get isReady(){return ready&&!disposed;},draw,dispose};
  photo.src=photoURL||global.SHIRT_PHOTO_DATA_URL||'';
  return api;
};
})(mockupGlobals);

/* Standalone mockups: WebGL objects plus explicitly labelled photo-fit shirts. */
const $=id=>mockupRoot.getElementById(id);
const canvas=$('sceneCanvas'),photoCanvas=$('photoCanvas'),stage=$('stageWrap'),statusEl=$('status'),loading=$('loading');
const artSlots={};
let renderer,scene,camera,controls,current=null,currentType='booklet',viewMode='free',frameId=0,gltfToken=0,exportURL='';
let surfaceTextures=[],externalRoot=null,shirtPhoto=null;
const typeButtons=[...mockupRoot.querySelectorAll('[data-type]')];
const viewButtons=[...mockupRoot.querySelectorAll('[data-view]')];
const setStatus=text=>statusEl.textContent=text;
const typeInfo={booklet:['精装画册 / 书本','封面、封底、左侧书脊分别上传 · 右侧保留白色书页'],a4:['A4 纸张','弧形纸面 · 白色背面'],banner:['易拉宝 · 80 × 180','80:180 印刷比例 · 金属支撑'],bag:['手提袋 · 三面设计','正面、背面分别上传 · 两侧共用第三张图'],phone:['圆角全面屏手机','圆角玻璃 · 金属边框 · 胶囊开孔 · 背面镜头'],shirt:['T 恤 · 照片式穿着','固定正面、侧面、背面 · 胸前小 Logo · 支持三视图导出']};
const nameIds={main:'mainFileName',bookFront:'bookFrontName',bookBack:'bookBackName',bookSpine:'bookSpineName',bagFront:'bagFrontName',bagBack:'bagBackName',bagSide:'bagSideName',shirtLogo:'shirtLogoName'};
const emptyNames={main:'PNG · JPG · WebP',bookFront:'选择正面封面',bookBack:'选择背面封底',bookSpine:'仅左侧书脊 · 右侧保留纸张',bagFront:'选择正面设计',bagBack:'选择背面设计',bagSide:'同一图片用于左、右两侧',shirtLogo:'推荐透明 PNG · 仅上胸小区域'};
function setError(message){loading.hidden=false;loading.textContent=message;setStatus(message);$('exportBtn').disabled=true;}
function releaseDerived(){surfaceTextures.forEach(t=>t.dispose());surfaceTextures=[];}
function disposeGroup(group){if(!group)return;const geometries=new Set(),materials=new Set();group.traverse(n=>{if(n.geometry)geometries.add(n.geometry);(Array.isArray(n.material)?n.material:n.material?[n.material]:[]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>{for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap']){const t=m[key];if(t&&!surfaceTextures.includes(t)&&!Object.values(artSlots).some(s=>s.texture===t))t.dispose();}m.dispose();});}
function fitTexture(texture,aspect,mode){
  // Per-surface clones keep the front/back/side crops independent.
  const t=texture.clone();t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const imageAspect=t.image.width/t.image.height;
  if(mode==='cover'){
    if(imageAspect>aspect){t.repeat.set(aspect/imageAspect,1);t.offset.set((1-t.repeat.x)/2,0);}
    else {t.repeat.set(1,imageAspect/aspect);t.offset.set(0,(1-t.repeat.y)/2);}
  }else{
    if(imageAspect>aspect){t.repeat.set(1,imageAspect/aspect);t.offset.set(0,(1-t.repeat.y)/2);}
    else{t.repeat.set(aspect/imageAspect,1);t.offset.set((1-t.repeat.x)/2,0);}
  }
  t.needsUpdate=true;surfaceTextures.push(t);return t;
}
function applyArtwork(){
  if(!current)return;releaseDerived();const mode=$('fitMode').value;
  if(current.photo){updateUI();drawScene();return;}
  current.surfaces.forEach(surface=>{
    const key=surface.slot||'main',asset=artSlots[key],m=surface.material;
    m.map=null;m.color.set(0xffffff);
    if(surface.fit==='logo'){
      surface.mesh.visible=!!asset?.texture;
      if(asset?.texture){const ratio=asset.texture.image.width/asset.texture.image.height,s=Number($('logoScale').value)/100;const w=Math.min(surface.maxWidth,surface.maxHeight*ratio)*s;surface.setSize(w,w/ratio);const t=fitTexture(asset.texture,ratio,'cover');t.flipY=true;m.map=t;m.transparent=true;m.alphaTest=.01;m.depthWrite=false;}
    }else if(asset?.texture){const t=fitTexture(asset.texture,surface.aspect||1,mode);t.flipY=surface.gltf?false:true;m.map=t;}
    mockupGlobals.MockupColor.configure(m,{contain:mode==='contain'&&surface.fit!=='logo',hasMap:!!m.map});
  });
  updateUI();
}
function updateUI(){
  const photo=currentType==='shirt';
  $('mainUpload').hidden=['bag','shirt','booklet'].includes(currentType);$('bookUploads').hidden=currentType!=='booklet';$('bagUploads').hidden=currentType!=='bag';$('shirtUpload').hidden=currentType!=='shirt';
  $('logoSettings').hidden=!photo;$('fitField').hidden=photo;$('customBagControls').hidden=currentType!=='bag';
  canvas.hidden=photo;photoCanvas.hidden=!photo;$('autoRotateRow').hidden=photo;$('colorModeField').hidden=photo;
  $('previewKicker').textContent=photo?'02 · PHOTO PREVIEW':'02 · 3D PREVIEW';$('previewTitle').textContent=photo?'T 恤穿着效果':'真实 3D 预览';$('renderMeta').textContent=photo?'照片式固定视角 · Logo 贴合棉布明暗':'OrbitControls · PBR 材质 · 阴影';
  $('exportBtn').textContent=photo?'导出穿着效果 PNG':'导出当前 3D 画面 PNG';$('resetBtn').textContent=photo?'恢复三视图':'恢复默认视角';
  $('colorModeNote').textContent=photo?'仅调整上传 Logo 的亮度、对比度与饱和度，保留衣服原有明暗。':mockupGlobals.MockupColor.params.faithful.value>.5?'优先保留原图色彩，减轻偏亮与褪色；保留轻微立体阴影。':'应用摄影棚光影与反射，贴图色彩会随光照变化。';
  $('uploadTitle').textContent=currentType==='booklet'?'上传书本三面设计':currentType==='bag'?'上传袋子三面设计':currentType==='shirt'?'上传胸前 Logo':'上传设计画面';
  $('uploadHint').textContent=currentType==='booklet'?'封面、封底、左侧书脊独立设置，其他三侧为白色内页。':currentType==='bag'?'正面、背面、侧面分别设置；同一侧面图应用到左右两侧。':photo?'Logo 贴合正面上胸小区域。推荐透明 PNG；侧面和背面保留空白衣服。':'图片等比贴合实体表面，可旋转查看。';
  for(const [key,id] of Object.entries(nameIds))$(id).textContent=artSlots[key]?.name||emptyNames[key];
  $('modelLabel').textContent=typeInfo[currentType][0];$('modelDetails').textContent=externalRoot?'已加载自定义立体模型':typeInfo[currentType][1];
  $('sizeMeta').textContent=currentType==='banner'?'印刷比例 80 : 180':currentType==='phone'?'圆角金属机身':photo?'正面 / 侧面 / 背面':'360° 真实 3D 模型';
  $('modelType').value=currentType;typeButtons.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.type===currentType)));
  $('exportBtn').disabled=!renderer||!current||(photo&&!shirtPhoto?.isReady);
}
function resetCamera(){
  if(!current)return;controls.autoRotate=false;$('autoRotate').checked=false;
  if(current.photo){viewMode='three';updateViews();drawScene();return;}
  viewMode='free';
  camera.position.fromArray(current.camera.position);controls.target.fromArray(current.camera.target);controls.update();controls.saveState();updateViews();
}
function getShirtPhoto(){
  if(!shirtPhoto)shirtPhoto=mockupGlobals.createShirtPhotoV5({canvas:photoCanvas,photoURL:mockupGlobals.SHIRT_PHOTO_DATA_URL,
    getArtwork:()=>artSlots.shirtLogo?.texture?{image:artSlots.shirtLogo.texture.image,name:artSlots.shirtLogo.name}:null,
    getColor:()=>({brightness:mockupGlobals.MockupColor.params.brightness.value,contrast:mockupGlobals.MockupColor.params.contrast.value,saturation:mockupGlobals.MockupColor.params.saturation.value}),
    getLayout:()=>({scale:Number($('logoScale').value)/100,x:Number($('logoX').value),y:Number($('logoY').value)}),
    onReady:()=>{if(currentType==='shirt'){loading.hidden=true;updateUI();drawScene();setStatus('穿着效果已就绪。上传胸前 Logo，可切换正面、侧面、背面或三视图。');}},
    onError:()=>{if(currentType==='shirt'){loading.hidden=false;loading.textContent='穿着底图未能加载，请刷新重试。';updateUI();}}
  });return shirtPhoto;
}
function loadModel(type){
  gltfToken++;releaseDerived();if(current){scene.remove(current.group);disposeGroup(current.group);}externalRoot=null;
  currentType=type;
  current=type==='shirt'?{photo:true,group:new THREE.Group(),surfaces:[],photoRenderer:getShirtPhoto()}:type==='booklet'?mockupGlobals.createBookV3(THREE):type==='bag'?mockupGlobals.createBagV2(THREE):type==='phone'?mockupGlobals.createPhoneV2(THREE):mockupGlobals.createMockupModel(THREE,type);
  scene.add(current.group);current.group.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
  // Keep the decal from casting a detached rectangular shadow.
  current.surfaces.filter(s=>s.fit==='logo').forEach(s=>{s.mesh.castShadow=false;});
  loading.hidden=!current.photo||!!shirtPhoto?.isReady;if(!loading.hidden)loading.textContent='正在准备照片式穿着效果…';
  applyArtwork();resetCamera();setStatus(current.photo?'照片式固定视角。上传 Logo 后，可切换正面、侧面、背面或三视图。':'已切换样机。拖动旋转，或用正面 / 背面 / 侧面检查贴图。');
}
async function loadArtwork(file,key){
  if(!file||(!/^image\/(png|jpeg|webp)$/.test(file.type)&&!(/\.(png|jpe?g|webp)$/i.test(file.name)))){setStatus('请选择 PNG、JPG 或 WebP 图片。');return;}
  const record=artSlots[key]||{generation:0};record.generation++;const ticket=record.generation;artSlots[key]=record;
  const url=URL.createObjectURL(file);setStatus('正在加载图片…');
  try{
    const texture=await new THREE.TextureLoader().loadAsync(url);
    if(artSlots[key]!==record||ticket!==record.generation){texture.dispose();return;}
    if(texture.image.width>renderer.capabilities.maxTextureSize||texture.image.height>renderer.capabilities.maxTextureSize){texture.dispose();throw new Error('图片超过设备最大纹理尺寸，请缩小后上传。');}
    const previous=record.texture;record.texture=texture;record.name=file.name;texture.colorSpace=THREE.SRGBColorSpace;applyArtwork();if(previous)previous.dispose();
    setStatus(key==='bagSide'?'侧面图片已应用到左右两侧，可旋转检查。':key==='shirtLogo'?'Logo 已贴合到上胸小区域。':'图片已应用到对应的外侧表面。');
  }catch(e){setStatus('图片加载失败：'+(e.message||'请换一张图片'));}finally{URL.revokeObjectURL(url);}
}
function activeKeys(){return currentType==='booklet'?['bookFront','bookBack','bookSpine']:currentType==='bag'?['bagFront','bagBack','bagSide']:currentType==='shirt'?['shirtLogo']:['main'];}
function clearImages(){const old=[];activeKeys().forEach(k=>{if(artSlots[k]?.texture)old.push(artSlots[k].texture);delete artSlots[k];});mockupRoot.querySelectorAll('[data-slot]').forEach(input=>{if(activeKeys().includes(input.dataset.slot))input.value='';});applyArtwork();old.forEach(t=>t.dispose());setStatus('当前样机的图片已清空。');}
function updateViews(){
  const photo=currentType==='shirt';
  $('frontViewLabel').textContent=currentType==='booklet'?'封面':'正面';$('backViewLabel').textContent=currentType==='booklet'?'封底':'背面';$('sideViewLabel').textContent=currentType==='booklet'?'书脊（左侧）':photo?'侧面':'右侧';
  viewButtons.forEach(b=>{b.hidden=photo&&['free','left'].includes(b.dataset.view);b.setAttribute('aria-pressed',String(b.dataset.view===viewMode));if(b.dataset.view==='right')b.textContent=photo?'侧面':'右侧';});
  $('threeLabels').hidden=viewMode!=='three';controls.enabled=!photo&&viewMode!=='three';
  $('stageTip').textContent=photo?'照片式固定视角 · Logo 仅用于正面胸前':viewMode==='three'?(currentType==='booklet'?'封面 / 书脊 / 封底 · 点击自由旋转返回':'正面 / 右侧 / 背面 · 点击自由旋转返回'):'拖动旋转 · 滚轮缩放 · 右键平移';
}
function setView(name){
  if(!current)return;viewMode=current.photo?(name==='free'?'three':name==='left'?'right':name):name;$('autoRotate').checked=false;controls.autoRotate=false;updateViews();
  if(current.photo){drawScene();return;}if(name==='three')return;if(name==='free'){resetCamera();return;}
  const box=new THREE.Box3().setFromObject(current.group),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const distance=Math.max(size.y,size.x)*1.75;const positions={front:[0,0,distance],back:[0,0,-distance],right:[distance,0,0],left:[-distance,0,0]};
  const local=new THREE.Vector3(...positions[name]);current.group.updateMatrixWorld(true);local.applyQuaternion(current.group.quaternion);camera.position.copy(center).add(local);controls.target.copy(center);controls.update();
}
function drawScene(){
  if(!current||!renderer)return;
  const w=stage.clientWidth,h=stage.clientHeight;
  if(current.photo){shirtPhoto.draw({view:viewMode,width:w,height:h,pixelRatio:Math.min(devicePixelRatio||1,2)});return;}
  renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.clear();
  if(viewMode!=='three'){renderer.render(scene,camera);return;}
  const box=new THREE.Box3().setFromObject(current.group),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const third=w/3,aspect=third/h,vertical=Math.max(size.y*1.16,Math.max(size.x,size.z)/aspect*1.22),half=vertical/2;
  const offsets=[new THREE.Vector3(0,0,5),new THREE.Vector3(currentType==='booklet'?-5:5,0,0),new THREE.Vector3(0,0,-5)];
  offsets.forEach((offset,i)=>{const c=new THREE.OrthographicCamera(-half*aspect,half*aspect,half,-half,.01,100);offset.applyQuaternion(current.group.quaternion);c.position.copy(center).add(offset);c.lookAt(center);renderer.setViewport(Math.round(i*third),0,Math.ceil(third),h);renderer.setScissor(Math.round(i*third),0,Math.ceil(third),h);renderer.setScissorTest(true);renderer.render(scene,c);});
  renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);
}
function resize(){if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(current?.photo)drawScene();}
function exportImage(){
  const isPhoto=!!current?.photo;if(isPhoto&&!shirtPhoto?.isReady)return;
  drawScene();const output=isPhoto?photoCanvas:canvas;
  output.toBlob(blob=>{if(!blob){setStatus('导出失败，请重试。');return;}if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(blob);const filename=(isPhoto?'T恤穿着效果_':'3D样机_')+typeInfo[currentType][0].replace(/[\\/:*?"<>|]/g,'_')+'_'+(viewMode==='three'?'三视图':viewMode==='front'?'正面':viewMode==='back'?'背面':isPhoto?'侧面':'展示图')+'.png';
    const a=$('saveLink');a.href=exportURL;a.download=filename;$('savePreview').src=exportURL;$('saveFallback').hidden=false;
    const link=document.createElement('a');link.href=exportURL;link.download=filename;document.body.appendChild(link);link.click();link.remove();setStatus('PNG 已生成。如果未自动保存，可展开下方“查看导出图片”。');
  },'image/png');
}
async function loadCustomBagModel(url='bag.gltf'){
  const token=++gltfToken;setStatus('正在加载自定义模型…');
  try{
    const gltf=await new GLTFLoader().loadAsync(url);if(token!==gltfToken){disposeGroup(gltf.scene);return;}
    const root=gltf.scene,targets=[];
    root.traverse(n=>{if(!n.isMesh)return;const list=Array.isArray(n.material)?n.material:[n.material];const converted=list.map(m=>{const name=(n.name+' '+m.name).toLowerCase();const standard=m.isMeshStandardMaterial?m.clone():new THREE.MeshStandardMaterial({color:m.color||0xffffff,roughness:.8,map:m.map||null});let slot=null;
      if(/side|gusset|left|right/.test(name))slot='bagSide';else if(/back|rear/.test(name))slot='bagBack';else if(/front|print|artwork/.test(name))slot='bagFront';
      if(slot&&n.geometry.attributes.uv)targets.push({material:standard,slot,aspect:slot==='bagSide'?.22:.9,gltf:true});return standard;});n.material=Array.isArray(n.material)?converted:converted[0];n.castShadow=n.receiveShadow=true;});
    if(!targets.length){disposeGroup(root);throw new Error('未找到可打印表面。请把表面命名为 print_front / print_back / print_side，并保留 UV。');}
    const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());if(!size.y)throw new Error('模型尺寸无效。');root.scale.multiplyScalar(2.4/size.y);const b=new THREE.Box3().setFromObject(root),c=b.getCenter(new THREE.Vector3());root.position.x-=c.x;root.position.z-=c.z;root.position.y-=b.min.y;
    releaseDerived();if(current){scene.remove(current.group);disposeGroup(current.group);}externalRoot=root;current={group:root,surfaces:targets,camera:{position:[2.6,1.9,4.5],target:[0,1.25,0]}};currentType='bag';scene.add(root);applyArtwork();resetCamera();setStatus('自定义袋子已加载，可使用正面、背面、两侧三个上传位置。');
  }catch(e){setStatus('模型加载失败：'+(e.message||'请检查 .gltf、.bin 和纹理文件是否齐全。'));}
}

function wireUI(){
  mockupRoot.querySelectorAll('input[data-slot]').forEach(input=>input.addEventListener('change',e=>loadArtwork(e.target.files[0],input.dataset.slot)));
  mockupGlobals.MockupColor.bind(()=>current?.surfaces||[]);
  $('modelType').addEventListener('change',e=>loadModel(e.target.value));typeButtons.forEach(b=>b.addEventListener('click',()=>loadModel(b.dataset.type)));viewButtons.forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  $('fitMode').addEventListener('change',applyArtwork);['logoScale','logoX','logoY'].forEach(id=>$(id).addEventListener('input',applyArtwork));$('clearBtn').addEventListener('click',clearImages);$('resetBtn').addEventListener('click',resetCamera);$('exportBtn').addEventListener('click',exportImage);
  ['artBrightness','artContrast','artSaturation','resetColorBtn'].forEach(id=>$(id).addEventListener(id==='resetColorBtn'?'click':'input',()=>{if(current?.photo){updateUI();drawScene();}}));
  $('loadBagBtn').addEventListener('click',()=>loadCustomBagModel());$('gltfInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;const url=URL.createObjectURL(file);try{await loadCustomBagModel(url);}finally{URL.revokeObjectURL(url);}});
  $('autoRotate').addEventListener('change',e=>{if(e.target.checked){viewMode='free';updateViews();}controls.autoRotate=e.target.checked;});controls.addEventListener('start',()=>{viewMode='free';updateViews();});
  const upload=$('uploadBox');['dragenter','dragover'].forEach(k=>upload.addEventListener(k,e=>{e.preventDefault();upload.classList.add('dragging');}));['dragleave','drop'].forEach(k=>upload.addEventListener(k,e=>{e.preventDefault();upload.classList.remove('dragging');}));upload.addEventListener('drop',e=>loadArtwork(e.dataTransfer.files[0],'main'));
}
function boot(){
  try{
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
    scene=new THREE.Scene();scene.background=new THREE.Color(0xe9edf1);
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.6;room.dispose();pmrem.dispose();
    camera=new THREE.PerspectiveCamera(35,1,.03,100);controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=1.1;controls.maxDistance=9;controls.maxPolarAngle=Math.PI*.94;controls.autoRotateSpeed=.65;
    scene.add(new THREE.AmbientLight(0xffffff,.35));const key=new THREE.DirectionalLight(0xffffff,1.8);key.position.set(3.8,6,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-4,right:4,top:5,bottom:-3,near:.1,far:18});key.shadow.normalBias=.008;key.shadow.bias=-.0001;scene.add(key);const fill=new THREE.DirectionalLight(0xffffff,.45);fill.position.set(-4,3,-3);scene.add(fill);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xe0e5e9,roughness:.9,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;scene.add(floor);
    wireUI();const observer=new ResizeObserver(resize);observer.observe(stage);resize();loadModel('shirt');
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();setError('3D 图形上下文中断，请刷新页面重试。');});
    startMockupLoop();
    mockupGlobals.debug={get state(){return{type:currentType,view:viewMode,slots:Object.keys(artSlots).filter(k=>artSlots[k].texture),surfaces:current.surfaces.map(s=>({slot:s.slot||'main',hasMap:!!s.material.map,opacity:s.material.opacity,side:s.material.side,visible:s.mesh?.visible})),render:renderer.info.render};},get current(){return current;},camera,controls,renderer,scene,loadModel,setView,drawScene};
  }catch(e){console.error(e);setError('3D 场景启动失败：'+e.message+'。请确认浏览器已启用 WebGL，并联网后刷新。');}
}

function startMockupLoop(){
 if(frameId||!mockupActive)return;
 function tick(){if(!mockupActive){frameId=0;return;}frameId=requestAnimationFrame(tick);if(!current?.photo){controls.update();drawScene();}}
 tick();
}
export function activate(){
 mockupActive=true;
 if(!renderer)boot();else if(!current)loadModel('shirt');
 if(!current)throw new Error(loading.textContent||'样机场景启动失败。');
 resize();drawScene();startMockupLoop();
}
export function suspend(){mockupActive=false;if(frameId){cancelAnimationFrame(frameId);frameId=0;}}
export function dispose(){
 suspend();++gltfToken;releaseDerived();
 if(current){scene.remove(current.group);disposeGroup(current.group);current=null;}
 for(const key of Object.keys(artSlots)){artSlots[key].texture?.dispose();delete artSlots[key];}
 if(shirtPhoto){shirtPhoto.dispose();shirtPhoto=null;}
 if(exportURL){URL.revokeObjectURL(exportURL);exportURL='';}
 mockupRoot.querySelectorAll('input[type=file]').forEach(input=>input.value='');
 $('saveFallback').hidden=true;$('savePreview').removeAttribute('src');$('saveLink').removeAttribute('href');
 if(controls)controls.autoRotate=false;$('autoRotate').checked=false;
}
export function inspect(){return {active:mockupActive,type:currentType,photo:!!current?.photo,view:viewMode,slots:Object.keys(artSlots).filter(k=>artSlots[k].texture)};}
