// HUD: health, armour, ammo, round timer, score, money, crosshair, hit marker, overlays.
const COPY = {
  start: {
    title: 'KESTREL YARD',
    copy: 'Tactical FPS. Plant the bomb or eliminate the enemy.',
    action: 'Deploy',
  },
  paused: {
    title: 'KESTREL YARD',
    copy: 'Paused. Click to resume.',
    action: 'Resume',
  },
  end: {
    title: 'Match ended',
    copy: 'The match is over.',
    action: 'Play again',
  },
};

// Minimap canvas - drawn once at module scope
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
const MAP_SIZE = 64;
const MINIMAP_SIZE = 164;
const SCALE = MINIMAP_SIZE / MAP_SIZE;

// Base map image drawn once at module scope, never reallocated
const baseMapCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (baseMapCanvas) {
  baseMapCanvas.width = MINIMAP_SIZE;
  baseMapCanvas.height = MINIMAP_SIZE;
}
const baseMapCtx = baseMapCanvas ? baseMapCanvas.getContext('2d') : null;

function buildMinimap(colliders, waypoints) {
  if (!baseMapCtx) return;

  // Clear and draw floor
  baseMapCtx.fillStyle = '#cbbfa8';
  baseMapCtx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  // Draw grid lines every 8m
  baseMapCtx.strokeStyle = 'rgba(91, 83, 72, 0.15)';
  baseMapCtx.lineWidth = 0.5;
  for (let i = -32; i <= 32; i += 8) {
    const x = (i + MAP_SIZE / 2) * SCALE;
    baseMapCtx.beginPath();
    baseMapCtx.moveTo(x, 0);
    baseMapCtx.lineTo(x, MINIMAP_SIZE);
    baseMapCtx.stroke();
    baseMapCtx.beginPath();
    baseMapCtx.moveTo(0, x);
    baseMapCtx.lineTo(MINIMAP_SIZE, x);
    baseMapCtx.stroke();
  }

  // Draw walls from colliders
  baseMapCtx.fillStyle = '#5b5348';
  for (const box of colliders) {
    const minX = (box.min.x + MAP_SIZE / 2) * SCALE;
    const minZ = (box.min.z + MAP_SIZE / 2) * SCALE;
    const maxX = (box.max.x + MAP_SIZE / 2) * SCALE;
    const maxZ = (box.max.z + MAP_SIZE / 2) * SCALE;
    const width = maxX - minX;
    const height = maxZ - minZ;
    if (width > 0 && height > 0 && box.max.y > 1.5) {
      baseMapCtx.fillRect(minX, minZ, width, height);
    }
  }

  // Draw corner brackets
  baseMapCtx.strokeStyle = '#5b5348';
  baseMapCtx.lineWidth = 2;
  const bracketLen = 8;
  const corners = [[2, 2], [MINIMAP_SIZE - 2, 2], [2, MINIMAP_SIZE - 2], [MINIMAP_SIZE - 2, MINIMAP_SIZE - 2]];
  for (const [cx, cy] of corners) {
    const dx = cx < MINIMAP_SIZE / 2 ? 1 : -1;
    const dy = cy < MINIMAP_SIZE / 2 ? 1 : -1;
    baseMapCtx.beginPath();
    baseMapCtx.moveTo(cx, cy);
    baseMapCtx.lineTo(cx + dx * bracketLen, cy);
    baseMapCtx.moveTo(cx, cy);
    baseMapCtx.lineTo(cx, cy + dy * bracketLen);
    baseMapCtx.stroke();
  }

  // Draw site markers
  const siteA = waypoints.find(wp => wp.lane === 'a_site');
  const siteB = waypoints.find(wp => wp.lane === 'b_site');

  baseMapCtx.font = 'bold 14px monospace';
  baseMapCtx.textAlign = 'center';
  baseMapCtx.textBaseline = 'middle';

  if (siteA) {
    const x = (siteA.x + MAP_SIZE / 2) * SCALE;
    const z = (siteA.z + MAP_SIZE / 2) * SCALE;
    baseMapCtx.fillStyle = '#4a4238';
    baseMapCtx.fillRect(x - 10, z - 10, 20, 20);
    baseMapCtx.fillStyle = '#f0a830';
    baseMapCtx.fillText('A', x, z);
  }
  if (siteB) {
    const x = (siteB.x + MAP_SIZE / 2) * SCALE;
    const z = (siteB.z + MAP_SIZE / 2) * SCALE;
    baseMapCtx.fillStyle = '#4a4238';
    baseMapCtx.fillRect(x - 10, z - 10, 20, 20);
    baseMapCtx.fillStyle = '#f0a830';
    baseMapCtx.fillText('B', x, z);
  }
}

export function createHud(mapData) {
  if (mapData) buildMinimap(mapData.colliders, mapData.waypoints);

  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const copy = document.getElementById('overlay-copy');
  const play = document.getElementById('play');
  const ammoPanel = document.getElementById('ammo-panel');
  const ammoMag = document.getElementById('ammo-mag');
  const ammoReserve = document.getElementById('ammo-reserve');
  const scoreVanguard = document.getElementById('score-vanguard');
  const scoreSentinel = document.getElementById('score-sentinel');
  const roundText = document.getElementById('round-text');
  const hitmarker = document.getElementById('hitmarker');
  const healthEl = document.getElementById('health');
  const armourEl = document.getElementById('armour');
  const timerEl = document.getElementById('timer');
  const moneyEl = document.getElementById('money');
  const crosshairGap = document.getElementById('crosshair');
  const killfeed = document.getElementById('killfeed');
  const bombIndicator = document.getElementById('bomb-indicator');
  const roundBanner = document.getElementById('round-banner');
  const plantProgress = document.getElementById('plant-progress');
  const plantFill = document.getElementById('plant-fill');
  const defuseProgress = document.getElementById('defuse-progress');
  const defuseFill = document.getElementById('defuse-fill');
  const bombCarrier = document.getElementById('bomb-carrier');
  const deathOverlay = document.getElementById('death-overlay');
  const deathTitle = document.getElementById('death-title');
  const deathCopy = document.getElementById('death-copy');
  const grenadesEl = document.getElementById('grenades');
  const grenadeRack = document.getElementById('grenade-rack');
  const weaponName = document.getElementById('weapon-name');
  const weaponNameAmmo = document.getElementById('weapon-name-ammo');
  const weaponTag = document.getElementById('weapon-tag');
  const kitItem = document.getElementById('kit-item');
  const radioCallout = document.getElementById('radio-callout');

  let hitTimer = 0;
  let lastMag = -1;
  let lastReserve = -1;
  let lastVanguard = -1;
  let lastSentinel = -1;
  let lastHealth = -1;
  let lastArmour = -1;
  let lastHelmet = false;
  let lastMoney = -1;
  let lastGrenades = -1;
  let lastWeapon = '';
  let lastTeam = '';
  let radioTimer = 0;

  return {
    setAmmo(mag, reserve) {
      if (mag === lastMag && reserve === lastReserve) return;
      lastMag = mag;
      lastReserve = reserve;
      if (ammoMag) ammoMag.textContent = String(mag);
      if (ammoReserve) ammoReserve.textContent = `/ ${reserve}`;
      if (ammoPanel) ammoPanel.classList.toggle('empty', mag === 0);
    },
    setHealth(value) {
      if (value === lastHealth) return;
      lastHealth = value;
      if (healthEl) healthEl.textContent = String(Math.max(0, Math.round(value)));
    },
    setArmour(value, hasHelmet) {
      if (value === lastArmour && hasHelmet === lastHelmet) return;
      lastArmour = value;
      lastHelmet = hasHelmet;
      if (armourEl) {
        const armourVal = Math.max(0, Math.round(value));
        armourEl.textContent = hasHelmet ? `${armourVal} + H` : String(armourVal);
      }
    },
    setMoney(value) {
      if (value === lastMoney) return;
      lastMoney = value;
      if (moneyEl) moneyEl.textContent = `$${value}`;
    },
    setGrenades(value, hasDefuseKit) {
      if (value === lastGrenades) return;
      lastGrenades = value;
      if (grenadesEl) grenadesEl.textContent = String(value);
      if (grenadeRack) grenadeRack.hidden = value === 0 && !hasDefuseKit;
      if (kitItem) kitItem.hidden = !hasDefuseKit;
    },
    setTimer(seconds) {
      if (!timerEl) return;
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    setScore(vanguard, sentinel) {
      if (vanguard === lastVanguard && sentinel === lastSentinel) return;
      lastVanguard = vanguard;
      lastSentinel = sentinel;
      if (scoreVanguard) scoreVanguard.textContent = String(vanguard);
      if (scoreSentinel) scoreSentinel.textContent = String(sentinel);
    },
    setRound(number, total = 16) {
      if (roundText) roundText.textContent = `ROUND ${number} OF ${total}`;
    },
    setWeapon(weaponType, team) {
      if (weaponType === lastWeapon && team === lastTeam) return;
      lastWeapon = weaponType;
      lastTeam = team;
      if (weaponName) weaponName.textContent = weaponType;
      if (weaponNameAmmo) weaponNameAmmo.textContent = weaponType;
      if (weaponTag) {
        weaponTag.style.background = team === 'vanguard' ? '#4a9eff' : '#ff6b4a';
      }
    },
    updateMinimap(player, bots, bombPlanted, bombSite) {
      if (!minimapCtx || !baseMapCanvas) return;
      if (!player || !player.position) return;

      // Redraw base map from pre-rendered canvas (no allocation)
      minimapCtx.drawImage(baseMapCanvas, 0, 0);

      // Draw player (arrow)
      const px = (player.position.x + MAP_SIZE / 2) * SCALE;
      const pz = (player.position.z + MAP_SIZE / 2) * SCALE;
      minimapCtx.save();
      minimapCtx.translate(px, pz);
      minimapCtx.rotate((player.yaw || 0) + Math.PI);
      minimapCtx.fillStyle = player.team === 'vanguard' ? '#4a9eff' : '#ff6b4a';
      minimapCtx.beginPath();
      minimapCtx.moveTo(0, -4);
      minimapCtx.lineTo(-3, 4);
      minimapCtx.lineTo(3, 4);
      minimapCtx.closePath();
      minimapCtx.fill();
      minimapCtx.restore();

      // Draw bots with guards for incomplete data
      for (const bot of bots) {
        if (!bot || !bot.position || !bot.alive) continue;
        const bx = (bot.position.x + MAP_SIZE / 2) * SCALE;
        const bz = (bot.position.z + MAP_SIZE / 2) * SCALE;
        const botTeam = bot.team || 'sentinel';
        minimapCtx.fillStyle = botTeam === player.team ? '#4a9eff' : '#ff6b4a';
        minimapCtx.beginPath();
        minimapCtx.arc(bx, bz, 2.5, 0, Math.PI * 2);
        minimapCtx.fill();
      }

      // Draw bomb if planted
      if (bombPlanted && bombSite) {
        const siteX = bombSite === 'a_site' ? -20 : 20;
        const siteZ = bombSite === 'a_site' ? -20 : 20;
        const bx = (siteX + MAP_SIZE / 2) * SCALE;
        const bz = (siteZ + MAP_SIZE / 2) * SCALE;
        minimapCtx.fillStyle = '#f0a830';
        minimapCtx.strokeStyle = '#1a1c20';
        minimapCtx.lineWidth = 1.5;
        minimapCtx.beginPath();
        minimapCtx.arc(bx, bz, 4, 0, Math.PI * 2);
        minimapCtx.fill();
        minimapCtx.stroke();
      }
    },
    refreshHUD(state, timeSeconds) {
      this.setTimer(timeSeconds);
      this.setScore(state.round.vanguardWins, state.round.sentinelWins);
      this.setRound(state.round.number + 1);
      this.setAmmo(state.weapon.mag, state.weapon.reserve);
      this.setHealth(state.player.health);
      this.setArmour(state.player.armour, state.player.hasHelmet);
      this.setMoney(state.player.money);
      this.setGrenades(state.player.grenades, state.player.hasDefuseKit);
      this.setWeapon(state.weapon.type, state.player.team);
      this.updateMinimap(state.player, state.bots, state.round.bombPlanted, state.round.bombSite);
    },
    showRadio(message, duration = 3000) {
      if (!radioCallout) return;
      radioCallout.textContent = message;
      radioCallout.classList.add('show');
      clearTimeout(radioTimer);
      radioTimer = setTimeout(() => {
        radioCallout.classList.remove('show');
      }, duration);
    },
    setCrosshairGap(spread) {
      if (!crosshairGap) return;
      const gap = 11 + Math.min(40, spread * 600);
      const lines = crosshairGap.querySelectorAll('i');
      if (lines[0]) lines[0].style.top = `${gap - 11}px`;
      if (lines[1]) lines[1].style.bottom = `${gap - 11}px`;
      if (lines[2]) lines[2].style.left = `${gap - 11}px`;
      if (lines[3]) lines[3].style.right = `${gap - 11}px`;
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        hitmarker.classList.remove('on');
        hitmarker.style.transform = '';
      }, holdMs);
    },
    showOverlay(mode, vanguard = 0, sentinel = 0) {
      const text = COPY[mode];
      title.textContent = text.title;
      copy.textContent = mode === 'end' ? `${text.copy} Score: ${vanguard}-${sentinel}` : text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      play.addEventListener('click', handler);
    },
    addKill(killer, victim, weaponType = '', headshot = false) {
      const entry = document.createElement('div');
      entry.className = 'kill-entry';
      const weapon = weaponType ? ` [${weaponType}]` : '';
      const hs = headshot ? ' HS' : '';
      entry.textContent = `${killer}${weapon}${hs} → ${victim}`;
      if (killfeed) killfeed.appendChild(entry);
      setTimeout(() => entry.remove(), 5000);
    },
    showBombIndicator(text) {
      bombIndicator.textContent = text;
      bombIndicator.hidden = false;
    },
    hideBombIndicator() {
      bombIndicator.hidden = true;
    },
    showRoundBanner(text) {
      roundBanner.textContent = text;
      roundBanner.hidden = false;
      setTimeout(() => (roundBanner.hidden = true), 5000);
    },
    showPlantProgress(percent) {
      plantProgress.hidden = false;
      plantFill.style.width = `${percent * 100}%`;
    },
    hidePlantProgress() {
      plantProgress.hidden = true;
    },
    showDefuseProgress(percent) {
      defuseProgress.hidden = false;
      defuseFill.style.width = `${percent * 100}%`;
    },
    hideDefuseProgress() {
      defuseProgress.hidden = true;
    },
    showBombCarrier() {
      bombCarrier.hidden = false;
    },
    hideBombCarrier() {
      bombCarrier.hidden = true;
    },
    showDeathOverlay(killer) {
      deathTitle.textContent = 'Eliminated';
      deathCopy.textContent = `Killed by ${killer}`;
      deathOverlay.hidden = false;
    },
    hideDeathOverlay() {
      deathOverlay.hidden = true;
    },
    showMatchEnd(winner, vanguardScore, sentinelScore) {
      const winnerName = winner === 'vanguard' ? 'Vanguard' : 'Sentinel';
      title.textContent = 'Match Ended';
      copy.textContent = `${winnerName} wins the match ${vanguardScore}-${sentinelScore}`;
      play.textContent = 'Play Again';
      overlay.hidden = false;
    },
  };
}
