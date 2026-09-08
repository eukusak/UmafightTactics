/** Presentation-only battle playback. All feedback follows recorded engine events. */
import Phaser from 'phaser';
import type { BattleFrame, BattleEvent } from '../engine/battle/engine';
import { getUnitDef } from '../engine/roster';
import { costColor, initialOf } from './fallback-art';
import { arenaUrl, assetUrl, portraitUrl, animationFrame, type AnimationName } from '../ui/art';
import { boardPoint } from '../ui/board-projection';
import { STATUS_PRESENTATION } from '../ui/status-presentation';

type Snapshot = BattleFrame['units'][number];
type Actor = {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  hp: Phaser.GameObjects.Rectangle;
  mana: Phaser.GameObjects.Rectangle;
  shield: Phaser.GameObjects.Rectangle;
  action: AnimationName;
  actionAt: number;
  sheet: boolean;
  statuses: Phaser.GameObjects.Container;
  statusKey: string;
};
const tint = (value: string): number => parseInt(value.replace('#', ''), 16);

export class BattleScene extends Phaser.Scene {
  private frames: BattleFrame[];
  private frameIndex = 0;
  private eventIndex = -1;
  private playbackTime = 0;
  private speed = 1;
  private ready = false;
  private started = false;
  private actors = new Map<string, Actor>();
  private showNumbers: boolean;

  constructor(frames: BattleFrame[] = [], showNumbers = true, private arena = arenaUrl()) {
    super({ key: 'BattleScene' });
    this.frames = frames;
    this.showNumbers = showNumbers;
  }

  preload(): void {
    this.load.image('arena', this.arena);
    for (const status of Object.values(STATUS_PRESENTATION)) {
      const url = status.icon ? assetUrl(`status/${status.icon}.png`) : null;
      if (url) this.load.image(`status:${status.icon}`, url);
    }
    const ids = new Set(this.frames.flatMap((frame) => frame.units.map((u) => u.unitDefId)));
    for (const id of ids) {
      const sheet = assetUrl(`characters/${id}.png`) ?? (id.startsWith('pve_') ? assetUrl(`pve/${id.slice(4)}.png`) : null);
      const portrait = portraitUrl(id);
      if (sheet) this.load.spritesheet(`sheet:${id}`, sheet, { frameWidth: 128, frameHeight: 128 });
      else if (portrait) this.load.image(`portrait:${id}`, portrait);
    }
    const vfx = new Set([...ids].map((id) => getUnitDef(id).skill.vfxKey));
    for (const key of vfx) {
      const url = assetUrl(`vfx/${key}.png`);
      if (url) this.load.spritesheet(key, url, { frameWidth: 192, frameHeight: 192 });
    }
  }

  create(): void {
    this.add.image(660, 329, 'arena').setDisplaySize(1320, 658);
    const tiles = this.add.graphics();
    for (let r = 0; r < 8; r += 1) for (let q = 0; q < 7; q += 1) {
      const p = boardPoint({ q, r });
      const points = Array.from({ length: 6 }, (_, i) => {
        const a = (i * 60 - 90) * Math.PI / 180;
        return new Phaser.Geom.Point(p.x + Math.cos(a) * 57 * p.scale, p.y + Math.sin(a) * 32);
      });
      tiles.fillStyle(r < 4 ? 0x342044 : 0x154e4a, .13);
      tiles.fillPoints(points, true);
      tiles.lineStyle(1, r < 4 ? 0xf1b9a5 : 0xbaffd5, .24);
      tiles.strokePoints(points, true);
    }
    this.add.text(32, 24, 'TWINKLE ARENA  /  전투', { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: '16px', color: '#fff5da', backgroundColor: '#122a3b', padding: { x: 14, y: 8 } });
    this.children.list.forEach((child) => { if (child instanceof Phaser.GameObjects.Text) child.setFontFamily('Noto Sans KR Variable, sans-serif'); });
    this.ready = true;
    this.tweens.timeScale = this.speed;
  }

  playBattle(frames: BattleFrame[], speed = 1): void {
    this.frames = frames;
    this.setSpeed(speed);
    this.frameIndex = 0;
    this.eventIndex = -1;
    this.playbackTime = 0;
    this.started = true;
    for (const a of this.actors.values()) a.container.destroy();
    this.actors.clear();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    if (this.ready) this.tweens.timeScale = speed;
  }

  get finished(): boolean {
    return this.ready && this.started && (this.frames.length === 0 || this.playbackTime >= this.frames[this.frames.length - 1].t + .7);
  }

  override update(_time: number, delta: number): void {
    if (!this.started || !this.frames.length) return;
    this.playbackTime += delta * this.speed / 1000;
    while (this.frameIndex < this.frames.length - 1 && this.frames[this.frameIndex + 1].t <= this.playbackTime) this.frameIndex += 1;
    const frame = this.frames[this.frameIndex];
    // Create actors before replaying events so the first tick has a visual target.
    for (const u of frame.units) if (!this.actors.has(u.id)) this.actors.set(u.id, this.createActor(u));
    // Consume every intervening event once, including at 10x playback.
    while (this.eventIndex < this.frameIndex) {
      this.eventIndex += 1;
      for (const event of this.frames[this.eventIndex].events) this.presentEvent(event);
    }
    const next = this.frames[Math.min(this.frameIndex + 1, this.frames.length - 1)];
    const mix = next.t > frame.t ? Phaser.Math.Clamp((this.playbackTime - frame.t) / (next.t - frame.t), 0, 1) : 0;
    for (const u of frame.units) this.renderActor(u, next.units.find((n) => n.id === u.id), mix);
  }

  private position(u: Snapshot): ReturnType<typeof boardPoint> {
    const p = boardPoint({ q: u.q, r: u.r });
    if (u.fromQ !== null && u.fromR !== null && u.progress > 0 && u.progress < 1) {
      const from = boardPoint({ q: u.fromQ, r: u.fromR });
      p.x = Phaser.Math.Linear(from.x, p.x, u.progress);
      p.y = Phaser.Math.Linear(from.y, p.y, u.progress);
    }
    return p;
  }

  private createActor(u: Snapshot): Actor {
    const def = getUnitDef(u.unitDefId);
    const p = this.position(u);
    const container = this.add.container(p.x, p.y);
    container.add(this.add.ellipse(0, 3, 67, 23, 0x08231c, .35));
    const base = this.add.ellipse(0, 0, 68, 23, u.team === 'B' ? 0x993957 : 0x319f87, .7).setStrokeStyle(2, tint(costColor(def.cost)), .95);
    container.add(base);
    const sheet = this.textures.exists(`sheet:${u.unitDefId}`);
    const texture = sheet ? `sheet:${u.unitDefId}` : `portrait:${u.unitDefId}`;
    if (!this.textures.exists(texture)) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x244b63);g.fillRoundedRect(0, 0, 64, 64, 18);
      g.lineStyle(2, tint(costColor(def.cost)));g.strokeRoundedRect(1, 1, 62, 62, 18);
      g.generateTexture(texture, 64, 64);g.destroy();
    }
    if (!sheet && !portraitUrl(u.unitDefId)) {
      container.add(this.add.text(0, -38, initialOf(def.nameKo), { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: '25px', color: '#fff8e3' }).setOrigin(.5).setDepth(2));
    }
    const body = this.add.image(0, 0, texture).setOrigin(.5, sheet ? .86 : 1).setDisplaySize(sheet ? 110 : 64, sheet ? 110 : 64);
    container.addAt(body, 2);
    container.add(this.add.text(0, 24, def.nameKo, { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: '12px', color: '#fff5dc', stroke: '#0a1727', strokeThickness: 4 }).setOrigin(.5));
    container.add(this.add.text(0, -83, '★'.repeat(u.star), { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: '13px', color: '#ffdc84', stroke: '#17362a', strokeThickness: 3 }).setOrigin(.5));
    container.add(this.add.rectangle(0, 13, 68, 8, 0x071926));
    const hp = this.add.rectangle(-33, 11, 66, 5, u.team === 'B' ? 0xff8887 : 0x8ff7bb).setOrigin(0, .5);
    const mana = this.add.rectangle(-33, 17, 66, 3, 0x7bdcfa).setOrigin(0, .5);
    const shield = this.add.rectangle(-33, 7, 66, 2, 0xe0faff).setOrigin(0, .5);
    container.add([hp, mana, shield]);
    const statuses = this.add.container(0, -108);
    container.add(statuses);
    return { container, body, hp, mana, shield, statuses, statusKey: '', action: 'idle', actionAt: 0, sheet };
  }

  private renderActor(u: Snapshot, next: Snapshot | undefined, mix: number): void {
    const a = this.actors.get(u.id)!;
    const p = this.position(u);const to = next ? this.position(next) : p;
    a.container.setPosition(Phaser.Math.Linear(p.x, to.x, mix), Phaser.Math.Linear(p.y, to.y, mix)).setDepth(100 + p.y).setScale(p.scale);
    const elapsed = this.playbackTime - a.actionAt;
    let action = a.action;
    if (!u.alive) action = 'ko';
    else if (action === 'ko' || (action === 'hit' && elapsed > .33) || (action === 'basic_attack' && elapsed > .57) || (action === 'skill_cast' && elapsed > .67)) {
      action = u.fromQ !== null ? 'run' : 'idle';
    } else if (action === 'idle' || action === 'run') action = u.fromQ !== null ? 'run' : 'idle';
    if (action !== a.action) { a.action = action; a.actionAt = this.playbackTime; }
    if (a.sheet) {
      if (u.unitDefId.startsWith('pve_')) {
        const clip = action === 'ko' ? { start: 30, count: 6, fps: 10 } : action === 'hit' ? { start: 20, count: 4, fps: 12 } : action === 'basic_attack' || action === 'skill_cast' ? { start: 10, count: 8, fps: 14 } : { start: 0, count: 6, fps: 8 };
        const n = Math.floor((this.playbackTime - a.actionAt) * clip.fps);
        a.body.setFrame(clip.start + (clip.start === 0 ? n % clip.count : Math.min(n, clip.count - 1)));
      } else a.body.setFrame(animationFrame(action, this.playbackTime - a.actionAt));
      a.body.setFlipX(u.team === 'B');
    } else {
      const bob = action === 'run' ? Math.sin(this.playbackTime * 18) * 4 : Math.sin(this.playbackTime * 3) * 1.4;
      a.body.y = !u.alive ? 12 : -bob;
      a.body.rotation = !u.alive ? (u.team === 'B' ? -.75 : .75) : action === 'basic_attack' ? Math.sin(elapsed * 11) * .12 : 0;
    }
    a.container.alpha = u.alive ? 1 : Math.max(0, 1 - (this.playbackTime - a.actionAt) / .65);
    a.hp.width = 66 * Phaser.Math.Clamp(u.hp / Math.max(1, u.maxHp), 0, 1);
    a.mana.width = 66 * Phaser.Math.Clamp(u.mana / Math.max(1, u.maxMana), 0, 1);
    a.shield.width = Math.min(66, 66 * u.shield / Math.max(1, u.maxHp));
    const active = u.alive ? [...new Set(u.statuses)].sort() : [];
    const statusKey = active.join(',');
    if (a.statusKey !== statusKey) {
      a.statusKey = statusKey;
      a.statuses.removeAll(true);
      active.forEach((kind, i) => {
        const status = STATUS_PRESENTATION[kind];
        const rowCount = Math.min(4, active.length - Math.floor(i / 4) * 4);
        const x = ((i % 4) - (rowCount - 1) / 2) * 25;
        const y = -Math.floor(i / 4) * 25;
        a.statuses.add(this.add.rectangle(x, y, 23, 23, 0x102336, .95).setStrokeStyle(1, 0xd9c898));
        if (status.icon && this.textures.exists(`status:${status.icon}`)) {
          a.statuses.add(this.add.image(x, y, `status:${status.icon}`).setDisplaySize(21, 21));
        } else {
          a.statuses.add(this.add.text(x, y, status.label, { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: '10px', color: '#fff5da' }).setOrigin(.5));
        }
      });
    }
    if (u.statuses.includes('STUN')) a.body.setTint(0xc8a4ff); else a.body.clearTint();
  }

  private setAction(id: string, action: AnimationName, t: number): Actor | undefined {
    const actor = this.actors.get(id);
    if (actor) { actor.action = action; actor.actionAt = t; }
    return actor;
  }

  private presentEvent(event: BattleEvent): void {
    if (event.type === 'ATTACK') {
      const a = this.setAction(event.source, 'basic_attack', event.t);
      const b = this.setAction(event.target, 'hit', event.t);
      if (!a || !b) return;
      const line = this.add.graphics().setDepth(850);
      line.lineStyle(event.crit ? 5 : 2, event.crit ? 0xffd684 : 0xc4f9ed, .8);
      line.lineBetween(a.container.x, a.container.y - 35, b.container.x, b.container.y - 35);
      this.tweens.add({ targets: line, alpha: 0, duration: 180, onComplete: () => line.destroy() });
      const ring = this.add.circle(b.container.x, b.container.y - 32, 12, 0xffedb5, .5).setDepth(851);
      this.tweens.add({ targets: ring, scale: 2.5, alpha: 0, duration: 240, onComplete: () => ring.destroy() });
      if (this.showNumbers) {
        const label = this.add.text(b.container.x, b.container.y - 78, `${event.crit ? '✦ ' : ''}${Math.round(event.damage)}`, { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: event.crit ? '26px' : '20px', color: event.crit ? '#ffdc80' : '#ffffff', stroke: '#22243c', strokeThickness: 4 }).setOrigin(.5).setDepth(900);
        this.tweens.add({ targets: label, y: label.y - 38, alpha: 0, duration: 650, onComplete: () => label.destroy() });
      }
    } else if (event.type === 'CAST') {
      const actor = this.setAction(event.source, 'skill_cast', event.t);
      const unit = this.frames[this.eventIndex].units.find((u) => u.id === event.source);
      if (!actor || !unit) return;
      const def = getUnitDef(unit.unitDefId);
      if (this.textures.exists(def.skill.vfxKey)) {
        const effect = this.add.image(actor.container.x, actor.container.y - 20, def.skill.vfxKey, 0).setDepth(820).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.addCounter({ from: 0, to: 9, duration: 600, onUpdate: (tween) => effect.setFrame(Math.floor(tween.getValue() ?? 0)), onComplete: () => effect.destroy() });
      }
      const label = this.add.text(actor.container.x, actor.container.y - 98, def.skill.displayName, { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: '14px', color: '#ffdd8e', backgroundColor: '#182b43', padding: { x: 8, y: 5 } }).setOrigin(.5).setDepth(910);
      this.tweens.add({ targets: label, y: label.y - 16, alpha: 0, delay: 500, duration: 350, onComplete: () => label.destroy() });
    } else if (event.type === 'END') {
      for (const u of this.frames[this.eventIndex].units) {
        if (u.alive && u.team === event.winner) this.setAction(u.id, 'victory', event.t);
      }
    } else if (event.type === 'DEATH') this.setAction(event.unit, 'ko', event.t);
    else if (event.type === 'REVIVE') this.setAction(event.unit, 'idle', event.t);
    else if (event.type === 'OVERTIME') {
      const text = this.add.text(660, 90, 'OVERTIME', { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: '32px', color: '#ffe6ae', stroke: '#96372a', strokeThickness: 5 }).setOrigin(.5).setDepth(950);
      this.tweens.add({ targets: text, alpha: 0, delay: 1200, duration: 500, onComplete: () => text.destroy() });
    }
  }
}
