import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { makeCatalog } from '../src/features/skillTree/catalog.js'
import { evaluateReadiness, evaluateSkill, getSummary, newlyAvailable, prerequisitesMet } from '../src/features/skillTree/progression.js'
import {
  createProgressStore, emptyProgress, mergeProgress, parseProgress, PROGRESS_VERSION, STORAGE_KEY,
  updateSkill, validateSession,
} from '../src/features/skillTree/progressStorage.js'
import { focusPath, layoutTree } from '../src/features/skillTree/treeLayout.js'
import { CATEGORY_TAGS, CATEGORIES, TRACKING } from '../src/features/skillTree/skillSettings.js'

const chart = JSON.parse(readFileSync(new URL('../public/data/progressions/bodyweight-fitness-progressions.json', import.meta.url), 'utf8'))
const catalog = makeCatalog(chart)
const skill = id => catalog.byId.get(id)
const timestamp = '2026-11-10T15:00:00.000Z'

function master(progress, id, override = false) {
  return updateSkill(progress, id, record => ({ ...record, mastery: { at: timestamp, override } }))
}

function attempt(sets, options = {}) {
  return validateSession({
    id: 'attempt-1', date: '2026-11-10', metric: 'reps', sets,
    loadKg: null, assistanceKg: null, checks: [], benchmarkVersion: 1, notes: '', ...options,
  })
}

function storage(start = null) {
  let value = start
  return {
    getItem(key) { assert.equal(key, STORAGE_KEY); return value },
    setItem(key, raw) { assert.equal(key, STORAGE_KEY); value = raw },
  }
}

test('the existing chart supplies names, guides, tiers, branches, and stable movement references', () => {
  const cells = catalog.skills.flatMap(entry => entry.sourceCells)
  assert.deepEqual(new Set(cells), new Set(chart.entries.filter(entry => ['skill', 'warm_up'].includes(entry.kind)).map(entry => entry.cell)))
  for (const configured of [...Object.keys(TRACKING), ...Object.values(CATEGORY_TAGS).flatMap(value => value.split(' '))]) {
    assert.ok(cells.includes(configured), 'Missing source cell ' + configured)
  }
  assert.ok(catalog.guides.length)
  assert.deepEqual(skill('pike-skin-the-cat').next, ['tuck-back-lever', 'l-hang'])
  assert.equal(skill('tuck-font-lever').name, 'Tuck Front Lever')
  assert.equal(skill('tuck-font-lever').links.length, 1)
  assert.equal(skill('tuck-font-lever').metric, 'hold')
  assert.equal(skill('ring-planche').sourceCells.length, 2)
  assert.equal(skill('ring-planche').links.length, 1)
  assert.ok(skill('ring-planche').next.includes('maltese'))
  assert.ok(skill('ring-planche').next.includes('inverted-cross'))
  assert.deepEqual(new Set(catalog.skills.flatMap(entry => entry.categories)), new Set(Object.keys(CATEGORIES)))
})

test('graph geometry displays known paths and distinguishes alternative and mandatory edges', () => {
  const focused = focusPath(catalog, 'muscle-up')
  assert.ok(focused.has('dip') && focused.has('ring-dip') && focused.has('wide-muscle-up'))
  assert.ok(!focused.has('push-up'))
  const layout = layoutTree(catalog.skills.filter(entry => focused.has(entry.id)), catalog.families)
  assert.ok(layout.edges.some(edge => edge.from === 'dip' && edge.to === 'muscle-up' && edge.alternative))
  assert.ok(layout.edges.some(edge => edge.from === 'c2b-pull-up' && edge.to === 'muscle-up' && !edge.alternative))
  assert.ok(layout.visible.get('c2b-pull-up').x < layout.visible.get('muscle-up').x)
})

test('a skill can require all groups while accepting alternatives within a group', () => {
  const muscleUp = skill('muscle-up')
  let progress = master(emptyProgress(), 'c2b-pull-up')
  progress = master(progress, 'dip')
  assert.equal(prerequisitesMet(muscleUp, progress), false)
  assert.equal(prerequisitesMet(muscleUp, master(progress, 'mu-neg')), true)
  assert.equal(prerequisitesMet(muscleUp, master(progress, 'kipping-mu')), true)
  assert.equal(prerequisitesMet(muscleUp, master(master(emptyProgress(), 'mu-neg'), 'kipping-mu')), false)

  const cross = skill('iron-cross-progression')
  assert.equal(cross.prerequisites.length, 5)
  assert.equal(prerequisitesMet(cross, cross.prerequisites.slice(1).flat().reduce((state, id) => master(state, id), emptyProgress())), false)
  assert.equal(prerequisitesMet(cross, cross.prerequisites.flat().reduce((state, id) => master(state, id), emptyProgress())), true)
})

test('mastering a skill unlocks dependents and leaves unrelated branches alone', () => {
  const original = emptyProgress()
  const root = skill('incline-push-up')
  assert.equal(evaluateSkill(root, original).status, 'available')
  assert.equal(evaluateSkill(skill('push-up'), original).status, 'locked')
  const progress = master(original, root.id, true)
  assert.equal(evaluateSkill(root, progress).status, 'mastered')
  assert.equal(evaluateSkill(root, progress).mastery.override, true)
  assert.equal(evaluateSkill(skill('push-up'), progress).status, 'available')
  assert.equal(evaluateSkill(skill('pull-up'), progress).status, 'locked')
  assert.deepEqual(newlyAvailable(root, catalog, original, progress).map(next => next.id), ['push-up'])
  const reset = updateSkill(progress, root.id, () => null)
  assert.equal(evaluateSkill(skill('push-up'), reset).status, 'locked')
})

test('rep thresholds count qualifying sets from the same attempt and require explicit technique', () => {
  const pushUp = skill('push-up')
  const good = { checks: ['range', 'control'] }
  const incomplete = attempt([[8], [8], [6]], good)
  const techniqueMissing = attempt([[8], [8], [8]])
  assert.equal(evaluateReadiness(pushUp, [incomplete]).criteria[0].qualifyingSets, 2)
  assert.equal(evaluateReadiness(pushUp, [incomplete, incomplete]).ready, false)
  assert.equal(evaluateReadiness(pushUp, [incomplete, techniqueMissing]).ready, false)
  assert.equal(evaluateReadiness(pushUp, [attempt([[9], [8], [8]], { ...good, benchmarkVersion: 0 })]).ready, false)
  const passing = attempt([[9], [8], [8]], good)
  assert.equal(evaluateReadiness(pushUp, [passing]).ready, true)
  let progress = updateSkill(emptyProgress(), pushUp.id, record => ({ ...record, sessions: [passing] }))
  assert.equal(evaluateSkill(pushUp, progress).status, 'locked')
  progress = master(progress, 'incline-push-up')
  assert.equal(evaluateSkill(pushUp, progress).status, 'ready')
  assert.equal(evaluateSkill(pushUp, updateSkill(progress, pushUp.id, record => ({ ...record, sessions: [incomplete] }))).status, 'inProgress')
})

test('readiness evaluates seconds, unilateral work, resistance, and distinct training days', () => {
  const lever = skill('tuck-font-lever')
  const options = { metric: 'hold', checks: ['shape'] }
  assert.equal(evaluateReadiness(lever, [attempt([[15], [15], [14]], options)]).ready, false)
  assert.equal(evaluateReadiness(lever, [attempt([[15], [15], [15]], options)]).ready, true)
  assert.equal(evaluateReadiness(lever, [attempt([[15], [15], [15]], { checks: ['shape'] })]).ready, false)
  const pistol = skill('pistol-squat')
  const unilateral = { metric: 'unilateral-reps', checks: ['control', 'sides'] }
  assert.equal(evaluateReadiness(pistol, [attempt([[3, 3], [3, 2]], unilateral)]).ready, false)
  assert.equal(evaluateReadiness(pistol, [attempt([[3, 3], [3, 3]], unilateral)]).ready, true)
  const loaded = { metric: 'reps', loaded: true, assisted: true, benchmark: {
    version: 1, consistency: 2,
    criteria: [{ id: 'test', type: 'sets', sets: 1, target: 6, minLoadKg: 5, maxAssistanceKg: 0 }],
  } }
  const good = attempt([[6]], { loadKg: 5, assistanceKg: 0 })
  assert.equal(evaluateReadiness(loaded, [good, good, attempt([[6]], { date: '2026-11-11', loadKg: 8 })]).ready, false)
  assert.equal(evaluateReadiness(loaded, [good, { ...good, date: '2026-11-11' }]).ready, true)
  assert.equal(evaluateReadiness(skill('ring-planche'), []).ready, false)
})

test('bad relationships are caught and renaming a display name preserves the stored key', () => {
  const entries = [
    { cell: 'A1', kind: 'skill', text: 'First', family: 'Core', difficulty: 'Beginner' },
    { cell: 'A2', kind: 'skill', text: 'Renamed movement', family: 'Core', difficulty: 'Beginner' },
  ]
  const mini = { format: chart.format, entries, families: ['Core'], edges: [{ from: 'A1', to: 'A2', kind: 'next_on_chart' }] }
  const registry = { first: ['A1'], second: ['A2'] }
  assert.equal(makeCatalog(mini, registry, {}, {}).byId.get('second').name, 'Renamed movement')
  assert.throws(() => makeCatalog(mini, { ...registry, duplicate: ['A1'] }, {}, {}), /duplicate/i)
  assert.throws(() => makeCatalog(mini, registry, { first: [['second']] }, {}), /circular/i)
  assert.throws(() => makeCatalog(mini, registry, { first: [['unknown']] }, {}), /unknown prerequisite/i)
  assert.throws(() => makeCatalog({ ...mini, entries: entries.slice(0, 1) }, registry, {}, {}), /missing exercise/i)
})

test('progress reload, import, and merge retain sessions, goals, overrides, and archived skill IDs', () => {
  const browser = storage()
  const first = createProgressStore(() => browser)
  const archived = updateSkill(master(emptyProgress(), 'old-movement', true), 'pull-up', record => ({
    ...record, sessions: [attempt([[5], [4], [3]])],
  }))
  const progress = { ...archived, selectedGoals: ['muscle-up'], preferences: { category: 'pull' } }
  assert.deepEqual(first.update(() => progress).progress, progress)
  const reloaded = createProgressStore(() => browser).load().progress
  assert.deepEqual(reloaded, progress)
  assert.deepEqual(parseProgress(JSON.stringify(reloaded)), progress)
  const changed = updateSkill(reloaded, 'pull-up', record => ({
    ...record, sessions: [attempt([[7]], { id: 'attempt-1' }), attempt([[8]], { id: 'attempt-2' })],
  }))
  const merged = mergeProgress(reloaded, { ...changed, selectedGoals: ['handstand'] })
  assert.equal(merged.skills['pull-up'].sessions.length, 2)
  assert.deepEqual(merged.skills['pull-up'].sessions.find(session => session.id === 'attempt-1').sets, [[5], [4], [3]])
  assert.deepEqual(merged.selectedGoals, ['muscle-up', 'handstand'])
})

test('migration, validation, storage denial, and corrupt storage recovery do not destroy data', () => {
  const prior = {
    version: 1, skills: { 'push-up': {
      masteredAt: timestamp, manualOverride: true,
      sessions: [{ id: 'prior-1', date: '2026-11-10', metric: 'reps', sets: [5, 6] }],
    } },
  }
  const migrated = parseProgress(JSON.stringify(prior))
  assert.equal(migrated.version, PROGRESS_VERSION)
  assert.deepEqual(migrated.skills['push-up'].sessions[0].sets, [[5], [6]])
  assert.deepEqual(migrated.skills['push-up'].mastery, { at: timestamp, override: true })
  assert.throws(() => parseProgress('{"version":25}'), /unsupported/)
  assert.throws(() => parseProgress('{"version":2,"skills":{"__proto__":{}},"selectedGoals":[],"preferences":{}}'), /identifier/)
  assert.throws(() => attempt([[1.3]]), /performance/)
  assert.throws(() => attempt([[3]], { date: '2026-02-31' }), /date/)
  assert.throws(() => attempt([[3, 3]]), /performance/)
  const create = createProgressStore(() => { throw new Error('blocked') })
  assert.match(create.load().warning, /unavailable/)
  assert.ok(create.update(() => migrated).progress.skills['push-up'].mastery)
  const corrupt = storage('{broken JSON')
  const store = createProgressStore(() => corrupt)
  assert.match(store.load().warning, /could not be read/)
  assert.match(store.update(() => migrated).warning, /in memory/)
  assert.equal(corrupt.getItem(STORAGE_KEY), '{broken JSON')
  assert.equal(store.update(() => migrated, { replace: true }).warning, '')
  assert.deepEqual(createProgressStore(() => corrupt).load().progress, migrated)
})

test('separate page instances apply changes to the latest stored state', () => {
  const browser = storage()
  const first = createProgressStore(() => browser)
  const second = createProgressStore(() => browser)
  first.load()
  second.load()
  first.update(progress => master(progress, 'push-up'))
  second.update(progress => master(progress, 'pull-up'))
  assert.deepEqual(Object.keys(first.load().progress.skills), ['push-up', 'pull-up'])
})

test('goals, category completion, recommendations, and milestones reflect recorded progress', () => {
  const progress = { ...master(emptyProgress(), 'incline-push-up'), selectedGoals: ['push-up'] }
  const evaluations = new Map(catalog.skills.map(entry => [entry.id, evaluateSkill(entry, progress)]))
  const summary = getSummary(catalog, progress, evaluations, 'push')
  assert.equal(summary.mastered, 1)
  assert.equal(summary.categoryCounts.find(category => category.id === 'push').mastered, 1)
  assert.equal(summary.suggestions[0].skill.id, 'push-up')
  assert.equal(summary.suggestions[0].reason, 'Your selected goal')
  assert.ok(summary.achievements.some(item => item.label === 'First Skill Mastered'))
  assert.ok(summary.unlocked.some(item => item.skill.id === 'push-up'))
})
