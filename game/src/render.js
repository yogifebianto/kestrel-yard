// Rendering utilities: practice dummies and bot meshes.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createPracticeDummies(scene) {
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d0a080'), roughness: 0.6, metalness: 0.05 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e0b090'), roughness: 0.45, metalness: 0.1 });
  const standMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a3d42'), roughness: 0.85 });
  const torsoGeometry = new THREE.BoxGeometry(0.52, 0.78, 0.3);
  const headGeometry = new THREE.SphereGeometry(0.155, 16, 12);
  const postGeometry = new THREE.BoxGeometry(0.1, 0.55, 0.1);
  const baseGeometry = new THREE.BoxGeometry(0.5, 0.08, 0.5);

  const spawns = [
    [-20, 0.8, -20], // A site
    [20, 0, 20],     // B site
    [0, 0, -5],      // Mid
  ];

  const dummies = [];

  for (const [x, y, z] of spawns) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const base = new THREE.Mesh(baseGeometry, standMaterial);
    base.position.y = 0.04;
    const post = new THREE.Mesh(postGeometry, standMaterial);
    post.position.y = 0.3;
    const torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
    torso.position.y = 1.0;
    torso.userData.part = 'torso';
    torso.userData.dummy = true;
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.53;
    head.userData.part = 'head';
    head.userData.dummy = true;
    group.add(base, post, torso, head);
    group.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    scene.add(group);
    dummies.push({ torso, head });
  }

  return dummies;
}

export function createBotMeshes(scene) {
  const vanguardBody = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d97030'), roughness: 0.7, metalness: 0.15 });
  const sentinelBody = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4080a8'), roughness: 0.7, metalness: 0.15 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c8a080'), roughness: 0.6, metalness: 0.05 });
  const helmetMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2c30'), roughness: 0.5, metalness: 0.3 });
  const weaponMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a3c40'), roughness: 0.6, metalness: 0.4 });

  const meshes = [];

  function createBotMesh(team) {
    const group = new THREE.Group();
    const bodyMat = team === 'vanguard' ? vanguardBody : sentinelBody;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.68, 0.26), bodyMat);
    torso.position.y = 1.08;

    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.28), bodyMat);
    shoulders.position.y = 1.36;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.18), skinMaterial);
    head.position.y = 1.6;

    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.2), helmetMaterial);
    helmet.position.y = 1.72;

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), bodyMat);
    armL.position.set(-0.34, 1.1, 0);
    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.1), skinMaterial);
    handL.position.set(-0.34, 0.78, 0);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), bodyMat);
    armR.position.set(0.34, 1.1, 0);
    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.1), skinMaterial);
    handR.position.set(0.34, 0.78, 0);

    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.36), weaponMaterial);
    weapon.position.set(0.16, 0.88, -0.24);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.18), bodyMat);
    legL.position.set(-0.12, 0.36, 0);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.18), bodyMat);
    legR.position.set(0.12, 0.36, 0);

    group.add(torso, shoulders, head, helmet, armL, handL, armR, handR, weapon, legL, legR);
    group.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    group.visible = false;
    scene.add(group);

    return { group, torso, head, legL, legR, armL, armR, weapon };
  }

  for (let i = 0; i < 7; i += 1) {
    const team = i < 3 ? 'vanguard' : 'sentinel';
    meshes.push(createBotMesh(team));
  }

  return meshes;
}

const scratchVec = new THREE.Vector3();

export function updateBotMeshes(bots, meshes) {
  for (let i = 0; i < bots.length && i < meshes.length; i += 1) {
    const bot = bots[i];
    const mesh = meshes[i];

    if (bot.alive) {
      mesh.group.visible = true;
      mesh.group.position.set(bot.position.x, bot.position.y, bot.position.z);
      mesh.group.rotation.set(0, bot.yaw, 0);

      const distTravelled = bot.distanceTravelled || 0;
      const walkPhase = distTravelled * 3.0;
      const legSwing = Math.sin(walkPhase) * 0.22;
      const armSwing = Math.sin(walkPhase) * 0.18;

      mesh.legL.rotation.x = legSwing;
      mesh.legR.rotation.x = -legSwing;
      mesh.armL.rotation.x = -armSwing;
      mesh.armR.rotation.x = armSwing;
    } else {
      const deathTime = bot.deathTime || 0;
      if (deathTime < 0.5) {
        mesh.group.visible = true;
        mesh.group.position.set(bot.position.x, bot.position.y - deathTime * 1.4, bot.position.z);
        mesh.group.rotation.set(-deathTime * 3.5, bot.yaw, 0);
      } else {
        mesh.group.visible = false;
      }
    }
  }
}
