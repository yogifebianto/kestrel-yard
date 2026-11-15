// Round system: buy phase (15s), live round (1m55s), bomb plant/defuse, win conditions.
const BUY_TIME = 15;
const LIVE_TIME = 115;
const END_TIME = 5;
const BOMB_TIMER = 40;
const DEFUSE_TIME = 10;
const DEFUSE_WITH_KIT = 5;
const ROUNDS_TO_WIN = 8;
const ROUNDS_BEFORE_SWAP = 8;

export function createRounds(state) {
  function startRound() {
    state.round.number += 1;
    state.round.phase = 'buy';
    state.round.phaseTime = 0;
    state.round.bombPlanted = false;
    state.round.bombSite = null;
    state.round.bombTime = 0;
    state.round.defusing = false;
    state.round.defuseTime = 0;
    state.round.defuseTimeNeeded = 10;
    state.round.defuserIndex = -1;
    state.round.winner = null;
    state.round.winReason = null;

    // Reset player state
    state.player.alive = true;
    state.player.health = 100;
    state.player.hasBomb = true;
    state.player.planting = false;
    state.player.plantTime = 0;
    state.player.defusing = false;
    state.player.defuseTime = 0;
    state.player.position.set(0, 0, 30);
    state.player.velocity.set(0, 0, 0);

    // Check for side swap at 8 rounds
    if (state.round.number === ROUNDS_BEFORE_SWAP + 1) {
      const temp = state.round.vanguardWins;
      state.round.vanguardWins = state.round.sentinelWins;
      state.round.sentinelWins = temp;
    }
  }

  function endRound(winner, reason) {
    state.round.phase = 'end';
    state.round.winner = winner;
    state.round.winReason = reason;
    state.round.phaseTime = 0;
    if (winner === 'vanguard') state.round.vanguardWins += 1;
    if (winner === 'sentinel') state.round.sentinelWins += 1;
  }

  function checkWinConditions() {
    // Elimination
    const vanguardAlive = state.bots.filter(b => b.team === 'vanguard' && b.alive).length + (state.player.alive ? 1 : 0);
    const sentinelAlive = state.bots.filter(b => b.team === 'sentinel' && b.alive).length;
    if (vanguardAlive === 0 && sentinelAlive > 0) return { winner: 'sentinel', reason: 'elimination' };
    if (sentinelAlive === 0 && vanguardAlive > 0) return { winner: 'vanguard', reason: 'elimination' };

    // Bomb detonation
    if (state.round.bombPlanted && state.round.bombTime >= BOMB_TIMER) {
      return { winner: 'vanguard', reason: 'detonation' };
    }

    // Defuse complete
    if (state.round.defusing && state.round.defuseTime >= state.round.defuseTimeNeeded) {
      return { winner: 'sentinel', reason: 'defuse' };
    }

    // Time out (defenders win)
    if (state.round.phase === 'live' && state.round.phaseTime >= LIVE_TIME && !state.round.bombPlanted) {
      return { winner: 'sentinel', reason: 'timeout' };
    }

    return null;
  }

  function step(dt) {
    state.round.phaseTime += dt;

    if (state.round.phase === 'buy' && state.round.phaseTime >= BUY_TIME) {
      state.round.phase = 'live';
      state.round.phaseTime = 0;
    }

    if (state.round.phase === 'live') {
      if (state.round.bombPlanted) state.round.bombTime += dt;

      if (state.round.defusing) {
        state.round.defuseTime += dt;
      }

      const outcome = checkWinConditions();
      if (outcome) endRound(outcome.winner, outcome.reason);
    }

    if (state.round.phase === 'end' && state.round.phaseTime >= END_TIME) {
      const vanguardWins = state.round.vanguardWins;
      const sentinelWins = state.round.sentinelWins;
      if (vanguardWins >= ROUNDS_TO_WIN || sentinelWins >= ROUNDS_TO_WIN) {
        state.round.phase = 'match_end';
      } else {
        startRound();
      }
    }
  }

  function plantBomb(site) {
    state.round.bombPlanted = true;
    state.round.bombSite = site;
    state.round.bombTime = 0;
  }

  function startDefuse(botIndex, hasKit) {
    state.round.defusing = true;
    state.round.defuseTime = 0;
    state.round.defuseTimeNeeded = hasKit ? DEFUSE_WITH_KIT : DEFUSE_TIME;
    state.round.defuserIndex = botIndex;
  }

  function stopDefuse() {
    state.round.defusing = false;
    state.round.defuseTime = 0;
    state.round.defuserIndex = -1;
  }

  startRound();

  return {
    step,
    startRound,
    endRound,
    plantBomb,
    startDefuse,
    stopDefuse,
    getTimeLeft() {
      if (state.round.phase === 'buy') return BUY_TIME - state.round.phaseTime;
      if (state.round.phase === 'live') {
        if (state.round.bombPlanted) return BOMB_TIMER - state.round.bombTime;
        return LIVE_TIME - state.round.phaseTime;
      }
      return 0;
    },
  };
}
