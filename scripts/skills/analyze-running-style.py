"""Audit running style from early-corner positions, never from final placing."""
import hashlib, json, pathlib, re, sqlite3, statistics, sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
src=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'docs/qa/skill-race-source.sqlite3'
raw=src.read_bytes()
assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()=='e0aee26ca7353d897e96a8da8bd16c277428eef6'
db=sqlite3.connect(src); db.row_factory=sqlite3.Row
units=json.loads((ROOT/'src/data/generated/all-units.json').read_text(encoding='utf8'))['units']
corrections=json.loads((ROOT/'src/data/manual/running-style-corrections.json').read_text(encoding='utf8'))['units']
result={}
for u in units:
 rows=[]
 for row in db.execute('select race_id,race_date,race_name,field_size,passage,finish_rank from race_history where horse_id=? order by race_date',(u['horseId'].removeprefix('H-'),)):
  r=dict(row); positions=[int(n) for n in re.findall(r'\d+',r['passage'] or '')]
  field=r['field_size']
  if not field or field<6 or len(positions)<2 or any(n<1 or n>field for n in positions) or '障害' in r['race_name']: continue
  early=statistics.mean(positions[:2]); fraction=(early-1)/(field-1)
  style='nige' if early<=1.5 else 'senko' if fraction<=.35 else 'sashi' if fraction<=.67 else 'oikomi'
  rows.append({**r,'earlyMean':round(early,2),'earlyFraction':round(fraction,3),'observedStyle':style})
 counts={s:sum(r['observedStyle']==s for r in rows) for s in ['nige','senko','sashi','oikomi']}
 dominant=max(counts,key=counts.get); confidence=counts[dominant]/len(rows) if rows else 0
 prior=corrections.get(u['id'],{}).get('from',u['source']['primaryStyle'])
 examples=sorted([r for r in rows if r['observedStyle']==dominant],key=lambda r:(r['finish_rank'] or 99,r['race_date']))[:5]
 result[u['id']]={'horseId':u['horseId'],'name':u['nameKo'],'previous':prior,'validStarts':len(rows),'counts':counts,'dominant':dominant,'confidence':round(confidence,3),'medianEarlyFraction':round(statistics.median(r['earlyFraction'] for r in rows),3) if rows else None,'evidenceRaces':examples}
payload={'format':'uft-running-style-evidence-v1','sourceGitBlob':'e0aee26ca7353d897e96a8da8bd16c277428eef6','policy':'At least 6 starters and two valid passage positions. Mean of first two corners: leader <=1.5, then normalized fraction <=.35 pace / <=.67 stalk / else closer. This is an auditable proxy, not a claim that a horse always uses one tactic. Manual changes need 8+ starts and 60% support.','units':result}
(ROOT/'src/data/manual/running-style-evidence.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps([{'id':id,**{k:r[k] for k in ['name','previous','validStarts','dominant','confidence','counts']}} for id,r in result.items() if r['previous']!=r['dominant'] and r['validStarts']>=8 and r['confidence']>=.6],ensure_ascii=False,indent=2))
