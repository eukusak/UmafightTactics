/** Presentation-only battle playback. All feedback follows recorded engine events. */
import Phaser from 'phaser';
import type { BattleFrame, BattleEvent } from '../engine/battle/engine';
import { getUnitDef } from '../engine/roster';
import { costColor, initialOf } from './fallback-art';
import { assetUrl, cutinUrl, portraitUrl, standeeUrl, animationFrame, type AnimationName } from '../ui/art';
import { movingPoint } from '../ui/board-projection';
import { orientSnapshot, samplePosition, effectProgress, frameAt, attackExtension } from '../ui/battle-playback';
import { STATUS_PRESENTATION } from '../ui/status-presentation';
import { FRAME_SHEETS, frameSheetUrl, frameGeometry, motionFrame, skillMotionFrame } from '../ui/frame-animation';
import { skillDuration } from '../engine/battle/skill-timeline';
import { skillLabel } from '../ui/skill-presentation';
import { drawLegendaryFeedback, legendaryFeedback, LEGENDARY_FEEDBACK_SECONDS } from '../ui/legendary-skill-feedback';
import { COST_SKILL_PRESENTATION } from '../ui/cost-skill-presentation';

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
  fullBody: boolean;
  facing: number;
  attackDuration: number;
  attackReleaseAt: number;
  hpTrail: Phaser.GameObjects.Rectangle;
  bodyScaleX: number;
  bodyScaleY: number;
  frameSheet: boolean;
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
  private readySent = false;
  private frameDelta = 0;
  private mirrored = false;
  private streaming = false;
  private lastCutinAt = -10;
  private pulseAt = new Map<string, number>();
  private effects: Array<{ start: number; duration: number; object: Phaser.GameObjects.GameObject; update: (progress: number) => void }> = [];
  private projectiles: Array<{ image: Phaser.GameObjects.Arc; source: string; target: string; start: number; end: number; x: number; y: number }> = [];

  constructor(frames: BattleFrame[] = [], showNumbers = true, private onReady: () => void = () => {}, private onTime: (time: number) => void = () => {}, private humanId = 'p1', private matchClock?: () => number) {
    super({ key: 'BattleScene' });
    this.frames = frames;
    this.showNumbers = showNumbers;
  }

  preload(): void {
    for (const status of Object.values(STATUS_PRESENTATION)) {
      const url = status.icon ? assetUrl(`status/${status.icon}.png`) : null;
      if (url) this.load.image(`status:${status.icon}`, url);
    }
    const ids = new Set(this.frames.flatMap((frame) => frame.units.map((u) => u.unitDefId)));
    for (const id of ids) {
      const frames = frameSheetUrl(id);
      const sheet = assetUrl(`characters/${id}.png`) ?? (id.startsWith('pve_') ? assetUrl(`pve/${id.slice(4)}.png`) : null);
      const portrait = portraitUrl(id);
      const cutin = cutinUrl(id, getUnitDef(id).cost);
      if (cutin) this.load.image(`cutin:${id}`, cutin);
      if (frames) this.load.spritesheet(`sheet:${id}`, frames, { frameWidth: FRAME_SHEETS[id].frameWidth, frameHeight: FRAME_SHEETS[id].frameHeight });
      else if (id.startsWith('pve_') && standeeUrl(id)) this.load.image(`standee:${id}`, standeeUrl(id)!);
      else if (sheet) this.load.spritesheet(`sheet:${id}`, sheet, { frameWidth: 128, frameHeight: 128 });
      else if (standeeUrl(id)) this.load.image(`standee:${id}`, standeeUrl(id)!);
      else if (portrait) this.load.image(`portrait:${id}`, portrait);
    }
    const vfx = new Set([...ids].map((id) => getUnitDef(id).skill.vfxKey).concat(['vfx_heal', 'vfx_shield', 'vfx_buff']));
    for (const key of vfx) {
      const url = assetUrl(`vfx/${key}.png`);
      if (url) this.load.spritesheet(key, url, { frameWidth: 192, frameHeight: 192 });
    }
  }

  create(): void {
    this.ready = true;
    this.tweens.timeScale = this.speed;
  }

  playBattle(frames: BattleFrame[], speed = 1, time = 0): void {
    this.frames = frames;
    this.setSpeed(speed);
    this.frameIndex = frameAt(frames, time);
    this.eventIndex = -1;
    this.playbackTime = time;
    this.readySent = false;
    this.lastCutinAt = -10;
    this.pulseAt.clear();
    this.mirrored = frames[0]?.units.some((u) => u.id.startsWith(`${this.humanId}#`) && u.team === 'B') ?? false;
    this.effects.forEach((e) => e.object.destroy()); this.effects = [];
    this.projectiles.forEach((p) => p.image.destroy()); this.projectiles = [];
    this.started = true;
    for (const a of this.actors.values()) a.container.destroy();
    this.actors.clear();
  }

  streamFrames(frames: BattleFrame[], time: number): void {
    if (!this.started) this.playBattle(frames, 1, Math.max(0, time - .2));
    this.streaming = true;
    this.frames = frames;
    const latest = frames.at(-1)?.t ?? 0;
    if (latest - this.playbackTime > .8) this.playbackTime = Math.max(0, latest - .2);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    if (this.ready) this.tweens.timeScale = speed;
  }

  get finished(): boolean {
    return this.ready && this.started && !this.streaming && (this.frames.length === 0 || this.playbackTime >= this.frames[this.frames.length - 1].t + .7);
  }

  override update(_time: number, delta: number): void {
    if (!this.ready || !this.started || !this.frames.length) return;
    this.frameDelta = Math.min(delta, 100) * this.speed / 1000;
    const latest = this.frames[this.frames.length - 1];
    const limit = this.streaming && !latest.events.some((e) => e.type === 'END') ? Math.max(0, latest.t - .15) : latest.t + .7;
    const previousTime = this.playbackTime;
    this.playbackTime = Math.min(limit, this.matchClock ? this.matchClock() : this.playbackTime + this.frameDelta);
    this.frameDelta = Math.max(0, this.playbackTime - previousTime);
    while (this.frameIndex < this.frames.length - 1 && this.frames[this.frameIndex + 1].t <= this.playbackTime) this.frameIndex += 1;
    const frame = this.frames[this.frameIndex];
    // Create actors before replaying events so the first tick has a visual target.
    for (const u of frame.units) if (!this.actors.has(u.id)) this.actors.set(u.id, this.createActor(orientSnapshot(u, this.mirrored)));
    for (const u of frame.units) {
      const p = this.position(orientSnapshot(u, this.mirrored));
      this.actors.get(u.id)!.container.setPosition(p.x, p.y);
    }
    // Consume every intervening event once, including at 10x playback.
    while (this.eventIndex < this.frameIndex) {
      this.eventIndex += 1;
      for (const event of this.frames[this.eventIndex].events) this.presentEvent(event);
    }
    const next = this.frames[Math.min(this.frameIndex + 1, this.frames.length - 1)];
    const mix = next.t > frame.t ? Phaser.Math.Clamp((this.playbackTime - frame.t) / (next.t - frame.t), 0, 1) : 0;
    const nextById = new Map(next.units.map((u) => [u.id, u]));
    for (const u of frame.units) {
      const nextUnit = nextById.get(u.id);
      this.renderActor(orientSnapshot(u, this.mirrored), nextUnit ? orientSnapshot(nextUnit, this.mirrored) : undefined, mix);
    }
    this.effects = this.effects.filter((effect) => {
      const progress = effectProgress(this.playbackTime, effect.start, effect.duration);
      if (progress >= 1) { effect.object.destroy(); return false; }
      effect.update(progress); return true;
    });
    this.onTime(this.playbackTime);
    this.projectiles = this.projectiles.filter((projectile) => {
      const target = this.actors.get(projectile.target);
      if (!target || this.playbackTime >= projectile.end) { projectile.image.destroy(); return false; }
      const t = Phaser.Math.Clamp((this.playbackTime - projectile.start) / Math.max(.001, projectile.end - projectile.start), 0, 1);
      projectile.image.setPosition(Phaser.Math.Linear(projectile.x, target.container.x, t), Phaser.Math.Linear(projectile.y, target.container.y - 38 * target.container.scaleX, t) - Math.sin(t * Math.PI) * 12);
      return true;
    });
    if (!this.readySent) { this.readySent = true; this.onReady(); }
  }

  private position(u: Snapshot): ReturnType<typeof movingPoint> {
    return movingPoint(u);
  }

  private createActor(u: Snapshot): Actor {
    const def = getUnitDef(u.unitDefId);
    const p = this.position(u);
    const container = this.add.container(p.x, p.y);
    container.add(this.add.ellipse(0, 3, 67, 23, 0x08231c, .35));
    const base = this.add.ellipse(0, 0, 68, 23, u.team === 'B' ? 0x993957 : 0x319f87, .7).setStrokeStyle(2, tint(costColor(def.cost)), .95);
    container.add(base);
    const sheet = this.textures.exists(`sheet:${u.unitDefId}`);
    const fullBody = sheet || this.textures.exists(`standee:${u.unitDefId}`);
    const texture = sheet ? `sheet:${u.unitDefId}` : fullBody ? `standee:${u.unitDefId}` : `portrait:${u.unitDefId}`;
    if (!this.textures.exists(texture)) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x244b63);g.fillRoundedRect(0, 0, 64, 64, 18);
      g.lineStyle(2, tint(costColor(def.cost)));g.strokeRoundedRect(1, 1, 62, 62, 18);
      g.generateTexture(texture, 64, 64);g.destroy();
    }
    if (!fullBody && !portraitUrl(u.unitDefId)) {
      container.add(this.add.text(0, -38, initialOf(def.nameKo), { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: '25px', color: '#fff8e3' }).setOrigin(.5).setDepth(2));
    }
    const size = sheet ? 110 : fullBody ? 148 : 64;
    const body = this.add.image(0, 0, texture).setOrigin(.5, fullBody ? 440 / 512 : 1).setDisplaySize(size, size);
    if (FRAME_SHEETS[u.unitDefId]) {
      const geometry = frameGeometry(u.unitDefId, size);
      body.setOrigin(geometry.originX, geometry.originY).setDisplaySize(geometry.width, geometry.height);
    }
    container.addAt(body, 2);
    container.add(this.add.text(0, 24, def.nameKo, { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: '12px', color: '#fff5dc', stroke: '#0a1727', strokeThickness: 4 }).setOrigin(.5));
    container.add(this.add.text(0, fullBody && !sheet ? -130 : -83, '★'.repeat(u.star), { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: '13px', color: '#ffdc84', stroke: '#17362a', strokeThickness: 3 }).setOrigin(.5));
    container.add(this.add.rectangle(0, 13, 68, 8, 0x071926));
    const hpTrail = this.add.rectangle(-33, 11, 66 * u.hp / Math.max(1, u.maxHp), 5, 0xffce8a).setOrigin(0, .5);
    const hp = this.add.rectangle(-33, 11, 66, 5, u.team === 'B' ? 0xff8887 : 0x8ff7bb).setOrigin(0, .5);
    const mana = this.add.rectangle(-33, 17, 66, 3, 0x7bdcfa).setOrigin(0, .5);
    const shield = this.add.rectangle(-33, 7, 66, 2, 0xe0faff).setOrigin(0, .5);
    hp.width = 66 * u.hp / Math.max(1, u.maxHp);
    mana.width = 66 * u.mana / Math.max(1, u.maxMana);
    shield.width = Math.min(66, 66 * u.shield / Math.max(1, u.maxHp));
    container.add([hpTrail, hp, mana, shield]);
    const statuses = this.add.container(0, fullBody && !sheet ? -155 : -108);
    container.add(statuses);
    return { container, body, hp, hpTrail, mana, shield, statuses, statusKey: '', action: 'idle', actionAt: 0, sheet, fullBody, frameSheet: sheet && !!FRAME_SHEETS[u.unitDefId], facing: u.team === 'B' ? -1 : 1, attackDuration: .4, attackReleaseAt: 0, bodyScaleX: body.scaleX, bodyScaleY: body.scaleY };
  }

  private renderActor(u: Snapshot, next: Snapshot | undefined, mix: number): void {
    const a = this.actors.get(u.id)!;
    const p = this.position(u);const to = next ? this.position(next) : p;
    const sampled = samplePosition(u, next, mix);
    a.container.setPosition(sampled.x, sampled.y).setDepth(100 + sampled.y).setScale(sampled.scale);
    let elapsed = this.playbackTime - a.actionAt;
    let action = a.action;
    if (!u.alive) action = 'ko';
    else if (action === 'ko' || (action === 'basic_attack' && elapsed > a.attackDuration) || (action === 'skill_cast' && elapsed > skillDuration(getUnitDef(u.unitDefId).skill))) {
      action = u.fromQ !== null ? 'run' : 'idle';
    } else if (action === 'idle' || action === 'run') action = u.fromQ !== null ? 'run' : 'idle';
    if (action !== a.action) { a.action = action; a.actionAt = this.playbackTime; elapsed = 0; }
    if (a.sheet) {
      if (a.frameSheet) a.body.setFrame(action === 'skill_cast'
        ? skillMotionFrame(getUnitDef(u.unitDefId).skill, elapsed, FRAME_SHEETS[u.unitDefId].skillReleaseFrame ?? 2)
        : motionFrame(action, elapsed, a.attackReleaseAt - a.actionAt));
      else if (u.unitDefId.startsWith('pve_')) {
        const clip = action === 'ko' ? { start: 30, count: 6, fps: 10 } : action === 'basic_attack' || action === 'skill_cast' ? { start: 10, count: 8, fps: 14 } : { start: 0, count: 6, fps: 8 };
        const n = Math.floor((this.playbackTime - a.actionAt) * clip.fps);
        a.body.setFrame(clip.start + (clip.start === 0 ? n % clip.count : Math.min(n, clip.count - 1)));
      } else a.body.setFrame(animationFrame(action, this.playbackTime - a.actionAt));

    }
    const dx = to.x - p.x;
    if (Math.abs(dx) > .2) a.facing = dx > 0 ? 1 : -1;
    a.body.setFlipX(a.fullBody && a.facing < 0);
    const idle = Math.sin(this.playbackTime * 3 + u.id.length);
    const run = Math.sin(this.playbackTime * 15);
    const lunge = action === 'basic_attack' ? attackExtension(this.playbackTime, a.actionAt, a.attackReleaseAt) : 0;
    const skill = action === 'skill_cast' ? Math.sin(Math.min(1, elapsed / .67) * Math.PI) : 0;
    const dash = getUnitDef(u.unitDefId).skill.template === 'DASH_LINE';
    a.body.x = a.facing * (lunge * 9 + (dash ? skill * 11 : 0));
    a.body.y = !u.alive ? Math.min(15, elapsed * 25) : action === 'run' ? -Math.abs(run) * 2 : -skill * (dash ? 1 : 5);
    a.body.rotation = !u.alive ? a.facing * Math.min(.8, elapsed * 1.3) : a.facing * (lunge * .09 + (action === 'run' ? .055 : idle * .006) + skill * (dash ? .14 : -.025));
    a.body.setScale(a.bodyScaleX, a.bodyScaleY * (1 + idle * .008 - lunge * .025));
    // Generated frames own the pose. Do not deform or rotate the baked drawing again.
    if (a.frameSheet) a.body.setPosition(0, 0).setRotation(0).setScale(a.bodyScaleX, a.bodyScaleY);
    a.container.alpha = u.alive ? 1 : Math.max(0, 1 - (this.playbackTime - a.actionAt) / .65);
    const settle = 1 - Math.exp(-this.frameDelta * 22);
    a.hp.width = Phaser.Math.Linear(a.hp.width, 66 * Phaser.Math.Clamp(u.hp / Math.max(1, u.maxHp), 0, 1), settle);
    a.hpTrail.width = Math.max(a.hp.width, Phaser.Math.Linear(a.hpTrail.width, a.hp.width, 1 - Math.exp(-this.frameDelta * 5)));
    a.mana.width = Phaser.Math.Linear(a.mana.width, 66 * Phaser.Math.Clamp(u.mana / Math.max(1, u.maxMana), 0, 1), settle);
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

  private track(object: Phaser.GameObjects.GameObject, start: number, duration: number, update: (progress: number) => void): void {
    if (this.playbackTime >= start + duration) { object.destroy(); return; }
    this.effects.push({ object, start, duration, update });
  }

  private setAction(id: string, action: AnimationName, t: number): Actor | undefined {
    const actor = this.actors.get(id);
    if (actor) { actor.action = action; actor.actionAt = t; }
    return actor;
  }

  private presentEvent(event: BattleEvent): void {
    if (event.type === 'ATTACK_START') {
      const actor = this.setAction(event.source, 'basic_attack', event.t);
      const target = this.actors.get(event.target);
      if (actor) {
        actor.attackReleaseAt = event.releaseAt;
        actor.attackDuration = Math.max(.1, event.releaseAt - event.t + .18);
        if (target) actor.facing = target.container.x >= actor.container.x ? 1 : -1;
      }
    } else if (event.type === 'PROJECTILE') {
      const actor = this.actors.get(event.source);
      if (!actor || this.playbackTime >= event.impactAt) return;
      const sourceFrame = this.frames[this.eventIndex].units.find((u) => u.id === event.source);
      const sourcePoint = sourceFrame ? this.position(orientSnapshot(sourceFrame, this.mirrored)) : actor.container;
      const image = this.add.circle(actor.container.x, actor.container.y - 38, 5, 0xffe2a0).setStrokeStyle(2, 0xffffff, .8).setDepth(800).setBlendMode(Phaser.BlendModes.ADD);
      this.projectiles.push({ image, source: event.source, target: event.target, start: event.t, end: event.impactAt, x: sourcePoint.x, y: sourcePoint.y - 38 * actor.container.scaleX });
    } else if (event.type === 'DAMAGE') {
      // Damage never changes pose or interrupts an attack. User direction 2026-09-08.
      const actor = this.actors.get(event.target);
      if (!actor) return;
      if (this.playbackTime - event.t >= .6) return;
      if (this.showNumbers && (event.damage > 0 || event.absorbed > 0)) {
        const critical = event.crit || this.frames[this.eventIndex].events.some((e) => e.type === 'ATTACK' && e.source === event.source && e.target === event.target && e.crit);
        const label = this.add.text(actor.container.x, actor.container.y - 78, event.damage > 0 ? `${critical ? '✦ ' : ''}${Math.round(event.damage)}` : '방어', { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: critical ? '26px' : '20px', color: critical ? '#ffdc80' : event.isSkill ? '#dac7ff' : '#ffffff', stroke: '#182238', strokeThickness: 4 }).setOrigin(.5).setDepth(900);
        const x = label.x, y = label.y;
        this.track(label, event.t, .6, (t) => label.setPosition(x, y - t * 36).setAlpha(1 - t));
      }
    } else if (event.type === 'CAST') {
      const actor = this.setAction(event.source, 'skill_cast', event.t);
      const unit = this.frames[this.eventIndex].units.find((u) => u.id === event.source);
      if (!actor || !unit || this.playbackTime - event.t >= .85) return;
      const def = getUnitDef(unit.unitDefId);
      if (def.cost === 5 && unit.id.startsWith(`${this.humanId}#`) && event.t - this.lastCutinAt >= 5 && this.textures.exists(`cutin:${unit.unitDefId}`)) {
        this.lastCutinAt = event.t;
        const cutin = this.add.image(1300, 20, `cutin:${unit.unitDefId}`).setOrigin(1, 0).setDepth(850);
        // All legendary panels preserve their source aspect ratio.
        const image = cutin.texture.getSourceImage();
        cutin.setDisplaySize(225 * image.width / image.height, 225);
        this.track(cutin, event.t, .85, (t) => cutin.setX(1300 + 24 * (1 - Math.min(1, t * 6))).setAlpha(Math.min(1, t * 8, (1 - t) * 4)));
      }
      const label = this.add.text(actor.container.x, actor.container.y - 98, `${def.cost} · ${skillLabel(def.skill)}`, { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: def.cost >= 4 ? '14px' : '12px', color: costColor(def.cost), backgroundColor: '#182b43', padding: { x: 4, y: 3 } }).setOrigin(.5).setDepth(910);
      const x = label.x, y = label.y;
      this.track(label, event.t, .85, (t) => label.setPosition(x, y - t * 16).setAlpha(Math.min(1, (1 - t) * 3)));
    } else if (event.type === 'SKILL_EFFECT') {
      this.presentSkillEffect(event);
    } else if (event.type === 'CAST_CANCEL') {
      this.setAction(event.source, 'idle', event.t);
    } else if (event.type === 'END') {
      for (const u of this.frames[this.eventIndex].units) {
        if (u.alive && u.team === event.winner) this.setAction(u.id, 'victory', event.t);
      }
    } else if (event.type === 'DEATH') this.setAction(event.unit, 'ko', event.t);
    else if (event.type === 'REVIVE') this.setAction(event.unit, 'idle', event.t);
    else if (event.type === 'OVERTIME') {
      const text = this.add.text(660, 90, 'OVERTIME', { fontFamily: 'Noto Sans KR Variable, sans-serif', fontSize: '32px', color: '#ffe6ae', stroke: '#96372a', strokeThickness: 5 }).setOrigin(.5).setDepth(950);
      this.track(text, event.t, 1.7, (t) => text.setAlpha(Math.min(1, (1 - t) * 3)));
    }
  }

  private presentSkillEffect(event: Extract<BattleEvent, { type: 'SKILL_EFFECT' }>): void {
    const unit = this.frames[this.eventIndex].units.find((u) => u.id === event.source);
    if (!unit) return;
    const def = getUnitDef(unit.unitDefId), color = tint(def.skill.choreography?.color ?? '#c6b6ff');
    const style = COST_SKILL_PRESENTATION[def.cost];
    if (this.playbackTime - event.t >= style.duration) return;
    const healing = event.kind.startsWith('HEAL'), shield = event.kind.startsWith('SHIELD');
    // Buff triplets share a pulse; damage and repeated healing retain every release.
    const buff = event.kind === 'STAT_MUL' || event.kind === 'STAT_ADD';
    if (buff && this.frames[this.eventIndex].events.find(e => e.type === 'SKILL_EFFECT' && e.source === event.source && (e.kind === 'STAT_MUL' || e.kind === 'STAT_ADD')) !== event) return;
    if (!healing && !shield && !buff && !['DAMAGE', 'DAMAGE_MAXHP_PCT', 'APPLY_STATUS', 'DASH', 'TAUNT'].includes(event.kind)) return;
    const source = this.actors.get(event.source);
    const signature = def.skill.choreography;
    const accent = tint(signature?.accent ?? '#ffffff');
    const points = event.targets.map(id => this.actors.get(id)).filter((a): a is NonNullable<typeof a> => !!a).map(a => ({ x: a.container.x, y: a.container.y - 22 * a.container.scaleX }));
    if (source && event.kind === 'DAMAGE' && points.length && legendaryFeedback(def.id, def.cost, 0)) {
      const origin = { x: source.container.x, y: source.container.y - 22 * source.container.scaleX };
      const feedback = this.add.graphics().setDepth(822);
      this.track(feedback, event.t, LEGENDARY_FEEDBACK_SECONDS, p => {
        feedback.clear();
        drawLegendaryFeedback(feedback, def.id, def.cost, origin, points, p * LEGENDARY_FEEDBACK_SECONDS, source.container.scaleX);
      });
      // Echo the authored release pose; never stretch, recolor, or rotate the body.
      for (let i = 0; i < 2; i++) {
        const body = source.body;
        const echo = this.add.image(0, 0, body.texture.key, 14).setOrigin(body.originX, body.originY)
          .setScale(source.bodyScaleX, source.bodyScaleY).setFlipX(body.flipX).setAlpha(.18);
        source.container.addAt(echo, 0);
        this.track(echo, event.t, .22, p => echo.setX(-source.facing * (i + 1) * (3 + p * 7)).setAlpha((1 - p) * .18));
      }
    }
    if (source && points.length && (event.shape || event.kind === 'DASH')) {
      const origin = { x: source.container.x, y: source.container.y - 22 * source.container.scaleX };
      const geometry = this.add.graphics().setDepth(818);
      geometry.lineStyle((event.shape === 'LINE' ? 2 : 1) * style.stroke, color, .8);
      if (event.shape === 'CONE') {
        for (const end of points) geometry.lineBetween(origin.x, origin.y, end.x, end.y);
        geometry.lineStyle(1, accent, .7);
        for (let i = 1; i < points.length; i++) geometry.lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
      } else {
        let from = origin;
        for (const end of points) {
          geometry.lineBetween(from.x, from.y, end.x, end.y);
          geometry.fillStyle(accent, .9).fillRect(end.x - 3, end.y - 3, 6, 6);
          if (event.shape === 'CHAIN') from = end;
        }
      }
      this.track(geometry, event.t, style.duration, p => geometry.setAlpha(1 - p));
    }
    const texture = healing ? 'vfx_heal' : shield ? 'vfx_shield' : def.skill.vfxKey;
    for (const id of event.targets) {
      const actor = this.actors.get(id);
      if (!actor) continue;
      const pulseKey = `${id}:${healing ? 'heal' : shield ? 'shield' : buff ? 'buff' : 'impact'}`;
      if (event.t - (this.pulseAt.get(pulseKey) ?? -1) < .1) continue;
      this.pulseAt.set(pulseKey, event.t);
      const x = actor.container.x, y = actor.container.y - 22 * actor.container.scaleX;
      const radius = (shield ? 38 : healing ? 22 : 28) * actor.container.scaleX * style.radius;
      const ring = this.add.circle(x, y, radius, color, .08).setStrokeStyle(style.stroke, color, .85).setDepth(819);
      this.track(ring, event.t, style.duration, (p) => ring.setScale(shield ? 1 : .5 + p).setAlpha(1 - p));
      for (let echo = 0; echo < style.echoes; echo++) {
        const trail = this.add.circle(x, y, radius * (.7 + echo * .16)).setStrokeStyle(1, accent, .45).setDepth(818);
        this.track(trail, event.t, style.duration, p => trail.setScale(.5 + Math.max(0, p - echo * .12) * 1.4).setAlpha((1 - p) * .45));
      }
      if (signature?.emblem !== undefined) {
        const glyph = this.add.graphics().setPosition(x, y).setDepth(821);
        const seed = signature.emblem + 1, count = 3 + seed % 5 + style.particles;
        glyph.fillStyle(accent, .9);
        for (let i = 0; i < count; i++) {
          const angle = i * Math.PI * 2 / count + (seed % 17) * .17 + (event.effectIndex ?? 0) * .4;
          const spread = radius * (.55 + (seed % 3) * .15);
          glyph.fillRect(Math.cos(angle) * spread - 2, Math.sin(angle) * spread - 2, 4, 4);
        }
        this.track(glyph, event.t, style.duration, p => glyph.setScale(1 + p * .8).setRotation(p * (seed % 2 ? 1 : -1)).setAlpha(1 - p));
      }
      if (this.textures.exists(texture)) {
        const effect = this.add.image(x, y + 18 * actor.container.scaleX, texture, 0).setDepth(820).setScale(actor.container.scaleX * .65 * style.radius);
        // Normal alpha blending works identically on WebGL and Canvas.
        this.track(effect, event.t, style.duration, (p) => effect.setFrame(Math.min(9, Math.floor(p * 10))).setAlpha(.7 - p * .4));
      }
    }
  }
}
