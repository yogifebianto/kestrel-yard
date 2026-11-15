// Rendering utilities: bot meshes.
import * as THREE from 'three';

const vanguardBody = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d97030'), roughness: 0.7, metalness: 0.15 });
const sentinelBody = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4080a8'), roughness: 0.7, metalness: 0.15 });
const vanguardAccent = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e88040'), roughness: 0.65, metalness: 0.2 });
const sentinelAccent = new THREE.MeshStandardMaterial({ color: new THREE.Color('#50a0d0'), roughness: 0.65, metalness: 0.2 });
const skinMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c8a080'), roughness: 0.6, metalness: 0.05 });
const gearMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2c30'), roughness: 0.5, metalness: 0.3 });

export function createBotMeshes(scene) {
  const meshes = [];

  function createBotMesh(team) {
    const group = new THREE.Group();
    const bodyMat = team === 'vanguard' ? vanguardBody : sentinelBody;
    const accentMat = team === 'vanguard' ? vanguardAccent : sentinelAccent;

    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.18, 0.20), bodyMat);
    hips.position.set(0, 0.86, 0);

    const legLPivot = new THREE.Group();
    legLPivot.position.set(-0.09, 0.79, 0);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.78, 0.16), bodyMat);
    legL.position.y = -0.39;
    legL.userData.part = 'legs';
    legLPivot.add(legL);

    const legRPivot = new THREE.Group();
    legRPivot.position.set(0.09, 0.79, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.78, 0.16), bodyMat);
    legR.position.y = -0.39;
    legR.userData.part = 'legs';
    legRPivot.add(legR);

    const torsoGroup = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.26), bodyMat);
    torso.position.set(0, 1.20, 0);
    torso.userData.part = 'torso';

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.28), accentMat);
    chest.position.set(0, 1.44, 0);

    const armLPivot = new THREE.Group();
    armLPivot.position.set(-0.27, 1.54, 0);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.44, 0.12), bodyMat);
    armL.position.y = -0.22;
    armL.userData.part = 'arms';
    armLPivot.add(armL);

    const armRPivot = new THREE.Group();
    armRPivot.position.set(0.27, 1.54, 0);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.44, 0.12), bodyMat);
    armR.position.y = -0.22;
    armR.userData.part = 'arms';
    armRPivot.add(armR);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.10), bodyMat);
    neck.position.set(0, 1.55, 0);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), skinMaterial);
    head.position.set(0, 1.65, 0);
    head.userData.part = 'head';

    const helmetGeo = new THREE.SphereGeometry(0.125, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const helmet = new THREE.Mesh(helmetGeo, accentMat);
    helmet.position.set(0, 1.67, 0);

    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.50), gearMaterial);
    weapon.position.set(0.20, 1.30, -0.22);

    torsoGroup.add(torso, chest, armLPivot, armRPivot, neck, head, helmet, weapon);
    group.add(hips, legLPivot, legRPivot, torsoGroup);

    group.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    group.visible = false;
    scene.add(group);

    return { group, torso, head, legL, legR, armL, armR, legLPivot, legRPivot, armLPivot, armRPivot };
  }

  for (let i = 0; i < 7; i += 1) {
    const team = i < 3 ? 'vanguard' : 'sentinel';
    meshes.push(createBotMesh(team));
  }

  return meshes;
}

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

      mesh.legLPivot.rotation.x = legSwing;
      mesh.legRPivot.rotation.x = -legSwing;
      mesh.armLPivot.rotation.x = -armSwing;
      mesh.armRPivot.rotation.x = armSwing;
    } else {
      const deathTime = bot.deathTime || 0;
      if (deathTime < 0.5) {
        mesh.group.visible = true;
        mesh.group.position.set(bot.position.x, bot.position.y, bot.position.z);
        mesh.group.rotation.set(-deathTime * Math.PI, bot.yaw, 0);
      } else {
        mesh.group.visible = false;
      }
    }
  }
}
