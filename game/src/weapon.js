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

export function createWeapon(camera, state) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });

  const model = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.42), body);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.4), grip);
  barrel.position.set(0, 0.025, -0.38);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip);
  stock.position.set(0, -0.02, 0.3);
  model.add(receiver, barrel, stock);
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const weapon = state.weapon;

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

    model.position.z = -0.42 + weapon.kick;
    model.rotation.x = weapon.kick * 2.2;

    if (weapon.switchTime > 0) {
      const switchProgress = weapon.switchTime / 0.4;
      model.position.y = -0.2 - switchProgress * 0.5;
      model.rotation.x = switchProgress * -0.8;
    } else {
      model.position.y = -0.2;
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
      weapon.kick = 0.055;
      weapon.recoilAccum = Math.min(0.12, weapon.recoilAccum + stats.recoilClimb);
      weapon.recoilRecoverTime = 0;
      return weapon.recoilAccum + (random() * 0.004 - 0.002);
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
