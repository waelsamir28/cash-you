let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(v: boolean) {
  muted = v;
}
export function isMuted() {
  return muted;
}

type ToneOpts = {
  freq: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweepTo?: number;
};

function tone({ freq, dur = 0.09, type = "sine", gain = 0.07, delay = 0, sweepTo }: ToneOpts) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/** صوت الماسح الليزري */
export const sfxScan = () => {
  tone({ freq: 2100, dur: 0.055, type: "square", gain: 0.045 });
  tone({ freq: 2700, dur: 0.05, type: "square", gain: 0.035, delay: 0.06 });
};

export const sfxAdd = () => {
  tone({ freq: 880, dur: 0.07, type: "triangle", gain: 0.06 });
  tone({ freq: 1320, dur: 0.09, type: "triangle", gain: 0.05, delay: 0.05 });
};

export const sfxRemove = () => {
  tone({ freq: 420, dur: 0.13, type: "sawtooth", gain: 0.045, sweepTo: 180 });
};

export const sfxKey = () => {
  tone({ freq: 1500, dur: 0.03, type: "square", gain: 0.022 });
};

export const sfxError = () => {
  tone({ freq: 240, dur: 0.16, type: "square", gain: 0.05 });
  tone({ freq: 180, dur: 0.2, type: "square", gain: 0.05, delay: 0.14 });
};

export const sfxSave = () => {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone({ freq: f, dur: 0.16, type: "sine", gain: 0.06, delay: i * 0.075 }),
  );
};

export const sfxCash = () => {
  tone({ freq: 1760, dur: 0.09, type: "triangle", gain: 0.05 });
  tone({ freq: 2349, dur: 0.14, type: "triangle", gain: 0.045, delay: 0.08 });
  tone({ freq: 1174, dur: 0.2, type: "sine", gain: 0.04, delay: 0.16 });
};

export const sfxToggle = () => {
  tone({ freq: 660, dur: 0.06, type: "sine", gain: 0.04, sweepTo: 990 });
};