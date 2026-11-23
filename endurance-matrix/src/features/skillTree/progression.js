import { CATEGORIES, METRICS } from './skillSettings.js'

export const STATES = {
  locked: 'Locked',
  available: 'Available',
  inProgress: 'In Progress',
  ready: 'Ready to Test',
  mastered: 'Mastered',
}

export function prerequisitesMet(skill, progress) {
  return skill.prerequisites.every(group => group.some(id => Boolean(progress.skills[id]?.mastery)))
}

function setValues(session) {
  return session.sets.map(set => Math.min(...set)).sort((a, b) => b - a)
}

function meetsResistance(criterion, session) {
  return (criterion.minLoadKg === undefined || (session.loadKg ?? 0) >= criterion.minLoadKg) &&
    (criterion.maxAssistanceKg === undefined || (session.assistanceKg !== null && session.assistanceKg <= criterion.maxAssistanceKg))
}

export function evaluateReadiness(skill, sessions) {
  const { benchmark } = skill
  if (!benchmark) return { criteria: [], ready: false, completed: 0, qualifyingDays: 0 }
  const scores = benchmark.criteria.map(criterion => ({ criterion, qualifyingSets: 0, value: 0, fraction: 0 }))
  const qualifyingDays = new Set()
  for (const session of sessions) {
    if (session.metric !== skill.metric || (!skill.loaded && session.loadKg > 0) ||
        (!skill.assisted && session.assistanceKg > 0)) continue
    const values = setValues(session)
    const complete = scores.map(score => {
      const { criterion } = score
      if (criterion.type === 'check') {
        const confirmed = session.benchmarkVersion === benchmark.version && session.checks.includes(criterion.id)
        if (confirmed) score.fraction = 1
        return confirmed
      }
      if (!meetsResistance(criterion, session)) return false
      const qualifyingSets = values.filter(value => value >= criterion.target).length
      const value = values[criterion.sets - 1] ?? 0
      const fraction = Math.min(1, Math.max(value / criterion.target, qualifyingSets / criterion.sets))
      if (fraction > score.fraction || (fraction === score.fraction && qualifyingSets > score.qualifyingSets)) {
        Object.assign(score, { qualifyingSets, value, fraction })
      }
      return qualifyingSets >= criterion.sets
    }).every(Boolean)
    if (complete) qualifyingDays.add(session.date)
  }
  return {
    criteria: scores,
    completed: scores.filter(score => score.fraction === 1).length,
    ready: qualifyingDays.size >= benchmark.consistency,
    qualifyingDays: qualifyingDays.size,
  }
}

export function evaluateSkill(skill, progress) {
  const record = progress.skills[skill.id]
  const readiness = evaluateReadiness(skill, record?.sessions ?? [])
  const eligible = prerequisitesMet(skill, progress)
  let status = 'locked'
  if (record?.mastery) status = 'mastered'
  else if (eligible) {
    if (readiness.ready) status = 'ready'
    else status = record?.sessions.length ? 'inProgress' : 'available'
  }
  return { status, readiness, eligible, mastery: record?.mastery }
}

export function newlyAvailable(skill, catalog, progress, nextProgress) {
  return skill.next.map(id => catalog.byId.get(id)).filter(next =>
    !nextProgress.skills[next.id]?.mastery && !prerequisitesMet(next, progress) && prerequisitesMet(next, nextProgress),
  )
}

function unlockDate(skill, progress) {
  if (!skill.prerequisites.length) return null
  const dates = skill.prerequisites.map(group => group.map(id => progress.skills[id]?.mastery?.at).filter(Boolean).sort()[0])
  return dates.every(Boolean) ? dates.sort().at(-1) : null
}

function goalPath(catalog, progress) {
  const path = new Set()
  function visit(id) {
    if (path.has(id) || !catalog.byId.has(id) || progress.skills[id]?.mastery) return
    path.add(id)
    for (const group of catalog.byId.get(id).prerequisites) {
      if (!group.some(parent => progress.skills[parent]?.mastery)) group.forEach(visit)
    }
  }
  progress.selectedGoals.forEach(visit)
  return path
}

export function getSummary(catalog, progress, evaluations, category) {
  const mastered = catalog.skills.filter(skill => evaluations.get(skill.id).status === 'mastered')
    .sort((a, b) => progress.skills[a.id].mastery.at.localeCompare(progress.skills[b.id].mastery.at))
  const categoryCounts = Object.keys(CATEGORIES).map(id => {
    const skills = catalog.skills.filter(skill => skill.categories.includes(id))
    return { id, total: skills.length, mastered: skills.filter(skill => evaluations.get(skill.id).status === 'mastered').length }
  })
  const achievements = mastered.filter(skill => skill.milestone || ['pull-up', 'handstand', 'muscle-up'].includes(skill.id))
    .map(skill => ({ id: skill.id, label: skill.name + ' mastered', date: progress.skills[skill.id].mastery.at }))
  for (const [threshold, label] of [[1, 'First Skill Mastered'], [10, 'Ten Skills Mastered']]) {
    if (mastered.length >= threshold) achievements.push({ id: 'total-' + threshold, label, date: progress.skills[mastered[threshold - 1].id].mastery.at })
  }
  for (const id of ['push', 'pull']) {
    const milestone = mastered.filter(skill => skill.categories.includes(id))[2]
    if (milestone) achievements.push({
      id: 'category-' + id, label: 'Three ' + CATEGORIES[id] + ' Skills Mastered', date: progress.skills[milestone.id].mastery.at,
    })
  }
  const started = catalog.skills.filter(skill => evaluations.get(skill.id).status === 'inProgress').length
  const ready = catalog.skills.filter(skill => evaluations.get(skill.id).status === 'ready').length
  const available = catalog.skills.filter(skill => ['available', 'inProgress', 'ready'].includes(evaluations.get(skill.id).status))
  const unlocked = available.map(skill => ({ skill, date: unlockDate(skill, progress) }))
    .filter(item => item.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const path = goalPath(catalog, progress)
  const suggestions = available.map(skill => {
    const { status, readiness } = evaluations.get(skill.id)
    const goalBonus = path.has(skill.id) ? 3 : 0
    const categoryBonus = skill.categories.includes(category) ? 2 : 0
    const coverage = readiness.criteria.length
      ? Math.min(...readiness.criteria.map(score => score.fraction))
      : 0
    const score = (status === 'ready' ? 5 : 0) + coverage * 4 + (status === 'inProgress' ? 2 : 0) +
      goalBonus + categoryBonus + (skill.benchmark ? 0.5 : 0)
    let reason = skill.prerequisites.length ? 'Prerequisites mastered' : 'Starting point'
    if (categoryBonus) reason = 'In your selected category'
    if (goalBonus) reason = progress.selectedGoals.includes(skill.id) ? 'Your selected goal' : 'On a path to your goal'
    if (status === 'inProgress') reason += ' · Training logged'
    if (status === 'ready') reason += ' · Benchmarks recorded'
    return { skill, reason, score }
  }).sort((a, b) => b.score - a.score || a.skill.depth - b.skill.depth).slice(0, 3)

  return {
    mastered: mastered.length, started, ready, categoryCounts, unlocked, suggestions,
    achievements: achievements.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
  }
}

export function formatSession(session) {
  const { unit } = METRICS[session.metric]
  const values = session.sets.map(set => set.join('/'))
  const performance = values.length
    ? (values.every(value => value === values[0]) ? values.length + ' × ' + values[0] : values.join(', ')) + ' ' + unit
    : 'Practice logged'
  const load = session.loadKg === null ? '' : ' · ' + session.loadKg + ' kg added'
  const assistance = session.assistanceKg === null ? '' : ' · ' + session.assistanceKg + ' kg assistance'
  return performance + load + assistance
}
