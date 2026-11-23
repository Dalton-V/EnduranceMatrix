// Structured prescriptions from the two book schedules. Only match complete
// clauses. Original text is always retained, including OCR and punctuation.
function bounds(a, b) {
  const number = text => Number(text.replaceAll(',', ''))
  return b ? { min: number(a), max: number(b) } : number(a)
}
function repeat(count, steps) {
  return { kind: 'repeat', reps: Number(count), steps }
}
function work(field, value, intensity) {
  return { kind: 'work', [field]: value, intensity }
}
function recovery(field, value, between) {
  return { kind: 'recovery', exercise: 'jog', [field]: value, instruction: between }
}

function parseRecovery(text) {
  if (!text) return []
  let m = /^jog (\d+)%?(?:-(\d+))?% interval time(?: recovery)?$/i.exec(text)
  if (m) return [recovery('interval_time_pct', bounds(m[1], m[2]), 'between intervals')]
  m = /^jog (\d+) (m|min) (?:recovery|between intervals)(?: and (\d+) min between sets)?$/i.exec(text)
  if (m) {
    const steps = [recovery(m[2] === 'm' ? 'distance_m' : 'duration_min', +m[1], 'between intervals')]
    if (m[3]) steps.push(recovery('duration_min', +m[3], 'between sets'))
    return steps
  }
  m = /^jog (\d+) min between sets$/i.exec(text)
  if (m) return [recovery('duration_min', +m[1], 'between sets')]
  if (text === 'jog downhill recovery') return [{ kind: 'recovery', exercise: 'jog downhill', instruction: 'between intervals' }]
  return null
}

function parseIntervals(clause) {
  const recoveryMatch = /(?:; |\s*\()(jog .+?)\)?$/i.exec(clause)
  const recoveries = parseRecovery(recoveryMatch?.[1])
  if (!recoveries) return null
  let main = (recoveryMatch ? clause.slice(0, recoveryMatch.index) : clause).trim()
  const pace = /\s+(?:All intervals\s+)?(?:@|at)\s+(.+?)$/i.exec(main)
  const intensity = pace?.[1] ?? (/strides/i.test(main) ? 'strides' : /LT intervals/i.test(main) ? 'LT' : null)
  if (pace) main = main.slice(0, pace.index)
  const sets = /^(\d+) sets of\s*/i.exec(main)
  if (sets) main = main.slice(sets[0].length)
  const steps = []
  const ladder = /^\(([\d,m\s]+)\)$/.exec(main)
  if (ladder) {
    const distances = [...ladder[1].matchAll(/([\d,]+)\s*m/g)]
    for (const m of distances) steps.push(work('distance_m', bounds(m[1]), intensity))
  } else {
    const rep = /(\d+)\s*[×x]\s*([\d,]+)\s*(km|min|sec|m)\b(?:\s+(strides|hill sprints|uphill|LT intervals))?/iy
    let pos = 0
    while (pos < main.length) {
      rep.lastIndex = pos
      const m = rep.exec(main)
      if (!m) return null
      const field = { km: 'distance_km', m: 'distance_m', sec: 'duration_sec', min: 'duration_min' }[m[3]]
      const step = work(field, bounds(m[2]), intensity ?? m[4])
      if (m[4] && m[4] !== 'LT intervals') step.exercise = m[4]
      steps.push(repeat(m[1], [step, ...recoveries.filter(s => s.instruction === 'between intervals')]))
      pos = rep.lastIndex
      pos += /^[,\s]*/.exec(main.slice(pos))[0].length
    }
  }
  if (!steps.length) return null
  // Intervals within a ladder share a recovery rule. Its scope is explicit.
  if (ladder) steps.push(...recoveries.filter(s => s.instruction === 'between intervals'))
  const outer = [...steps, ...recoveries.filter(s => s.instruction === 'between sets')]
  return sets ? [repeat(sets[1], outer)] : outer
}

function parseClause(clause) {
  let m = /^(\d+)(?:-(\d+))? (?:minutes at LT pace|min tempo run)$/i.exec(clause)
  if (m) return [work('duration_min', bounds(m[1], m[2]), 'LT')]
  m = /^(\d+) min change-of-pace tempo run: (\d+) min fast, (\d+) min steady, followed by (\d+) × \(?(\d+) min fast, (\d+) min steady\)?$/i.exec(clause)
  if (m) return [{ kind: 'sequence', duration_min: +m[1], steps: [work('duration_min', +m[2], 'fast'),
    work('duration_min', +m[3], 'steady'), repeat(m[4], [work('duration_min', +m[5], 'fast'), work('duration_min', +m[6], 'steady')])] }]
  if (/^\d+ min LT interval\b/.test(clause)) {
    const match = /(\d+) min LT interval(?: \(jog (\d+) min recovery\))?\s*/gy
    const steps = []
    let end = 0, part
    while ((part = match.exec(clause))) {
      steps.push(work('duration_min', +part[1], 'LT'))
      if (part[2]) steps.push(recovery('duration_min', +part[2], 'between intervals'))
      end = match.lastIndex
    }
    if (end === clause.length) return steps
  }
  m = /^(?:(Increase effort steadily throughout run), last )?([\d.]+) miles(?: \(([\d.]+) km\))? (?:at|@) (.+?)\)?$/i.exec(clause)
  if (m) {
    const step = work('distance_miles', Number(m[2]), m[4])
    if (m[3]) step.distance_km = Number(m[3])
    if (m[1]) return [{ kind: 'progression', instruction: m[1] }, { ...step, instruction: 'last segment' }]
    return [step]
  }
  m = /^([\d,]+)\s*(m|% of race distance) @ (.+)$/i.exec(clause)
  if (m) return [work(m[2] === 'm' ? 'distance_m' : 'race_distance_pct', bounds(m[1]), m[3])]
  return parseIntervals(clause) ?? [{ kind: 'instruction', instruction: clause }]
}

export function bookSteps(workout) {
  let text = workout.source_text
  if (!text) return []
  if (workout.session === 'AM') text = text.split(/\bPM\b/)[0]
  if (workout.session === 'PM') text = text.split(/\bPM\b/).at(-1)
  if (/^run_\d+$/.test(workout.session ?? '')) return []
  const total = /\d+(?:-\d+)? miles?\s*\(\s*\d+(?:-\d+)?\s*km\)/i.exec(text)
  if (!total) return []
  let tail = text.slice(total.index + total[0].length).trim()
  if (workout.session === 'AM') return [] // The trailing words can name the evening session.
  tail = tail.replace(/[·\s]+$/, '').replace(/^[|]?\s*with\s+/i, '')
    .replace(/be- tween/g, 'between').replace(/re-? cov-? ery|recov- ery|re- covery/g, 'recovery')
    .replace(/dis- tance/g, 'distance').trim()
  if (!tail) return []
  const clauses = tail.split(/\s*\+\s*|,?\s+followed by\s+(?=\d+\s*[×x]\s*\d+\s*m\b)|(?<=strides)\s+(?=\(?\d)/i)
  return clauses.flatMap(clause => parseClause(clause.replace(/^\((.+)\)$/, '$1')))
}

