# Render 분리 배포 (PR22)

## 병합 전: 기존 서비스 자동 배포 중지

이번 변경 이후 `npm start`는 정적 파일을 제공하지 않는다. 기존 통합 Web Service가 main을 자동 배포하면 게임 주소가 JSON 상태 화면으로 바뀔 수 있으므로 **기존 서비스 Auto-Deploy를 먼저 끈다**. 기존 정상 배포는 새 사이트 검증이 끝날 때까지 유지한다. PR 자체는 운영 리소스를 생성·변경하지 않는다.

## 구성

| 서비스 | 설정 | 용도 |
|---|---|---|
| umafight-frontend | type web / runtime static / dist | React, Phaser, 이미지, 폰트, BGM/SFX CDN |
| umafight-multiplayer | type web / runtime node / Singapore / free / 1 instance | health + WebSocket + 권한 있는 경기 판정 |

기존 Node 서비스를 Static Site로 변환하지 않는다. 두 서비스는 새 이름으로 만들며 자동 배포는 off로 시작한다. 기존 서비스의 실제 region·디스크·도메인은 대시보드에서 먼저 확인한다. Blueprint의 Singapore는 새 서버의 제안 지역이며 기존 리소스의 region을 변경하는 설정이 아니다. 기존 사용 URL을 유지하려면 사용자 지정 도메인을 새 Static Site에 연결한다. Render 기본 onrender.com 주소를 그대로 이전할 수 있다고 가정하지 않는다.

## 전환 순서

1. 기존 서비스의 현재 배포 커밋과 설정을 기록하고 자동 배포를 끈다. 진행 중 경기를 종료할 시간을 둔다.
2. PR을 병합하고 Blueprint로 두 서비스를 만든다. 기존 서비스와 이름이 겹치지 않는지 확인한다. 원치 않는 유료 서비스/디스크는 생성하지 않는다.
3. 새 Web Service: `npm ci --omit=dev` / `npm run start:server` / health `/health`. `NODE_ENV=production`, `ALLOWED_ORIGINS=https://<실제 프런트 주소>`. 주소 예약 후 값이 확정되면 서버를 배포한다. 주소가 아직 없으면 임의 allow-all로 시작하지 말고 배포를 보류한다.
4. 새 Static Site: `npm ci --include=dev && npm run build` / publish `dist`. `VITE_MULTIPLAYER_URL=wss://<실제 백엔드 주소>/multiplayer`를 지정하고 빌드한다. 이 값은 공개 빌드 설정이며 토큰을 넣지 않는다. URL 변경은 재빌드가 필요하다.
5. 서로의 실제 URL을 확인한다. Preview/custom domain은 `ALLOWED_ORIGINS`에 정확한 origin으로 추가한다. 쉼표 구분, 경로·마지막 slash·와일드카드 금지. Internal hostname/fromService host는 브라우저가 접근할 수 없으므로 사용하지 않는다.
6. 아래 확인을 통과한 뒤 게임 링크/사용자 지정 도메인을 프런트로 전환한다. 그 후 원하는 서비스만 자동 배포를 켠다. 기존 서버 종료는 새 배포 확인 후 별도로 수행한다.

## 외부 배포 확인

- 백엔드 `GET /health` → 200, `service: multiplayer`. `/assets/audio/title.mp3`, 이미지, JS, 임의 SPA 경로 → 404. 백엔드에서 gzip MP3/JS를 스트리밍하지 않아야 한다.
- 프런트 새 브라우저 → 제목/메뉴/도감/전투/결과/모바일. 제목 화면 Network에 Phaser·전체 모션·BGM 재생목록 선행 다운로드가 없어야 한다.
- 프런트 origin에서 WebSocket 방 생성, 2인 및 8인 시작, AI 채움, 관전, 연결 끊김 후 기존 좌석 복구. 다른 origin이나 Origin 없는 연결은 403.
- `curl -I https://<frontend>/assets/audio/title.mp3` 및 `curl -I -H "Range: bytes=0-1023" https://<frontend>/assets/audio/title.mp3`: audio/mpeg, 두 번째 206 / Content-Range 확인. 로컬 Range 시험은 CDN 검증을 대체하지 않는다.
- 해시 JS/CSS/폰트 `/bundled/*`는 1년 immutable. 고정 파일명 `/assets/*`는 1시간 재검증, 게임의 빌드 버전 query도 유지한다. HTML은 no-cache. Service Worker는 추가하지 않았다.
- ENABLE_SERVER_METRICS=true 로그: 30초 간격 rooms/sockets/players, RSS/heap, CPU, tick drift, event loop p99, 메시지·JSON payload bytes·프레임 batches/sec. bytesPerSecond는 압축 전 payload이며 실제 선로 바이트는 test:load의 wireBytesPerSecond를 확인한다. CPU 수치는 단일 코어 100% 기준이며 로컬 PC 값은 Render 무료 인스턴스 성능을 뜻하지 않는다.

## 빌드와 로컬 사용

`npm ci && npm run build` 후 `npm run start:local`은 통합 미리보기, `npm run dev`는 Vite+로컬 WebSocket이다. 로컬 localhost/127.0.0.1/::1에만 same-origin fallback이 있다. 외부 주소는 VITE_MULTIPLAYER_URL을 반드시 설정한다.

별도 경로 시험: PORT=4174로 `npm run start:server`, VITE_MULTIPLAYER_URL=ws://127.0.0.1:4174/multiplayer로 프런트를 빌드하고 PORT=4173으로 `npm run start:static`. 서버 ALLOWED_ORIGINS=http://127.0.0.1:4173. PowerShell에서는 명령 앞 변수를 `$env:PORT='4174'`처럼 지정한다.

서버는 프런트 빌드/FFmpeg가 필요 없다. ffmpeg-static은 개발 의존성이며 Static Site 빌드에서만 다운로드·사용한다. 빌드 머신은 npm과 해당 FFmpeg GitHub 릴리스에 접근할 수 있어야 한다. 음악 인코딩은 원본 SHA-256을 키로 .cache/audio-160k-v1에 캐시하며, 인코딩 옵션 변경 시 캐시 버전을 올린다. 음악 원본은 public/assets/audio, 배포 파일은 dist/assets/audio의 160kbps MP3이다. 제목곡과 23곡을 포함하며 효과음은 재인코딩하지 않는다. dist/audio-build-report.json에 실제 크기가 기록된다. npm 설치 후 자동 프런트 빌드는 하지 않는다.

## 제한과 롤백

- 무료 서버의 유휴 절전/콜드 스타트·CPU 한계는 구조 개선으로 없어지지 않는다. 유료 전환은 계측 후 판단하며 이 PR에서 구매하지 않는다.
- 서버는 기존처럼 라운드 전체 전투를 동기 계산한 뒤 50ms 시계로 재생한다. 100ms 전송 묶음은 판정 속도를 바꾸지 않는다. 동시 여러 방의 라운드 계산 시 tick drift가 남을 수 있으며 다음 단계는 worker thread/작업 분산 검토이다.
- WebSocket 압축은 유지하되 level 1 / memLevel 4 / 동시 2개 작업 / context takeover 비활성화로 CPU·메모리 사용을 제한한다. HTTP 정적 gzip은 백엔드에서 하지 않는다.
- 512KB 이상 대기열에서는 프레임 커서를 전진시키지 않고 재시도, 5초 지속 또는 4MB 초과면 1013 재접속. 재접속/관전 기록은 64프레임씩 현재 공개 시각까지만 복원한다. 점수·경제·보상은 서버가 판정한다.
- 이번에는 메시지 형식에 draft 증분을 추가했다. 기존 브라우저 탭은 새 백엔드로 자동 전환되지 않는다. 전환 시 새로고침을 안내하고 기존 서비스의 진행 중 경기를 강제로 옮기지 않는다.
- 인메모리 방은 서버 재시작 시 사라진다. 이미 영구 디스크와 ROOM_STATE_FILE이 있다면 [복구 문서](SERVER_RECOVERY.md)의 단일 프로세스·호환성 조건을 지킨다. 무료 신규 Blueprint에는 디스크를 추가하지 않는다.
- 문제 발생 시 게임 링크/사용자 지정 도메인을 이전 정상 통합 서비스로 되돌린다. 새 서버에 진행 중인 방이 있으면 사용자에게 종료를 안내한다. CDN 캐시 때문에 이전 프런트+새 프로토콜을 섞지 않는다.

## 근거

Render 공식 [Blueprint 문법](https://render.com/docs/blueprint-spec), [Static Site](https://render.com/docs/static-sites), [헤더 설정](https://render.com/docs/static-site-headers), [WebSocket](https://render.com/docs/websocket)을 확인했다. render.yaml은 공식 draft2020-12 JSON Schema로 검증했다. 실제 Render 리소스는 워크스페이스가 선택되지 않아 조회/생성하지 않았으며 위 외부 전환 검증은 배포 담당자가 수행해야 한다.
