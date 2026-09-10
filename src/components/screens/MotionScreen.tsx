import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { ALL_UNITS, getUnitDef } from '../../game/engine/roster';
import { PVE_UNIT_IDS } from '../../game/engine/battle/pve-units';
import { FRAME_SHEETS, frameSheetUrl, motionFrame, skillMotionFrame } from '../../game/ui/frame-animation';
import { skillTimeline } from '../../game/engine/battle/skill-timeline';
import { portraitUrl, standeeUrl, type AnimationName } from '../../game/ui/art';
import { useGameStore } from '../../store/gameStore';

const ACTIONS: Record<AnimationName, string> = { idle: '대기', run: '달리기', basic_attack: '공격', skill_cast: '스킬', ko: '쓰러짐', victory: '승리' };
export function MotionScreen(): JSX.Element {
  const back = useGameStore(s => s.setScreen);
  const [id, setId] = useState('special_week');
  const [action, setAction] = useState<AnimationName>('idle');
  const [paused, setPaused] = useState(false);
  const [facing, setFacing] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [frame, setFrame] = useState(0);
  const [status, setStatus] = useState('불러오는 중');
  const host = useRef<HTMLDivElement>(null);
  const timeline = useRef(0);
  const control = useRef({ action, paused, facing, speed, frame, reset: 0 });
  control.current = { ...control.current, action, paused, facing, speed, frame };
  useEffect(() => {
    if (!host.current) return;
    let alive = true;
    class Preview extends Phaser.Scene {
      private sprites: Phaser.GameObjects.Image[] = [];
      private clock = 0;
      private lastAction: AnimationName = 'idle';
      private wasPaused = false;
      private pulses!: Phaser.GameObjects.Graphics;
      preload(): void {
        const sheet = FRAME_SHEETS[id];
        if (sheet) this.load.spritesheet('preview-body', frameSheetUrl(id)!, { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
        else this.load.image('preview-body', standeeUrl(id) ?? portraitUrl(id)!);
        this.load.on('loaderror', () => { if (alive) setStatus('이미지를 불러오지 못했습니다.'); });
      }
      create(): void {
        this.pulses = this.add.graphics().setDepth(20);
        this.add.ellipse(360, 468, 180, 38, 0x07131e, .6);
        this.sprites.push(this.add.image(360, 465, 'preview-body').setOrigin(.5, .859375).setDisplaySize(420, 420));
        if (alive) setStatus(FRAME_SHEETS[id] ? '프레임 애니메이션 · 6종 모션 · 24개 원화' : '프레임 제작 대기 · 현재 원화 미리보기');
      }
      override update(_t: number, dt: number): void {
        const c = control.current;
        if (c.action !== this.lastAction) { this.clock = 0; this.lastAction = c.action; }
        if (this.wasPaused && !c.paused) this.clock = c.frame;
        this.wasPaused = c.paused;
        if (!c.paused) this.clock += Math.min(dt, 100) / 1000 * c.speed;
        const time = c.paused ? c.frame : this.clock;
        const cycle = time % 2;
        timeline.current = cycle;
        const skill = getUnitDef(id).skill;
        this.pulses.clear();
        for (const sprite of this.sprites) {
          sprite.setFlipX(c.facing < 0);
          if (FRAME_SHEETS[id]) sprite.setFrame(c.action === 'skill_cast'
            ? skillMotionFrame(skill, cycle, FRAME_SHEETS[id].skillReleaseFrame ?? 2)
            : motionFrame(c.action, cycle));
          if (c.action === 'skill_cast') {
            const releases = [...new Set(skillTimeline(skill).map(e => e.at))];
            for (const at of releases) {
              const age = cycle - at;
              if (age < 0 || age > .25) continue;
              const color = parseInt((skill.choreography?.color ?? '#b9ddff').slice(1), 16);
              this.pulses.lineStyle(4, color, 1 - age / .25);
              const effect = skillTimeline(skill).find(e => Math.abs(e.at - at) < 1e-8 && e.effect.shape)?.effect;
              const x = sprite.x, y = sprite.y - 130, direction = c.facing;
              if (effect?.shape === 'LINE') this.pulses.lineBetween(x, y, x + direction * 250, y - 25);
              else if (effect?.shape === 'CONE') {
                for (const offset of [-65, 0, 65]) this.pulses.lineBetween(x, y, x + direction * 200, y + offset);
              } else if (effect?.shape === 'CHAIN') {
                this.pulses.lineBetween(x, y, x + direction * 90, y - 60);
                this.pulses.lineBetween(x + direction * 90, y - 60, x + direction * 185, y + 15);
              } else this.pulses.strokeCircle(x, y, 72 * (1 + age * 2));
              const seed = (skill.choreography?.emblem ?? 0) + 1;
              this.pulses.fillStyle(parseInt((skill.choreography?.accent ?? '#ffffff').slice(1), 16), 1 - age / .25);
              for (let i = 0; i < 3 + seed % 5; i++) {
                const a = i * Math.PI * 2 / (3 + seed % 5) + seed * .17;
                this.pulses.fillRect(x + Math.cos(a) * (85 + age * 120), y + Math.sin(a) * (85 + age * 120), 6, 6);
              }
            }
          }
        }
      }
    }
    const game = new Phaser.Game({ type: Phaser.AUTO, width: 720, height: 550,
      parent: host.current, backgroundColor: '#183549', scene: Preview, audio: { noAudio: true },
      render: { antialias: false, pixelArt: true }, scale: { mode: Phaser.Scale.NONE },
      callbacks: { postBoot: game => { game.canvas.style.width = '100%'; game.canvas.style.height = '100%'; } } });
    return () => { alive = false; game.destroy(true); };
  }, [id]);

  return <div className="menu-screen motion-screen" style={{ padding: 55, justifyContent: 'flex-start' }}>
    <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400 }}>기물 모션 미리보기</h1>
      <button onClick={() => back('MAIN_MENU')}>돌아가기</button>
    </div>
    <div className="motion-layout" style={{ display: 'flex', gap: 35, width: '100%' }}>
      <div className="panel motion-preview" style={{ width: 1000, height: 765 }} ref={host} aria-label={`${getUnitDef(id).nameKo} 모션 화면`} />
      <div className="panel" style={{ flex: 1, padding: 30 }}>
        <label>기물 선택<select aria-label="기물 선택" value={id} onChange={e => setId(e.target.value)} style={{ width: '100%', margin: '12px 0 28px', padding: 12, background: '#173044', color: '#fff5df' }}>
          {ALL_UNITS.map(u => <option key={u.id} value={u.id}>{u.nameKo}</option>)}
          {Object.values(PVE_UNIT_IDS).map(key => <option key={key} value={key}>{getUnitDef(key).nameKo} (PvE)</option>)}
        </select></label>
        <p>{status}</p>
        <p className="motion-skill-name" style={{ color: '#ffe4a6', fontWeight: 700 }}>{getUnitDef(id).skill.displayName}</p>
        <p className="motion-skill-description" style={{ fontSize: 14, lineHeight: 1.6 }}>{getUnitDef(id).skill.description}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, margin: '25px 0' }}>
          {Object.entries(ACTIONS).map(([key, label]) => <button key={key} className={action === key ? 'btn-primary' : ''} onClick={() => setAction(key as AnimationName)}>{label}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { if (!paused) setFrame(timeline.current); setPaused(!paused); }}>{paused ? '재생' : '일시정지'}</button>
          <button onClick={() => setFacing(-facing)}>방향 반전</button>
          <button onClick={() => setSpeed(speed === 1 ? 2 : 1)}>{speed}×</button>
        </div>
      </div>
    </div>
  </div>;
}
