/**
 * Race Plan iconography, drawn in code.
 *
 * These are inline SVG rather than PNG on purpose: they inherit the category
 * colour through `currentColor`, and keeping them out of art-manifest.json
 * means no art delivery is blocked on twenty small glyphs.
 */
import type { JSX } from 'react';
import type { RacePlanCategory, RaceCombatPhase } from '../../game/engine/race-plan/types';

type Props = { size?: number; className?: string };

const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const IconPaceHigh = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M3 8h13M5 12h11M8 16h8" /><path d="M18 6l3 6-3 6" /></svg>
);
export const IconPaceLead = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><circle cx="17" cy="12" r="3.2" /><circle cx="9" cy="9" r="1.8" /><circle cx="6" cy="15" r="1.8" /></svg>
);
export const IconPaceMiddle = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><circle cx="5.5" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="18.5" cy="12" r="2.2" /></svg>
);
export const IconPaceSlow = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><circle cx="6" cy="15" r="2.6" /><path d="M10 14l8-7M18 7h-4M18 7v4" /></svg>
);
export const IconPassing = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M4 18c4 0 5-12 12-12" /><path d="M13 4l3.5 2-2.5 3" /><circle cx="5" cy="10" r="1.6" /></svg>
);
export const IconLast3F = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M3 9h4v4H3zM7 5h4v4H7zM7 13h4v4H7z" /><path d="M14 9h7M14 14h5" /></svg>
);
export const IconGuts = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M3 10l4 8 5-14 4 10 5-6" /></svg>
);
export const IconTrack = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><ellipse cx="12" cy="12" rx="9" ry="6" /><ellipse cx="12" cy="12" rx="5" ry="2.6" strokeDasharray="2 2" /></svg>
);

export const CATEGORY_ICON: Record<RacePlanCategory, (p: Props) => JSX.Element> = {
  HIGH_PACE: IconPaceHigh,
  LEAD_CONTROL: IconPaceLead,
  MIDDLE_PACE: IconPaceMiddle,
  SLOW_PACE: IconPaceSlow,
  PASSING: IconPassing,
  LAST_3F: IconLast3F,
  GUTS: IconGuts,
  TRACK: IconTrack,
};

export const IconPhaseStart = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M5 5v14M12 5v14M19 5v14M5 5h14M5 19h14" /></svg>
);
export const IconPhasePosition = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><circle cx="12" cy="7" r="2" /><circle cx="7" cy="16" r="2" /><circle cx="17" cy="16" r="2" /></svg>
);
export const IconPhaseLate = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M5 19a12 12 0 0 1 14-12" /><path d="M15 5l4 2-2 4" /></svg>
);
export const IconPhaseLast3F = IconLast3F;
export const IconPhaseGoal = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M6 4v16M18 4v16M6 6h12" /></svg>
);

export const PHASE_ICON: Record<RaceCombatPhase, (p: Props) => JSX.Element> = {
  START: IconPhaseStart,
  POSITIONING: IconPhasePosition,
  LATE: IconPhaseLate,
  LAST_3F: IconPhaseLast3F,
  OVERTIME: IconPhaseGoal,
};

export const IconSurfaceTurf = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M4 19c1-5 2-7 3-9M8 19c0-6 1-8 2-10M12 19c0-5 1-7 2-9M16 19c0-5 1-6 2-8M3 19h18" /></svg>
);
export const IconSurfaceDirt = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M3 18h18" /><circle cx="7" cy="13" r=".9" /><circle cx="11" cy="10" r=".9" /><circle cx="15" cy="13" r=".9" /><circle cx="18" cy="9" r=".9" /><circle cx="9" cy="7" r=".9" /></svg>
);
export const IconGoingFast = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M3 16h18" /></svg>
);
export const IconGoingStandard = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M3 16h18M4 12q4-2 8 0t8 0" /></svg>
);
export const IconGoingHeavy = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M3 18h18M4 14q4-2 8 0t8 0M4 10q4-2 8 0t8 0M4 6q4-2 8 0t8 0" /></svg>
);
export const IconDirectionLeft = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M19 12a7 7 0 1 0-2 4.9" /><path d="M17 13l0 4 4 0" /></svg>
);
export const IconDirectionRight = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M5 12a7 7 0 1 1 2 4.9" /><path d="M7 13l0 4-4 0" /></svg>
);
export const IconEntryBest = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /></svg>
);
export const IconEntryGood = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><circle cx="12" cy="12" r="7" /></svg>
);
export const IconEntryExperimental = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><path d="M12 5l8 14H4z" /></svg>
);
export const IconSaddlecloth = ({ size = 20 }: Props): JSX.Element => (
  <svg {...base(size)}><rect x="5" y="5" width="14" height="14" rx="3" /><path d="M12 9v6" /></svg>
);
