/** Root shell: screen routing plus the 1920x1080 scale-to-fit wrapper. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { configureAudio, setMusicScene, unlockAudio, playSound } from '../game/ui/audio';
import { OnlineScreen } from '../components/screens/OnlineScreen';
import { BattleScreen } from '../components/screens/BattleScreen';
import { CollectionScreen } from '../components/screens/CollectionScreen';
import { MotionScreen } from '../components/screens/MotionScreen';
import {
  MainMenu, MatchSetup, ResultScreen, SettingsScreen, TitleScreen,
} from '../components/screens/MenuScreens';

const DESIGN_W = 1920;
const DESIGN_H = 1080;

type StageBox = { scale: number; left: number; top: number; width: number; height: number };

/** Scales the fixed design canvas to the viewport, preserving aspect ratio. */
function useStageBox(resolution: string): StageBox {
  const [box, setBox] = useState<StageBox>({ scale: 1, left: 0, top: 0, width: DESIGN_W, height: DESIGN_H });
  useLayoutEffect(() => {
    const update = (): void => {
      const [w, h] = resolution === 'auto' ? [window.innerWidth, window.innerHeight] : resolution.split('x').map(Number);
      const cap = Math.min(1, window.innerWidth / w, window.innerHeight / h);
      const scale = Math.min(w / DESIGN_W, h / DESIGN_H) * cap;
      const width = resolution === 'auto' ? window.innerWidth / scale : DESIGN_W;
      const height = resolution === 'auto' ? window.innerHeight / scale : DESIGN_H;
      setBox({ scale, width, height, left: (window.innerWidth - width * scale) / 2, top: (window.innerHeight - height * scale) / 2 });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [resolution]);
  return box;
}

export function App(): JSX.Element {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest('button, [role="button"]') : null;
      if (button && !button.matches(':disabled, [aria-disabled="true"], [data-sound="xp"]')) playSound('select');
    };
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, []);
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const settings = useGameStore(s => s.settings);
  const inMatch = useGameStore(s => !!s.match);
  const { scale, left, top, width, height } = useStageBox(settings.resolution);
  useEffect(() => { configureAudio(settings); }, [settings]);
  useEffect(() => { setMusicScene(inMatch ? 'game' : 'title'); }, [inMatch]);
  useEffect(() => {
    const unlock = () => unlockAudio();
    document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
  }, []);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    setScreen('TITLE');
  }, [setScreen]);

  let content: JSX.Element;
  switch (screen) {
    case 'TITLE': content = <TitleScreen />; break;
    case 'MAIN_MENU': content = <MainMenu />; break;
    case 'MATCH_SETUP': content = <MatchSetup />; break;
    case 'ONLINE': content = <OnlineScreen />; break;
    case 'BATTLE': content = <BattleScreen />; break;
    case 'COLLECTION': content = <CollectionScreen />; break;
    case 'MOTION': content = <MotionScreen />; break;
    case 'SETTINGS': content = <SettingsScreen />; break;
    case 'RESULT': content = <ResultScreen />; break;
    default: content = <TitleScreen />;
  }

  return (
    <div className="stage-root">
      <div className="stage" style={{ left, top, width, height, transform: `scale(${scale})` }}>
        {content}
      </div>
    </div>
  );
}
