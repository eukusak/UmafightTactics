"""Extract auditable racing evidence from the pinned UmaRogue SQLite snapshot."""
import hashlib, json, sqlite3, sys, pathlib, re
ROOT=pathlib.Path(__file__).resolve().parents[2]
source=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'docs/qa/skill-race-source.sqlite3'
raw=source.read_bytes()
blob=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
assert blob=='e0aee26ca7353d897e96a8da8bd16c277428eef6', 'Unexpected upstream database'
c=sqlite3.connect(source); c.row_factory=sqlite3.Row
units=json.loads((ROOT/'src/data/generated/all-units.json').read_text(encoding='utf8'))['units']
# Explicit iconic performances; selection must exist in the actual history.
picks={'silence_suzuka':('1998','毎日王冠'),'oguri_cap':('1990','有馬記念'),'tokai_teio':('1993','有馬記念'),'special_week':('1999','天皇賞(秋)'),'orfevre':('2013','有馬記念'),'gold_ship':('2012','菊花賞'),'rice_shower':('1995','天皇賞(春)'),'mejiro_mcqueen':('1992','天皇賞(春)'),'kitasan_black':('2017','天皇賞(秋)'),'twin_turbo':('1993','オールカマー'),'nice_nature':('1994','高松宮杯'),'symboli_kris_s':('2003','有馬記念'),'almond_eye':('2020','ジャパンC'),'gentildonna':('2014','有馬記念'),'buena_vista':('2011','ジャパンC'),'stay_gold':('2001','香港'),'taiki_shuttle':('1998','ジャック'),'el_condor_pasa':('1999','サンクルー'),'grass_wonder':('1999','有馬記念'),'narita_brian':('1994','菊花賞'),'tm_opera_o':('2000','有馬記念'),'duramente':('2015','東京優駿'),'satono_diamond':('2016','有馬記念'),'chrono_genesis':('2021','宝塚記念')}
def distance(m): return 'sprinter' if m<=1400 else 'miler' if m<=1800 else 'middle' if m<=2400 else 'stayer'
def grade(r):
 g=r['race_name'].replace('Ⅰ','I').replace('Ⅱ','II').replace('Ⅲ','III')
 # The upstream grade column sometimes calls GII/GIII GI; trust the explicit name first.
 m=re.search(r'\((GIII|GII|GI|G3|G2|G1|JpnIII|JpnII|JpnI)\)',g)
 key=m.group(1) if m else (r['grade'] or '')
 return {'GI':6,'G1':6,'JpnI':6,'GII':3,'G2':3,'JpnII':3,'GIII':2,'G3':2,'JpnIII':2}.get(key,1)
out={}; misses=[]
for u in units:
 rows=[dict(r) for r in c.execute('select race_id,race_date,race_name,grade,racecourse,surface,distance_m,finish_rank,field_size,popularity,margin,passage,final_3f,prize_10k_yen from race_history where horse_id=? order by race_date',(u['horseId'].removeprefix('H-'),))]
 valid=[r for r in rows if r['finish_rank'] and r['finish_rank']>0]; wins=[r for r in valid if r['finish_rank']==1]
 ranked=sorted(wins or valid,key=lambda r:(-r['finish_rank'],grade(r),r['prize_10k_yen'] or 0,r['race_date']),reverse=True)
 chosen=ranked[0] if ranked else None; why='승리 중 등급·상금·최근 경기 순' if wins else '승리 기록 없음: 확인 가능한 최고 착순' if ranked else '개별 경기 기록 없음: 원본 경력 요약만 사용'
 if u['id'] in picks:
  year,name=picks[u['id']]; found=[r for r in wins if r['race_date'].startswith(year) and name in r['race_name']]
  if found: chosen=found[-1]; why='실제 기록에서 확인한 대표 경기 수동 선정: '+year+' '+name
  else: misses.append(u['id'])
 dist={k:0 for k in ['sprinter','miler','middle','stayer']}; front=late=0
 for r in wins:
  if r['distance_m']: dist[distance(r['distance_m'])]+=grade(r)
  positions=[int(x) for x in re.findall(r'\d+',r['passage'] or '')]
  if positions and r['field_size']:
   front+=positions[-1]<=max(2,r['field_size']*.3)
   late+=positions[-1]>=r['field_size']*.6
 dominant=max(dist,key=dist.get); total=sum(dist.values())
 recommendation=dominant if len(wins)>=3 and total and dist[dominant]/total>=.55 else None
 out[u['id']]={'horseId':u['horseId'],'name':u['nameKo'],'recordedRaces':len(rows),'recordedWins':len(wins),'selectionReason':why,'representative':chosen,'otherTopResults':[r for r in ranked[:5] if r!=chosen],'distanceWinWeights':dist,'frontWins':front,'closingWins':late,'distanceRecommendation':recommendation,'sourceHistoryConfidence':u['source']['dataConfidence']}
payload={'format':'uft-race-evidence-v1','repository':'https://github.com/eukusak/UmaRogue','commit':'b53aab53a96626187bc9877dacd4a0cab5d94275','path':'data_pipeline/source/uma_rogue_jpn.sqlite3','gitBlob':blob,'sha256':hashlib.sha256(raw).hexdigest(),'sourceRaceCount':c.execute('select count(*) from race_history').fetchone()[0],'selectionPolicy':'Explicit verified iconic races; otherwise wins ranked by grade, prize and recency. Never describe a non-win as a victory. Distance recommendations need at least three wins and 55% weighted support.','units':out}
(ROOT/'src/data/manual/race-evidence.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'units':len(out),'withRace':sum(v['representative'] is not None for v in out.values()),'manualPickUnavailable':misses,'distanceChanges':[(u['id'],u['source']['bestDistance'],out[u['id']]['distanceRecommendation']) for u in units if out[u['id']]['distanceRecommendation'] and u['source']['bestDistance']!=out[u['id']]['distanceRecommendation']]},ensure_ascii=True))
