/** Title, main menu, match setup, settings and final result screens. */
import { useState } from 'react';
import { useGameStore, DEFAULT_KEYBINDS } from '../../store/gameStore';
import { DEFAULT_SEED } from '../../game/engine/constants';
import { SeasonPicker } from '../SeasonPicker';
import type { SeasonId } from '../../game/engine/seasons/catalog';
import { ROSTER_HASH } from '../../game/engine/roster';
import { seasonBackdrop } from '../../game/ui/season-art';

export function TitleScreen(): JSX.Element {
  const setScreen = useGameStore((s) => s.setScreen);
  return (
    <div className="menu-screen title-hero">
      <div className="eyebrow">FIVE SEASONS / TWINKLE ARENA</div>
      <h1 className="menu-title">Umafight<br />Tactics</h1>
      <div className="title-korean">말토체스</div>
      <p className="hero-description">최고의 레이스는, 최고의 팀에서.<br />나만의 조합으로 아레나의 정상을 향해.</p>
      <div className="menu-buttons">
        <button className="btn-primary" onClick={() => setScreen('MAIN_MENU')}>시작하기</button>
      </div>
      <div className="hero-meta"><div><strong>145</strong><span>전체 출전 캐릭터</span></div><div><strong>5</strong><span>서로 다른 시즌</span></div><div><strong>20</strong><span>새 시즌 시너지</span></div></div>
      <p className="muted" style={{ position: 'absolute', bottom: 26, fontSize: 12 }}>
        본 게임은 팬 제작 비공식 작품이며 Cygames와 무관합니다.
      </p>
    </div>
  );
}

export function MainMenu(): JSX.Element {
  const setScreen = useGameStore((s) => s.setScreen);
  const continueMatch = useGameStore((s) => s.continueMatch);
  const hasSave = useGameStore((s) => s.hasSavedMatch());
  const lastError = useGameStore((s) => s.lastError);

  return (
    <div className="menu-screen">
      <h1 className="menu-title" style={{ fontSize: 54 }}>트레이닝 센터</h1>
      <div className="menu-buttons">
        <button className="btn-primary" onClick={() => setScreen('MATCH_SETUP')}>새 게임</button>
        <button className="btn-primary" onClick={() => setScreen('ONLINE')}>온라인 대전 · 최대 8인</button>
        <button disabled={!hasSave} onClick={() => { continueMatch(); }}>이어하기</button>
        <button onClick={() => setScreen('COLLECTION')}>도감 (145명)</button>
        <button onClick={() => setScreen('MOTION')}>기물 모션 미리보기</button>
        <button onClick={() => setScreen('SETTINGS')}>설정</button>
        <button className="btn-ghost" onClick={() => setScreen('TITLE')}>뒤로</button>
      </div>
      {lastError && <div className="toast" style={{ top: 'auto', bottom: 60 }}>{lastError}</div>}
      <p className="muted" style={{ position: 'absolute', bottom: 20, fontSize: 11 }}>
        로스터 버전 {ROSTER_HASH}
      </p>
    </div>
  );
}

export function MatchSetup(): JSX.Element {
  const newMatch = useGameStore((s) => s.newMatch);
  const setScreen = useGameStore((s) => s.setScreen);
  const [name, setName] = useState('트레이너');
  const [seasonId, setSeasonId] = useState<SeasonId>('s1');
  const [seed, setSeed] = useState(String(DEFAULT_SEED));
  const [randomSeed, setRandomSeed] = useState(true);

  const start = (): void => {
    // A player-facing "random" seed still resolves to a concrete number so the
    // match stays reproducible and shareable.
    const value = randomSeed ? (Date.now() % 2_147_483_647) : Number(seed) || DEFAULT_SEED;
    newMatch(value, name.trim() || '트레이너', seasonId);
  };

  const inputStyle = {
    width: '100%', padding: 9, background: 'var(--panel-bright)', color: 'var(--text)',
    border: '2px solid var(--edge-light)', borderRadius: 6, fontFamily: 'inherit',
  } as const;

  return (
    <div className="menu-screen season-screen" style={seasonBackdrop(seasonId)}>
      <h1 className="menu-title" style={{ fontSize: 40, marginBottom: 12 }}>매치 설정</h1>
      <SeasonPicker value={seasonId} onChange={setSeasonId} />
      <div className="panel" style={{ padding: 16, width: 620, marginTop: 14 }}>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 5 }}>트레이너 이름</div>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <input type="checkbox" checked={randomSeed} onChange={(e) => setRandomSeed(e.target.checked)} />
          <span>무작위 시드 사용</span>
        </label>
        {!randomSeed && (
          <label style={{ display: 'block' }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 5 }}>시드</div>
            <input value={seed} onChange={(e) => setSeed(e.target.value)} style={inputStyle} />
          </label>
        )}
        <div className="muted" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>
          플레이어 1명 + AI 7명 · 시작 체력 100 · {seasonId.toUpperCase()} 출전 60명
        </div>
      </div>
      <div className="menu-buttons" style={{ marginTop: 18 }}>
        <button className="btn-primary" onClick={start}>게임 시작</button>
        <button className="btn-ghost" onClick={() => setScreen('MAIN_MENU')}>뒤로</button>
      </div>
    </div>
  );
}

export function SettingsScreen(): JSX.Element {
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const setScreen = useGameStore((s) => s.setScreen);
  const match = useGameStore((s) => s.match);
  const devMode = useGameStore((s) => s.devMode);
  const setDevMode = useGameStore((s) => s.setDevMode);
  const [rebinding, setRebinding] = useState<string | null>(null);

  const bindLabels: Record<string, string> = {
    reroll: '상점 새로고침', buyXp: '경험치 구매', sellHovered: '유닛 판매',
    toggleBench: '보드↔벤치', ownBoard: '내 보드 보기', prevPlayer: '이전 플레이어 관전',
    nextPlayer: '다음 플레이어 관전', battleInfo: '전투 정보', settings: '설정',
  };

  return (
    <div className="menu-screen" style={{ justifyContent: 'flex-start', paddingTop: 60 }}>
      <h1 className="menu-title" style={{ fontSize: 44 }}>설정</h1>
      <div className="panel scroll" style={{ padding: 22, width: 620, maxHeight: 720 }}>
        <h3 style={{ marginTop: 0 }}>전투</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
          <span className="muted">기본 재생 속도</span>
          {[1, 2, 4, 10].map((s) => (
            <button key={s} className={settings.battleSpeed === s ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setSettings({ battleSpeed: s as 1 | 2 | 4 | 10 })}>{s}×</button>
          ))}
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
          <input type="checkbox" checked={settings.showDamageNumbers}
            onChange={(e) => setSettings({ showDamageNumbers: e.target.checked })} />
          <span>피해량 표시</span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
          <input type="checkbox" checked={settings.autoContinue}
            onChange={(e) => setSettings({ autoContinue: e.target.checked })} />
          <span>전투 결과 확인 후 5초 뒤 자동 진행</span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
          <input type="checkbox" checked={devMode} onChange={(e) => setDevMode(e.target.checked)} />
          <span>개발자 패널</span>
        </label>

        <h3>키 바인딩</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          항목을 클릭한 뒤 새 키를 누르세요.
        </p>
        {Object.entries(settings.keybinds).map(([action, key]) => (
          <div key={action} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ width: 190 }}>{bindLabels[action] ?? action}</span>
            <button
              className={rebinding === action ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setRebinding(action)}
              onKeyDown={(e) => {
                if (rebinding !== action) return;
                e.preventDefault();
                setSettings({ keybinds: { ...settings.keybinds, [action]: e.key } });
                setRebinding(null);
              }}
            >
              {rebinding === action ? '키 입력…' : key === ' ' ? 'Space' : key}
            </button>
          </div>
        ))}
        <button className="btn-ghost" style={{ marginTop: 10 }}
          onClick={() => setSettings({ keybinds: { ...DEFAULT_KEYBINDS } })}>
          기본값 복원
        </button>
      </div>
      <div className="menu-buttons" style={{ marginTop: 16 }}>
        <button className="btn-primary" onClick={() => setScreen(match ? 'BATTLE' : 'MAIN_MENU')}>
          돌아가기
        </button>
      </div>
    </div>
  );
}

export function ResultScreen(): JSX.Element {
  const match = useGameStore((s) => s.match);
  const setScreen = useGameStore((s) => s.setScreen);
  const abandon = useGameStore((s) => s.abandonMatch);
  if (!match) return <div />;

  const ordered = (match.finalStandings ?? []).map((id) => match.players.find((p) => p.id === id)!);
  const human = match.players.find((p) => p.isHuman);

  return (
    <div className="menu-screen result-screen" style={{ justifyContent: 'flex-start', paddingTop: 50 }}>
      <h1 className="menu-title" style={{ fontSize: 48 }}>
        {human?.placement === 1 ? '우승!' : `${human?.placement ?? '-'}위`}
      </h1>
      <p className="menu-sub">최종 순위</p>
      <div className="panel" style={{ padding: 20, width: 620 }}>
        {ordered.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px',
            borderBottom: '1px solid #24384a',
            background: p.isHuman ? 'rgba(255,204,51,0.12)' : 'transparent',
          }}>
            <span style={{ width: 34, fontSize: 20, fontWeight: 800,
              color: i === 0 ? 'var(--gold)' : 'var(--muted)' }}>{i + 1}</span>
            <span style={{ flex: 1 }}>{p.name}</span>
            <span className="muted" style={{ width: 90 }}>{p.aiProfile ?? '플레이어'}</span>
            <span style={{ width: 60, textAlign: 'right' }}>체력 {Math.max(0, p.hp)}</span>
            <span className="muted" style={{ width: 44, textAlign: 'right' }}>L{p.level}</span>
          </div>
        ))}
      </div>
      <div className="menu-buttons" style={{ marginTop: 20 }}>
        <button className="btn-primary" onClick={() => { abandon(); setScreen('MATCH_SETUP'); }}>
          새 게임
        </button>
        <button className="btn-ghost" onClick={() => { abandon(); setScreen('MAIN_MENU'); }}>
          메인 메뉴
        </button>
      </div>
      <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
        시드 {match.seed} · {match.history.length} 라운드
      </p>
    </div>
  );
}
