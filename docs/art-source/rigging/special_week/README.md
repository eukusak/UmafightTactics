# Special Week — 부분 분리 원화, 리깅 미완료

이번 납품은 **머리·몸통·치마·꼬리·손 5개 독립 생성 원화**다. `originals/`는 생성 결과 원본, `parts/`는 실제 알파 경계로 크롭하고 최대 460px로 축소한 편집용 부품이다. `special_week_partial_source.ora`에는 5개가 각각 독립 레이어로 들어 있다. `parts-board.png`는 이 파일의 부품 배치 미리보기다. 이 배치 좌표는 부품 목록을 보기 위한 좌표이며 모델의 관절/조립 좌표가 아니다.

**조립된 캐릭터, 모션, Cubism 프로젝트 또는 런타임 모델이 아니다.** 게임의 기존 전신 이미지를 대체하지 않으며 46프레임 전투 시트 완료 수에 포함하지 않는다.

## 열기와 후속 제작

OpenRaster 지원 편집기(Krita/GIMP 등)에서 `.ora`를 열어 레이어를 편집할 수 있다. Cubism은 ORA를 직접 모델 원화로 가져오지 않는다. 나머지 부품을 완성하고 정면 자세로 조립·크기 조정한 뒤 RGB 8bit PSD로 저장해 Cubism에 가져와야 한다.

- 머리에는 눈·입·귀·앞뒤 머리카락이 함께 그려져 있다. 눈 깜빡임/표정/머리카락 물리를 위한 추가 분리가 필요하다.
- 팔/다리/신발 원화, 앞뒤 치마 분리, 가려진 부분과 관절 겹침 검수가 남아 있다.
- 몸통과 치마의 허리 장식이 중복되므로 조립 시 어느 레이어가 허리 장식을 소유할지 정리해야 한다.
- 좌우 독립 원화, 관절 크기·앵커 정렬, PSD 조립이 완료되지 않았다.
- Cubism ArtMesh, 디포머, 파라미터, 물리, Idle/Run/Attack/Skill/KO/Victory 모션과 cmo3/moc3/model3 내보내기가 남았다.
- Hit/Flinch/Damage 모션은 만들지 않는다. 피격으로 공격/스킬을 초기화하지 않는 기존 규칙을 유지한다.

## 제작 기록

내장 image_gen 사용. 참고: `public/assets/characters/standees/special_week.png`, `public/assets/characters/reference_previews/special_week.png`.

공통 지시: `One isolated transparent PNG 2D puppet component of Special Week; smooth cel-shaded anime; neutral front-facing bind pose; faithful supplied costume and identity; one component only; painted overlap ends; opaque interior and real alpha-zero surrounding space; no labels, effects or environment.`

- head: short dark bob, white forelock, violet eyes, horse ears, purple ribbon, short neck stem.
- torso: sleeveless white/pink jacket vest, blue collar, purple neck ribbon, purple corset with gold lacing, no head/arms/skirt.
- skirt: white pleats, purple/pink ruffled hem, waist overlap, no legs or torso.
- tail: long dark-brown curved horse tail with rounded root, no body.
- hand: one relaxed hand pointing down, rounded wrist overlap, five fingers, no forearm.

16부품 아틀라스 생성/수정 3회는 RGB 체크무늬 배경으로 실패하여 납품에서 제외했다. 개별 팔 생성은 이미지 도구의 안전 필터에서 거절되어 완성 부품으로 세지 않았다. 현재 환경에 Cubism Editor/컴파일 도구가 없어 실모델 제작/내보내기도 수행하지 못했다.

공식 형식 참고: [OpenRaster 파일 규격](https://www.openraster.org/baseline/file-layout-spec.html), [레이어 규격](https://www.openraster.org/baseline/layer-stack-spec.html), [Cubism PSD 조건](https://docs.live2d.com/en/cubism-editor-manual/precautions-for-psd-data/), [부위 분리](https://docs.live2d.com/en/cubism-editor-manual/divide-the-material/).
