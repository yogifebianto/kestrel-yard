// Boot and loop: fixed 60 Hz simulation, screenshot hooks, thin wiring between modules.
// Movement and crouch: player.step, player.js
// Recoil and spread: weapon.pullTrigger, weapon.spread
// Head damage: shoot(), part detection and bodyMultiplier
// Bomb plant and defuse: planting and defusing blocks in step()
// Economy and buy menu: economy.js, opened from the buy phase in step() and frame()
// Grenade: throwGrenade(), stepGrenades()
// Bot routes: assignRoles and waypoint navigation in bots.js
// Bot holding: the hold-role anchor and its yaw sweep in bots.step
// Bot hearing: state.noise written in shoot() and step(), read in bots.step
// Fixed step: frame() runs step() at a fixed 60 Hz, rendering stays separate
import * as THREE from 'three';
import { createState } from './state.js';
import { createMap } from './map.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon } from './weapon.js';
import { createHud } from './hud.js';
import { createBots } from './bots.js';
import { createRounds } from './rounds.js';
import { createEconomy } from './economy.js';
import { createAudio } from './audio.js';
import { createBotMeshes, updateBotMeshes } from './render.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.85;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Sky dome with warm horizon to cool zenith gradient
const skyGeo = new THREE.SphereGeometry(130, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
const skyMat = new THREE.ShaderMaterial({
  uniforms: {},
  vertexShader: `
    varying vec3 vPosition;
    void main() {
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vPosition;
    void main() {
      float t = clamp(vPosition.y / 130.0, 0.0, 1.0);
      vec3 horizon = vec3(0.82, 0.55, 0.35);
      vec3 zenith = vec3(0.30, 0.45, 0.62);
      gl_FragColor = vec4(mix(horizon, zenith, t * t), 1.0);
    }
  `,
  side: THREE.BackSide,
  depthWrite: false,
});
const skyDome = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyDome);

// Warm low fog matching horizon palette
scene.fog = new THREE.Fog(new THREE.Color('#d19068'), 45, 110);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const state = createState(seed);
const map = createMap(scene);
const botMeshes = createBotMeshes(scene);
const weapon = createWeapon(camera, state);
const hud = createHud(map);
const player = createPlayer(map.colliders, state);
const bots = createBots(state, map.waypoints);
const rounds = createRounds(state);
const economy = createEconomy(state);
economy.setWeaponRef(weapon);
economy.setHudRef(hud);
const audio = createAudio();
const input = createInput(renderer.domElement, onLockChange);
const raycaster = new THREE.Raycaster();
raycaster.far = 100;

let shootables = map.shootables;
const direction = new THREE.Vector3();
const shotDir = new THREE.Vector3();
const throwVelocity = new THREE.Vector3();
const grenadePos = new THREE.Vector3();
const grenadeVel = new THREE.Vector3();

const grenadeMeshes = [];
const grenadeGeometry = new THREE.SphereGeometry(0.06, 8, 6);
const grenadeMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a4a3a'), roughness: 0.8, metalness: 0.3 });

function createGrenadeMesh() {
  const mesh = new THREE.Mesh(grenadeGeometry, grenadeMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}

for (let i = 0; i < 8; i += 1) grenadeMeshes.push(createGrenadeMesh());

function updateShootables() {
  shootables.length = map.shootables.length;
  for (let i = 0; i < map.shootables.length; i += 1) shootables[i] = map.shootables[i];
  for (const mesh of botMeshes) {
    shootables.push(mesh.torso, mesh.head, mesh.legL, mesh.legR, mesh.armL, mesh.armR);
  }
}

const markerHoldMs = shot ? 4000 : 90;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let bombBeepTimer = 0;

hud.setAmmo(state.weapon.mag, state.weapon.reserve);
hud.setHealth(state.player.health);
hud.setArmour(state.player.armour, state.player.hasHelmet);
hud.setMoney(state.player.money);
hud.setGrenades(state.player.grenades, state.player.hasDefuseKit);
hud.setScore(state.round.vanguardWins, state.round.sentinelWins);
hud.setRound(state.round.number + 1);
hud.setWeapon(state.weapon.type, state.player.team);
hud.setTimer(0);
hud.onPlay(() => {
  if (shot) return;
  audio.resume();
  if (state.round.phase === 'match_end') {
    state.round.number = 0;
    state.round.vanguardWins = 0;
    state.round.sentinelWins = 0;
    state.player.team = 'vanguard';
    state.player.money = 800;
    state.player.hasDefuseKit = false;
    state.player.hasBomb = true;
    rounds.startRound();
    hud.hideOverlay();
    hud.setScore(0, 0);
    hud.setMoney(state.player.money);
  }
  input.requestLock();
});

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
  } else {
    hud.showOverlay(started ? 'paused' : 'start', state.round.vanguardWins, state.round.sentinelWins);
  }
}

function syncCamera() {
  const p = state.player;
  camera.position.set(p.position.x, p.position.y + p.eye, p.position.z);
  camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const p = state.player;
  const dx = point.x - p.position.x;
  const dy = point.y - (p.position.y + p.eye);
  const dz = point.z - p.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  p.yaw = Math.atan2(-dx, -dz);
  p.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function shoot(spread) {
  if (!weapon.takeRound()) return false;
  audio.playGunshot();
  state.noise.x = state.player.position.x;
  state.noise.y = state.player.position.y;
  state.noise.z = state.player.position.z;
  state.noise.radius = 35;
  state.noise.time = state.time;
  camera.getWorldDirection(direction);

  const stats = weapon.stats();
  const pellets = stats.pellets || 1;

  for (let p = 0; p < pellets; p += 1) {
    shotDir.copy(direction);
    shotDir.x += (random() * 2 - 1) * spread;
    shotDir.y += (random() * 2 - 1) * spread;
    shotDir.z += (random() * 2 - 1) * spread;
    shotDir.normalize();

    scene.updateMatrixWorld(true);
    raycaster.set(camera.position, shotDir);
    const hit = raycaster.intersectObjects(shootables, false)[0];

    if (hit) {
      audio.playImpact();
      weapon.spawnTracer(camera.position, shotDir, hit.distance);
      weapon.spawnImpact(hit.point, hit.face.normal);
      for (const bot of state.bots) {
        if (!bot.alive) continue;
        const botPos = bot.position;
        const dist = hit.point.distanceTo(botPos);
        if (dist < 0.8) {
          const yDiff = hit.point.y - botPos.y;
          const xDiff = Math.abs(hit.point.x - botPos.x);
          let part = 'torso';
          if (yDiff > 1.4) part = 'head';
          else if (yDiff < 0.6) part = 'legs';
          else if (xDiff > 0.2) part = 'arms';

          const mult = weapon.bodyMultiplier(part);
          let damage = weapon.damage() * mult;
          if (state.player.armour > 0 && part !== 'legs') {
            const absorbed = damage * 0.5;
            state.player.armour = Math.max(0, state.player.armour - absorbed);
            damage -= absorbed;
          }

          const killed = bots.takeDamage(bot.id, damage);
          hud.hitMarker(part === 'head', markerHoldMs);
          if (killed) {
            hud.addKill('Player', `Bot${bot.id}`, state.weapon.type, part === 'head');
            economy.killReward();
            hud.setMoney(state.player.money);
          }
          break;
        }
      }
    }
  }

  const recoil = weapon.pullTrigger(random);
  player.recoil(recoil, (random() * 2 - 1) * 0.004);
  hud.setAmmo(state.weapon.mag, state.weapon.reserve);
  return true;
}

let footstepPhase = 0;
let grenadeThrowCooldown = 0;

function throwGrenade() {
  if (state.player.grenades <= 0 || grenadeThrowCooldown > 0) return;
  state.player.grenades -= 1;
  grenadeThrowCooldown = 0.5;
  hud.setGrenades(state.player.grenades);

  camera.getWorldDirection(throwVelocity);
  const throwSpeed = 18;
  throwVelocity.multiplyScalar(throwSpeed);
  throwVelocity.y += 6;

  grenadePos.copy(camera.position);
  grenadeVel.copy(throwVelocity);

  state.grenades.push({
    position: grenadePos.clone(),
    velocity: grenadeVel.clone(),
    fuse: 1.6,
    team: state.player.team,
  });
}

const explosionScratch = new THREE.Vector3();

function stepGrenades(dt) {
  grenadeThrowCooldown = Math.max(0, grenadeThrowCooldown - dt);

  for (let i = state.grenades.length - 1; i >= 0; i -= 1) {
    const nade = state.grenades[i];
    nade.fuse -= dt;

    if (nade.fuse <= 0) {
      const explosionPos = nade.position;
      const radius = 5.5;

      if (state.player.alive) {
        explosionScratch.subVectors(state.player.position, explosionPos);
        const dist = explosionScratch.length();
        if (dist < radius) {
          const damage = Math.max(0, 95 * (1 - dist / radius));
          if (state.player.armour > 0) {
            const absorbed = damage * 0.5;
            state.player.armour = Math.max(0, state.player.armour - absorbed);
            state.player.health -= damage - absorbed;
          } else {
            state.player.health -= damage;
          }
          hud.setHealth(state.player.health);
          hud.setArmour(state.player.armour);
          if (state.player.health <= 0) {
            state.player.alive = false;
            state.player.health = 0;
          }
        }
      }

      for (const bot of state.bots) {
        if (!bot.alive) continue;
        explosionScratch.subVectors(bot.position, explosionPos);
        const dist = explosionScratch.length();
        if (dist < radius) {
          const damage = Math.max(0, 95 * (1 - dist / radius));
          const killed = bots.takeDamage(bot.id, damage);
          if (killed && nade.team === state.player.team) {
            hud.addKill('Player', `Bot${bot.id}`, 'HE', false);
            economy.killReward();
            hud.setMoney(state.player.money);
          }
        }
      }

      state.grenades.splice(i, 1);
      continue;
    }

    nade.velocity.y -= 20 * dt;
    nade.position.x += nade.velocity.x * dt;
    nade.position.y += nade.velocity.y * dt;
    nade.position.z += nade.velocity.z * dt;

    if (nade.position.y < 0) {
      nade.position.y = 0;
      nade.velocity.y = -nade.velocity.y * 0.5;
      nade.velocity.x *= 0.7;
      nade.velocity.z *= 0.7;
    }

    for (const box of map.colliders) {
      if (box.containsPoint(nade.position)) {
        nade.velocity.multiplyScalar(-0.4);
        nade.position.x += nade.velocity.x * dt * 2;
        nade.position.z += nade.velocity.z * dt * 2;
        break;
      }
    }
  }

  for (let i = 0; i < grenadeMeshes.length; i += 1) {
    if (i < state.grenades.length) {
      grenadeMeshes[i].visible = true;
      grenadeMeshes[i].position.copy(state.grenades[i].position);
    } else {
      grenadeMeshes[i].visible = false;
    }
  }
}

function step(dt) {
  state.time += dt;
  stepGrenades(dt);

  if (state.round.phase === 'live') {
    const prevDist = state.player.distanceTravelled || 0;
    player.step(dt, input.state.keys);
    const distMoved = (state.player.distanceTravelled || 0) - prevDist;

    if (distMoved > 0 && state.player.onGround) {
      const stepInterval = state.player.crouching ? 9999 : (player.groundSpeed() > 4.0 ? 0.85 : 1.6);
      footstepPhase += distMoved;
      if (footstepPhase > stepInterval) {
        footstepPhase = 0;
        const volume = state.player.crouching ? 0 : (player.groundSpeed() > 4.0 ? 0.08 : 0.04);
        if (volume > 0) {
          audio.playFootstep(volume);
          state.noise.x = state.player.position.x;
          state.noise.y = state.player.position.y;
          state.noise.z = state.player.position.z;
          state.noise.radius = player.groundSpeed() > 4.0 ? 12 : 6;
          state.noise.time = state.time;
        }
      }
    }

    // Bomb plant/defuse logic
    const p = state.player;
    const isInSiteA = Math.abs(p.position.x + 20) < 6 && Math.abs(p.position.z + 20) < 5;
    const isInSiteB = Math.abs(p.position.x - 20) < 7 && Math.abs(p.position.z - 20) < 7;

    if (input.state.keys.has('KeyE') && p.alive && !state.round.bombPlanted && p.hasBomb && (isInSiteA || isInSiteB)) {
      p.planting = true;
      p.plantTime += dt;
      hud.showPlantProgress(Math.min(1, p.plantTime / 3));
      if (p.plantTime >= 3) {
        const site = isInSiteA ? 'a_site' : 'b_site';
        rounds.plantBomb(site);
        hud.showRadio(`Bomb planted at ${site === 'a_site' ? 'A' : 'B'}`);
        p.hasBomb = false;
        p.planting = false;
        p.plantTime = 0;
        hud.hidePlantProgress();
      }
    } else if (!input.state.keys.has('KeyE')) {
      if (p.planting) hud.hidePlantProgress();
      p.planting = false;
      p.plantTime = 0;
    }

    if (p.hasBomb && !state.round.bombPlanted) {
      hud.showBombCarrier();
    } else {
      hud.hideBombCarrier();
    }

    if (state.round.bombPlanted && p.team === 'sentinel') {
      const bombSite = state.round.bombSite;
      const siteX = bombSite === 'a_site' ? -20 : 20;
      const siteZ = bombSite === 'a_site' ? -20 : 20;
      const distToBomb = Math.hypot(p.position.x - siteX, p.position.z - siteZ);

      if (input.state.keys.has('KeyE') && p.alive && distToBomb < 3) {
        if (!p.defusing) {
          hud.showRadio(`Defusing at ${bombSite === 'a_site' ? 'A' : 'B'}`);
        }
        p.defusing = true;
        p.defuseTime += dt;
        const defuseTimeNeeded = p.hasDefuseKit ? 5 : 10;
        hud.showDefuseProgress(Math.min(1, p.defuseTime / defuseTimeNeeded));
        if (p.defuseTime >= defuseTimeNeeded) {
          rounds.endRound('sentinel', 'defuse');
          p.defusing = false;
          p.defuseTime = 0;
          hud.hideDefuseProgress();
        }
      } else if (!input.state.keys.has('KeyE')) {
        if (p.defusing) hud.hideDefuseProgress();
        p.defusing = false;
        p.defuseTime = 0;
      }
    }

    const botShots = bots.step(dt, random, map.colliders, weapon, hud, rounds);

    let anyBotPlanting = false;
    let anyBotDefusing = false;
    for (const bot of state.bots) {
      if (bot.planting && bot.plantTime > 0) {
        hud.showPlantProgress(Math.min(1, bot.plantTime / 3));
        anyBotPlanting = true;
      }
      if (bot.defusing && bot.defuseTime > 0) {
        const defuseTimeNeeded = bot.hasDefuseKit ? 5 : 10;
        hud.showDefuseProgress(Math.min(1, bot.defuseTime / defuseTimeNeeded));
        anyBotDefusing = true;
      }
    }
    if (!anyBotPlanting && !state.player.planting) hud.hidePlantProgress();
    if (!anyBotDefusing && !state.player.defusing) hud.hideDefuseProgress();

    for (const shot of botShots) {
      audio.playGunshot(0.04);
      raycaster.set(shot.origin, shot.direction);
      raycaster.far = 100;
      const hits = raycaster.intersectObjects(shootables, false);
      const hit = hits[0];

      if (hit) {
        const playerPos = state.player.position;
        const dist = hit.point.distanceTo(playerPos);
        if (dist < 0.8 && state.player.alive) {
          const yDiff = hit.point.y - playerPos.y;
          const xDiff = Math.abs(hit.point.x - playerPos.x);
          let part = 'torso';
          if (yDiff > 1.4) part = 'head';
          else if (yDiff < 0.6) part = 'legs';
          else if (xDiff > 0.2) part = 'arms';

          const mult = weapon.bodyMultiplier(part);
          let damage = 34 * mult;

          if (state.player.armour > 0 && part !== 'legs') {
            const absorbed = damage * 0.5;
            state.player.armour = Math.max(0, state.player.armour - absorbed);
            damage -= absorbed;
          }

          state.player.health -= damage;
          hud.setHealth(state.player.health);
          hud.setArmour(state.player.armour);

          if (state.player.health <= 0) {
            state.player.alive = false;
            state.player.health = 0;
            hud.addKill(`Bot${shot.shooterId}`, 'Player', 'AR-4', part === 'head');
            hud.showDeathOverlay(`Bot${shot.shooterId}`);
          }
        }
      }
    }
  } else if (state.round.phase === 'buy') {
    player.step(dt, input.state.keys);
  }

  weapon.step(dt);

  const prevPhase = state.round.phase;
  rounds.step(dt);

  // Handle round transitions
  if (prevPhase !== 'buy' && state.round.phase === 'buy') {
    hud.setGrenades(state.player.grenades, state.player.hasDefuseKit);
    hud.setRound(state.round.number + 1);
  }

  if (prevPhase === 'buy' && state.round.phase === 'live') {
    if (state.round.sideSwapped) {
      const newTeamName = state.player.team === 'vanguard' ? 'Vanguard' : 'Sentinel';
      hud.showRoundBanner(`Side swap! You are now ${newTeamName}`);
      hud.setWeapon(state.weapon.type, state.player.team);
      weapon.setTeamColor(state.player.team);
      state.round.sideSwapped = false;
    }
    bots.spawn();
    bots.assignRoles(random);
  }

  if (prevPhase !== 'end' && state.round.phase === 'end') {
    const won = state.round.winner === state.player.team;
    economy.roundIncome(won, state.player.alive);
    hud.setMoney(state.player.money);

    const reason = state.round.winReason;
    const winner = state.round.winner === 'vanguard' ? 'Vanguard' : 'Sentinel';
    hud.showRoundBanner(`${winner} wins by ${reason}!`);
  }

  if (prevPhase !== 'match_end' && state.round.phase === 'match_end') {
    const winner = state.round.vanguardWins >= 8 ? 'vanguard' : 'sentinel';
    hud.showMatchEnd(winner, state.round.vanguardWins, state.round.sentinelWins);
  }

  if (state.round.phase === 'end' || state.round.phase === 'match_end') {
    hud.hideDeathOverlay();
  }

  const timeLeft = rounds.getTimeLeft();
  hud.refreshHUD(state, timeLeft);

  if (state.round.bombPlanted) {
    bombBeepTimer += dt;
    if (bombBeepTimer > 1.0) {
      audio.playBombBeep();
      bombBeepTimer = 0;
    }
    const bombTime = 40 - state.round.bombTime;
    hud.showBombIndicator(`BOMB: ${Math.ceil(bombTime)}s`);
  } else {
    hud.hideBombIndicator();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    player.look(look.x, look.y);
    const currentSpread = weapon.spread(player.groundSpeed());
    hud.setCrosshairGap(currentSpread);

    if (input.state.keys.has('KeyB') && !economy.isMenuOpen()) {
      const canBuy = state.round.phase === 'buy' || (state.round.phase === 'live' && state.round.phaseTime < 20);
      if (canBuy) economy.showBuyMenu();
    }
    if (input.state.keys.has('Escape') && economy.isMenuOpen()) {
      economy.hideBuyMenu();
    }

    if (!economy.isMenuOpen()) {
      updateShootables();
      if (input.state.firing && weapon.ready() && state.player.alive) {
        shoot(shot ? 0 : currentSpread);
      }
      if (input.state.keys.has('KeyR')) {
        weapon.reload();
        audio.playReload();
      }
      if (input.state.keys.has('KeyG') && state.player.alive) {
        throwGrenade();
      }
    }

    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
    updateBotMeshes(state.bots, botMeshes);
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function runShot(name) {
  const p = state.player;
  p.pitch = 0;
  p.yaw = 0;

  if (name === 'play') {
    hud.hideOverlay();
    bots.spawn();
    bots.assignRoles(random);
    const enemyBot = state.bots.find(b => b.team === 'sentinel');
    if (enemyBot) {
      enemyBot.position.set(-5, 0, -12);
      enemyBot.yaw = Math.PI * 0.75;
    }
    p.position.set(0, 0, 0);
    aimAt(new THREE.Vector3(-5, 1.6, -12));
    state.weapon.type = 'AR-4';
    state.weapon.mag = 22;
    state.weapon.reserve = 60;
    state.player.health = 92;
    state.player.armour = 78;
    state.player.money = 2450;
    state.player.grenades = 1;
    state.round.phase = 'live';
    state.round.phaseTime = 48;
    state.round.vanguardWins = 3;
    state.round.sentinelWins = 2;
  } else if (name === 'menu') {
    p.position.set(0, 0, 28);
    aimAt(new THREE.Vector3(0, 1.5, -5));
    hud.showOverlay('start', 0, 0);
  } else if (name === 'buy') {
    hud.hideOverlay();
    p.position.set(0, 0, 28);
    aimAt(new THREE.Vector3(0, 1.5, 0));
    state.player.money = 3500;
    state.player.team = 'sentinel';
    state.round.phase = 'buy';
    state.round.phaseTime = 5;
    economy.showBuyMenu();
  } else if (name === 'bomb') {
    hud.hideOverlay();
    bots.spawn();
    bots.assignRoles(random);
    const defuserBot = state.bots.find(b => b.team === 'sentinel');
    if (defuserBot) {
      defuserBot.position.set(-20, 0.8, -22);
    }
    p.position.set(-15, 0.8, -15);
    aimAt(new THREE.Vector3(-20, 1.5, -20));
    state.round.bombPlanted = true;
    state.round.bombSite = 'a_site';
    state.round.bombTime = 20;
    state.round.phase = 'live';
    hud.showBombIndicator('BOMB: 20s');
  }

  weapon.setTeamColor(state.player.team);
  syncCamera();
  updateBotMeshes(state.bots, botMeshes);
  hud.refreshHUD(state, state.round.phase === 'buy' ? 10 : 95);

  // Emit contact callout if any friendly bot has detected an enemy
  const friendlyBotWithContact = state.bots.find(b => b.team === state.player.team && b.target !== null);
  if (friendlyBotWithContact && friendlyBotWithContact.path.length > 0) {
    const wp = map.waypoints.find(w => w.id === friendlyBotWithContact.path[friendlyBotWithContact.waypointIndex]);
    const lane = wp ? wp.lane.replace('_', ' ').toUpperCase() : 'MID';
    hud.showRadio(`Contact at ${lane}`);
  }

  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
