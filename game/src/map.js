// KESTREL YARD: a 64x64 m tactical map with two bombsites, three lanes, and cover.
// Returns collision boxes for player/bots and a waypoint graph for AI navigation.
import * as THREE from 'three';

// Procedural tile texture: generated once at module scope
const tileCanvas = document.createElement('canvas');
tileCanvas.width = 256;
tileCanvas.height = 256;
const tileCtx = tileCanvas.getContext('2d');
tileCtx.fillStyle = '#787470';
tileCtx.fillRect(0, 0, 256, 256);
for (let y = 0; y < 2; y += 1) {
  for (let x = 0; x < 2; x += 1) {
    const noise = Math.random() * 0.08 - 0.04;
    const brightness = 115 + Math.floor(noise * 255);
    tileCtx.fillStyle = `rgb(${brightness + 3}, ${brightness + 1}, ${brightness - 2})`;
    tileCtx.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
    tileCtx.strokeStyle = '#5a5650';
    tileCtx.lineWidth = 2;
    tileCtx.strokeRect(x * 128 + 2.5, y * 128 + 2.5, 123, 123);
  }
}
const tileTexture = new THREE.CanvasTexture(tileCanvas);
tileTexture.wrapS = THREE.RepeatWrapping;
tileTexture.wrapT = THREE.RepeatWrapping;
tileTexture.anisotropy = 4;

// Concrete wall texture
const concreteCanvas = document.createElement('canvas');
concreteCanvas.width = 256;
concreteCanvas.height = 256;
const concreteCtx = concreteCanvas.getContext('2d');
concreteCtx.fillStyle = '#625e58';
concreteCtx.fillRect(0, 0, 256, 256);
for (let i = 0; i < 800; i += 1) {
  const x = Math.random() * 256;
  const y = Math.random() * 256;
  const noise = Math.random() * 20 - 10;
  concreteCtx.fillStyle = `rgba(${98 + noise}, ${94 + noise}, ${88 + noise}, 0.3)`;
  concreteCtx.fillRect(x, y, 2, 2);
}
const concreteTexture = new THREE.CanvasTexture(concreteCanvas);
concreteTexture.wrapS = THREE.RepeatWrapping;
concreteTexture.wrapT = THREE.RepeatWrapping;

// Rusted metal texture
const rustCanvas = document.createElement('canvas');
rustCanvas.width = 256;
rustCanvas.height = 256;
const rustCtx = rustCanvas.getContext('2d');
rustCtx.fillStyle = '#8a6a4a';
rustCtx.fillRect(0, 0, 256, 256);
for (let i = 0; i < 600; i += 1) {
  const x = Math.random() * 256;
  const y = Math.random() * 256;
  const noise = Math.random() * 30 - 15;
  rustCtx.fillStyle = `rgba(${138 + noise}, ${106 + noise}, ${74 + noise}, 0.4)`;
  rustCtx.fillRect(x, y, Math.random() * 3 + 1, Math.random() * 3 + 1);
}
const rustTexture = new THREE.CanvasTexture(rustCanvas);
rustTexture.wrapS = THREE.RepeatWrapping;
rustTexture.wrapT = THREE.RepeatWrapping;

export function createMap(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {
    concrete: new THREE.MeshStandardMaterial({
      map: tileTexture.clone(),
      roughness: 0.88,
      metalness: 0.02,
    }),
    rust: new THREE.MeshStandardMaterial({
      map: rustTexture.clone(),
      roughness: 0.82,
      metalness: 0.15,
    }),
    darkConcrete: new THREE.MeshStandardMaterial({
      map: concreteTexture.clone(),
      roughness: 0.85,
      metalness: 0.03,
    }),
    crate: new THREE.MeshStandardMaterial({ color: new THREE.Color('#7a6d5f'), roughness: 0.84, metalness: 0.05 }),
    platform: new THREE.MeshStandardMaterial({
      map: tileTexture.clone(),
      roughness: 0.78,
      metalness: 0.08,
    }),
    marking: new THREE.MeshStandardMaterial({ color: new THREE.Color('#f0c040'), roughness: 0.9, metalness: 0.0 }),
    metal: new THREE.MeshStandardMaterial({ color: new THREE.Color('#656870'), roughness: 0.6, metalness: 0.4 }),
  };

  // Configure texture repeat scales
  materials.concrete.map.repeat.set(16, 12);
  materials.rust.map.repeat.set(8, 8);
  materials.platform.map.repeat.set(3, 2.5);
  materials.darkConcrete.map.repeat.set(4, 4);

  const colliders = [];
  const shootables = [];

  const panelMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#5a524a'), roughness: 0.8, metalness: 0.1 });
  const boltMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a3430'), roughness: 0.5, metalness: 0.35 });

  function box(width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  function crate(width, height, depth, x, y, z) {
    const c = box(width, height, depth, x, y, z, 'crate');
    const inset = 0.03;
    const panelW = width - inset * 2;
    const panelH = height - inset * 2;
    const panelD = depth - inset * 2;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, panelH, panelD), panelMat);
    panel.position.copy(c.position);
    panel.castShadow = true;
    panel.receiveShadow = true;
    group.add(panel);

    const boltSize = Math.min(width, height, depth) * 0.04;
    const boltGeo = new THREE.BoxGeometry(boltSize, boltSize, boltSize);
    const offW = width * 0.42;
    const offH = height * 0.42;
    const offD = depth * 0.5 + 0.01;
    for (const [ox, oy] of [[-offW, -offH], [offW, -offH], [-offW, offH], [offW, offH]]) {
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(x + ox, y + oy, z + offD);
      bolt.castShadow = true;
      bolt.receiveShadow = true;
      group.add(bolt);
    }
    return c;
  }

  // Floor zones: concrete yard, rusted metal in B
  box(64, 0.2, 48, 0, -0.1, -8, 'concrete');
  box(32, 0.2, 32, -16, -0.1, 16, 'concrete');
  box(32, 0.2, 32, 16, -0.095, 16, 'rust');

  // Site markings: thin box outlines with letters A and B
  function markSite(x, y, z, w, h, letter) {
    const lineThickness = 0.08;
    const lineHeight = 0.02;
    const outline = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, lineHeight, lineThickness), materials.marking);
    top.position.set(0, 0, -h / 2);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, lineHeight, lineThickness), materials.marking);
    bottom.position.set(0, 0, h / 2);
    const left = new THREE.Mesh(new THREE.BoxGeometry(lineThickness, lineHeight, h), materials.marking);
    left.position.set(-w / 2, 0, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(lineThickness, lineHeight, h), materials.marking);
    right.position.set(w / 2, 0, 0);
    outline.add(top, bottom, left, right);

    if (letter === 'A') {
      const lBar = new THREE.Mesh(new THREE.BoxGeometry(lineThickness, lineHeight, 1.2), materials.marking);
      lBar.position.set(-0.3, 0, 0);
      lBar.rotation.y = 0.3;
      const rBar = new THREE.Mesh(new THREE.BoxGeometry(lineThickness, lineHeight, 1.2), materials.marking);
      rBar.position.set(0.3, 0, 0);
      rBar.rotation.y = -0.3;
      const mid = new THREE.Mesh(new THREE.BoxGeometry(0.6, lineHeight, lineThickness), materials.marking);
      mid.position.set(0, 0, -0.1);
      outline.add(lBar, rBar, mid);
    } else if (letter === 'B') {
      const vert = new THREE.Mesh(new THREE.BoxGeometry(lineThickness, lineHeight, 1.2), materials.marking);
      vert.position.set(-0.3, 0, 0);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, lineHeight, lineThickness), materials.marking);
      top.position.set(-0.05, 0, -0.6);
      const mid = new THREE.Mesh(new THREE.BoxGeometry(0.5, lineHeight, lineThickness), materials.marking);
      mid.position.set(-0.05, 0, 0);
      const bot = new THREE.Mesh(new THREE.BoxGeometry(0.5, lineHeight, lineThickness), materials.marking);
      bot.position.set(-0.05, 0, 0.6);
      const arc1 = new THREE.Mesh(new THREE.BoxGeometry(lineThickness, lineHeight, 0.6), materials.marking);
      arc1.position.set(0.2, 0, -0.3);
      const arc2 = new THREE.Mesh(new THREE.BoxGeometry(lineThickness, lineHeight, 0.6), materials.marking);
      arc2.position.set(0.2, 0, 0.3);
      outline.add(vert, top, mid, bot, arc1, arc2);
    }
    outline.position.set(x, y, z);
    group.add(outline);
  }

  markSite(-20, 0.82, -20, 9, 8, 'A');
  markSite(20, 0.01, 20, 11, 10, 'B');

  // Perimeter walls
  box(64.4, 6, 0.4, 0, 3, -32.2, 'darkConcrete');
  box(64.4, 6, 0.4, 0, 3, 32.2, 'darkConcrete');
  box(0.4, 6, 64.4, -32.2, 3, 0, 'darkConcrete');
  box(0.4, 6, 64.4, 32.2, 3, 0, 'darkConcrete');

  // BOMBSITE A (high ground, north-west quadrant)
  // Raised platform
  box(12, 0.8, 10, -20, 0.4, -20, 'platform');
  // Crates on platform
  crate(1.8, 1.4, 1.8, -23, 1.5, -22);
  crate(1.8, 1.4, 1.8, -17, 1.5, -18);
  crate(1.6, 1.2, 1.6, -21, 1.4, -17);
  // Cover around A
  crate(2.4, 1.1, 1.2, -14, 0.55, -26);
  crate(1.2, 1.1, 2.4, -26, 0.55, -14);

  // BOMBSITE B (loading bay, south-east quadrant)
  // Interior walls
  box(0.3, 3.5, 14, 24, 1.75, 20, 'darkConcrete');
  box(14, 3.5, 0.3, 17, 1.75, 27, 'darkConcrete');
  box(14, 3.5, 0.3, 17, 1.75, 13, 'darkConcrete');
  // Loading crates
  crate(2.2, 1.6, 2.2, 18, 0.8, 18);
  crate(2.2, 1.6, 2.2, 22, 0.8, 22);
  crate(1.8, 1.3, 1.8, 20, 0.65, 24);
  // Cover boxes
  crate(1.4, 1.0, 1.4, 15, 0.5, 20);

  // A LONG (west lane)
  crate(1.2, 1.2, 1.2, -28, 0.6, -8);
  crate(1.6, 1.0, 1.6, -28, 0.5, 4);
  crate(2.0, 1.1, 1.2, -26, 0.55, 12);

  // A SHORT (north lane)
  crate(1.4, 1.1, 2.6, -8, 0.55, -28);
  crate(2.2, 1.0, 1.4, 2, 0.5, -26);

  // MID (central corridor)
  crate(1.8, 1.2, 1.8, -4, 0.6, -4);
  crate(1.8, 1.2, 1.8, 4, 0.6, 4);
  crate(3.2, 1.1, 1.4, 0, 0.55, 0);
  // Mid divider
  box(0.4, 2.2, 8, 0, 1.1, -10, 'concrete');

  // B TUNNEL (south-east approach)
  crate(1.6, 1.0, 1.6, 12, 0.5, 8);
  crate(1.4, 1.1, 1.4, 8, 0.55, 12);

  // Additional cover and corners
  crate(1.2, 1.0, 1.2, -12, 0.5, 18);
  crate(1.8, 1.1, 1.2, 18, 0.55, -12);
  crate(1.2, 1.0, 2.4, 8, 0.5, -18);

  // Props: barriers, pipes, pallets, gantry, lamps, fence
  box(2.4, 0.9, 0.2, -28, 0.45, -18, 'metal');
  box(0.2, 0.9, 2.0, -27, 0.45, -17, 'metal');

  box(0.3, 0.3, 6.0, 12, 0.15, 20, 'metal');
  box(0.3, 0.3, 4.0, 16, 0.15, 24, 'metal');

  crate(1.6, 0.6, 1.2, -16, 0.3, 8);
  crate(1.6, 0.6, 1.2, -16, 0.9, 8);

  box(0.15, 3.2, 0.15, -10, 1.6, -12, 'metal');
  box(0.15, 3.2, 0.15, 10, 1.6, 12, 'metal');
  box(3.6, 0.2, 0.15, 0, 3.1, 0, 'metal');

  function hangLamp(x, z) {
    const cableGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.6, 6);
    const cable = new THREE.Mesh(cableGeo, materials.metal);
    cable.position.set(x, 4.4, z);
    cable.castShadow = false;
    cable.receiveShadow = false;
    group.add(cable);

    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 0.32, 8, 1, true), materials.metal);
    shade.position.set(x, 3.8, z);
    shade.castShadow = true;
    shade.receiveShadow = true;
    group.add(shade);

    const ceiling = new THREE.Mesh(new THREE.CircleGeometry(0.24, 8), materials.metal);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(x, 3.96, z);
    group.add(ceiling);

    const gantry = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.4), materials.metal);
    gantry.position.set(x, 5.16, z);
    gantry.castShadow = true;
    gantry.receiveShadow = true;
    group.add(gantry);

    const lightPool = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 16),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f0d0a8'),
        emissive: new THREE.Color('#f0d0a8'),
        emissiveIntensity: 0.15,
        roughness: 0.92,
        metalness: 0.0,
      })
    );
    lightPool.rotation.x = -Math.PI / 2;
    lightPool.position.set(x, 0.01, z);
    lightPool.receiveShadow = true;
    group.add(lightPool);
  }

  hangLamp(-20, -20);
  hangLamp(20, 20);

  box(0.1, 2.4, 20, -24, 1.2, 0, 'metal');
  box(0.1, 2.4, 20, 24, 1.2, 0, 'metal');

  // Additional dressing: shipping containers, bollards, fence, chimney
  box(2.4, 2.6, 6.0, -18, 1.3, 28, 'rust');
  box(2.4, 2.6, 6.0, 18, 1.3, -28, 'darkConcrete');

  const bollardGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.9, 8);
  const bollardMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e8c040'), roughness: 0.75, metalness: 0.25 });
  for (const [bx, bz] of [[-10, 16], [-6, 16], [6, -16], [10, -16], [26, 8], [26, 12]]) {
    const bollard = new THREE.Mesh(bollardGeo, bollardMat);
    bollard.position.set(bx, 0.45, bz);
    bollard.castShadow = true;
    bollard.receiveShadow = true;
    group.add(bollard);
  }

  // Chain-link fence (crossing planes)
  const fenceMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5a6068'),
    roughness: 0.7,
    metalness: 0.3,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
  });
  const fence1 = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.4), fenceMat);
  fence1.position.set(-6, 1.2, 24);
  fence1.rotation.y = Math.PI / 2;
  fence1.castShadow = true;
  fence1.receiveShadow = true;
  group.add(fence1);
  const fence2 = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.4), fenceMat);
  fence2.position.set(-6, 1.2, 24);
  fence2.rotation.y = -Math.PI / 2;
  fence2.castShadow = true;
  fence2.receiveShadow = true;
  group.add(fence2);

  // Chimney stack on skyline
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 18, 8), materials.darkConcrete);
  chimney.position.set(-28, 9, -28);
  chimney.castShadow = true;
  chimney.receiveShadow = true;
  group.add(chimney);

  // Ground markings: centre circle, lane arrows, hazard chevron at tunnel mouths
  const markHeight = 0.015;
  const circleMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f0c850'), roughness: 0.92, metalness: 0.0 });
  const circleGeo = new THREE.RingGeometry(3.5, 3.7, 32);
  const circle = new THREE.Mesh(circleGeo, circleMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(0, markHeight, 0);
  circle.receiveShadow = true;
  group.add(circle);

  // Lane arrows
  function arrow(x, z, rot) {
    const arrowGroup = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.3, markHeight, 1.4), circleMat);
    shaft.position.set(0, 0, -0.3);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, markHeight, 0.6), circleMat);
    head.position.set(0, 0, 0.4);
    arrowGroup.add(shaft, head);
    arrowGroup.position.set(x, markHeight, z);
    arrowGroup.rotation.y = rot;
    group.add(arrowGroup);
  }

  arrow(-24, -12, 0);
  arrow(-12, -24, Math.PI / 2);
  arrow(12, 12, -Math.PI / 2);

  // Hazard chevron at tunnel mouths
  function chevron(x, z, rot) {
    const chevGroup = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.15, markHeight, 1.2), circleMat);
      bar.position.set(i * 0.3 - 0.3, 0, 0);
      bar.rotation.y = 0.6;
      chevGroup.add(bar);
    }
    chevGroup.position.set(x, markHeight, z);
    chevGroup.rotation.y = rot;
    group.add(chevGroup);
  }

  chevron(10, 6, Math.PI * 0.25);
  chevron(-10, -6, -Math.PI * 0.75);

  // Lighting: low warm sun with long shadows, cool fill light for shadowed areas
  const sun = new THREE.DirectionalLight(new THREE.Color('#ffc896'), 2.6);
  sun.position.set(-45, 22, 38);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.camera.far = 110;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  // Warm fill light for shadowed sides
  const fillLight = new THREE.DirectionalLight(new THREE.Color('#c8b8a8'), 1.1);
  fillLight.position.set(30, 35, -25);
  fillLight.castShadow = false;
  scene.add(fillLight);

  // Hemisphere for ambient base
  const hemi = new THREE.HemisphereLight(new THREE.Color('#d8c8b8'), new THREE.Color('#8a7868'), 0.75);
  scene.add(hemi);

  // Point lights: brighter at sites, dimmer in tunnels
  const lightA = new THREE.PointLight(new THREE.Color('#f0d0a8'), 3.5, 28);
  lightA.position.set(-20, 4.8, -20);
  scene.add(lightA);

  const lightB = new THREE.PointLight(new THREE.Color('#e8c898'), 3.8, 28);
  lightB.position.set(20, 4.8, 20);
  scene.add(lightB);

  const lightMid = new THREE.PointLight(new THREE.Color('#c8d0d8'), 1.2, 18);
  lightMid.position.set(0, 3.5, 0);
  scene.add(lightMid);

  const lightTunnel = new THREE.PointLight(new THREE.Color('#a8b0b8'), 1.0, 16);
  lightTunnel.position.set(12, 3.2, 12);
  scene.add(lightTunnel);

  // Waypoint graph for bot navigation
  const waypoints = [
    // Spawn areas
    { id: 0, x: 0, y: 0, z: 30, lane: 'vanguard_spawn' },
    { id: 1, x: 0, y: 0, z: -30, lane: 'sentinel_spawn' },

    // A Long
    { id: 2, x: -28, y: 0, z: 20, lane: 'a_long' },
    { id: 3, x: -28, y: 0, z: 0, lane: 'a_long' },
    { id: 4, x: -28, y: 0, z: -20, lane: 'a_long' },

    // A Short
    { id: 5, x: -10, y: 0, z: -28, lane: 'a_short' },
    { id: 6, x: -5, y: 0, z: -22, lane: 'a_short' },

    // A Site
    { id: 7, x: -20, y: 0.8, z: -20, lane: 'a_site' },

    // Mid
    { id: 8, x: 0, y: 0, z: 10, lane: 'mid' },
    { id: 9, x: 0, y: 0, z: 0, lane: 'mid' },
    { id: 10, x: 0, y: 0, z: -10, lane: 'mid' },

    // B Tunnel
    { id: 11, x: 10, y: 0, z: 10, lane: 'b_tunnel' },
    { id: 12, x: 15, y: 0, z: 15, lane: 'b_tunnel' },

    // B Site
    { id: 13, x: 20, y: 0, z: 20, lane: 'b_site' },
  ];

  return { colliders, shootables, waypoints, group };
}
