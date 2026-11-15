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

export function createHud() {
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const copy = document.getElementById('overlay-copy');
  const play = document.getElementById('play');
  const ammo = document.getElementById('ammo');
  const ammoMag = document.getElementById('ammo-mag');
  const ammoReserve = document.getElementById('ammo-reserve');
  const scoreValue = document.getElementById('score-value');
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
  const grenadeCountEl = document.getElementById('grenade-count');

  let hitTimer = 0;
  let lastMag = -1;
  let lastReserve = -1;
  let lastScore = -1;
  let lastHealth = -1;
  let lastArmour = -1;
  let lastMoney = -1;
  let lastGrenades = -1;

  return {
    setAmmo(mag, reserve) {
      if (mag === lastMag && reserve === lastReserve) return;
      lastMag = mag;
      lastReserve = reserve;
      ammoMag.textContent = String(mag);
      ammoReserve.textContent = `/ ${reserve}`;
      ammo.classList.toggle('empty', mag === 0);
    },
    setHealth(value) {
      if (value === lastHealth) return;
      lastHealth = value;
      if (healthEl) healthEl.textContent = String(Math.max(0, Math.round(value)));
    },
    setArmour(value) {
      if (value === lastArmour) return;
      lastArmour = value;
      if (armourEl) armourEl.textContent = String(Math.max(0, Math.round(value)));
    },
    setMoney(value) {
      if (value === lastMoney) return;
      lastMoney = value;
      if (moneyEl) moneyEl.textContent = `$${value}`;
    },
    setGrenades(value) {
      if (value === lastGrenades) return;
      lastGrenades = value;
      if (grenadesEl) grenadesEl.textContent = String(value);
      if (grenadeCountEl) grenadeCountEl.hidden = value === 0;
    },
    setTimer(seconds) {
      if (!timerEl) return;
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    setScore(vanguard, sentinel) {
      if (!scoreValue) return;
      scoreValue.textContent = `${vanguard} - ${sentinel}`;
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
    addKill(killer, victim, headshot) {
      const entry = document.createElement('div');
      entry.className = 'kill-entry';
      entry.textContent = `${killer} ${headshot ? '[HS]' : ''} → ${victim}`;
      killfeed.appendChild(entry);
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
