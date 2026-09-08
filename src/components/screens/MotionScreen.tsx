import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { ALL_UNITS, getUnitDef } from '../../game/engine/roster';
import { PVE_UNIT_IDS } from '../../game/engine/battle/pve-units';
import { FRAME_CLIPS, FRAME_SHEETS, frameSheetUrl, motionFrame } from '../../game/ui/frame-animation';
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
  const [canvas, setCanvas] = useState(false);
  const [crowd, setCrowd] = useState(false);
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
      preload(): void {
        const sheet = FRAME_SHEETS[id];
        if (sheet) this.load.spritesheet('preview-body', frameSheetUrl(id)!, { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
        else this.load.image('preview-body', standeeUrl(id) ?? portraitUrl(id)!);
        this.load.on('loaderror', () => { if (alive) setStatus('이미지를 불러오지 못했습니다.'); });
      }
      create(): void {
        const count = crowd ? 28 : 1;
        for (let i = 0; i < count; i++) {
          const x = crowd ? 58 + (i % 7) * 99 : 360;
          const y = crowd ? 130 + Math.floor(i / 7) * 124 : 465;
          this.add.ellipse(x, y + 3, crowd ? 52 : 180, crowd ? 15 : 38, 0x07131e, .6);
          const body = this.add.image(x, y, 'preview-body').setOrigin(.5, .859375).setDisplaySize(crowd ? 116 : 420, crowd ? 116 : 420);
          this.sprites.push(body);
        }
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
        for (const sprite of this.sprites) {
          sprite.setFlipX(c.facing < 0);
          if (FRAME_SHEETS[id]) sprite.setFrame(motionFrame(c.action, cycle));
        }
      }
    }
    const game = new Phaser.Game({ type: canvas ? Phaser.CANVAS : Phaser.AUTO, width: 720, height: 550,
      parent: host.current, backgroundColor: '#183549', scene: Preview, audio: { noAudio: true },
      render: { antialias: false, pixelArt: true }, scale: { mode: Phaser.Scale.NONE },
      callbacks: { postBoot: game => { game.canvas.style.width = '100%'; game.canvas.style.height = '100%'; } } });
    return () => { alive = false; game.destroy(true); };
  }, [id, canvas, crowd]);

  return <div className="menu-screen" style={{ padding: 55, justifyContent: 'flex-start' }}>
    <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400 }}>기물 모션 미리보기</h1>
      <button onClick={() => back('MAIN_MENU')}>돌아가기</button>
    </div>
    <div style={{ display: 'flex', gap: 35, width: '100%' }}>
      <div className="panel" style={{ width: 1000, height: 765 }} ref={host} aria-label={`${getUnitDef(id).nameKo} 모션 화면`} />
      <div className="panel" style={{ flex: 1, padding: 30 }}>
        <label>기물 선택<select aria-label="기물 선택" value={id} onChange={e => setId(e.target.value)} style={{ width: '100%', margin: '12px 0 28px', padding: 12, background: '#173044', color: '#fff5df' }}>
          {ALL_UNITS.map(u => <option key={u.id} value={u.id}>{u.nameKo}</option>)}
          {Object.values(PVE_UNIT_IDS).map(key => <option key={key} value={key}>{getUnitDef(key).nameKo} (PvE)</option>)}
        </select></label>
        <p>{status}</p>
        <p style={{ lineHeight: 1.6 }}><strong>{getUnitDef(id).skill.displayName}</strong><br />{getUnitDef(id).skill.description}</p>
        {FRAME_SHEETS[id] && <p className="muted">{FRAME_SHEETS[id].skillReview}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, margin: '25px 0' }}>
          {Object.entries(ACTIONS).map(([key, label]) => <button key={key} className={action === key ? 'btn-primary' : ''} onClick={() => setAction(key as AnimationName)}>{label}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { if (!paused) setFrame(timeline.current); setPaused(!paused); }}>{paused ? '재생' : '일시정지'}</button>
          <button onClick={() => setFacing(-facing)}>방향 반전</button>
          <button onClick={() => setSpeed(speed === 1 ? 2 : 1)}>{speed}×</button>
        </div>
        <label style={{ display: 'block', margin: '30px 0' }}>장면 시간 {frame.toFixed(2)}초
          <input aria-label="장면 시간" type="range" min="0" max="1.99" step="0.01" value={frame}
            onChange={e => { setPaused(true); setFrame(Number(e.target.value)); }} style={{ display: 'block', width: '100%' }} />
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { setPaused(true); setFrame(Math.max(0, frame - 1 / FRAME_CLIPS[action].fps)); }}>이전 프레임</button>
          <button onClick={() => { setPaused(true); setFrame(Math.min(1.99, frame + 1 / FRAME_CLIPS[action].fps)); }}>다음 프레임</button>
        </div>
        <label style={{ display: 'block', margin: '20px 0' }}><input type="checkbox" checked={crowd} onChange={e => setCrowd(e.target.checked)} /> 28기 동시 미리보기</label>
        <label style={{ display: 'block', margin: '20px 0' }}><input type="checkbox" checked={canvas} onChange={e => setCanvas(e.target.checked)} /> 호환 렌더러 (Canvas)</label>
        <p className="muted" style={{ lineHeight: 1.8 }}>미리보기에서는 준비부터 회복까지 모든 포즈를 재생합니다. 전투의 공격 타격은 실제 발사 시각에, 즉시 발동 스킬은 시전 시각에 방출 포즈를 맞춥니다. 피격은 모션을 초기화하지 않습니다.</p>
      </div>
    </div>
  </div>;
}
