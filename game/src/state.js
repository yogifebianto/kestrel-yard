// Central state object: all game state in one place for determinism and clarity.
// The simulation owns and mutates this; rendering and HUD read it.
import * as THREE from 'three';

export function createState(seed) {
  return {
    seed,
    time: 0,

    // Player
    player: {
      position: new THREE.Vector3(0, 0, 30),
      velocity: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      eye: 1.6,
      onGround: true,
      crouching: false,
      height: 1.72,
      health: 100,
      armour: 0,
      hasHelmet: false,
      money: 800,
      alive: true,
      team: 'vanguard',
      grenades: 0,
      hasDefuseKit: false,
      hasBomb: true,
      planting: false,
      plantTime: 0,
      defusing: false,
      defuseTime: 0,
    },

    // Weapon
    weapon: {
      type: 'P9',
      mag: 12,
      reserve: 24,
      cooldown: 0,
      reloadLeft: 0,
      flash: 0,
      kick: 0,
      recoilAccum: 0,
      recoilRecoverTime: 0,
      switchTime: 0,
    },

    // Round
    round: {
      number: 0,
      phase: 'buy', // 'buy' | 'live' | 'end' | 'match_end'
      phaseTime: 0,
      vanguardWins: 0,
      sentinelWins: 0,
      bombPlanted: false,
      bombSite: null,
      bombTime: 0,
      defusing: false,
      defuseTime: 0,
      defuseTimeNeeded: 10,
      defuserIndex: -1,
      winner: null,
      winReason: null,
    },

    // Bots
    bots: [],

    // Grenades
    grenades: [],
  };
}
