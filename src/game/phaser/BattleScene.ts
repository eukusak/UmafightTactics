/**
 * Phaser board renderer.
 *
 * Renders only: it holds no economy, shop or combat logic (spec §42). It reads
 * BattleFrames produced by the pure engine and interpolates between them.
 */
import Phaser from 'phaser';
import {
  BOARD_COLS, BOARD_ROWS_PER_SIDE, BOARD_ROWS_TOTAL, HEX_ODD_ROW_OFFSET_X,
  HEX_STEP_X, HEX_STEP_Y,
} from '../engine/constants';
import { hexToPixel, pixelToHex, type Hex } from '../engine/battle/hex';
import type { BattleFrame } from '../engine/battle/engine';
import { ART_COLORS } from '../ui/palette';
import { costColor, initialOf } from './fallback-art';
import { getUnitDef } from '../engine/roster';

const hex = (c: string): number => Number.parseInt(c.replace('#', ''), 16);

// Centres the 7-column grid inside the 1320x658 field.
export const BOARD_ORIGIN_X = 300;
export const BOARD_ORIGIN_Y = 58;

export type BoardMode = 'PREP' | 'BATTLE';

export type PrepUnitView = {
  instanceId: string;
  unitDefId: string;
  star: 1 | 2 | 3;
  position: Hex;
  items: string[];
};

export type BattleSceneEvents = {
  onCellClick?: (cell: Hex | null) => void;
  onUnitClick?: (instanceId: string) => void;
};

export class BattleScene extends Phaser.Scene {
  private tiles!: Phaser.GameObjects.Graphics;
  private unitLayer!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Graphics;

  private frames: BattleFrame[] = [];
  private frameIndex = 0;
  private playbackTime = 0;
  private speed = 1;
  private mode: BoardMode = 'PREP';
  private prepUnits: PrepUnitView[] = [];
  private hovered: Hex | null = null;
  /** Phaser boots the scene asynchronously, so playback requests are queued. */
  private booted = false;
  private pendingPlayback: { frames: BattleFrame[]; speed: number } | null = null;
  private highlight: Hex[] = [];
  private events2: BattleSceneEvents = {};

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    this.tiles = this.add.graphics();
    this.overlay = this.add.graphics();
    this.unitLayer = this.add.container(0, 0);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.hovered = pixelToHex(p.worldX, p.worldY, BOARD_ORIGIN_X, BOARD_ORIGIN_Y);
      this.drawTiles();
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const cell = pixelToHex(p.worldX, p.worldY, BOARD_ORIGIN_X, BOARD_ORIGIN_Y);
      this.events2.onCellClick?.(cell);
      if (!cell) return;
      const unit = this.prepUnits.find((u) => u.position.q === cell.q && u.position.r === cell.r);
      if (unit) this.events2.onUnitClick?.(unit.instanceId);
    });

    this.booted = true;
    this.drawTiles();
    if (this.pendingPlayback) {
      const { frames, speed } = this.pendingPlayback;
      this.pendingPlayback = null;
      this.playBattle(frames, speed);
    }
  }

  setEvents(events: BattleSceneEvents): void {
    this.events2 = events;
  }

  setHighlight(cells: Hex[]): void {
    this.highlight = cells;
    this.drawTiles();
  }

  /** Prep mode shows the player's own half with draggable tokens. */
  showPrep(units: PrepUnitView[]): void {
    this.mode = 'PREP';
    this.prepUnits = units;
    this.frames = [];
    this.drawTiles();
    this.renderPrepUnits();
  }

  /** Battle mode plays recorded frames back at the requested speed. */
  playBattle(frames: BattleFrame[], speed = 1): void {
    if (!this.booted) {
      this.pendingPlayback = { frames, speed };
      return;
    }
    this.mode = 'BATTLE';
    this.frames = frames;
    this.frameIndex = 0;
    this.playbackTime = 0;
    this.speed = speed;
    this.drawTiles();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  get finished(): boolean {
    if (this.pendingPlayback) return false;
    if (this.mode !== 'BATTLE') return false;
    // An empty recording (for example a board with no units) is already done.
    if (this.frames.length === 0) return true;
    return this.frameIndex >= this.frames.length - 1;
  }

  override update(_time: number, delta: number): void {
    if (this.mode !== 'BATTLE' || this.frames.length === 0) return;
    this.playbackTime += (delta / 1000) * this.speed;
    while (
      this.frameIndex < this.frames.length - 1 &&
      this.frames[this.frameIndex + 1].t <= this.playbackTime
    ) {
      this.frameIndex += 1;
    }
    this.renderBattleFrame();
  }

  // ------------------------------------------------------------------- draw
  private hexPath(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    // Pointy-top hexes, matching the odd-r offset grid.
    const pts: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 180) * (60 * i - 90);
      pts.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
  }

  private drawTiles(): void {
    const g = this.tiles;
    g.clear();
    const radius = HEX_STEP_X * 0.5;
    const highlightKeys = new Set(this.highlight.map((h) => `${h.q},${h.r}`));

    const rows = this.mode === 'PREP' ? BOARD_ROWS_PER_SIDE : BOARD_ROWS_TOTAL;
    for (let r = 0; r < rows; r += 1) {
      for (let q = 0; q < BOARD_COLS; q += 1) {
        const p = hexToPixel({ q, r }, BOARD_ORIGIN_X, BOARD_ORIGIN_Y);
        const isHover = this.hovered && this.hovered.q === q && this.hovered.r === r;
        const isHighlight = highlightKeys.has(`${q},${r}`);
        // The far half is the enemy side during a battle.
        const enemyHalf = this.mode === 'BATTLE' && r < BOARD_ROWS_PER_SIDE;

        g.fillStyle(
          isHighlight ? hex(ART_COLORS.cyan) : enemyHalf ? hex('#1A1F2E') : hex(ART_COLORS.panel),
          isHighlight ? 0.28 : 0.55,
        );
        this.hexPath(g, p.x, p.y, radius);
        g.fillPath();

        g.lineStyle(2, isHover ? hex(ART_COLORS.gold) : hex(ART_COLORS.edgeLight), isHover ? 0.95 : 0.35);
        this.hexPath(g, p.x, p.y, radius);
        g.strokePath();
      }
    }
  }

  private clearUnits(): void {
    this.unitLayer.removeAll(true);
    this.overlay.clear();
  }

  private renderPrepUnits(): void {
    this.clearUnits();
    for (const u of this.prepUnits) {
      const p = hexToPixel(u.position, BOARD_ORIGIN_X, BOARD_ORIGIN_Y);
      const def = getUnitDef(u.unitDefId);
      this.drawToken(p.x, p.y, def.nameKo, def.cost, u.star, 1, 1, 0, 0, false);
    }
  }

  private renderBattleFrame(): void {
    const frame = this.frames[this.frameIndex];
    if (!frame) return;
    this.clearUnits();

    for (const u of frame.units) {
      if (!u.alive) continue;
      const to = hexToPixel({ q: u.q, r: u.r }, BOARD_ORIGIN_X, BOARD_ORIGIN_Y);
      let x = to.x;
      let y = to.y;
      // Interpolate out of the previous cell for smooth movement.
      if (u.fromQ !== null && u.fromR !== null && u.progress > 0 && u.progress < 1) {
        const from = hexToPixel({ q: u.fromQ, r: u.fromR }, BOARD_ORIGIN_X, BOARD_ORIGIN_Y);
        x = from.x + (to.x - from.x) * u.progress;
        y = from.y + (to.y - from.y) * u.progress;
      }
      const def = getUnitDef(u.unitDefId);
      this.drawToken(
        x, y, def.nameKo, def.cost, u.star,
        u.maxHp > 0 ? u.hp / u.maxHp : 0,
        u.maxMana > 0 ? u.mana / u.maxMana : 0,
        u.shield, u.statuses.length,
        u.team === 'B',
      );
    }
  }

  private drawToken(
    x: number, y: number, nameKo: string, cost: number, star: number,
    hpRatio: number, manaRatio: number, shield: number, statusCount: number, isEnemy: boolean,
  ): void {
    const r = 34;
    const circle = this.add.circle(x, y, r, hex(ART_COLORS.panel));
    circle.setStrokeStyle(4, hex(costColor(cost)));
    this.unitLayer.add(circle);

    const label = this.add.text(x, y + 2, initialOf(nameKo), {
      fontFamily: '"Noto Sans KR", system-ui, sans-serif',
      fontSize: '26px',
      color: ART_COLORS.text,
    }).setOrigin(0.5);
    this.unitLayer.add(label);

    if (star > 1) {
      const stars = this.add.text(x, y - r - 10, '★'.repeat(star), {
        fontSize: '14px',
        color: star >= 3 ? ART_COLORS.gold : ART_COLORS.text,
      }).setOrigin(0.5);
      this.unitLayer.add(stars);
    }

    // HP bar with a shield segment, mana bar underneath.
    const barW = 62;
    const bg = this.add.rectangle(x, y + r + 8, barW, 7, hex(ART_COLORS.edgeDark)).setOrigin(0.5);
    this.unitLayer.add(bg);
    const hpColor = isEnemy ? hex(ART_COLORS.danger) : hex(ART_COLORS.success);
    const hpBar = this.add.rectangle(
      x - barW / 2, y + r + 8, Math.max(0, barW * hpRatio), 7, hpColor,
    ).setOrigin(0, 0.5);
    this.unitLayer.add(hpBar);
    if (shield > 0) {
      const sw = Math.min(barW, barW * 0.35);
      const shieldBar = this.add.rectangle(
        x - barW / 2 + barW * hpRatio, y + r + 8, sw * 0.5, 7, hex(ART_COLORS.cyan),
      ).setOrigin(0, 0.5);
      this.unitLayer.add(shieldBar);
    }

    const manaBar = this.add.rectangle(
      x - barW / 2, y + r + 17, Math.max(0, barW * manaRatio), 5, hex(ART_COLORS.cyan),
    ).setOrigin(0, 0.5);
    this.unitLayer.add(manaBar);

    if (statusCount > 0) {
      const dot = this.add.circle(x + r - 6, y - r + 6, 6, hex(ART_COLORS.violet));
      this.unitLayer.add(dot);
    }
  }
}

export const BOARD_WIDTH = BOARD_ORIGIN_X * 2 + (BOARD_COLS - 1) * HEX_STEP_X + HEX_ODD_ROW_OFFSET_X;
export const BOARD_HEIGHT_PREP = BOARD_ORIGIN_Y * 2 + (BOARD_ROWS_PER_SIDE - 1) * HEX_STEP_Y;
export const BOARD_HEIGHT_BATTLE = BOARD_ORIGIN_Y * 2 + (BOARD_ROWS_TOTAL - 1) * HEX_STEP_Y;
