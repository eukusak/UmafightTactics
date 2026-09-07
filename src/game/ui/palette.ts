/** The master palette from the art order document, §2. */
export const ART_COLORS = {
  bg: '#0B1018',
  panel: '#182331',
  panelBright: '#24384A',
  edgeDark: '#05080C',
  edgeLight: '#7EA7B5',
  text: '#EDF5F1',
  muted: '#91A8A6',
  gold: '#FFCC33',
  success: '#7DFF8A',
  danger: '#FF5A4D',
  cyan: '#4FE3FF',
  violet: '#B98AE0',

  cost1: '#8FA3AD',
  cost2: '#5BD07A',
  cost3: '#4FA8FF',
  cost4: '#B98AE0',
  cost5: '#FFCC33',
} as const;

/** Run-style VFX colours, also used for trait chips. */
export const STYLE_COLORS: Record<string, string> = {
  nige: '#FF6A3D',
  senko: '#FFCC33',
  sashi: '#4FE3FF',
  oikomi: '#B98AE0',
};

export const ROLE_COLORS: Record<string, string> = {
  TANK: '#7EA7B5',
  BRUISER: '#FF8A5B',
  AD_CARRY: '#FF5A4D',
  AP_CARRY: '#4FE3FF',
  SUPPORT: '#7DFF8A',
};

export const ROLE_LABELS: Record<string, string> = {
  TANK: '탱커',
  BRUISER: '브루저',
  AD_CARRY: '물리 캐리',
  AP_CARRY: '스킬 캐리',
  SUPPORT: '서포터',
};

export const ITEM_TAG_COLORS: Record<string, string> = {
  DAMAGE: '#FF5A4D',
  TANK: '#7EA7B5',
  MANA: '#4FE3FF',
  UTILITY: '#B98AE0',
  EMBLEM: '#FFCC33',
  TACTICIAN: '#7DFF8A',
};
