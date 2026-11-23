import { useEffect, useRef, useState } from 'react'
import { CATEGORIES, METRICS } from './skillSettings.js'
import { SkillStatus } from './SkillMap.jsx'
import { AttemptForm, Readiness, TrainingHistory } from './TrainingLog.jsx'

function ExerciseResources({ skill, guides }) {
  const image = skill.links.find(link => /\.(?:png|jpe?g|webp|gif)(?:[?#]|$)/i.test(link.url))
  return <section className="st-detail-section">
    <h3>Exercise guides & demonstrations</h3>
    {skill.description && <p>{skill.description}</p>}
    {image && <img loading="lazy" src={image.url} alt={skill.name + ' demonstration'} />}
    {skill.links.length ? <ul className="st-resource-list">
      {skill.links.map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">
        {/youtu\.be|youtube\.com/.test(link.url) ? 'Watch demonstration' : link.label}
      </a></li>)}
    </ul> : <p>No movement-specific guide is linked in the catalog.</p>}
    {!!guides.length && <details><summary>Training library references</summary>
      <ul className="st-resource-list">{guides.map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></li>)}</ul>
    </details>}
  </section>
}

function SkillRelations({ skill, catalog, evaluations, onInspect }) {
  const skillLink = id => {
    const { status } = evaluations.get(id)
    return <button type="button" className="st-skill-link" onClick={() => onInspect(id)}>
      {catalog.byId.get(id).name}<SkillStatus status={status} />
    </button>
  }
  const related = skill.chartNext.filter(id => !skill.next.includes(id))
  return <>
    <section className="st-detail-section">
      <h3>Prerequisites</h3>
      {!skill.prerequisites.length ? <p>You can start here.</p> : <>
        <p>{skill.prerequisites.length > 1 ? 'Master one skill in each group.' : skill.prerequisites[0].length > 1 ? 'Master any one of these skills to unlock this route.' : 'Master this prerequisite to unlock the skill.'}</p>
        <ul className="st-relations">
          {skill.prerequisites.map((group, index) => <li key={index}>
            {skill.prerequisites.length > 1 && <span>{group.length > 1 ? 'Choose one' : 'Required'} · {group.some(id => evaluations.get(id).status === 'mastered') ? 'Met' : 'Pending'}</span>}
            {group.map(id => <div key={id}>{skillLink(id)}</div>)}
          </li>)}
        </ul>
      </>}
    </section>
    {(skill.next.length > 0 || related.length > 0) && <section className="st-detail-section">
      <h3>Next in the tree</h3>
      {skill.next.length > 0 && <>
        <p>Mastering this skill counts toward unlocking these movements.</p>
        <ul className="st-relations">{skill.next.map(id => <li key={id}>{skillLink(id)}</li>)}</ul>
      </>}
      {related.length > 0 && <details><summary>Related routes from the source chart</summary>
        <ul className="st-relations">{related.map(id => <li key={id}>{skillLink(id)}</li>)}</ul>
      </details>}
    </section>}
  </>
}

function SkillBody({ skill, catalog, evaluation, evaluations, record, goal, announce, warning, onInspect,
  onFocus, onGoal, onSave, onRemove, onReset, onMaster }) {
  const [editing, setEditing] = useState(null)
  const [formVersion, setFormVersion] = useState(0)
  const training = useRef(null)
  const { status, readiness, mastery } = evaluation

  function clearForm() {
    setEditing(null)
    setFormVersion(value => value + 1)
  }

  return <>
    <div className="st-detail-content">
      <p className="st-detail-categories">{skill.categories.map(category => CATEGORIES[category]).join(' · ')} · {skill.difficulty}</p>
      <div className="st-actions">
        <button type="button" className="st-button" aria-pressed={goal} onClick={onGoal}>{goal ? 'Remove goal' : 'Set as goal'}</button>
        <button type="button" className="st-button" onClick={() => onFocus(skill.id)}>Focus this path</button>
      </div>
      <p role="status" className="st-announcement">{announce}</p>
      {warning && <p role="alert" className="st-warning">{warning}</p>}
      <SkillRelations skill={skill} catalog={catalog} evaluations={evaluations} onInspect={onInspect} />
      <Readiness skill={skill} readiness={readiness} />
      <section className="st-detail-section">
        <h3>Confirm mastery</h3>
        {mastery ? <p><strong>{mastery.override ? 'Mastered by manual override' : 'Mastered'}</strong> on {new Date(mastery.at).toLocaleDateString()}.</p> :
          status === 'ready' ? <>
            <p>Log is ready for assessment. Confirm mastery after you demonstrate the skill with the control described above.</p>
            <button type="button" className="st-button st-primary"
              onClick={() => { if (window.confirm('Did you successfully demonstrate this skill with controlled technique?')) onMaster(false) }}>Confirm successful test</button>
          </> : <>
            <p>{status === 'locked' ? 'Master the prerequisites to unlock training in the tree.' : 'Log an attempt that meets the recommendations, then confirm a successful test.'}</p>
            <button type="button" className="st-button"
              onClick={() => { if (window.confirm('Mark as mastered by manual override? This can unlock dependent skills even when prerequisites or benchmarks are incomplete.')) onMaster(true) }}>Record manual mastery</button>
          </>}
      </section>
      <section className="st-detail-section">
        <h3 tabIndex={-1} ref={training}>{editing ? 'Edit attempt' : 'Log an attempt'}</h3>
        <p>{METRICS[skill.metric].label}{!evaluation.eligible && ' · Practice can be recorded while this skill is locked.'}</p>
        <AttemptForm key={(editing?.id ?? 'new') + formVersion} skill={skill} session={editing}
          onSave={attempt => { onSave(attempt); clearForm() }}
          onCancel={() => { clearForm(); training.current.focus() }} />
      </section>
      <TrainingHistory skill={skill} sessions={record?.sessions ?? []}
        onEdit={attempt => {
          setEditing(attempt)
          requestAnimationFrame(() => training.current?.focus())
        }}
        onRemove={attempt => {
          if (!window.confirm('Remove this attempt from your training history?')) return
          if (editing?.id === attempt.id) clearForm()
          onRemove(attempt.id)
        }} />
      <ExerciseResources skill={skill} guides={catalog.guides} />
      {record && (record.sessions.length > 0 || record.mastery) && <section className="st-detail-section">
        <h3>Manage skill progress</h3>
        <button type="button" className="st-button st-danger" onClick={() => {
          if (!window.confirm('Reset mastery and delete all attempts for ' + skill.name + '?')) return
          onReset()
          clearForm()
        }}>Reset this skill</button>
      </section>}
    </div>
  </>
}

export default function SkillDetails({ skill, onClose, ...details }) {
  const dialog = useRef(null)
  const heading = useRef(null)
  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal()
  }, [])
  useEffect(() => {
    dialog.current.scrollTop = 0
    heading.current.focus()
  }, [skill.id])

  return <dialog ref={dialog} className="st-dialog" aria-labelledby="st-detail-title" onCancel={event => {
    event.preventDefault()
    onClose()
  }}>
    <header className="st-dialog-header">
      <div><SkillStatus status={details.evaluation.status} /><h2 id="st-detail-title" tabIndex={-1} ref={heading}>{skill.name}</h2></div>
      <button type="button" className="st-button st-close" onClick={onClose} aria-label="Close skill details">×</button>
    </header>
    <SkillBody key={skill.id} skill={skill} {...details} />
  </dialog>
}
