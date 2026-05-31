import standards from '../data/ncic_standards.json' with { type: 'json' }
import publicResources from '../data/public_learning_resources.json' with { type: 'json' }

const STOP_TERMS = new Set([
  '뜻', '알고', '이해', '이해하고', '설명', '설명하고', '구하기', '구하는', '구할',
  '방법', '문제', '해결', '활용', '활용하여', '이용', '이용하여', '이를', '그',
  '주어진', '관련된', '대한', '관계', '판단', '계산', '수행', '인식',
])

function normalize(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase()
}

function normalizeInputTerm(value) {
  return String(value || '')
    .trim()
    .replace(/(의|을|를|은|는|이|가|와|과|에|에서|으로|로|한다|하다|하고)$/u, '')
}

function toInputTerms(input) {
  if (Array.isArray(input)) return input.map(String).filter(Boolean)
  if (!input) return []
  return String(input)
    .split(/[\s,.;:()[\]{}"'`~!?/\\|]+/)
    .map(normalizeInputTerm)
    .filter((item) => item.length >= 2 && !STOP_TERMS.has(item))
}

function includesMatch(source, target) {
  const normalizedSource = normalize(source)
  const normalizedTarget = normalize(target)
  if (!normalizedSource || !normalizedTarget) return false
  return normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)
}

function scoreTerms(inputTerms, targetTerms, weight = 1) {
  const normalizedInputs = inputTerms.map(normalize).filter(Boolean)
  const hits = []
  for (const targetTerm of targetTerms) {
    const normalizedTarget = normalize(targetTerm)
    if (!normalizedTarget) continue
    const matched = normalizedInputs.some((term) => (
      term === normalizedTarget
      || (
        term.length > 2
        && normalizedTarget.length > 2
        && (term.includes(normalizedTarget) || normalizedTarget.includes(term))
      )
    ))
    if (matched) hits.push(targetTerm)
  }
  return { score: hits.length * weight, hits }
}

export function getLearningTargetsForStandard(standardOrCode) {
  const standard = typeof standardOrCode === 'string'
    ? standards.find((item) => item.code === standardOrCode)
    : standardOrCode
  if (!standard) return []
  return (standard.learningTargets || []).map((target) => ({
    ...target,
    standardCode: standard.code,
    standardDescription: standard.description,
    subject: standard.subject,
    grade: standard.grade,
    unit: standard.unit,
    edunetUrl: standard.edunetUrl,
  }))
}

export function getLearningTargetById(targetId) {
  for (const standard of standards) {
    const target = getLearningTargetsForStandard(standard).find((item) => item.id === targetId)
    if (target) return target
  }
  return null
}

export function findStandardMatches(input, { limit = 3 } = {}) {
  const inputTerms = toInputTerms(input)
  const results = standards
    .map((standard) => {
      const standardTerms = [
        standard.subject,
        standard.domain,
        standard.unit,
        standard.description,
        ...(standard.keywords || []),
      ]
      const targetTerms = (standard.learningTargets || []).flatMap((target) => [
        target.title,
        target.description,
        ...(target.criteria || []),
        ...(target.keywords || []),
      ])
      const standardScore = scoreTerms(inputTerms, standardTerms, 2)
      const targetScore = scoreTerms(inputTerms, targetTerms, 1)
      const score = standardScore.score + targetScore.score
      return {
        code: standard.code,
        score,
        matchedTerms: [...standardScore.hits, ...targetScore.hits],
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code, 'ko'))

  return results.slice(0, limit)
}

export function findStandards(input) {
  return findStandardMatches(input, { limit: 10 }).map((match) => match.code)
}

export function findLearningTargets(input, standardCodes = [], { limit = 6 } = {}) {
  const inputTerms = toInputTerms(input)
  const candidates = standardCodes.length
    ? standards.filter((standard) => standardCodes.includes(standard.code))
    : standards

  const results = candidates
    .flatMap((standard) => getLearningTargetsForStandard(standard).map((target) => {
      const targetTerms = [
        target.title,
        target.description,
        ...(target.criteria || []),
        ...(target.keywords || []),
      ]
      const targetScore = scoreTerms(inputTerms, targetTerms, 3)
      const standardScore = scoreTerms(inputTerms, [
        standard.subject,
        standard.domain,
        standard.unit,
        ...(standard.keywords || []),
      ], 1)
      const score = targetScore.score + standardScore.score
      return {
        id: target.id,
        standardCode: standard.code,
        title: target.title,
        description: target.description,
        criteria: target.criteria || [],
        keywords: target.keywords || [],
        score,
        matchedTerms: [...targetScore.hits, ...standardScore.hits],
      }
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'ko'))

  return results.slice(0, limit)
}

export function getStandardByCode(code) {
  const standard = standards.find((item) => item.code === code)
  if (!standard) return null
  return {
    ...standard,
    publicResources: getPublicResourcesForStandard(standard),
  }
}

export function getSummary(codes = []) {
  if (!codes.length) return { subject: '과목 불명', grade: '', unit: '' }
  const first = getStandardByCode(codes[0])
  return first
    ? { subject: first.subject, grade: first.grade, unit: first.unit }
    : { subject: '과목 불명', grade: '', unit: '' }
}

export function getEdunetUrl(code) {
  const standard = getStandardByCode(code)
  return standard?.publicResources?.[0]?.url || standard?.edunetUrl || 'https://www.edunet.net/nedu/search/searchList.do'
}

export function getPublicResourcesForStandard(standardOrCode, limit = 3) {
  const standard = typeof standardOrCode === 'string'
    ? standards.find((item) => item.code === standardOrCode)
    : standardOrCode
  if (!standard) return []

  const targetTerms = [
    standard.subject,
    standard.domain,
    standard.unit,
    standard.description,
    ...(standard.keywords || []),
    ...(standard.learningTargets || []).flatMap((target) => [
      target.title,
      target.description,
      ...(target.keywords || []),
    ]),
  ].map(normalize).filter(Boolean)

  return publicResources
    .map((resource) => {
      const resourceTerms = [
        resource.title,
        ...(resource.keywords || []),
      ].map(normalize).filter(Boolean)
      const score = resourceTerms.reduce((sum, term) => {
        const matched = targetTerms.some((target) => includesMatch(target, term))
        return sum + (matched ? 1 : 0)
      }, 0)
      return { ...resource, score }
    })
    .filter((resource) => resource.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ko'))
    .slice(0, limit)
    .map(({ score, ...resource }) => resource)
}
