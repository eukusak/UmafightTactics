/**
 * 레이스 도움말 — the main-menu explanation of the race system.
 *
 * Deliberately not reachable from a running match: a player mid-round needs the
 * prep-phase side panel, which already translates the round's own conditions
 * for their board. This is the reference you read before you play, so it lives
 * with the codex rather than over the field.
 *
 * Every number on screen is read from the definitions the engine applies, via
 * `guide.ts`. Nothing here is transcribed by hand.
 */
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  GOING_ROWS, PACE_ROWS, WEATHER_ROWS, CLAUSE_ROWS, CLAUSE_ANY_CHANCE,
  MANDATE_ROWS, NAMED_MANDATE_COUNT, PHASE_ROWS, STYLE_CURVE_ROWS, STYLE_LABEL,
  type GuideRow,
} from '../../game/engine/race-plan/guide';
import type { RunStyle } from '../../game/engine/types';

type Tab = 'BASICS' | 'GOING' | 'PACE' | 'WEATHER' | 'CLAUSE' | 'MANDATE';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'BASICS', label: '구간과 각질' },
  { id: 'GOING', label: '마장' },
  { id: 'PACE', label: '페이스' },
  { id: 'WEATHER', label: '날씨' },
  { id: 'CLAUSE', label: '개최 특례' },
  { id: 'MANDATE', label: 'GⅠ 과제' },
];

const signed = (n: number): string => `${n > 0 ? '+' : ''}${n}%`;

function RowCard({ row, children }: { row: GuideRow; children?: React.ReactNode }): JSX.Element {
  return (
    <article className="guide-card">
      <header>
        <h3>{row.name}</h3>
        {row.chance !== null && <span className="guide-chance">{row.chance}%</span>}
      </header>
      <p className="guide-note">{row.note}</p>
      {children}
      {row.lines.length > 0 && (
        <ul className="race-effects">{row.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
      )}
      {row.extra && <p className="guide-extra">등장 마장 · {row.extra}</p>}
    </article>
  );
}

export function GuideScreen(): JSX.Element {
  const setScreen = useGameStore((s) => s.setScreen);
  const [tab, setTab] = useState<Tab>('BASICS');

  return (
    <div className="guide-screen">
      <div className="hud-top">
        <h1 className="menu-title" style={{ fontSize: 26, margin: 0 }}>레이스 도움말</h1>
        <span className="muted">전투가 곧 한 판의 경마입니다</span>
        <button className="btn-ghost" style={{ marginLeft: 'auto' }}
          onClick={() => setScreen('MAIN_MENU')}>메인 메뉴</button>
      </div>

      <div className="guide-tabs" role="tablist" style={{ marginTop: 84 }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="guide-body scroll">
        {tab === 'BASICS' && <>
          <section>
            <h2>전투는 다섯 구간으로 흐릅니다</h2>
            <p className="guide-note">
              진행도는 시계 · 양쪽 전열 붕괴 · 양쪽 체력 소모 가운데 가장 앞선 것으로 정해집니다.
              한쪽이 빠르게 무너지면 시계와 상관없이 최종 직선이 열립니다.
            </p>
            <table className="guide-table">
              <thead><tr><th>구간</th><th>언제</th><th>진행도</th></tr></thead>
              <tbody>
                {PHASE_ROWS.map((p) => (
                  <tr key={p.id}><td className="gold-text">{p.name}</td><td>{p.when}</td><td>{p.at}</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2>각질은 구간마다 값이 다릅니다</h2>
            <p className="guide-note">
              능력치가 바뀌는 것이 아니라 <strong>그 구간에서 주고받는 피해</strong>가 바뀝니다.
              각질을 가진 보드 위 모든 기물에 걸립니다.
            </p>
            <table className="guide-table">
              <thead>
                <tr><th>각질</th>{PHASE_ROWS.map((p) => <th key={p.id}>{p.name}</th>)}</tr>
              </thead>
              <tbody>
                {STYLE_CURVE_ROWS.map((row) => (
                  <tr key={row.style}>
                    <td className="gold-text">{row.name}</td>
                    {row.phases.map((p, i) => (
                      <td key={i} className={p.dealt > 0 ? 'up' : p.dealt < 0 ? 'down' : ''}>
                        {signed(p.dealt)}
                        {p.resist !== 0 && <span className="guide-resist"> (방 {signed(p.resist)})</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="guide-extra">괄호 없는 값은 주는 피해, 괄호는 받는 피해 감소입니다.</p>

            <div className="guide-grid">
              {STYLE_CURVE_ROWS.map((row) => (
                <article key={row.style} className="guide-card">
                  <header><h3>{row.name}</h3></header>
                  <p className="guide-note">{row.summary}</p>
                  <p className="guide-extra">승부수 · {row.signature.nameKo}</p>
                  <ul className="race-effects"><li>{row.signature.descriptionKo}</li></ul>
                </article>
              ))}
            </div>
          </section>
        </>}

        {tab === 'GOING' && <section>
          <h2>마장 — 땅 상태</h2>
          <p className="guide-note">매 라운드 새로 정해지고, 로비 전원이 같은 땅에서 달립니다.</p>
          <div className="guide-grid">{GOING_ROWS.map((r) => <RowCard key={r.id} row={r} />)}</div>
        </section>}

        {tab === 'PACE' && <section>
          <h2>페이스 — 각질 곡선 자체를 휘게 합니다</h2>
          <p className="guide-note">
            숫자를 더하는 것이 아니라 각질 곡선 전체에 곱합니다. 이 게임에서 한 축이 만드는
            가장 큰 차이입니다.
          </p>
          <div className="guide-grid">
            {PACE_ROWS.map((r) => (
              <RowCard key={r.id} row={r}>
                <table className="guide-table compact">
                  <thead>
                    <tr>{(Object.keys(STYLE_LABEL) as RunStyle[]).map((s) => <th key={s}>{STYLE_LABEL[s]}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr>
                      {(Object.keys(STYLE_LABEL) as RunStyle[]).map((s) => (
                        <td key={s} className={r.scale[s] > 1 ? 'up' : r.scale[s] < 1 ? 'down' : ''}>
                          ×{r.scale[s]}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </RowCard>
            ))}
          </div>
        </section>}

        {tab === 'WEATHER' && <section>
          <h2>날씨</h2>
          <p className="guide-note">마장에 따라 뽑힐 수 있는 날씨가 다릅니다. 비는 마른 땅에 오지 않습니다.</p>
          <div className="guide-grid">{WEATHER_ROWS.map((r) => <RowCard key={r.id} row={r} />)}</div>
        </section>}

        {tab === 'CLAUSE' && <section>
          <h2>개최 특례</h2>
          <p className="guide-note">
            약 {CLAUSE_ANY_CHANCE}% 확률로 하나가 붙습니다. 수치가 아니라 규칙을 바꿉니다.
          </p>
          <div className="guide-grid">{CLAUSE_ROWS.map((r) => <RowCard key={r.id} row={r} />)}</div>
        </section>}

        {tab === 'MANDATE' && <section>
          <h2>GⅠ 과제</h2>
          <p className="guide-note">
            매치 시작에 GⅠ 하나가 뽑히고 8명 전원이 같은 경기에 출주합니다. 거리 · 잔디/더트 ·
            직선 길이에서 과제가 정해지며, {NAMED_MANDATE_COUNT}개 대회는 전용 과제를 가집니다.
          </p>
          <div className="guide-grid">
            {MANDATE_ROWS.map((r) => (
              <RowCard key={r.id} row={r}>
                <p className="guide-extra">
                  {r.races.length}개 대회 · {r.races.slice(0, 3).join(', ')}
                  {r.races.length > 3 ? ` 외 ${r.races.length - 3}개` : ''}
                </p>
              </RowCard>
            ))}
          </div>
        </section>}
      </div>
    </div>
  );
}
