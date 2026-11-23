import { useState } from 'react'
import { formatSession } from './progression.js'
import { localDate, MAX_SETS, validateSession } from './progressStorage.js'
import { METRICS } from './skillSettings.js'

export function Readiness({ skill, readiness }) {
  const { benchmark } = skill
  if (!benchmark) return <section className="st-detail-section">
    <h3>Readiness benchmarks</h3>
    <p>No readiness benchmarks are configured for this skill. You can still log practice and self-assess mastery.</p>
  </section>
  return <section className="st-detail-section">
    <h3>Readiness benchmarks</h3>
    <p>Use these as recommended training targets. Record all checks in the same attempt on {benchmark.consistency === 1 ? 'one day' : benchmark.consistency + ' different days'}.</p>
    <ul className="st-criteria">
      {readiness.criteria.map(({ criterion, fraction, qualifyingSets, value }) => {
        const isCheck = criterion.type === 'check'
        const unit = METRICS[skill.metric].unit
        const resistance = [
          criterion.minLoadKg === undefined ? '' : 'at least ' + criterion.minLoadKg + ' kg added',
          criterion.maxAssistanceKg === undefined ? '' : 'at most ' + criterion.maxAssistanceKg + ' kg assistance',
        ].filter(Boolean)
        const title = isCheck ? criterion.label : criterion.sets + ' sets of ' + criterion.target + ' ' + unit +
          (resistance.length ? ' with ' + resistance.join(' and ') : '')
        return <li key={criterion.id}>
          <strong>{title}</strong>
          <span>{isCheck ? (fraction ? 'Confirmed in a logged attempt' : 'Confirm when you log an attempt') :
            qualifyingSets + ' of ' + criterion.sets + ' sets at target' + (value > 0 ? ' · ' + value + ' ' + unit + ' in the weakest counted set' : '')}</span>
          <progress value={fraction} max="1" aria-label={title} />
        </li>
      })}
    </ul>
    <p><strong>{readiness.qualifyingDays} of {benchmark.consistency}</strong> qualifying {benchmark.consistency === 1 ? 'day' : 'days'}</p>
    {benchmark.rationale && <p>{benchmark.rationale}</p>}
    {benchmark.source && <a href={benchmark.source.url} target="_blank" rel="noreferrer">{benchmark.source.label}</a>}
  </section>
}

export function AttemptForm({ skill, session, onSave, onCancel }) {
  const metric = session?.metric ?? skill.metric
  const { fields } = METRICS[metric]
  const benchmark = metric === skill.metric ? skill.benchmark : null
  const [sets, setSets] = useState(() => session?.sets.map(set => set.map(String)) ?? (fields.length ? [fields.map(() => '')] : []))
  const [error, setError] = useState('')
  const emptySet = () => fields.map(() => '')
  const checkCriteria = benchmark?.criteria.filter(item => item.type === 'check') ?? []

  function submit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const optionalNumber = name => data.get(name) ? Number(data.get(name)) : null
    if (sets.some(set => set.includes(''))) {
      setError('Enter a value for every set and side.')
      return
    }
    try {
      onSave(validateSession({
        id: session?.id ?? crypto.randomUUID(), date: data.get('date'), metric, sets: sets.map(set => set.map(Number)),
        loadKg: optionalNumber('load'), assistanceKg: optionalNumber('assistance'), notes: data.get('notes').trim(),
        checks: benchmark ? data.getAll('check') : session?.checks ?? [],
        benchmarkVersion: benchmark?.version ?? session?.benchmarkVersion ?? 0,
      }))
    } catch (error) {
      setError(error.message)
    }
  }

  return <form onSubmit={submit} className="st-attempt-form">
    <label>Date of attempt<input name="date" type="date" required defaultValue={session?.date ?? localDate()} /></label>
    {fields.length > 0 && <fieldset className="st-set-fields">
      <legend>{METRICS[metric].label} by set</legend>
      {sets.map((set, index) => <div className="st-set" key={index}>
        {fields.map((field, column) => <label key={field}>{field} for set {index + 1}
          <input type="number" inputMode={metric.endsWith('reps') ? 'numeric' : 'decimal'} required
            min="0" max="10000" step={metric.endsWith('reps') ? '1' : 'any'} value={set[column]}
            onChange={event => {
              const value = event.target.value
              setSets(previous => previous.map((row, rowIndex) => rowIndex === index
                ? row.map((item, colIndex) => colIndex === column ? value : item)
                : row))
            }} />
        </label>)}
        {sets.length > 1 && <button className="st-button" type="button" aria-label={'Remove set ' + (index + 1)}
          onClick={() => setSets(previous => previous.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>}
      </div>)}
      <button className="st-button" type="button" disabled={sets.length >= MAX_SETS} onClick={() => setSets(previous => [...previous, emptySet()])}>Add set</button>
    </fieldset>}
    {(skill.loaded || session?.loadKg != null) && <label>Added load per set (kg)
      <input name="load" type="number" inputMode="decimal" min="0" max="10000" step="any" defaultValue={session?.loadKg ?? ''} />
    </label>}
    {(skill.assisted || session?.assistanceKg != null) && <label>Assistance per set (kg, if known)
      <input name="assistance" type="number" inputMode="decimal" min="0" max="10000" step="any" defaultValue={session?.assistanceKg ?? ''} />
    </label>}
    {checkCriteria.length > 0 && <fieldset className="st-checks">
      <legend>Technique in this attempt</legend>
      {checkCriteria.map(criterion => <label key={criterion.id}>
        <input type="checkbox" name="check" value={criterion.id}
          defaultChecked={session?.benchmarkVersion === benchmark.version && session.checks.includes(criterion.id)} />
        <span>{criterion.label}</span>
      </label>)}
    </fieldset>}
    <label>Notes (optional)<textarea name="notes" rows="2" maxLength="2000" defaultValue={session?.notes ?? ''} /></label>
    {error && <p role="alert" className="st-warning">{error}</p>}
    <div className="st-actions">
      <button type="submit" className="st-button st-primary">{session ? 'Save changes' : 'Save attempt'}</button>
      {session && <button type="button" className="st-button" onClick={onCancel}>Cancel edit</button>}
    </div>
  </form>
}

function TrendChart({ sessions, metric }) {
  const points = sessions.filter(session => session.metric === metric && session.sets.length).slice(0, 12).reverse()
    .map(session => ({ date: session.date, value: Math.max(...session.sets.map(set => Math.min(...set))) }))
  if (points.length < 2) return null
  const unit = METRICS[metric].unit
  const max = Math.max(1, ...points.map(point => point.value))
  const step = 312 / (points.length - 1)
  const coordinates = points.map((point, index) => ({ ...point, x: 16 + index * step, y: 77 - 62 * point.value / max }))
  const summary = points.map(point => point.date + ', ' + point.value + ' ' + unit).join('; ')
  return <figure className="st-trend">
    <figcaption>Best set per attempt · {unit}</figcaption>
    <svg viewBox="0 0 344 90" role="img" aria-label={summary}>
      <path d="M16 14H328 M16 46H328 M16 77H328" fill="none" stroke="#d9e6e5" />
      <polyline points={coordinates.map(({ x, y }) => x + ',' + y).join(' ')} fill="none" stroke="#287d65" strokeWidth="2" />
      {coordinates.map(({ x, y, date, value }, index) => <circle key={index} cx={x} cy={y} r="3.5" fill="#287d65"><title>{date} · {value} {unit}</title></circle>)}
    </svg>
    <div className="st-trend-labels"><span>{points[0].date}</span><span>{points.at(-1).date}</span></div>
  </figure>
}

export function TrainingHistory({ skill, sessions, onEdit, onRemove }) {
  const [limit, setLimit] = useState(6)
  const recent = [...sessions].reverse().sort((a, b) => b.date.localeCompare(a.date))
  return <section className="st-detail-section">
    <h3>Training history</h3>
    {!recent.length && <p>Your logged attempts will appear here.</p>}
    <TrendChart sessions={recent} metric={skill.metric} />
    {recent.length > 0 && <ol className="st-history">
      {recent.slice(0, limit).map(session => <li key={session.id}>
        <div>
          <time dateTime={session.date}>{session.date}</time>
          <strong>{formatSession(session)}</strong>
          {session.notes && <p>{session.notes}</p>}
        </div>
        <div className="st-actions">
          <button type="button" className="st-button" aria-label={'Edit attempt on ' + session.date} onClick={() => onEdit(session)}>Edit</button>
          <button type="button" className="st-button" aria-label={'Remove attempt on ' + session.date} onClick={() => onRemove(session)}>Remove</button>
        </div>
      </li>)}
    </ol>}
    {recent.length > limit && <button type="button" className="st-button" onClick={() => setLimit(limit + 6)}>Show more attempts</button>}
  </section>
}
