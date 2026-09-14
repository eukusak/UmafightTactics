# RACE PLAN — 데이터 임포트 리포트

> `npm run data:build`가 자동 생성한다. 직접 수정하지 않는다.

| 항목 | 값 |
|---|---:|
| 로스터 | 145 |
| horseId 조인 성공 | 145 |
| 조인 실패 | 0 |
| 코스 affinity 보유 | 80 (55.2%) |
| 마장상태 affinity 보유 | 22 (15.2%) |
| 계절 affinity 보유 | 87 (60.0%) |
| 각질 신뢰도 LOW | 7 |
| GⅠ 테마 | 30 |

## 각질 신뢰도 LOW (고유 승부수 생성 제외 대상)

- `maruzensky`
- `symboli_rudolf`
- `haru_urara`
- `mr_cb`
- `sirius_symboli`
- `mejiro_ramonu`
- `katsuragi_ace`

## 주의

- 마장상태(going) affinity 보유율이 낮으므로 going을 조건으로 쓰는 콘텐츠를 만들지 않는다.
- 적성 등급 문자는 표기 전용이다. 가중치는 `*Pct`(로스터 퍼센타일)만 사용한다.
