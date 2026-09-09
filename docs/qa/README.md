# 2026-09-08 온라인 화면 검사

Chromium 1366×768, 독립 컨텍스트 8개에서 실제 로비 버튼으로 생성/코드 참가/준비/시작했다. 각 컨텍스트는 별도의 WebSocket과 sessionStorage 좌석을 사용했다. 준비·선택 단계의 서버 시계만 테스트에서 앞당기고 실제 전투 프레임은 실시간으로 수신/재생했다.

`online-report.json`: 각 좌석의 실제 프레임 수/재생 시간, DAMAGE 전후 action/actionAt 변경 관찰, p4 재접속, 2라운드 전환, 콘솔·깨진 이미지 결과. 미래 프레임 비전송, 명령 소유권, 중복/오래된 명령, 8개 최종 순위까지의 검사는 `tests/online.test.ts`와 `tests/websocket.test.ts`에서 재현한다.

- online-lobby.png: 8명 준비 완료
- online-prep.png: 1-1 준비와 공유 공간
- online-battle.png: 실시간 전투·피해 숫자·진행 정보
- online-result.png: 서버 정산과 다음 라운드 대기

싱글플레이의 배치→전투→설정 복귀→건너뛰기/결과→정찰, 10배속 자연 종료→자동 다음 라운드도 별도로 확인했다. 프로덕션 Node 서버의 /health, /, 컷인 PNG 응답을 검사했다. 외부 WAN/장시간 운영/부하 검증은 수행하지 않았다.
