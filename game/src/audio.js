// All sound is synthesized with WebAudio — no audio files, no network.
// Guard footsteps are panned left/right by where the guard stands
// relative to the player and faded by distance, so a patrol can be
// heard coming around a corner. The context is created on the first
// user gesture; every play function is a no-op until then, which keeps
// headless screenshot runs silent and error-free.

export function createAudio() {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function noiseBurst({ duration, frequency, gain, pan = 0, type = 'lowpass' }) {
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    let tail = amp;
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      amp.connect(panner);
      tail = panner;
    }
    source.connect(filter);
    filter.connect(amp);
    tail.connect(master);
    source.start();
  }

  function tone({ frequency, endFrequency, duration, gain, type = 'sine', delay = 0 }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    const start = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(frequency, start);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(amp);
    amp.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  return {
    /** Call from a user gesture (key or click) to unlock audio. */
    unlock() {
      ensure();
    },
    /** A guard's footstep, placed in the stereo field by `pan` (-1..1). */
    guardStep(pan, loudness) {
      if (!ctx || loudness <= 0.01) return;
      noiseBurst({ duration: 0.07, frequency: 420, gain: 0.20 * loudness, pan });
    },
    /** The player's own soft step. */
    playerStep(gait) {
      if (!ctx) return;
      const gain = gait === 'run' ? 0.10 : gait === 'walk' ? 0.05 : 0.015;
      noiseBurst({ duration: 0.05, frequency: 600, gain });
    },
    /** A pebble clattering where it lands. */
    pebbleLand() {
      if (!ctx) return;
      noiseBurst({ duration: 0.05, frequency: 2400, gain: 0.16, type: 'highpass' });
      tone({ frequency: 1900, duration: 0.06, gain: 0.05, type: 'triangle' });
    },
    /** Short rising tick when a guard first grows curious. */
    curious() {
      if (!ctx) return;
      tone({ frequency: 520, endFrequency: 760, duration: 0.12, gain: 0.08, type: 'triangle' });
    },
    /** Alarm sting when a chase begins. */
    spotted() {
      if (!ctx) return;
      tone({ frequency: 880, endFrequency: 660, duration: 0.22, gain: 0.16, type: 'sawtooth' });
      tone({ frequency: 880, endFrequency: 660, duration: 0.22, gain: 0.16, type: 'sawtooth', delay: 0.24 });
    },
    /** Two-tone electronic alarm when a camera calls a guard over. */
    alarm() {
      if (!ctx) return;
      for (let i = 0; i < 3; i += 1) {
        tone({ frequency: 1240, duration: 0.09, gain: 0.1, type: 'square', delay: i * 0.2 });
        tone({ frequency: 880, duration: 0.09, gain: 0.1, type: 'square', delay: i * 0.2 + 0.1 });
      }
    },
    /** Bright chime for the Star Sapphire. */
    pickup() {
      if (!ctx) return;
      tone({ frequency: 1046, duration: 0.16, gain: 0.12, type: 'triangle' });
      tone({ frequency: 1568, duration: 0.24, gain: 0.12, type: 'triangle', delay: 0.1 });
    },
    /** Low thud for being caught. */
    caught() {
      if (!ctx) return;
      tone({ frequency: 160, endFrequency: 60, duration: 0.4, gain: 0.22, type: 'sine' });
      noiseBurst({ duration: 0.18, frequency: 300, gain: 0.18 });
    },
    /** Little fanfare for clearing a floor. */
    floorClear() {
      if (!ctx) return;
      [523, 659, 784, 1046].forEach((frequency, i) => {
        tone({ frequency, duration: 0.18, gain: 0.1, type: 'triangle', delay: i * 0.11 });
      });
    },
  };
}
