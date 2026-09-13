import { versionedAssetUrl } from './asset-version';
import musicManifest from '../../data/manual/music.json';
import { Rng } from '../engine/rng';
// Audio randomness is independent of every simulation stream.
const musicRng = new Rng(Date.now());
export type GameSound = 'select' | 'level-up' | 'attack-melee' | 'attack-ranged' | 'hit' | 'skill-strike' | 'skill-magic' | 'skill-support' | 'augment' | 'promote2' | 'promote3' | 'race-plan-open' | 'race-plan-hover' | 'race-plan-select' | 'race-plan-stamp' | 'race-gate' | 'race-late' | 'race-last3f' | 'race-entry-confirm' | 'race-entry-transfer';
type AudioClip = { volume: number; currentTime: number; play(): Promise<void>; pause?(): void };
const clips = new Map<GameSound, AudioClip>();
export const GAME_TRACKS: readonly string[] = musicManifest.bgm;
const TITLE_TRACK: string | null = musicManifest.title;
let options = { musicVolume: .45, effectsVolume: .65, muted: false };
type MusicClip = AudioClip & { src: string; loop: boolean; preload: string; paused: boolean; addEventListener(name: string, listener: () => void): void };
let music: MusicClip | null = null;
let scene: 'title' | 'game' = 'title';
let unlocked = false;
let bag: string[] = [];
let lastTrack = '';
function audioDiagnostic(event: string, error?: unknown): void {
  if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) console.warn('[audio]', event, error ?? '');
}

/** Shuffle bag: hear every available track before repeating, never repeat at a boundary. */
export function shuffledTracks(tracks: readonly string[], previous = '', random = () => musicRng.next()): string[] {
  const result = [...tracks];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (result.length > 1 && result[0] === previous) [result[0], result[1]] = [result[1], result[0]];
  return result;
}
function nextTrack(): void {
  if (!music) return;
  if (scene === 'title' ? !TITLE_TRACK : !GAME_TRACKS.length) { music.pause?.(); return; }
  if (scene === 'title') { music.src = versionedAssetUrl(TITLE_TRACK!); music.loop = true; }
  else {
    if (!bag.length) bag = shuffledTracks(GAME_TRACKS, lastTrack);
    lastTrack = bag.shift()!; music.src = versionedAssetUrl(lastTrack); music.loop = false;
  }
  if (unlocked) void music.play().catch(error => audioDiagnostic('music.play failed', error));
}
export function configureAudio(settings: typeof options): void {
  options = { musicVolume: settings.musicVolume, effectsVolume: settings.effectsVolume, muted: settings.muted };
  if (synthMaster) synthMaster.gain.value = options.muted ? 0 : options.effectsVolume;
  if (music) music.volume = options.muted ? 0 : options.musicVolume;
  for (const clip of clips.values()) clip.volume = options.muted ? 0 : options.effectsVolume;
}
export function setMusicScene(value: typeof scene): void {
  if (scene === value) return;
  scene = value; bag = []; nextTrack();
}
export function unlockAudio(): void {
  unlockSynth();
  const Audio = (globalThis as unknown as { Audio?: new () => MusicClip }).Audio;
  if (!Audio) return;
  unlocked = true;
  if (!TITLE_TRACK && !GAME_TRACKS.length) return;
  if (!music) {
    music = new Audio(); music.preload = 'metadata';
    music.volume = options.muted ? 0 : options.musicVolume;
    music.addEventListener('ended', nextTrack);
    for (const event of ['loadedmetadata', 'canplay', 'playing', 'waiting', 'stalled', 'error'])
      music.addEventListener(event, () => audioDiagnostic(event));
    nextTrack();
  } else if (music.paused) void music.play().catch(error => audioDiagnostic('music.play failed', error));
}
/** Reuse uploaded clips; audio failures must never interrupt a game action. */
export function playSound(name: GameSound, variant = 0): void {
  if(name!=='select' && name!=='level-up'){try { playSynth(name,variant); } catch { /* A disconnected audio device is non-fatal. */ } return;}
  const Audio = (globalThis as unknown as { Audio?: new (src: string) => AudioClip }).Audio;
  if (!Audio || options.muted || options.effectsVolume <= 0) return;
  try {
    let clip = clips.get(name);
    if (!clip) { clip = new Audio(versionedAssetUrl(`/assets/audio/${name}.mp3`)); clips.set(name, clip); }
    clip.volume = options.effectsVolume; clip.currentTime = 0;
    void clip.play().catch(error => audioDiagnostic('effect.play failed', error));
  } catch { /* Browser autoplay/device restrictions are non-fatal. */ }
}

export const SOUND_DESIGNS = {
  'race-plan-open':{notes:[330,440,523],wave:'sine',duration:.34,noise:.02},
  'race-plan-hover':{notes:[880],wave:'sine',duration:.05,noise:.01},
  'race-plan-select':{notes:[392,523,659],wave:'triangle',duration:.30,noise:0},
  'race-plan-stamp':{notes:[140,90],wave:'triangle',duration:.16,noise:.30},
  'race-gate':{notes:[520,300,180],wave:'square',duration:.22,noise:.22},
  'race-late':{notes:[294,392],wave:'sawtooth',duration:.26,noise:.06},
  'race-last3f':{notes:[392,523,659,880],wave:'triangle',duration:.50,noise:.04},
  'race-entry-confirm':{notes:[349,523,698,880],wave:'triangle',duration:.58,noise:.01},
  'race-entry-transfer':{notes:[523,392,523],wave:'sine',duration:.34,noise:0},
  'attack-melee':{notes:[190,95],wave:'sawtooth',duration:.11,noise:.16},
  'attack-ranged':{notes:[880,420],wave:'triangle',duration:.12,noise:.03},
  hit:{notes:[100,45],wave:'triangle',duration:.09,noise:.25},
  'skill-strike':{notes:[160,300,110],wave:'sawtooth',duration:.28,noise:.13},
  'skill-magic':{notes:[440,660,990],wave:'sine',duration:.36,noise:.025},
  'skill-support':{notes:[523,659,784],wave:'sine',duration:.42,noise:0},
  augment:{notes:[392,523,659,1046],wave:'triangle',duration:.55,noise:0},
  promote2:{notes:[440,554,659],wave:'triangle',duration:.4,noise:0},
  promote3:{notes:[523,659,784,1046],wave:'triangle',duration:.65,noise:.015},
} as const;
type SynthSound=keyof typeof SOUND_DESIGNS;
/** Combat cues +3.25 dB; keep UI loudness and the user's volume/mute intact. */
export function soundPeakGain(name: SynthSound): number {
  return /^(attack-|skill-|hit$)/.test(name) ? .16 : .11;
}
let synth:AudioContext|null=null,synthMaster:GainNode|null=null,voices=0;
const lastSound=new Map<string,number>();
function unlockSynth():void {
  try {
    if(!synth && typeof AudioContext!=='undefined') {synth=new AudioContext();synthMaster=synth.createGain();synthMaster.gain.value=options.muted?0:options.effectsVolume;const limiter=synth.createDynamicsCompressor();
      limiter.threshold.value=-8;limiter.knee.value=8;limiter.ratio.value=12;
      limiter.attack.value=.003;limiter.release.value=.12;
      synthMaster.connect(limiter);limiter.connect(synth.destination);}
    if(synth?.state==='suspended')void synth.resume().catch(error => audioDiagnostic('AudioContext.resume failed', error));
  } catch { /* Audio devices and browser permissions never block gameplay. */ }
}
/** Original synthesized cues: distinct envelopes, no downloaded game audio. */
function playSynth(name:SynthSound,variant:number):void {
  if(!synth||!synthMaster||synth.state!=='running'||options.muted||options.effectsVolume<=0||voices>=16)return;
  const now=synth.currentTime,design=SOUND_DESIGNS[name];
  if(now-(lastSound.get(name)??-10)<(name==='hit'?.085:name==='race-plan-hover'?.08:.06))return;
  lastSound.set(name,now);voices++;
  const pitch=1+(Math.abs(variant)%7-3)*.025;
  const gain=synth.createGain();gain.connect(synthMaster);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(soundPeakGain(name),now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+design.duration);
  const tone=synth.createOscillator();tone.type=design.wave;tone.connect(gain);
  design.notes.forEach((f,i)=>tone.frequency.setValueAtTime(f*pitch,now+i*design.duration/design.notes.length));
  tone.start(now);tone.stop(now+design.duration);tone.onended=()=>{tone.disconnect();gain.disconnect();voices--;};
  if(design.noise){
    const buffer=synth.createBuffer(1,Math.ceil(synth.sampleRate*design.duration),synth.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.sin(i*127.1)*43758.5453%1)*design.noise;
    const noise=synth.createBufferSource();noise.buffer=buffer;noise.connect(gain);noise.start(now);noise.onended=()=>noise.disconnect();
  }
}
