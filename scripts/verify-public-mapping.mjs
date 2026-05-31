import { findLearningTargets, findStandards, getLearningTargetById } from '../src/lib/ncicMapper.js'

// 단일 성취기준 매핑 케이스: 특정 code와 topTarget을 검증
const cases = [
  {
    name: '등차수열 성취기준 매핑',
    text: '등차수열의 뜻과 일반항, 첫째항부터 제n항까지의 합을 구하는 방법',
    expectedStandard: '12대수03-02',
    expectedTarget: '12대수03-02-T01',
  },
  {
    name: '등비수열 성취기준 매핑',
    text: '등비수열의 뜻과 일반항, 첫째항부터 제n항까지의 합을 구하는 방법',
    expectedStandard: '12대수03-03',
    expectedTarget: '12대수03-03-T01',
  },
  {
    name: '미분계수 성취기준 매핑',
    text: '미분계수를 이해하고 주어진 함수에서 미분계수를 구하는 방법',
    expectedStandard: '12미적Ⅰ-02-01',
    expectedTarget: '12미적Ⅰ-02-01-T01',
  },
  {
    name: '조건부확률 성취기준 매핑',
    text: '조건부확률의 뜻을 알고 조건부확률을 구하는 방법',
    expectedStandard: '12확통02-04',
    expectedTarget: '12확통02-04-T01',
  },
  {
    name: '이차함수 최대·최소 성취기준 매핑',
    text: '이차함수의 최대 최소를 탐구하고 실생활과 연결하여 유용성을 인식하는 방법',
    expectedStandard: '10공수1-02-06',
    expectedTarget: '10공수1-02-06-T01',
  },
]

// 복합 단원 커버리지 케이스: 여러 도메인이 동시에 포함되는지 검증
const coverageCases = [
  {
    name: '복합 단원 매핑 — 대수 유한수열 + 미적분Ⅰ 변화율',
    description: '정해진 항까지의 수열 합과 다항함수 변화율을 다루는 PDF에서 두 과목이 모두 standards[]에 포함돼야 한다',
    // Gemini가 개선된 프롬프트로 추출할 법한 키워드 배열
    keywords: ['등차수열', '등비수열', '첫째항부터 제n항까지의 합', '미분계수', '도함수', '변화율'],
    // 다음 prefix 중 하나 이상씩 포함돼야 함
    requiredPrefixes: ['12대수03', '12미적Ⅰ-02'],
  },
  {
    name: '복합 단원 매핑 — 공통수학2 + 확률과 통계',
    description: '원의 방정식, 필요조건, 조건부확률이 동시에 언급된 텍스트',
    keywords: ['원의 방정식', '원과 직선의 위치 관계', '필요조건', '충분조건', '조건부확률', '독립', '종속'],
    requiredPrefixes: ['10공수2-01', '10공수2-02', '12확통02'],
  },
]

let failed = 0

// 단일 케이스 검증
for (const item of cases) {
  const standards = findStandards(item.text)
  const targets = findLearningTargets(item.text, standards)
  const topTarget = targets[0]
  const targetInfo = topTarget ? getLearningTargetById(topTarget.id) : null
  const passStandard = standards.includes(item.expectedStandard)
  const passTarget = topTarget?.id === item.expectedTarget

  if (!passStandard || !passTarget) failed += 1

  console.log([
    passStandard && passTarget ? 'PASS' : 'FAIL',
    item.name,
    `standards=${standards.slice(0, 5).join(',') || '-'}`,
    `topTarget=${targetInfo?.title || topTarget?.id || '-'}`,
  ].join(' | '))
}

// 복합 커버리지 케이스 검증
for (const item of coverageCases) {
  const standards = findStandards(item.keywords)
  const missingPrefixes = item.requiredPrefixes.filter(
    (prefix) => !standards.some((code) => code.startsWith(prefix)),
  )
  const pass = missingPrefixes.length === 0

  if (!pass) failed += 1

  console.log([
    pass ? 'PASS' : 'FAIL',
    item.name,
    `standards=${standards.slice(0, 6).join(',') || '-'}`,
    pass ? '두 도메인 모두 포함' : `누락 prefix: ${missingPrefixes.join(', ')}`,
  ].join(' | '))
}

if (failed) {
  console.error(`${failed} mapping case(s) failed.`)
  process.exit(1)
}

console.log('All public-data learning-unit mapping cases passed.')
