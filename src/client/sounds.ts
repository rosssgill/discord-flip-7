import type { Cue, Sound } from "./cues";

// Effects are synthesized; only the lobby music is a recorded file.
const SETTINGS_KEY = "audio";
const MUSIC_URL = "/lobby.mp3";
const MUSIC_LEVEL = 0.35;
const MUSIC_FADE_S = 1.2;

export interface Channel {
  /** Slider position, 0–1. */
  volume: number;
  muted: boolean;
}

export interface AudioSettings {
  effects: Channel;
  music: Channel;
}

export function loadAudioSettings(): AudioSettings {
  const defaults: AudioSettings = { effects: { volume: 1, muted: false }, music: { volume: 0.7, muted: false } };
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<AudioSettings> | null;
    return { ...defaults, ...stored };
  } catch {
    return defaults;
  }
}

export function saveAudioSettings(settings: AudioSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked inside iframes; settings then last for this session only.
  }
}

/** Gain for a channel. Squaring the slider makes its steps sound even, since loudness is perceived roughly logarithmically. */
export function channelGain({ volume, muted }: Channel): number {
  return muted ? 0 : volume ** 2;
}

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext();
  } catch {
    return null;
  }
  // Browsers start audio suspended until the page gets a click or key press.
  if (context.state === "suspended") void context.resume();
  return context;
}

export function unlockAudio() {
  audio();
  // Music requested before the first click was blocked by the browser, so retry inside the gesture.
  if (musicWanted) setMusic(true);
}

// All effects play through one bus so a single gain sets their volume.
let effectsBus: GainNode | null = null;
let effectsGain = 1;

function effectsOutput(ac: AudioContext): GainNode {
  if (!effectsBus) {
    effectsBus = ac.createGain();
    effectsBus.gain.value = effectsGain;
    effectsBus.connect(ac.destination);
  }
  return effectsBus;
}

export function setEffectsGain(gain: number) {
  effectsGain = gain;
  if (effectsBus) effectsBus.gain.value = gain;
}

export function playCues(cues: Cue[]) {
  if (effectsGain === 0) return;
  const ac = audio();
  if (!ac) return;
  for (const { sound, delayMs } of cues) SOUNDS[sound](ac, ac.currentTime + delayMs / 1000);
}

// Streamed through an <audio> element rather than decoded, since a full track decodes to ~80 MB.
// It's routed through a gain node because iOS ignores HTMLMediaElement.volume.
let music: { element: HTMLAudioElement; gain: GainNode } | null = null;
let musicWanted = false;
let musicGain = 1;
let pauseTimer: ReturnType<typeof setTimeout> | undefined;

/** Fades the lobby music in or out. */
export function setMusic(wanted: boolean) {
  musicWanted = wanted;
  if (!music && !wanted) return;
  const ac = audio();
  if (!ac) return;
  if (!music) {
    const element = new Audio(MUSIC_URL);
    element.loop = true;
    const gain = ac.createGain();
    gain.gain.value = 0;
    ac.createMediaElementSource(element).connect(gain).connect(ac.destination);
    music = { element, gain };
  }

  const { element } = music;
  clearTimeout(pauseTimer);
  if (wanted) {
    element.play().catch(() => {
      // Autoplay blocked until the first click; unlockAudio retries.
    });
    rampMusic(MUSIC_LEVEL * musicGain, MUSIC_FADE_S);
  } else {
    rampMusic(0, MUSIC_FADE_S);
    pauseTimer = setTimeout(() => element.pause(), MUSIC_FADE_S * 1000);
  }
}

export function setMusicGain(gain: number) {
  musicGain = gain;
  if (musicWanted) rampMusic(MUSIC_LEVEL * gain, 0.1);
}

function rampMusic(to: number, seconds: number) {
  if (!music || !context) return;
  const param = music.gain.gain;
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(to, now + seconds);
}

interface ToneOptions {
  freq: number;
  to?: number;
  type?: OscillatorType;
  duration: number;
  volume: number;
}

function tone(ac: AudioContext, at: number, { freq, to, type = "sine", duration, volume }: ToneOptions) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(effectsOutput(ac));
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

interface NoiseOptions {
  duration: number;
  volume: number;
  filter: BiquadFilterType;
  freq: number;
  to?: number;
}

function noise(ac: AudioContext, at: number, { duration, volume, filter, freq, to }: NoiseOptions) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const biquad = ac.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, at);
  if (to) biquad.frequency.exponentialRampToValueAtTime(to, at + duration);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(biquad).connect(gain).connect(effectsOutput(ac));
  source.start(at);
}

const SOUNDS: Record<Sound, (ac: AudioContext, at: number) => void> = {
  flip(ac, at) {
    noise(ac, at, { duration: 0.07, volume: 0.35, filter: "bandpass", freq: 2600 });
    tone(ac, at, { freq: 900, to: 500, type: "triangle", duration: 0.06, volume: 0.08 });
  },
  freeze(ac, at) {
    noise(ac, at, { duration: 0.7, volume: 0.18, filter: "highpass", freq: 1500, to: 9000 });
    [1568, 2093, 2637, 3136, 4186].forEach((freq, i) =>
      tone(ac, at + i * 0.06, { freq, duration: 0.8, volume: 0.06 }),
    );
  },
  bust(ac, at) {
    tone(ac, at, { freq: 320, to: 70, type: "sawtooth", duration: 0.5, volume: 0.12 });
    noise(ac, at, { duration: 0.25, volume: 0.25, filter: "lowpass", freq: 400 });
  },
  flip7(ac, at) {
    [523, 659, 784, 1047].forEach((freq, i) =>
      tone(ac, at + i * 0.1, { freq, type: "triangle", duration: i === 3 ? 0.7 : 0.18, volume: 0.15 }),
    );
  },
  // "Du du du duuu" on a C, then a rising Ab–Bb–C to finish.
  victory(ac, at) {
    const notes: [freq: number, start: number, length: number][] = [
      [523, 0, 0.12],
      [523, 0.14, 0.12],
      [523, 0.28, 0.12],
      [523, 0.42, 0.5],
      [415, 0.95, 0.3],
      [466, 1.27, 0.3],
      [523, 1.59, 0.15],
      [466, 1.76, 0.12],
      [523, 1.9, 0.9],
    ];
    for (const [freq, start, length] of notes) {
      tone(ac, at + start, { freq, type: "square", duration: length, volume: 0.07 });
      tone(ac, at + start, { freq: freq * 2, type: "triangle", duration: length, volume: 0.05 });
    }
  },
  // Two knocks on the table, like signalling "stay" at a card table.
  stay(ac, at) {
    for (const offset of [0, 0.14]) {
      tone(ac, at + offset, { freq: 180, to: 90, type: "sine", duration: 0.12, volume: 0.35 });
      noise(ac, at + offset, { duration: 0.05, volume: 0.25, filter: "lowpass", freq: 900 });
    }
  },
  tick(ac, at) {
    tone(ac, at, { freq: 1900, type: "square", duration: 0.03, volume: 0.06 });
    noise(ac, at, { duration: 0.02, volume: 0.15, filter: "highpass", freq: 4000 });
  },
  yourTurn(ac, at) {
    tone(ac, at, { freq: 880, duration: 0.25, volume: 0.12 });
    tone(ac, at + 0.12, { freq: 1320, duration: 0.35, volume: 0.12 });
  },
};
