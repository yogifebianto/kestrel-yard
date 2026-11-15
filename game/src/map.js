// KESTREL YARD: a 64x64 m tactical map with two bombsites, three lanes, and cover.
// Returns collision boxes for player/bots and a waypoint graph for AI navigation.
import * as THREE from 'three';

export function createMap(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {
    concrete: new THREE.MeshStandardMaterial({ color: new THREE.Color('#7a7d82'), roughness: 0.88, metalness: 0.02 }),
    rust: new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a6a4a'), roughness: 0.82, metalness: 0.15 }),
    darkConcrete: new THREE.MeshStandardMaterial({ color: new THREE.Color('#5a5c60'), roughness: 0.85, metalness: 0.03 }),
    crate: new THREE.MeshStandardMaterial({ color: new THREE.Color('#7a6d5f'), roughness: 0.84, metalness: 0.05 }),
    platform: new THREE.MeshStandardMaterial({ color: new THREE.Color('#758592'), roughness: 0.78, metalness: 0.08 }),
    marking: new THREE.MeshStandardMaterial({ color: new THREE.Color('#f0c040'), roughness: 0.9, metalness: 0.0 }),
    metal: new THREE.MeshStandardMaterial({ color: new THREE.Color('#656870'), roughness: 0.6, metalness: 0.4 }),
  };

  const colliders = [];
  const shootables = [];

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
  box(1.8, 1.4, 1.8, -23, 1.5, -22, 'crate');
  box(1.8, 1.4, 1.8, -17, 1.5, -18, 'crate');
  box(1.6, 1.2, 1.6, -21, 1.4, -17, 'crate');
  // Cover around A
  box(2.4, 1.1, 1.2, -14, 0.55, -26, 'crate');
  box(1.2, 1.1, 2.4, -26, 0.55, -14, 'crate');

  // BOMBSITE B (loading bay, south-east quadrant)
  // Interior walls
  box(0.3, 3.5, 14, 24, 1.75, 20, 'darkConcrete');
  box(14, 3.5, 0.3, 17, 1.75, 27, 'darkConcrete');
  box(14, 3.5, 0.3, 17, 1.75, 13, 'darkConcrete');
  // Loading crates
  box(2.2, 1.6, 2.2, 18, 0.8, 18, 'crate');
  box(2.2, 1.6, 2.2, 22, 0.8, 22, 'crate');
  box(1.8, 1.3, 1.8, 20, 0.65, 24, 'crate');
  // Cover boxes
  box(1.4, 1.0, 1.4, 15, 0.5, 20, 'crate');

  // A LONG (west lane)
  box(1.2, 1.2, 1.2, -28, 0.6, -8, 'crate');
  box(1.6, 1.0, 1.6, -28, 0.5, 4, 'crate');
  box(2.0, 1.1, 1.2, -26, 0.55, 12, 'crate');

  // A SHORT (north lane)
  box(1.4, 1.1, 2.6, -8, 0.55, -28, 'crate');
  box(2.2, 1.0, 1.4, 2, 0.5, -26, 'crate');

  // MID (central corridor)
  box(1.8, 1.2, 1.8, -4, 0.6, -4, 'crate');
  box(1.8, 1.2, 1.8, 4, 0.6, 4, 'crate');
  box(3.2, 1.1, 1.4, 0, 0.55, 0, 'crate');
  // Mid divider
  box(0.4, 2.2, 8, 0, 1.1, -10, 'concrete');

  // B TUNNEL (south-east approach)
  box(1.6, 1.0, 1.6, 12, 0.5, 8, 'crate');
  box(1.4, 1.1, 1.4, 8, 0.55, 12, 'crate');

  // Additional cover and corners
  box(1.2, 1.0, 1.2, -12, 0.5, 18, 'crate');
  box(1.8, 1.1, 1.2, 18, 0.55, -12, 'crate');
  box(1.2, 1.0, 2.4, 8, 0.5, -18, 'crate');

  // Props: barriers, pipes, pallets, gantry, lamps, fence
  box(2.4, 0.9, 0.2, -28, 0.45, -18, 'metal');
  box(0.2, 0.9, 2.0, -27, 0.45, -17, 'metal');

  box(0.3, 0.3, 6.0, 12, 0.15, 20, 'metal');
  box(0.3, 0.3, 4.0, 16, 0.15, 24, 'metal');

  box(1.6, 0.6, 1.2, -16, 0.3, 8, 'crate');
  box(1.6, 0.6, 1.2, -16, 0.9, 8, 'crate');

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

  // Lighting: hemisphere for ambient fill, strong directional sun
  const hemi = new THREE.HemisphereLight(new THREE.Color('#b0c5d5'), new THREE.Color('#8a7a60'), 0.8);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(new THREE.Color('#ffe5cc'), 3.0);
  sun.position.set(30, 50, 20);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.far = 100;
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

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
