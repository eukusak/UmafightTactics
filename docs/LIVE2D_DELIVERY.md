# 실제 Cubism 리깅 납품 조건

현재 저장소에는 실제 Cubism `.cmo3`, `.moc3`, `.model3.json` 모델이 없다. 투명 단일 전신과 Phaser Rope 변형은 독립 팔/다리/눈/머리카락 리깅을 대체하지 않는다. 이미지 생성 결과를 moc3 확장자로 바꾸거나 JSON만 추가해 리깅 완료로 처리하지 않는다.

실제 제작에는 부위가 분리되고 가려진 부분까지 그린 원화, Cubism Editor에서 만든 ArtMesh·디포머·파라미터·물리·키프레임, Editor에서 내보낸 모델이 필요하다. 현재 실행 환경에는 Cubism Editor나 모델 컴파일 도구가 없어 실제 모델 제작/내보내기를 수행하지 못했다.

## 기물별 제작 계약

- 눈/눈썹/입, 머리/귀/앞뒤 머리카락, 몸통, 좌우 상·하완/손, 좌우 허벅지/종아리/발, 치마 앞뒤, 꼬리·장식물을 독립 편집 가능하게 분리한다.
- Idle, Run, Attack, Skill, KO, Victory 모션을 만든다. **Hit/Flinch/Damage 모션은 만들거나 호출하지 않는다.** DAMAGE 판정은 체력/보호막/피해 숫자만 갱신한다.
- Attack은 엔진 ATTACK_START에서 시작하고 releaseAt에 타격 포즈가 도달한다. CAST는 스킬 동작으로 전환한다. 피격이 공격/스킬 모션 우선순위를 덮어쓰지 않는다.
- 같은 발 접지점과 카메라 투영을 유지하고 이동은 보드 좌표 보간이 소유한다. 모델 내부 동작 때문에 전체 기물의 세계 좌표가 밀리면 안 된다.
- 기본 자세→공격→이동, 연속 공격, 공격 중 피격, 사망/부활, 28기 편성의 가림·렌더 비용을 검사한다. 라이브러리 연동만으로 이 검수를 대신하지 않는다.

## 필요한 실제 납품 파일

편집용 원화와 `.cmo3`, 런타임 `.model3.json` 및 참조 `.moc3`/텍스처, `.motion3.json`, `.physics3.json`을 함께 버전 관리한다. Cubism Core/SDK를 배포하는 조건과 SDK 버전은 실제 모델 버전과 함께 결정해야 한다. 이 PR에는 Core나 실모델 로더를 가짜로 포함하지 않았다.

공식 설명: [Cubism 모델·모션 내보내기](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/) · [임베딩 데이터 내보내기](https://docs.live2d.com/en/cubism-editor-tutorials/exporting-data-for-embedding/).
