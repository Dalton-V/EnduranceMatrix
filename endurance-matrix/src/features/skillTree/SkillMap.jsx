import { useMemo, useRef, useState } from 'react'
import { STATES } from './progression.js'
import { layoutTree, NODE_HEIGHT, NODE_WIDTH } from './treeLayout.js'

const statusIcons = {
  locked: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  available: <circle cx="12" cy="12" r="6" />,
  inProgress: <><circle cx="12" cy="12" r="8" /><path d="M12 4v8l5 5" /></>,
  ready: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z" /></>,
  mastered: <path d="m5 12 4 4L19 6" />,
}

export function SkillStatus({ status }) {
  return <span className="st-status" data-status={status}>
    <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{statusIcons[status]}</svg>
    {STATES[status]}
  </span>
}

function SkillNode({ skill, evaluation, focused, onInspect, position }) {
  const { status, readiness } = evaluation
  return <button
    className="st-node" data-status={status} data-focus={focused || undefined}
    style={position && { left: position.x, top: position.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
    onClick={() => onInspect(skill.id)} title={skill.name + ' · ' + skill.difficulty} type="button"
  >
    <span className="st-node-name">{skill.name}</span>
    <span className="st-node-meta"><SkillStatus status={status} /><span>{skill.difficulty}</span></span>
    {readiness.criteria.length > 0 && status === 'inProgress' &&
      <progress value={Math.min(...readiness.criteria.map(score => score.fraction))} max="1" aria-label={skill.name + ' lowest benchmark progress'} />}
  </button>
}

function Edge({ edge, layout, evaluations }) {
  const from = layout.visible.get(edge.from)
  const to = layout.visible.get(edge.to)
  const x1 = from.x + NODE_WIDTH
  const x2 = to.x - 4
  const y1 = from.y + NODE_HEIGHT / 2
  const y2 = to.y + NODE_HEIGHT / 2
  const middle = x1 + 17
  const mastered = evaluations.get(edge.from).status === 'mastered'
  return <path d={`M ${x1} ${y1} H ${middle} C ${middle + 4} ${y1}, ${middle - 4} ${y2}, ${middle} ${y2} H ${x2}`}
    className={mastered ? 'st-edge st-edge-done' : 'st-edge'}
    markerEnd={mastered ? 'url(#st-arrow-done)' : 'url(#st-arrow)'}
    strokeDasharray={edge.alternative ? '4 5' : undefined} />
}

export default function SkillMap({ skills, catalog, evaluations, focus, onInspect, view, onView }) {
  const viewport = useRef(null)
  const drag = useRef(null)
  const [scale, setScale] = useState(1)
  const layout = useMemo(() => view === 'tree' ? layoutTree(skills, catalog.families) : null, [skills, catalog, view])

  function zoom(value, reset = false) {
    const box = viewport.current
    if (!box) return
    const next = Math.min(1.5, Math.max(0.05, value))
    const left = reset ? 0 : ((box.scrollLeft + box.clientWidth / 2) * next / scale) - box.clientWidth / 2
    const top = reset ? 0 : ((box.scrollTop + box.clientHeight / 2) * next / scale) - box.clientHeight / 2
    setScale(next)
    requestAnimationFrame(() => box.scrollTo({ left, top }))
  }

  function startDrag(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button')) return
    const box = event.currentTarget
    drag.current = { x: event.clientX, y: event.clientY, left: box.scrollLeft, top: box.scrollTop }
    box.setPointerCapture(event.pointerId)
  }

  function moveDrag(event) {
    if (!drag.current) return
    const { x, y, left, top } = drag.current
    event.currentTarget.scrollTo(left + x - event.clientX, top + y - event.clientY)
  }

  const node = (skill, position) => <SkillNode key={skill.id} skill={skill} evaluation={evaluations.get(skill.id)}
    focused={skill.id === focus} onInspect={onInspect} position={position} />

  return <>
    <div className="st-map-bar">
      <div className="st-view-buttons" aria-label="Map view" role="group">
        <button type="button" onClick={() => onView('tree')} aria-pressed={view === 'tree'}>Tree</button>
        <button type="button" onClick={() => onView('list')} aria-pressed={view === 'list'}>List</button>
      </div>
      <span className="st-muted st-map-legend">{skills.length} {skills.length === 1 ? 'skill' : 'skills'}{view === 'tree' && ' · Dashed paths show alternatives'}</span>
      {view === 'tree' && skills.length > 0 && <div className="st-map-tools" aria-label="Tree zoom" role="group">
        <button type="button" aria-label="Zoom out" onClick={() => zoom(scale / 1.25)} disabled={scale <= 0.05}>−</button>
        <button type="button" aria-label="Zoom in" onClick={() => zoom(scale * 1.25)} disabled={scale >= 1.5}>+</button>
        <button type="button" onClick={() => {
          const box = viewport.current
          zoom(Math.min(1, box.clientWidth / layout.width, box.clientHeight / layout.height), true)
        }}>Fit</button>
        <button type="button" onClick={() => zoom(1, true)}>Reset view</button>
      </div>}
    </div>
    {!skills.length && <p className="st-empty">No skills match these filters.</p>}
    {skills.length > 0 && (view === 'list' ? <div className="st-list">
      {catalog.families.map(family => {
        const inFamily = skills.filter(skill => skill.family === family)
        if (!inFamily.length) return null
        return <section key={family}><h3>{family}</h3><ol>
          {inFamily.map(skill => <li key={skill.id}>
            {node(skill)}
            {skill.prerequisites.length > 0 && <p className="st-list-path">
              Requires {skill.prerequisites.map(group => group.map(id => catalog.byId.get(id).name).join(' or ')).join(' · ')}
            </p>}
          </li>)}
        </ol></section>
      })}
    </div> : <div className="st-viewport" tabIndex={0} role="region" aria-label="Scrollable skill tree"
      ref={viewport} onPointerDown={startDrag} onPointerMove={moveDrag} onLostPointerCapture={() => { drag.current = null }}>
      <div className="st-scene" style={{ width: layout.width * scale, height: layout.height * scale }}>
        <div className="st-scene-inner" style={{ width: layout.width, height: layout.height, transform: 'scale(' + scale + ')' }}>
          {layout.lanes.map(lane => <div className="st-lane" key={lane.family} style={{ top: lane.top, height: lane.height }}><span>{lane.family}</span></div>)}
          <svg aria-hidden="true" className="st-edges" width={layout.width} height={layout.height}>
            <defs>
              <marker id="st-arrow" viewBox="0 0 6 6" refX="4" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 0 5 3 1 6" fill="#8197a6" /></marker>
              <marker id="st-arrow-done" viewBox="0 0 6 6" refX="4" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 0 5 3 1 6" fill="#287d65" /></marker>
            </defs>
            {layout.edges.map(edge => <Edge key={edge.from + '>' + edge.to} edge={edge} layout={layout} evaluations={evaluations} />)}
          </svg>
          {skills.map(skill => node(skill, layout.visible.get(skill.id)))}
        </div>
      </div>
    </div>)}
  </>
}
