// Cena 3D do hero: o emblema da Naturalle esculpido em 3D, com folhas que brotam
// e folhas soltas flutuando. Carregado sob demanda e pausado fora da tela.
import * as THREE from '../vendor/three.module.min.js';

// Os mesmos traços do logo em SVG (viewBox 200x200), convertidos para 3D.
const STROKES = [
  [[55, 116], [50, 150], [80, 172], [104, 170], [132, 168], [150, 146], [146, 116]],
  [[70, 112], [72, 140], [104, 150], [122, 134], [132, 124], [130, 110], [118, 104]],
  [[128, 98], [108, 92], [90, 104], [92, 122], [94, 132], [104, 134], [110, 128]],
];
const LEAVES = [-60, -40, -20, 0, 20, 40, 60].map((a, i) => ({ a, len: [12, 15, 17, 19, 17, 15, 12][i] }));

const P = (x, y, z = 0) => new THREE.Vector3((x - 100) / 40, -(y - 122) / 40, z);

export function startScene(canvas, opts = {}) {
  const reduced = opts.reducedMotion;
  const small = window.innerWidth < 760;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0e3b1e, 7, 17);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  camera.position.set(0, 0, 9);

  scene.add(new THREE.HemisphereLight(0xfff6dc, 0x0b2a15, 1.5));
  const key = new THREE.DirectionalLight(0xfff1d0, 2.4);
  key.position.set(-4, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa8d64a, 2.2);
  rim.position.set(4, 1, -5);
  scene.add(rim);

  // ---------- Emblema ----------
  const emblem = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.add(emblem);
  scene.add(tilt);

  const white = new THREE.MeshStandardMaterial({ color: 0xfbf9f1, roughness: 0.32, metalness: 0.05 });
  const tubes = STROKES.map((pts, i) => {
    const path = new THREE.CurvePath();
    for (let k = 0; k < pts.length - 1; k += 3) {
      path.add(new THREE.CubicBezierCurve3(P(...pts[k], i * 0.08), P(...pts[k + 1], i * 0.1), P(...pts[k + 2], i * 0.1), P(...pts[k + 3], i * 0.08)));
    }
    const geo = new THREE.TubeGeometry(path, 90, 0.17, small ? 12 : 18, false);
    geo.setDrawRange(0, reduced ? Infinity : 0);
    const mesh = new THREE.Mesh(geo, white);
    emblem.add(mesh);
    // tampas arredondadas nas pontas do traço
    const capGeo = new THREE.SphereGeometry(0.17, 16, 12);
    const capA = new THREE.Mesh(capGeo, white);
    const capB = new THREE.Mesh(capGeo, white);
    capA.position.copy(path.getPoint(0));
    capB.position.copy(path.getPoint(1));
    capA.scale.setScalar(reduced ? 1 : 0);
    capB.scale.setScalar(reduced ? 1 : 0);
    emblem.add(capA, capB);
    return { mesh, total: geo.index.count, capA, capB };
  });

  // Folha: esfera achatada e afinada nas pontas
  const leafGeo = new THREE.SphereGeometry(1, 28, 18);
  {
    const pos = leafGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = (v.y + 1) / 2; // 0 base, 1 ponta
      const taper = Math.sin(Math.PI * Math.pow(t, 0.85));
      v.x *= taper;
      v.z *= taper * 0.35;
      v.z += Math.sin(t * Math.PI) * 0.18; // leve curvatura côncava
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    leafGeo.computeVertexNormals();
  }
  const lime = new THREE.MeshStandardMaterial({ color: 0x9bcb3c, roughness: 0.45, emissive: 0x2c4a08, emissiveIntensity: 0.35 });
  const pivot = P(100, 122);
  const sprouts = LEAVES.map(({ a, len }, i) => {
    const holder = new THREE.Group();
    holder.position.copy(pivot);
    holder.rotation.z = -THREE.MathUtils.degToRad(a);
    const leaf = new THREE.Mesh(leafGeo, lime);
    const h = len / 40;
    leaf.scale.set(h * 0.52, h, h);
    leaf.position.y = (122 - 52) / 40 - (19 - len) / 40 * 1.6;
    leaf.rotation.x = (i - 3) * 0.06;
    holder.add(leaf);
    holder.userData.leaf = leaf;
    holder.userData.target = leaf.scale.clone();
    if (!reduced) leaf.scale.setScalar(0.0001);
    emblem.add(holder);
    return holder;
  });

  // Base: disco verde profundo, como o selo do perfil
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(3.05, 3.05, 0.22, small ? 64 : 96, 1),
    new THREE.MeshStandardMaterial({ color: 0x0f3f20, roughness: 0.6, metalness: 0.1 })
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, 0.48, -0.38);
  emblem.add(disc);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.05, 0.06, 12, small ? 96 : 160),
    new THREE.MeshStandardMaterial({ color: 0x9bcb3c, roughness: 0.35, emissive: 0x3b5a10, emissiveIntensity: 0.4 })
  );
  ring.position.set(0, 0.48, -0.26);
  emblem.add(ring);
  const BASE_Y = -0.48;
  emblem.position.y = BASE_Y;

  // ---------- Folhas soltas (uma única chamada de desenho) ----------
  const COUNT = small ? 22 : 54;
  const floatGeo = leafGeo.clone();
  const floatMat = new THREE.MeshStandardMaterial({ roughness: 0.55, side: THREE.DoubleSide });
  const swarm = new THREE.InstancedMesh(floatGeo, floatMat, COUNT);
  swarm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const palette = [0x9bcb3c, 0x7fae2c, 0x2e6b35, 0xc6e27a, 0x1f5a2c].map((c) => new THREE.Color(c));
  const seeds = [];
  for (let i = 0; i < COUNT; i++) {
    const r = 3.6 + Math.random() * 4.2;
    const th = Math.random() * Math.PI * 2;
    seeds.push({
      r, th,
      y: (Math.random() - 0.5) * 7,
      z: -2 - Math.random() * 6 + (r > 6 ? 2 : 0),
      s: 0.12 + Math.random() * 0.22,
      sp: 0.04 + Math.random() * 0.09,
      rx: Math.random() * 6, ry: Math.random() * 6,
      wob: 0.4 + Math.random() * 0.8,
    });
    swarm.setColorAt(i, palette[i % palette.length]);
  }
  scene.add(swarm);
  const dummy = new THREE.Object3D();

  // ---------- Interação ----------
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  let scroll = 0;
  const onScroll = () => {
    scroll = Math.min(1, window.scrollY / window.innerHeight);
    if (reduced) requestAnimationFrame(frame);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Layout: emblema à direita no desktop, centralizado acima do texto no celular
  let layoutX = 0;
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const wide = w / h > 1.15;
    layoutX = wide ? 2.85 * Math.min(1.3, camera.aspect / 1.6) : 0;
    tilt.scale.setScalar(wide ? 0.7 : Math.min(0.4, camera.aspect * 0.78));
    tilt.position.y = wide ? 0 : 1.42;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ---------- Animação ----------
  const clock = new THREE.Clock();
  let running = false, raf = 0, introT = reduced ? 10 : 0;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const backOut = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    introT += dt;

    // Intro orquestrada: traços brancos se desenham, depois as folhas brotam em leque
    tubes.forEach((tb, i) => {
      const p = THREE.MathUtils.clamp((introT - 0.2 - i * 0.35) / 1.1, 0, 1);
      const e = easeOut(p);
      tb.mesh.geometry.setDrawRange(0, Math.floor(tb.total * e / 3) * 3);
      tb.capA.scale.setScalar(p > 0 ? 1 : 0);
      tb.capB.scale.setScalar(p >= 1 ? 1 : 0);
    });
    sprouts.forEach((s, i) => {
      const order = Math.abs(i - 3); // do centro para fora
      const p = THREE.MathUtils.clamp((introT - 1.5 - order * 0.14) / 0.75, 0, 1);
      const k = p <= 0 ? 0.0001 : backOut(p);
      const tg = s.userData.target;
      s.userData.leaf.scale.set(tg.x * k, tg.y * k, tg.z * k);
      s.rotation.y = Math.sin(t * 1.3 + i) * 0.08;
    });

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    const idle = reduced ? 0 : Math.sin(t * 0.6) * 0.12;
    tilt.position.x = layoutX - scroll * 0.6;
    emblem.rotation.y = idle + pointer.x * 0.45 + scroll * 1.9;
    emblem.rotation.x = -pointer.y * 0.3 + scroll * 0.35;
    emblem.position.y = BASE_Y + (reduced ? 0 : Math.sin(t * 0.9) * 0.08) + scroll * 1.2;

    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i];
      const th = s.th + t * s.sp * (reduced ? 0 : 1);
      const spread = 1 + scroll * 0.9;
      dummy.position.set(
        Math.cos(th) * s.r * spread + layoutX * 0.4,
        s.y + Math.sin(t * s.wob + i) * 0.35 + scroll * 2,
        s.z + Math.sin(th) * 1.4
      );
      dummy.rotation.set(s.rx + t * 0.3, s.ry + t * 0.2, th);
      dummy.scale.setScalar(s.s);
      dummy.updateMatrix();
      swarm.setMatrixAt(i, dummy.matrix);
    }
    swarm.instanceMatrix.needsUpdate = true;

    camera.position.x = pointer.x * 0.35;
    camera.position.y = -pointer.y * 0.2;
    camera.lookAt(tilt.position.x * 0.15, 0, 0);
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }

  const play = () => { if (reduced) { frame(); return; } if (running) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); };
  const pause = () => { running = false; cancelAnimationFrame(raf); };

  // Só renderiza quando o hero está visível e a aba está ativa
  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible && !document.hidden ? play() : pause(); });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden || !visible ? pause() : play()));

  play();
  canvas.classList.add('is-ready');
  return { play, pause };
}
