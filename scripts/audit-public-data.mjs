import fs from 'node:fs'
import standards from '../src/data/ncic_standards.json' with { type: 'json' }
import resources from '../src/data/public_learning_resources.json' with { type: 'json' }
import sources from '../src/data/public_data_sources.json' with { type: 'json' }
import { getPublicResourcesForStandard } from '../src/lib/ncicMapper.js'

const rawApiPath = 'data/raw/keris_topic_learning_resources_api.json'
const hasRawApi = fs.existsSync(rawApiPath)
const rawApi = hasRawApi ? JSON.parse(fs.readFileSync(rawApiPath, 'utf8')) : null
const totalTargets = standards.reduce((sum, standard) => sum + (standard.learningTargets?.length || 0), 0)
const standardRows = standards.map((standard) => {
  const matchedResources = getPublicResourcesForStandard(standard, 20)
  return {
    code: standard.code,
    subject: standard.subject,
    unit: standard.unit,
    targets: standard.learningTargets?.length || 0,
    matchedResources: matchedResources.length,
  }
})

const providerCounts = resources.reduce((map, resource) => {
  const key = resource.provider || resource.sourceName || 'unknown'
  map[key] = (map[key] || 0) + 1
  return map
}, {})

const report = {
  generatedAt: new Date().toISOString(),
  keris: {
    rawApiFetched: hasRawApi,
    rawApiTotalCount: rawApi?.totalCount || rawApi?.response?.body?.totalCount || null,
    rawApiFetchedPages: rawApi?.fetchedPages || null,
    bundledResources: resources.length,
    resourcesWithPortalUrl: resources.filter((resource) => resource.publicDataPortalUrl).length,
    providerCounts,
  },
  ncic: {
    standards: standards.length,
    learningTargets: totalTargets,
    sourceTypes: [...new Set(standards.map((standard) => standard.sourceType || 'unknown'))],
  },
  mapping: {
    standardsWithResources: standardRows.filter((row) => row.matchedResources > 0).length,
    standardsWithoutResources: standardRows.filter((row) => row.matchedResources === 0).length,
    rows: standardRows,
  },
  sources: sources.map((source) => ({
    id: source.id,
    name: source.name,
    url: source.url,
    role: source.role,
    status: source.status,
  })),
}

console.log(JSON.stringify(report, null, 2))
