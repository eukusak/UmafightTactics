export type GameSound = 'select' | 'level-up';
type AudioClip = { volume: number; currentTime: number; play(): Promise<void> };
const clips = new Map<GameSound, AudioClip>();

/** Reuse uploaded clips; audio failures must never interrupt a game action. */
export function playSound(name: GameSound): void {
  const Audio = (globalThis as unknown as { Audio?: new (src: string) => AudioClip }).Audio;
  if (!Audio) return;
  try {
    let clip = clips.get(name);
    if (!clip) {
      clip = new Audio(`/assets/audio/${name}.mp3`);
      clip.volume = .65;
      clips.set(name, clip);
    }
    clip.currentTime = 0;
    void clip.play().catch(() => {});
  } catch { /* Browser autoplay/device restrictions are non-fatal. */ }
}
