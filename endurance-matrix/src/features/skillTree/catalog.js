import identities from './skillIdentities.json' with { type: 'json' }
import { BENCHMARKS } from './benchmarks.js'
import {
  ASSISTED_CELLS, CATEGORY_TAGS, FAMILY_CATEGORIES, LOADED_CELLS,
  METRICS, PREREQUISITE_OVERRIDES, SKILL_LABELS, TRACKING,
} from './skillSettings.js'

const sourceFile = 'data/progressions/bodyweight-fitness-progressions.json'
const categoryCells = Object.entries(CATEGORY_TAGS).map(([category, cells]) => [category, new Set(cells.split(' '))])

function chartLinks(entries) {
  const urls = new Map()
  for (const entry of entries) {
    for (const link of entry.links ?? []) {
      if (/^https?:\/\//i.test(link.url) && !urls.has(link.url)) {
        urls.set(link.url, { url: link.url, label: link.label.trim() || entry.text })
      }
    }
  }
  return [...urls.values()]
}

export function makeCatalog(chart, registry = identities, overrides = PREREQUISITE_OVERRIDES, benchmarks = BENCHMARKS) {
  if (chart?.format !== 'bodyweight-progression-sheet-v1' ||
      !Array.isArray(chart.entries) || !Array.isArray(chart.edges) || !Array.isArray(chart.families)) {
    throw new Error('The skill catalog format is unsupported.')
  }
  const entries = new Map(chart.entries.map(entry => [entry.cell, entry]))
  if (entries.size !== chart.entries.length) throw new Error('The skill catalog contains duplicate source cells.')
  const cellIds = new Map()
  const byId = new Map()

  for (const [id, cells] of Object.entries(registry)) {
    const placements = cells.map(cell => entries.get(cell))
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !placements.length || placements.some(entry => !['skill', 'warm_up'].includes(entry?.kind))) {
      throw new Error('Missing exercise reference for ' + id)
    }
    for (const cell of cells) {
      if (cellIds.has(cell)) throw new Error('Duplicate skill reference for ' + cell)
      cellIds.set(cell, id)
    }
    const [entry] = placements
    const family = entry.family ?? 'Mobility'
    if (!Object.hasOwn(FAMILY_CATEGORIES, family) || (family !== 'Mobility' && !chart.families.includes(family))) {
      throw new Error('Unknown movement family for ' + id)
    }
    const metric = TRACKING[entry.cell] ?? 'reps'
    const tags = categoryCells.filter(([, group]) => cells.some(cell => group.has(cell))).map(([tag]) => tag)
    const categories = [...new Set([
      ...placements.map(entry => FAMILY_CATEGORIES[entry.family ?? 'Mobility']),
      ...tags,
      ...(metric.includes('hold') ? ['static'] : []),
    ])]
    const benchmark = Object.hasOwn(benchmarks, id) ? benchmarks[id] : undefined
    const loaded = LOADED_CELLS.has(entry.cell)
    const assisted = ASSISTED_CELLS.has(entry.cell)
    if (benchmark && !validBenchmark(benchmark, metric, loaded, assisted)) throw new Error('Invalid readiness benchmark for ' + id)
    byId.set(id, {
      id, family, metric, categories, benchmark, sourceCells: cells,
      name: SKILL_LABELS[id] ?? entry.text,
      sourceName: entry.text,
      difficulty: entry.difficulty ?? 'Beginner',
      description: entry.detail,
      milestone: placements.some(entry => entry.milestone),
      links: chartLinks(placements),
      loaded, assisted,
      prerequisites: [], next: [], chartNext: [],
    })
  }
  for (const id of [...Object.keys(overrides), ...Object.keys(benchmarks)]) {
    if (!byId.has(id)) throw new Error('Skill settings reference an unknown movement ID ' + id)
  }

  const incoming = new Map()
  for (const edge of chart.edges) {
    const from = cellIds.get(edge.from)
    const to = cellIds.get(edge.to)
    if (!from || !to) throw new Error('Missing progression edge endpoint for ' + edge.from + ' → ' + edge.to)
    if (from === to) continue
    const skill = byId.get(from)
    const paths = incoming.get(to) ?? { next: new Set(), explicit: new Set() }
    if (edge.kind === 'prerequisite') paths.explicit.add(from)
    else if (edge.kind === 'next_on_chart') {
      paths.next.add(from)
      if (!skill.chartNext.includes(to)) skill.chartNext.push(to)
    } else throw new Error('Unknown progression connection type ' + edge.kind)
    incoming.set(to, paths)
  }

  for (const skill of byId.values()) {
    const { next = new Set(), explicit = new Set() } = incoming.get(skill.id) ?? {}
    const onChart = next.size ? [[...next]] : []
    skill.prerequisites = [...(overrides[skill.id] ?? onChart), ...[...explicit].map(id => [id])]
    for (const group of skill.prerequisites) {
      if (!group.length || new Set(group).size !== group.length) throw new Error('Invalid prerequisite group for ' + skill.id)
      for (const id of group) {
        if (!byId.has(id)) throw new Error('Unknown prerequisite ' + id + ' for ' + skill.id)
        const nextSkills = byId.get(id).next
        if (!nextSkills.includes(skill.id)) nextSkills.push(skill.id)
      }
    }
  }

  const active = new Set()
  const depth = new Map()
  function visit(skill) {
    if (active.has(skill.id)) throw new Error('Circular skill prerequisites at ' + skill.id)
    if (depth.has(skill.id)) return depth.get(skill.id)
    active.add(skill.id)
    const level = Math.max(-1, ...skill.prerequisites.flat().map(id => visit(byId.get(id)))) + 1
    depth.set(skill.id, level)
    active.delete(skill.id)
    return level
  }
  for (const skill of byId.values()) skill.depth = visit(skill)
  return {
    byId,
    skills: [...byId.values()],
    guides: chartLinks(chart.entries.filter(entry => entry.kind === 'reference' && entry.text !== '1920 x 1080 Wallpaper')),
    title: chart.title,
    edition: chart.edition,
    families: [...chart.families, 'Mobility'],
  }
}

function validBenchmark(benchmark, metric, loaded, assisted) {
  const { version, consistency, criteria } = benchmark
  return Number.isInteger(version) && version > 0 && Number.isInteger(consistency) && consistency > 0 &&
    Array.isArray(criteria) && criteria.length > 0 && new Set(criteria.map(item => item.id)).size === criteria.length &&
    criteria.every(item => {
      if (item.type === 'check') return Boolean(item.id && item.label)
      return item.type === 'sets' && item.id && METRICS[metric].fields.length > 0 &&
        Number.isFinite(item.target) && item.target > 0 && Number.isInteger(item.sets) && item.sets > 0 &&
        (loaded || item.minLoadKg === undefined) && (assisted || item.maxAssistanceKg === undefined) &&
        [item.minLoadKg, item.maxAssistanceKg].every(value => value === undefined || (Number.isFinite(value) && value >= 0))
    })
}

export async function loadSkillCatalog(baseUrl, signal) {
  const response = await fetch(baseUrl + sourceFile, { signal })
  if (!response.ok) throw new Error('Could not load the movement catalog.')
  return makeCatalog(await response.json())
}
