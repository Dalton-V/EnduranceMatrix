import { useEffect, useMemo, useRef, useState } from 'react'
import { loadSkillCatalog } from './catalog.js'
import { CATEGORIES } from './skillSettings.js'
import { evaluateSkill, getSummary, newlyAvailable, STATES } from './progression.js'
import { emptyProgress, MAX_IMPORT_SIZE, mergeProgress, parseProgress, updateSkill } from './progressStorage.js'
import { useSkillProgress } from './useSkillProgress.js'
import { focusPath } from './treeLayout.js'
import SkillMap from './SkillMap.jsx'
import SkillDetails from './SkillDetails.jsx'
import './skillTree.css'

function Summary({ summary, onInspect }) {
  return <div className="st-summary-grid">
    <section className="st-card st-suggestions">
      <h2>Suggested next skills</h2>
      {summary.suggestions.length ? <ul>
        {summary.suggestions.map(({ skill, reason }) => <li key={skill.id}><button type="button" onClick={() => onInspect(skill.id)}>
          <span><strong>{skill.name}</strong><small>{reason}</small></span><span aria-hidden="true">↗</span>
        </button></li>)}
      </ul> : <p>No available skills to suggest.</p>}
    </section>
    <section className="st-card st-milestones">
      <h2>Milestones</h2>
      {summary.achievements.length ? <ul>{summary.achievements.map(item => <li key={item.id}>
        <span>{item.label}</span><time dateTime={item.date}>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
      </li>)}</ul> : <p>Your first milestone appears when you master a skill.</p>}
      {summary.unlocked.length > 0 && <div className="st-unlocked"><h3>Recently unlocked</h3>
        <ul>{summary.unlocked.map(({ skill }) => <li key={skill.id}><button type="button" className="st-link"
          onClick={() => onInspect(skill.id)}>{skill.name}</button></li>)}</ul>
      </div>}
    </section>
  </div>
}

function ProgressTools({ progress, changeProgress, onAnnounce }) {
  const [mode, setMode] = useState('merge')
  const [error, setError] = useState('')

  function exportFile() {
    const blob = new Blob([JSON.stringify(progress)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'endurance-matrix-skill-progress.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    onAnnounce('Progress export created.')
  }

  async function importFile(event) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setError('')
    try {
      if (file.size > MAX_IMPORT_SIZE) throw new Error('The progress file is too large.')
      const incoming = parseProgress(await file.text())
      if (mode === 'replace' && !window.confirm('Replace all browser progress with this file?')) return
      changeProgress(current => mode === 'replace' ? incoming : mergeProgress(current, incoming), { replace: mode === 'replace' })
      onAnnounce('Progress imported.')
    } catch (error) {
      setError(error.message)
    } finally {
      input.value = ''
    }
  }

  return <details className="st-card st-tools">
    <summary>Manage browser progress</summary>
    <p>Progress stays in this browser and device. Export a backup to move it to another browser or recover it if this browser’s data is cleared.</p>
    <div className="st-actions">
      <button className="st-button" type="button" onClick={exportFile}>Export progress</button>
      <button className="st-button st-danger" type="button" onClick={() => {
        if (!window.confirm('Delete all skill tree progress, history, and goals from this browser?')) return
        changeProgress(emptyProgress, { replace: true })
        onAnnounce('All skill tree progress cleared.')
      }}>Reset all progress</button>
    </div>
    <div className="st-import">
      <label>Import mode<select value={mode} onChange={event => setMode(event.target.value)}>
        <option value="merge">Merge with browser progress</option><option value="replace">Replace browser progress</option>
      </select></label>
      <label>Import progress JSON<input type="file" accept=".json,application/json" onChange={importFile} /></label>
    </div>
    {error && <p className="st-warning" role="alert">{error}</p>}
  </details>
}

function SkillTree({ catalog }) {
  const { progress, warning, changeProgress } = useSkillProgress()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [difficulty, setDifficulty] = useState('all')
  const [view, setView] = useState(() => matchMedia('(max-width: 720px)').matches ? 'list' : 'tree')
  const [focus, setFocus] = useState(null)
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const opener = useRef(null)
  const mapTitle = useRef(null)
  const { category } = progress.preferences
  const evaluations = useMemo(() => new Map(catalog.skills.map(skill => [skill.id, evaluateSkill(skill, progress)])), [catalog, progress])
  const summary = useMemo(() => getSummary(catalog, progress, evaluations, category), [catalog, progress, evaluations, category])
  const filtersByStatus = status === 'all' ? null : evaluations
  const visible = useMemo(() => {
    const branch = focus ? focusPath(catalog, focus) : null
    const terms = query.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    return catalog.skills.filter(skill =>
      (!branch || branch.has(skill.id)) &&
      (category === 'all' || skill.categories.includes(category)) &&
      (difficulty === 'all' || skill.difficulty === difficulty) &&
      (!filtersByStatus || filtersByStatus.get(skill.id).status === status) &&
      terms.every(term => (skill.name + ' ' + skill.sourceName + ' ' + skill.id).toLowerCase().replace(/[^a-z0-9]+/g, ' ').includes(term)),
    )
  }, [catalog, category, difficulty, filtersByStatus, focus, query, status])
  const detail = selected ? catalog.byId.get(selected) : null
  const goals = progress.selectedGoals.map(id => catalog.byId.get(id)).filter(Boolean)
  const difficulties = [...new Set(catalog.skills.map(skill => skill.difficulty))]

  function inspect(id) {
    if (!selected) opener.current = document.activeElement
    setMessage('')
    setSelected(id)
  }

  function close(toTree = false) {
    setSelected(null)
    setMessage('')
    requestAnimationFrame(() => {
      const element = !toTree && opener.current?.isConnected ? opener.current : mapTitle.current
      element?.focus()
    })
  }

  function focusSkill(id) {
    setFocus(id)
    setQuery('')
    setStatus('all')
    setDifficulty('all')
    chooseCategory('all')
    close(true)
  }

  function chooseCategory(nextCategory) {
    changeProgress(current => current.preferences.category === nextCategory ? current :
      { ...current, preferences: { ...current.preferences, category: nextCategory } })
  }

  function saveAttempt(attempt) {
    changeProgress(current => updateSkill(current, detail.id, record => {
      const sessions = record.sessions.filter(previous => previous.id !== attempt.id)
      return { ...record, sessions: [...sessions, attempt] }
    }))
    setMessage('Attempt saved.')
  }

  function master(override) {
    const at = new Date().toISOString()
    let result = ''
    changeProgress(current => {
      if (!override && evaluateSkill(detail, current).status !== 'ready') {
        result = 'The current progress record does not meet readiness requirements.'
        return current
      }
      if (current.skills[detail.id]?.mastery) return current
      const next = updateSkill(current, detail.id, record => ({ ...record, mastery: { at, override } }))
      const unlocked = newlyAvailable(detail, catalog, current, next)
      result = detail.name + ' mastered' + (override ? ' by manual override' : '') + '.' +
        (unlocked.length ? ' Newly unlocked skills include ' + unlocked.map(skill => skill.name).join(', ') + '.' : '')
      return next
    })
    setMessage(result)
  }

  return <main className="st-page">
    <section className="st-hero">
      <div className="st-hero-content"><h1>Calisthenics Skill Tree</h1>
        <p>Explore movement paths, log your training, and unlock the next skill when you’re ready.</p>
      </div>
      <div className="st-hero-progress">
        <span>Tree completion</span><strong>{Math.round(summary.mastered / (catalog.skills.length || 1) * 100)}%</strong>
        <progress value={summary.mastered} max={catalog.skills.length || 1} aria-label="Overall tree completion" />
      </div>
    </section>
    <div className="st-stats" aria-label="Progress overview">
      <div><strong>{summary.mastered}<small> / {catalog.skills.length}</small></strong><span>Skills mastered</span></div>
      <div><strong>{summary.started}</strong><span>In progress</span></div>
      <div><strong>{summary.ready}</strong><span>Ready to test</span></div>
    </div>

    <section className="st-card st-explore" aria-labelledby="st-map-title">
      <div className="st-explore-head">
        <div className="st-explore-top">
          <h2 id="st-map-title" ref={mapTitle} tabIndex={-1}>Skill map</h2>
          <label className="st-search"><span className="st-visually-hidden">Search skills</span>
            <input type="search" placeholder="Search skills" value={query} onChange={event => setQuery(event.target.value)} />
          </label>
        </div>
        <div className="st-category-buttons" aria-label="Movement categories" role="group">
          {Object.entries({ all: 'All Skills', ...CATEGORIES }).map(([id, label]) => <button key={id} type="button"
            aria-pressed={category === id} onClick={() => chooseCategory(id)}>{label}</button>)}
        </div>
        <div className="st-filters">
          <label>Difficulty<select value={difficulty} onChange={event => setDifficulty(event.target.value)}>
            <option value="all">All difficulties</option>{difficulties.map(level => <option key={level}>{level}</option>)}
          </select></label>
          <label>Status<select value={status} onChange={event => setStatus(event.target.value)}>
            <option value="all">All statuses</option>{Object.entries(STATES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
          {focus && <button className="st-button" type="button" onClick={() => setFocus(null)} aria-label="Clear focused skill path">
            {catalog.byId.get(focus).name} path ×</button>}
        </div>
        {!!goals.length && <div className="st-goals"><strong>Your goals</strong>
          {goals.map(goal => <button className="st-link" type="button" key={goal.id} onClick={() => inspect(goal.id)}>{goal.name}</button>)}
        </div>}
      </div>
      <SkillMap key={category + '/' + (focus ?? 'all')} skills={visible} catalog={catalog} evaluations={evaluations} view={view}
        onView={setView} focus={focus} onInspect={inspect} />
    </section>

    <Summary summary={summary} onInspect={inspect} />
    <section className="st-card st-category-summary">
      <h2>Progress by category</h2>
      <div>{summary.categoryCounts.map(({ id, mastered, total }) => <button className="st-category-progress" type="button" key={id} onClick={() => {
        setFocus(null)
        chooseCategory(id)
        mapTitle.current.focus()
      }}>
        <span>{CATEGORIES[id]} <strong>{mastered}/{total}</strong></span>
        <progress value={mastered} max={total || 1} aria-label={CATEGORIES[id] + ' completion'} />
      </button>)}</div>
    </section>
    {warning && <p role="alert" className="st-warning">{warning}</p>}
    <ProgressTools progress={progress} changeProgress={changeProgress} onAnnounce={setMessage} />
    <p className="st-source">Movement catalog · {catalog.title} · {catalog.edition}</p>
    {!detail && <p role="status" className="st-visually-hidden">{message}</p>}

    {detail && <SkillDetails skill={detail} catalog={catalog} evaluations={evaluations} evaluation={evaluations.get(detail.id)}
      record={progress.skills[detail.id]} goal={progress.selectedGoals.includes(detail.id)} announce={message} warning={warning}
      onClose={() => close()} onInspect={inspect} onFocus={focusSkill} onSave={saveAttempt} onMaster={master}
      onGoal={() => {
        const isGoal = progress.selectedGoals.includes(detail.id)
        changeProgress(current => ({
          ...current, selectedGoals: isGoal ? current.selectedGoals.filter(id => id !== detail.id) : [...new Set([...current.selectedGoals, detail.id])],
        }))
        setMessage(isGoal ? 'Goal removed.' : 'Goal saved.')
      }}
      onRemove={attemptId => {
        changeProgress(current => updateSkill(current, detail.id, record => ({
          ...record, sessions: record.sessions.filter(attempt => attempt.id !== attemptId),
        })))
        setMessage('Attempt removed.')
      }}
      onReset={() => {
        changeProgress(current => updateSkill(current, detail.id, () => null))
        setMessage('Skill progress reset.')
      }}
    />}
  </main>
}

export default function SkillTreePage() {
  const [result, setResult] = useState(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    loadSkillCatalog(import.meta.env.BASE_URL, controller.signal)
      .then(catalog => setResult({ catalog }))
      .catch(error => { if (!controller.signal.aborted) setResult({ error: error.message }) })
    return () => controller.abort()
  }, [retry])
  if (!result) return <main className="st-page"><h1>Calisthenics Skill Tree</h1><p role="status">Loading movement paths.</p></main>
  if (result.error) return <main className="st-page"><h1>Calisthenics Skill Tree</h1><p role="alert">{result.error}</p>
    <button type="button" className="st-button" onClick={() => { setResult(null); setRetry(retry + 1) }}>Try again</button>
  </main>
  return <SkillTree catalog={result.catalog} />
}
