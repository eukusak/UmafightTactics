import type { CSSProperties } from 'react';
import { FRAME_SHEETS, frameSheetUrl, frameGeometry } from '../game/ui/frame-animation';

/** Four actual poses per row, cropped from the same sheets as battle playback. */
export function AnimatedUnit({ id, size = 148, action = 'idle', className = '', name = '' }: {
  id: string; size?: number; action?: 'idle' | 'run'; className?: string; name?: string;
}): JSX.Element | null {
  const sheet = FRAME_SHEETS[id];
  if (!sheet) return null;
  const geometry = frameGeometry(id, size);
  const style = { width: geometry.width, height: geometry.height, position: 'absolute', left: geometry.offsetX, top: geometry.offsetY,
    backgroundImage: `url("${frameSheetUrl(id)}")`,
    backgroundSize: `${geometry.width * sheet.columns}px ${geometry.height * sheet.rows}px`,
    backgroundPositionY: action === 'run' ? -geometry.height : 0,
    '--sheet-end': `${-geometry.width * sheet.columns}px`, animationDuration: action === 'run' ? '.5s' : '1s',
  } as CSSProperties;
  return <span role="img" aria-label={name || id} data-animation={action} data-unit-def={id}
    className={`animated-unit ${className}`} style={{ width: size, height: size }}><span aria-hidden="true" className="animated-unit-frames" style={style} /></span>;
}
