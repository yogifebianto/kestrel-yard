// Bot AI: waypoint navigation, field of view, aiming, shooting, bomb behavior.
import * as THREE from 'three';

const BOT_SPEED = 4.5;
const BOT_RADIUS = 0.34;
const BOT_HEIGHT = 1.72;
const BOT_EYE = 1.6;
const FOV_ANGLE = Math.PI * 0.55;
const REACTION_TIME = 0.15;
const AIM_ERROR_MAX = 0.08;
const AIM_ERROR_MIN = 0.005;
const AIM_TRACK_TIME = 1.2;
const FIRE_RATE = 0.12;
const WAYPOINT_REACH = 1.8;

const shotOrigin = new THREE.Vector3();
const shotDirection = new THREE.Vector3();

export function createBots(state, waypoints) {
  const bots = [];
  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3();
  const wishDir = new THREE.Vector3();
  const targetDir = new THREE.Vector3();
  const botEye = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const playerEye = new THREE.Vector3();
  const enemyEye = new THREE.Vector3();
  const targetPos = new THREE.Vector3();

  function spawn() {
    bots.length = 0;
    state.bots = bots;

    const playerTeam = state.player.team;
    const enemyTeam = playerTeam === 'vanguard' ? 'sentinel' : 'vanguard';

    // 3 teammates
    for (let i = 0; i < 3; i += 1) {
      bots.push(createBot(playerTeam, i, waypoints));
    }

    // 4 enemies
    for (let i = 0; i < 4; i += 1) {
      bots.push(createBot(enemyTeam, i + 3, waypoints));
    }
  }

  function createBot(team, id, waypoints) {
    const spawnWp = waypoints.find(wp => wp.lane === (team === 'vanguard' ? 'vanguard_spawn' : 'sentinel_spawn'));
    return {
      id,
      team,
      position: new THREE.Vector3(spawnWp.x, 0, spawnWp.z),
      velocity: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      health: 100,
      armour: 0,
      alive: true,
      weapon: team === 'vanguard' ? 'AR-4' : 'AR-4',
      mag: 30,
      cooldown: 0,
      reactionTime: 0,
      target: null,
      trackTime: 0,
      role: null,
      waypointIndex: 0,
      path: [],
      hasDefuseKit: team === 'sentinel',
      distanceTravelled: 0,
      deathTime: 0,
      hasBomb: false,
      planting: false,
      plantTime: 0,
      defusing: false,
      defuseTime: 0,
    };
  }

  function assignRoles(random) {
    const vanguard = bots.filter(b => b.team === 'vanguard' && b.alive);
    const sentinel = bots.filter(b => b.team === 'sentinel' && b.alive);

    const site = random() < 0.5 ? 'a_site' : 'b_site';

    if (!state.player.hasBomb && vanguard.length > 0) {
      const bombCarrier = vanguard[Math.floor(random() * vanguard.length)];
      bombCarrier.hasBomb = true;
    }

    for (const bot of vanguard) {
      bot.role = 'rush';
      bot.path = site === 'a_site'
        ? [2, 3, 4, 7]
        : [8, 11, 12, 13];
      bot.waypointIndex = 0;
    }

    for (const bot of sentinel) {
      if (random() < 0.5) {
        bot.role = 'hold';
        bot.path = site === 'a_site' ? [5, 6, 7] : [11, 12, 13];
      } else {
        bot.role = 'rotate';
        bot.path = site === 'a_site' ? [10, 9, 8, 11, 12, 13] : [10, 6, 7];
      }
      bot.waypointIndex = 0;
    }
  }

  function canSee(bot, targetPosIn, colliders) {
    botEye.set(bot.position.x, bot.position.y + BOT_EYE, bot.position.z);
    targetDir.subVectors(targetPosIn, botEye);
    const dist = targetDir.length();
    if (dist > 60) return false;

    forward.set(Math.sin(bot.yaw), 0, Math.cos(bot.yaw));
    const dot = forward.dot(targetDir.clone().normalize());
    if (dot < Math.cos(FOV_ANGLE / 2)) return false;

    raycaster.set(botEye, targetDir.normalize());
    raycaster.far = dist;
    const hits = raycaster.intersectObjects(colliders, false);
    return hits.length === 0 || hits[0].distance > dist - 0.5;
  }

  function moveToward(bot, target, dt) {
    wishDir.set(target.x - bot.position.x, 0, target.z - bot.position.z);
    const dist = wishDir.length();
    if (dist < 0.1) return true;
    wishDir.normalize();
    bot.yaw = Math.atan2(wishDir.x, wishDir.z);
    bot.velocity.x = wishDir.x * BOT_SPEED;
    bot.velocity.z = wishDir.z * BOT_SPEED;
    const moveDist = BOT_SPEED * dt;
    bot.position.x += bot.velocity.x * dt;
    bot.position.z += bot.velocity.z * dt;
    bot.distanceTravelled += moveDist;
    return dist < WAYPOINT_REACH;
  }

  function aimAt(bot, targetIn, dt) {
    botEye.set(bot.position.x, bot.position.y + BOT_EYE, bot.position.z);
    targetDir.subVectors(targetIn, botEye);
    const dist = targetDir.length();
    targetDir.normalize();

    const yaw = Math.atan2(targetDir.x, targetDir.z);
    const pitch = Math.asin(-targetDir.y);

    bot.trackTime += dt;
    const error = AIM_ERROR_MAX - Math.min(1, bot.trackTime / AIM_TRACK_TIME) * (AIM_ERROR_MAX - AIM_ERROR_MIN);
    bot.yaw = yaw;
    bot.pitch = pitch;
    return error;
  }

  function shoot(bot, random, weapon, hud) {
    if (bot.cooldown > 0 || bot.mag === 0) return false;
    bot.cooldown = FIRE_RATE;
    bot.mag -= 1;

    botEye.set(bot.position.x, bot.position.y + BOT_EYE, bot.position.z);
    direction.set(Math.sin(bot.yaw), Math.sin(bot.pitch), Math.cos(bot.yaw)).normalize();
    const error = AIM_ERROR_MIN + (random() * 0.02);
    direction.x += (random() * 2 - 1) * error;
    direction.y += (random() * 2 - 1) * error;
    direction.z += (random() * 2 - 1) * error;
    direction.normalize();

    shotOrigin.copy(botEye);
    shotDirection.copy(direction);
    raycaster.set(shotOrigin, shotDirection);
    raycaster.far = 100;
    return true;
  }

  function step(dt, random, colliders, weapon, hud, rounds) {
    if (state.round.phase !== 'live') return [];
    const shots = [];

    for (const bot of bots) {
      if (!bot.alive) {
        bot.deathTime += dt;
        continue;
      }

      bot.cooldown = Math.max(0, bot.cooldown - dt);

      // Bot planting
      if (bot.hasBomb && !state.round.bombPlanted && bot.team === 'vanguard') {
        const isInSiteA = Math.abs(bot.position.x + 20) < 6 && Math.abs(bot.position.z + 20) < 5;
        const isInSiteB = Math.abs(bot.position.x - 20) < 7 && Math.abs(bot.position.z - 20) < 7;
        if (isInSiteA || isInSiteB) {
          bot.planting = true;
          bot.plantTime += dt;
          if (bot.plantTime >= 3) {
            rounds.plantBomb(isInSiteA ? 'a_site' : 'b_site');
            bot.hasBomb = false;
            bot.planting = false;
            bot.plantTime = 0;
          }
          continue;
        } else {
          if (bot.planting) {
            bot.planting = false;
            bot.plantTime = 0;
          }
        }
      }

      // Bot defusing
      if (state.round.bombPlanted && bot.team === 'sentinel' && bot.role === 'defuse') {
        const bombSite = state.round.bombSite;
        const siteX = bombSite === 'a_site' ? -20 : 20;
        const siteZ = bombSite === 'a_site' ? -20 : 20;
        const distToBomb = Math.hypot(bot.position.x - siteX, bot.position.z - siteZ);
        if (distToBomb < 3) {
          bot.defusing = true;
          bot.defuseTime += dt;
          const defuseTimeNeeded = bot.hasDefuseKit ? 5 : 10;
          if (bot.defuseTime >= defuseTimeNeeded) {
            rounds.endRound('sentinel', 'defuse');
            bot.defusing = false;
            bot.defuseTime = 0;
          }
          continue;
        } else {
          if (bot.defusing) {
            bot.defusing = false;
            bot.defuseTime = 0;
          }
        }
      }

      // Check for targets
      playerEye.set(state.player.position.x, state.player.position.y + state.player.eye, state.player.position.z);
      if (bot.team !== state.player.team && state.player.alive && canSee(bot, playerEye, colliders)) {
        if (!bot.target) {
          bot.reactionTime = REACTION_TIME;
          bot.trackTime = 0;
        }
        bot.target = 'player';
      } else {
        let foundEnemy = null;
        for (const b of bots) {
          if (b.team !== bot.team && b.alive) {
            enemyEye.set(b.position.x, b.position.y + BOT_EYE, b.position.z);
            if (canSee(bot, enemyEye, colliders)) {
              foundEnemy = b;
              break;
            }
          }
        }
        if (foundEnemy) {
          if (!bot.target) {
            bot.reactionTime = REACTION_TIME;
            bot.trackTime = 0;
          }
          bot.target = foundEnemy.id;
        } else {
          bot.target = null;
        }
      }

      // Engage target
      if (bot.target) {
        if (bot.target === 'player') {
          targetPos.copy(playerEye);
        } else {
          const targetBot = bots.find(b => b.id === bot.target);
          targetPos.set(targetBot.position.x, targetBot.position.y + BOT_EYE, targetBot.position.z);
        }
        aimAt(bot, targetPos, dt);
        bot.velocity.set(0, 0, 0);

        if (bot.reactionTime > 0) {
          bot.reactionTime -= dt;
        } else if (shoot(bot, random, weapon, hud)) {
          shots.push({ origin: new THREE.Vector3().copy(shotOrigin), direction: new THREE.Vector3().copy(shotDirection), shooterId: bot.id, team: bot.team });
        }
      } else {
        // Navigate waypoints
        if (state.round.bombPlanted && bot.team === 'sentinel' && bot.role !== 'defuse') {
          bot.role = 'defuse';
          bot.path = state.round.bombSite === 'a_site' ? [10, 6, 7] : [8, 11, 12, 13];
          bot.waypointIndex = 0;
        }

        if (bot.path.length > 0 && bot.waypointIndex < bot.path.length) {
          const wp = waypoints.find(w => w.id === bot.path[bot.waypointIndex]);
          if (wp && moveToward(bot, wp, dt)) {
            bot.waypointIndex += 1;
          }
        }
      }
    }

    return shots;
  }

  function takeDamage(botId, damage) {
    const bot = bots.find(b => b.id === botId);
    if (!bot || !bot.alive) return false;
    bot.health -= damage;
    if (bot.health <= 0) {
      bot.alive = false;
      bot.health = 0;
      bot.deathTime = 0;
      return true;
    }
    return false;
  }

  return {
    step,
    spawn,
    assignRoles,
    takeDamage,
  };
}
