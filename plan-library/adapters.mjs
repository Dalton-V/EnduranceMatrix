import { bookSteps } from './book-steps.mjs'

function appWorkout(workout, instruction = workout.source_text) {
  const result = { ...workout }
  for (const field of ['distance_km', 'distance_miles', 'event_distance_km']) {
    if (result[field] && typeof result[field] === 'object') {
      result[field + '_range'] = result[field]
      delete result[field]
    }
  }
  const steps = bookSteps({ ...workout, source_text: instruction })
  if (steps.length) result.steps = steps
  return result
}

function appDay(day) {
  if (day.workouts.length === 1 && day.workouts[0].workout_ref === 'rest_or_cross_train') {
    const original = appWorkout(day.workouts[0])
    const choice = { ...original, source_workout_ref: original.workout_ref }
    return { ...day, workouts: [{ ...choice, workout_ref: 'rest' }],
      alternative_workouts: [{ ...choice, workout_ref: 'cross_training' }] }
  }
  // A few entries encode the second recovery run only in the printed text.
  // Both distances are explicit. Keep the supplied entry and its full wording.
  if (day.workouts.length === 1 && !day.workouts[0].session) {
    const original = day.workouts[0]
    const second = /\s+(Recovery|PM) (\d+)(?:-(\d+))? miles \((\d+)(?:-(\d+))? km\)\s*·?$/i.exec(original.source_text)
    if (second && /\d+\s*km\)/i.test(original.source_text.slice(0, second.index))) {
      const firstText = original.source_text.slice(0, second.index)
      const first = appWorkout(original, firstText)
      const firstType = /^Endurance\b/i.test(firstText) ? 'endurance_run'
        : /^General aerobic\b/i.test(firstText) ? 'general_aerobic' : original.workout_ref
      first.source_workout_ref = original.workout_ref
      first.workout_ref = firstType
      const recovery = { workout_ref: 'recovery_run', source_text: original.source_text,
        distance_miles_range: { min: +second[2], max: +(second[3] ?? second[2]) },
        distance_km_range: { min: +second[4], max: +(second[5] ?? second[4]) } }
      if (second[1] === 'PM') recovery.session = 'PM'
      return { ...day, workouts: [first, recovery] }
    }
  }
  return { ...day, workouts: day.workouts.map(workout => appWorkout(workout)) }
}

function appWeek(week) {
  const result = { ...week, days: week.days.map(appDay) }
  for (const field of ['total_distance_miles', 'total_distance_km']) {
    if (result[field] && typeof result[field] === 'object') {
      result[field + '_range'] = result[field]
      delete result[field]
    }
  }
  return result
}

function keyed(entries, key) {
  const map = new Map()
  for (const entry of entries) {
    if (map.has(entry[key])) throw new Error('Duplicate ' + key + ': ' + entry[key])
    map.set(entry[key], entry)
  }
  return map
}

// Each adapter yields exactly the payload the normalized store must reproduce.
// Publishing a book plan includes its relevant bibliography and extraction notes.
export function adapterFor(document) {
  if (Array.isArray(document.plans) && Array.isArray(document.sources)) return 'book-collection-v1'
  if (document.plan?.schedule) return 'app-plan-v1'
  throw new Error('Unrecognized training plan format')
}

export function* adapt(document, filename, adapter = adapterFor(document)) {
  if (adapter === 'app-plan-v1') {
    if (!document.plan?.schedule) throw new Error('Expected a shipped plan or a book collection in ' + filename)
    yield { payload: document, filename, pointer: '' }
    return
  }
  if (adapter !== 'book-collection-v1') throw new Error('Unknown source adapter ' + adapter)
  const { plans, workout_definitions, sources, comparison_index, ...dataset } = document
  const publications = keyed(sources, 'id')
  const comparisons = keyed(comparison_index, 'plan_id')
  const planIds = new Set()
  for (const [index, entry] of plans.entries()) {
    const { plan, source, schedule, ...other } = entry
    if (planIds.has(plan.id)) throw new Error('Duplicate source plan ' + plan.id)
    planIds.add(plan.id)
    const publication = publications.get(source.source_id)
    if (!publication) throw new Error('Missing source ' + source.source_id)
    const weeks = schedule.map(appWeek)
    const refs = new Set(schedule.flatMap(w => w.days.flatMap(d => d.workouts.map(x => x.workout_ref))))
    for (const w of weeks) for (const d of w.days) for (const x of d.workouts) refs.add(x.workout_ref)
    const defs = Object.fromEntries([...refs].map(ref => {
      if (!Object.hasOwn(workout_definitions, ref)) throw new Error('Missing book definition ' + ref)
      return [ref, workout_definitions[ref]]
    }))
    if (refs.has('rest_or_cross_train')) {
      defs.rest ??= workout_definitions.rest
      defs.cross_training ??= workout_definitions.cross_training ?? {
        label: 'Cross-training', category: 'active-recovery', discipline: null,
        description: workout_definitions.rest_or_cross_train.description,
      }
    }
    const result = { ...plan, ...other, workout_definitions: defs, schedule: weeks,
      source: { ...source, publication, dataset } }
    if (comparisons.has(plan.id)) result.comparison_index = comparisons.get(plan.id)
    yield { payload: { plan: result }, filename: plan.id + '.json', pointer: '/plans/' + index }
  }
  for (const id of comparisons.keys()) if (!planIds.has(id)) throw new Error('Comparison for missing plan ' + id)
}

