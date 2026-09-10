import musicManifest from '../../data/manual/music.json';
import { Rng } from '../engine/rng';
// Audio randomness is independent of every simulation stream.
const musicRng = new Rng(Date.now());
export type GameSound = 'select' | 'level-up';
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
  if (scene === 'title') { music.src = TITLE_TRACK!; music.loop = true; }
  else {
    if (!bag.length) bag = shuffledTracks(GAME_TRACKS, lastTrack);
    lastTrack = bag.shift()!; music.src = lastTrack; music.loop = false;
  }
  if (unlocked) void music.play().catch(() => {});
}
export function configureAudio(settings: typeof options): void {
  options = { musicVolume: settings.musicVolume, effectsVolume: settings.effectsVolume, muted: settings.muted };
  if (music) music.volume = options.muted ? 0 : options.musicVolume;
  for (const clip of clips.values()) clip.volume = options.muted ? 0 : options.effectsVolume;
}
export function setMusicScene(value: typeof scene): void {
  if (scene === value) return;
  scene = value; bag = []; nextTrack();
}
export function unlockAudio(): void {
  const Audio = (globalThis as unknown as { Audio?: new () => MusicClip }).Audio;
  if (!Audio) return;
  unlocked = true;
  if (!TITLE_TRACK && !GAME_TRACKS.length) return;
  if (!music) {
    music = new Audio(); music.preload = 'metadata';
    music.volume = options.muted ? 0 : options.musicVolume;
    music.addEventListener('ended', nextTrack);
    nextTrack();
  } else if (music.paused) void music.play().catch(() => {});
}
/** Reuse uploaded clips; audio failures must never interrupt a game action. */
export function playSound(name: GameSound): void {
  const Audio = (globalThis as unknown as { Audio?: new (src: string) => AudioClip }).Audio;
  if (!Audio || options.muted || options.effectsVolume <= 0) return;
  try {
    let clip = clips.get(name);
    if (!clip) { clip = new Audio(`/assets/audio/${name}.mp3`); clips.set(name, clip); }
    clip.volume = options.effectsVolume; clip.currentTime = 0;
    void clip.play().catch(() => {});
  } catch { /* Browser autoplay/device restrictions are non-fatal. */ }
}
