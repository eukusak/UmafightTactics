import type { CSSProperties } from 'react';
import { FRAME_SHEETS, frameSheetUrl } from '../game/ui/frame-animation';

/** Four actual poses per row, cropped from the same sheets as battle playback. */
export function AnimatedUnit({ id, size = 148, action = 'idle', className = '', name = '' }: {
  id: string; size?: number; action?: 'idle' | 'run'; className?: string; name?: string;
}): JSX.Element | null {
  const sheet = FRAME_SHEETS[id];
  if (!sheet) return null;
  const style = { width: size, height: size, backgroundImage: `url("${frameSheetUrl(id)}")`,
    backgroundSize: `${size * sheet.columns}px ${size * sheet.rows}px`,
    backgroundPositionY: action === 'run' ? -size : 0,
    '--sheet-end': `${-size * sheet.columns}px`, animationDuration: action === 'run' ? '.5s' : '1s',
  } as CSSProperties;
  return <span role="img" aria-label={name || id} data-animation={action} data-unit-def={id}
    className={`animated-unit ${className}`} style={style} />;
}
