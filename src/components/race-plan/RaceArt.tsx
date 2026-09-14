import { useEffect, useState, type CSSProperties } from 'react';
import { assetUrl } from '../../game/ui/art';
import { RACE_ART, raceArtFrame, raceArtPosition, raceArtUrl, g1CrestKey, courseArtKey } from '../../game/ui/race-art';
import type { G1Theme } from '../../game/engine/race-plan/types';
import { conditionNotes, type RaceConditions } from '../../game/engine/race-plan/conditions';

/** Static images do not load an animation clock. Missing downloads retain text. */
export function RaceArt({ name, className = '', style }: { name: string; className?: string; style?: CSSProperties }): JSX.Element | null {
  const [failed, setFailed] = useState(false);
  const url = raceArtUrl(name);
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? <img className={`race-art ${className}`} src={url} alt="" aria-hidden="true" draggable={false} onError={() => setFailed(true)} style={style} /> : null;
}

/** CSS loop for preparation markers only; battle animations use recorded time. */
export function ExposedMarker({ enemy }: { enemy: boolean }): JSX.Element | null {
  const key = enemy ? 'exposed_marker_target' : 'exposed_marker_warn';
  const url = raceArtUrl(key);
  return <span className="race-exposed" title={enemy ? '무방비 캐리 · 브루저 돌입 표적' : '무방비 캐리 · 옆에 탱커나 브루저를 배치하세요'}>
    <span className="race-exposed-fallback" />
    {url && <span className="race-exposed-sheet" style={{ backgroundImage: `url("${url}")` }} />}
  </span>;
}

export function RaceSprite({ name, seconds, loop = false, className = '' }: { name: string; seconds: number; loop?: boolean; className?: string }): JSX.Element | null {
  const a = RACE_ART[name], url = name.startsWith('weather_') ? assetUrl('race/' + name + '@half.png') : raceArtUrl(name);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!a || !url) return null;
  const frame = raceArtFrame(name, seconds, loop, reduced);
  return <span aria-hidden="true" className={`race-sprite ${className}`} style={{ aspectRatio: `${a.w}/${a.h}`, backgroundImage: `url("${url}")`, backgroundSize: `${a.cols * 100}% ${a.rows * 100}%`, backgroundPosition: raceArtPosition(name, frame) }} />;
}

export function RaceConditionsStrip({ conditions }: { conditions: RaceConditions }): JSX.Element {
  const keys = [`cond_going_${conditions.going.toLowerCase()}`, `cond_weather_${conditions.weather.toLowerCase()}`, `cond_pace_${conditions.pace.toLowerCase()}`, `cond_clause_${conditions.clause.toLowerCase()}`];
  return <div className="race-conditions-strip">{conditionNotes(conditions).map((note, i) => <span key={keys[i]} title={note.note}><RaceArt name={keys[i]} /><b>{note.label}</b></span>)}</div>;
}
export function G1Crest({ theme }: { theme: G1Theme }): JSX.Element {
  const course = courseArtKey(theme.racecourse);
  return <span className="race-g1-art"><RaceArt name={g1CrestKey(theme)} />{course && <RaceArt name={course} className="race-course-mark" />}</span>;
}
