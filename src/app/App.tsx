/** Root shell: screen routing plus the 1920x1080 scale-to-fit wrapper. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { OnlineScreen } from '../components/screens/OnlineScreen';
import { BattleScreen } from '../components/screens/BattleScreen';
import { CollectionScreen } from '../components/screens/CollectionScreen';
import {
  MainMenu, MatchSetup, ResultScreen, SettingsScreen, TitleScreen,
} from '../components/screens/MenuScreens';

const DESIGN_W = 1920;
const DESIGN_H = 1080;

type StageBox = { scale: number; left: number; top: number };

/** Scales the fixed design canvas to the viewport, preserving aspect ratio. */
function useStageBox(): StageBox {
  const [box, setBox] = useState<StageBox>({ scale: 1, left: 0, top: 0 });
  useLayoutEffect(() => {
    const update = (): void => {
      const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
      setBox({
        scale,
        left: Math.round((window.innerWidth - DESIGN_W * scale) / 2),
        top: Math.round((window.innerHeight - DESIGN_H * scale) / 2),
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return box;
}

export function App(): JSX.Element {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const { scale, left, top } = useStageBox();
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
    case 'SETTINGS': content = <SettingsScreen />; break;
    case 'RESULT': content = <ResultScreen />; break;
    default: content = <TitleScreen />;
  }

  return (
    <div className="stage-root">
      <div className="stage" style={{ left, top, transform: `scale(${scale})` }}>
        {content}
      </div>
    </div>
  );
}
