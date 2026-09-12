import fs from 'node:fs/promises';
const dir = 'docs/art-source/motions/identity-revisions-2026-09-12';
const path = dir + '/roster-review.json';
const audit = JSON.parse(await fs.readFile(path, 'utf8'));
const rows = Object.entries(audit.units);
audit.integratedCount = rows.filter(([, u]) => u.status === 'integrated').length;
await fs.writeFile(path, JSON.stringify(audit, null, 2) + '\n');
const body = `# 초상화·기물 외형 전체 검토\n\n145명 대조: **54명 수정 대상 / 91명 유지 / ${audit.integratedCount}명 실제 이미지 반영**. 완료 전까지 Draft PR입니다.\n\n초상화를 외형 기준으로 삼고 수정 대상의 24프레임(대기·이동·공격·스킬·쓰러짐·승리)을 교체합니다. 스킬 데이터와 발동 타이밍은 유지합니다.\n\n## 복구 결과\n\nPR12는 병합되었으며 PR13의 초기 커밋에는 명단 README만 있었습니다. 이전 대화에 기록된 로컬 반영 6명과 생성본은 현재 저장소/작업 폴더에서 확인되지 않았으므로 완료 수에 포함하지 않습니다. 아래 상태는 실제 커밋 가능한 PNG·검수·패킹 기록만 집계합니다. 기존 명단 51명에 땋은 머리/앞머리 컬 누락이 확인된 카렌 부케도르, 사쿠라 치토세 오, 다이이치 루비를 추가했습니다.\n\n## 수정 대상\n\n| 캐릭터 | ID | 외형 수정 기준 | 현재 상태 |\n| --- | --- | --- | --- |\n${rows
  .filter(([, u]) => u.decision === 'revise')
  .map(([id, u]) => `| ${u.name} | ${id} | ${u.reason} | ${u.status} |`)
  .join('\n')}\n\n## 유지 대상 91명\n\n${rows
  .filter(([, u]) => u.decision === 'retain')
  .map(([, u]) => u.name)
  .join(
    ', ',
  )}\n\n## 검수 및 추적\n\n[전체 145명 판정과 기준 해시](roster-review.json), [외형별 생성 지침](identity-briefs.json). 캐릭터별 승인 파일에 원본·생성 프롬프트·실제 알파 검사·24포즈 검토와 패킹 경로를 기록합니다. 미승인 생성본은 게임에 연결하지 않습니다. 테스트 통과와 이미지 제작 완료는 별도로 집계합니다.\n`;
await fs.writeFile(dir + '/README.md', body);
await fs.writeFile(
  'docs/art-source/motions/identity-revisions-2026-09-11/README.md',
  `# 이전 외형 수정 체크포인트\n\n이 문서에 기록되었던 로컬 6명 반영/12명 알파 대기 상태는 실제 이미지 파일을 복구하지 못해 완료로 인정하지 않습니다. PR13 초기 커밋 847fc5a에는 이 README만 존재했습니다.\n\n[현재 145명 검토 및 54명 수정 진행표](../identity-revisions-2026-09-12/README.md)를 확인하세요. 현재 상태와 검증 결과는 그 문서와 캐릭터별 실제 파일을 기준으로 합니다.\n`,
);
console.log({ reviewed: 145, targets: 54, integrated: audit.integratedCount });
