// Audio: synthesized gunfire, impacts, reload clicks, bomb beep using WebAudio.
let audioContext = null;
let noiseBuffer = null;

function getContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = audioContext.sampleRate * 0.5;
    noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return audioContext;
}

export function createAudio() {
  function playGunshot(volume = 0.12) {
    try {
      const ctx = getContext();
      if (ctx.state === 'suspended') return;

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.8;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(ctx.currentTime);
      noise.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // Audio failed, continue without sound
    }
  }

  function playImpact(volume = 0.06) {
    try {
      const ctx = getContext();
      if (ctx.state === 'suspended') return;

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2000;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(ctx.currentTime);
      noise.stop(ctx.currentTime + 0.04);
    } catch (e) {
      // Audio failed
    }
  }

  function playReload(volume = 0.08) {
    try {
      const ctx = getContext();
      if (ctx.state === 'suspended') return;

      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 150;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Audio failed
    }
  }

  function playBombBeep(volume = 0.1) {
    try {
      const ctx = getContext();
      if (ctx.state === 'suspended') return;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 880;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Audio failed
    }
  }

  function playFootstep(volume = 0.04) {
    try {
      const ctx = getContext();
      if (ctx.state === 'suspended') return;

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(ctx.currentTime);
      noise.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // Audio failed
    }
  }

  return {
    playGunshot,
    playImpact,
    playReload,
    playBombBeep,
    playFootstep,
    resume() {
      try {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) {
        // Audio context not available
      }
    },
  };
}
