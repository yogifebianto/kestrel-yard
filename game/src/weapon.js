// Weapon system: viewmodel, recoil climb/recovery, spread, reload animation.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const WEAPONS = {
  P9: { mag: 12, reserve: 24, fireGap: 0.15, reload: 1.5, spread: 0.004, recoilClimb: 0.008, damage: 26, pellets: 1 },
  'VX-9': { mag: 25, reserve: 75, fireGap: 0.09, reload: 2.0, spread: 0.006, recoilClimb: 0.006, damage: 22, pellets: 1 },
  'AR-4': { mag: 30, reserve: 90, fireGap: 0.096, reload: 2.4, spread: 0.0025, recoilClimb: 0.010, damage: 34, pellets: 1 },
  Mako: { mag: 8, reserve: 24, fireGap: 0.9, reload: 2.8, spread: 0.08, recoilClimb: 0.015, damage: 28, pellets: 8 },
};

const BODY_MULTIPLIERS = {
  head: 4.0,
  torso: 1.0,
  legs: 0.75,
  arms: 0.9,
};

const SPREAD_STILL = 0.0022;
const SPREAD_MOVING = 0.028;
const MOVE_REFERENCE = 5.2;
const MUZZLE_TIME = 0.06;
const RECOIL_RECOVERY_RATE = 3.5;

// Pooled effects created once at module scope
const shellPool = [];
const shellGeo = new THREE.BoxGeometry(0.008, 0.008, 0.016);
const shellMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c8a860'), roughness: 0.4, metalness: 0.6 });
for (let i = 0; i < 20; i += 1) {
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.visible = false;
  shell.castShadow = true;
  shellPool.push({ mesh: shell, velocity: new THREE.Vector3(), life: 0 });
}

const tracerPool = [];
const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
const tracerMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#f0c060'), transparent: true, opacity: 0.7 });
for (let i = 0; i < 20; i += 1) {
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  tracerPool.push({ mesh: tracer, life: 0 });
}

const decalPool = [];
const decalGeo = new THREE.PlaneGeometry(0.12, 0.12);
const decalMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#2a2a2a'),
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
  side: THREE.DoubleSide
});
for (let i = 0; i < 30; i += 1) {
  const decal = new THREE.Mesh(decalGeo, decalMat);
  decal.visible = false;
  decalPool.push({ mesh: decal, life: 0 });
}

const sparkPool = [];
const sparkGeo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f0c860') });
for (let i = 0; i < 40; i += 1) {
  const spark = new THREE.Mesh(sparkGeo, sparkMat);
  spark.visible = false;
  sparkPool.push({ mesh: spark, velocity: new THREE.Vector3(), life: 0 });
}

export function createWeapon(camera, state) {
  // Rifle materials: dark gunmetal body, darker furniture
  const gunmetalMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#33302c'), roughness: 0.55, metalness: 0.45 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#46423c'), roughness: 0.6, metalness: 0.25 });
  const nearBlackMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#26231f'), roughness: 0.7, metalness: 0.15 });
  const accentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c8a860'), roughness: 0.3, metalness: 0.6 });

  const model = new THREE.Group();

  // Receiver: main body, dark gunmetal
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.065, 0.28), gunmetalMat);
  receiver.position.set(0, 0, 0);

  // Barrel: slim, protruding forward, gunmetal
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.35), gunmetalMat);
  barrel.position.set(0, 0.015, -0.3);

  // Front sight post: small brass accent on barrel
  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.025, 0.008), accentMat);
  frontSight.position.set(0, 0.038, -0.45);

  // Magazine: angled below receiver, dark
  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.07), darkMat);
  magazine.position.set(0, -0.1, -0.05);
  magazine.rotation.x = -0.174; // ~10 degrees forward tilt

  // Pistol grip: below and behind receiver, near-black
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.085, 0.05), nearBlackMat);
  grip.position.set(0.015, -0.08, 0.03);

  // Handguard: under barrel, dark
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.19), darkMat);
  handguard.position.set(0, -0.005, -0.26);

  // Stock: behind receiver, near-black
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.17), nearBlackMat);
  stock.position.set(0, -0.01, 0.2);

  // Rear sight: small optic on top of receiver, gunmetal
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.035), gunmetalMat);
  rearSight.position.set(0, 0.05, 0.08);

  // Right arm viewmodel: forearm and hand
  const gloveMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1a1814'), roughness: 0.9, metalness: 0.05 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3f5d7a'), roughness: 0.75, metalness: 0.1 });

  // Right forearm angled from bottom-right toward grip
  const forearmR = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.028, 0.14), sleeveMat);
  forearmR.position.set(0.08, -0.24, -0.08);
  forearmR.rotation.set(0.6, -0.2, 0.15);

  // Right hand wrapped around pistol grip
  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.05), gloveMat);
  handR.position.set(0.035, -0.09, 0.025);
  handR.rotation.set(0.3, -0.1, 0.05);

  model.add(receiver, barrel, frontSight, magazine, grip, handguard, stock, rearSight, forearmR, handR);
  model.position.set(0.24, -0.2, -0.42);
  model.rotation.y = 0.08; // ~4.5 degrees, muzzle toward center-left
  camera.add(model);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.185, -0.895); // Aligned with barrel tip at rest
  flash.visible = false;
  camera.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.18, -0.7);
  camera.add(flashLight);

  // Add pooled effects to scene (once per weapon instance)
  const scene = camera.parent;
  for (const entry of shellPool) if (!entry.mesh.parent) scene.add(entry.mesh);
  for (const entry of tracerPool) if (!entry.mesh.parent) scene.add(entry.mesh);
  for (const entry of decalPool) if (!entry.mesh.parent) scene.add(entry.mesh);
  for (const entry of sparkPool) if (!entry.mesh.parent) scene.add(entry.mesh);

  const weapon = state.weapon;
  const sleeveMats = [sleeveMat];
  let bobPhase = 0;

  function step(dt) {
    weapon.cooldown = Math.max(0, weapon.cooldown - dt);
    weapon.flash = Math.max(0, weapon.flash - dt);
    weapon.kick += (0 - weapon.kick) * Math.min(1, dt * 14);

    if (weapon.switchTime > 0) {
      weapon.switchTime = Math.max(0, weapon.switchTime - dt);
    }

    // Recoil recovery
    if (weapon.recoilAccum > 0) {
      weapon.recoilRecoverTime += dt;
      if (weapon.recoilRecoverTime > 0.15) {
        weapon.recoilAccum = Math.max(0, weapon.recoilAccum - RECOIL_RECOVERY_RATE * dt);
      }
    }

    // Weapon bob based on movement
    const player = state.player;
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    if (speed > 0.5 && player.onGround) {
      bobPhase += dt * speed * 1.8;
      const bobX = Math.sin(bobPhase * 2) * 0.015;
      const bobY = Math.abs(Math.sin(bobPhase)) * 0.025;
      model.position.x = 0.24 + bobX;
      model.position.y = -0.2 + bobY;
    } else {
      model.position.x = 0.24;
      model.position.y = -0.2;
      bobPhase = 0;
    }

    model.position.z = -0.42 + weapon.kick;
    model.rotation.x = weapon.kick * 3.2;

    if (weapon.switchTime > 0) {
      const switchProgress = weapon.switchTime / 0.4;
      model.position.y = -0.2 - switchProgress * 0.5;
      model.rotation.x = switchProgress * -0.8;
    }

    flash.visible = weapon.flash > 0;
    flash.rotation.z = weapon.flash * 30;
    flashLight.intensity = weapon.flash > 0 ? 18 : 0;

    if (weapon.reloadLeft > 0) {
      const stats = WEAPONS[weapon.type];
      weapon.reloadLeft = Math.max(0, weapon.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (stats.reload - weapon.reloadLeft) * 2);
      if (weapon.reloadLeft === 0) {
        const need = stats.mag - weapon.mag;
        const take = Math.min(need, weapon.reserve);
        weapon.mag += take;
        weapon.reserve -= take;
      }
    }

    // Update shell casings
    for (const entry of shellPool) {
      if (entry.life > 0) {
        entry.life -= dt;
        if (entry.life <= 0) {
          entry.mesh.visible = false;
        } else {
          entry.velocity.y -= 20 * dt;
          entry.mesh.position.x += entry.velocity.x * dt;
          entry.mesh.position.y += entry.velocity.y * dt;
          entry.mesh.position.z += entry.velocity.z * dt;
          entry.mesh.rotation.x += entry.velocity.x * 10 * dt;
          entry.mesh.rotation.y += entry.velocity.y * 10 * dt;
          if (entry.mesh.position.y < 0) entry.mesh.position.y = 0;
        }
      }
    }

    // Update tracers
    for (const entry of tracerPool) {
      if (entry.life > 0) {
        entry.life -= dt;
        if (entry.life <= 0) entry.mesh.visible = false;
      }
    }

    // Update sparks
    for (const entry of sparkPool) {
      if (entry.life > 0) {
        entry.life -= dt;
        if (entry.life <= 0) {
          entry.mesh.visible = false;
        } else {
          entry.velocity.y -= 25 * dt;
          entry.mesh.position.x += entry.velocity.x * dt;
          entry.mesh.position.y += entry.velocity.y * dt;
          entry.mesh.position.z += entry.velocity.z * dt;
          entry.mesh.scale.setScalar(entry.life / 0.3);
        }
      }
    }

    // Update decals (fade out over time)
    for (const entry of decalPool) {
      if (entry.life > 0) {
        entry.life -= dt;
        if (entry.life <= 0) {
          entry.mesh.visible = false;
        } else {
          entry.mesh.material.opacity = Math.min(0.4, entry.life / 5);
        }
      }
    }
  }

  return {
    step,
    ready() {
      return weapon.mag > 0 && weapon.cooldown === 0 && weapon.reloadLeft === 0 && weapon.switchTime === 0;
    },
    pullTrigger(random) {
      const stats = WEAPONS[weapon.type];
      weapon.cooldown = stats.fireGap;
      weapon.flash = MUZZLE_TIME;
      weapon.kick = 0.095;
      weapon.recoilAccum = Math.min(0.12, weapon.recoilAccum + stats.recoilClimb);
      weapon.recoilRecoverTime = 0;

      // Spawn shell casing
      for (const entry of shellPool) {
        if (entry.life <= 0) {
          camera.getWorldPosition(entry.mesh.position);
          entry.mesh.position.x += 0.15 + random() * 0.05;
          entry.mesh.position.y += -0.1;
          entry.mesh.position.z += -0.3;
          entry.velocity.set(random() * 2 + 1, random() * 2 + 3, random() * 2 - 1);
          entry.life = 2.5;
          entry.mesh.visible = true;
          break;
        }
      }

      return weapon.recoilAccum + (random() * 0.004 - 0.002);
    },
    spawnTracer(origin, direction, length) {
      for (const entry of tracerPool) {
        if (entry.life <= 0) {
          const positions = entry.mesh.geometry.attributes.position.array;
          positions[0] = origin.x;
          positions[1] = origin.y;
          positions[2] = origin.z;
          positions[3] = origin.x + direction.x * length;
          positions[4] = origin.y + direction.y * length;
          positions[5] = origin.z + direction.z * length;
          entry.mesh.geometry.attributes.position.needsUpdate = true;
          entry.mesh.visible = true;
          entry.life = 0.08;
          break;
        }
      }
    },
    spawnImpact(point, normal) {
      // Spawn decal
      for (const entry of decalPool) {
        if (entry.life <= 0) {
          entry.mesh.position.copy(point);
          entry.mesh.position.addScaledVector(normal, 0.01);
          entry.mesh.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z);
          entry.mesh.visible = true;
          entry.life = 8.0;
          break;
        }
      }

      // Spawn sparks
      for (let i = 0; i < 3; i += 1) {
        for (const entry of sparkPool) {
          if (entry.life <= 0) {
            entry.mesh.position.copy(point);
            entry.velocity.set(
              (Math.random() * 2 - 1) * 2 + normal.x * 3,
              (Math.random() * 2 - 1) * 2 + normal.y * 3 + 2,
              (Math.random() * 2 - 1) * 2 + normal.z * 3
            );
            entry.life = 0.3;
            entry.mesh.visible = true;
            entry.mesh.scale.setScalar(1);
            break;
          }
        }
      }
    },
    setTeamColor(team) {
      const color = team === 'vanguard' ? '#3f5d7a' : '#7a4a3f';
      for (const mat of sleeveMats) mat.color.setStyle(color);
    },
    takeRound() {
      if (weapon.mag <= 0) return false;
      weapon.mag -= 1;
      return true;
    },
    reload() {
      const stats = WEAPONS[weapon.type];
      if (weapon.reloadLeft > 0 || weapon.mag === stats.mag || weapon.reserve === 0) return;
      weapon.reloadLeft = stats.reload;
    },
    spread(speed) {
      const stats = WEAPONS[weapon.type];
      const moveSpread = SPREAD_STILL + Math.min(1, speed / MOVE_REFERENCE) * SPREAD_MOVING;
      return moveSpread + stats.spread + weapon.recoilAccum * 0.5;
    },
    refill(type) {
      if (type) weapon.type = type;
      const stats = WEAPONS[weapon.type];
      weapon.mag = stats.mag;
      weapon.reserve = stats.reserve;
      weapon.cooldown = 0;
      weapon.reloadLeft = 0;
      weapon.flash = 0;
      weapon.kick = 0;
      weapon.recoilAccum = 0;
      weapon.recoilRecoverTime = 0;
    },
    damage() {
      return WEAPONS[weapon.type].damage;
    },
    stats() {
      return WEAPONS[weapon.type];
    },
    bodyMultiplier(part) {
      return BODY_MULTIPLIERS[part] || 1.0;
    },
  };
}
