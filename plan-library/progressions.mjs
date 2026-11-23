import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { digest, hash, json, movementId, registerActivity } from './database.mjs'

export const chartFormat = 'bodyweight-progression-sheet-v1'

export function readProgressionWorkbook(bytes) {
  const script = fileURLToPath(new URL('read_progression_ods.py', import.meta.url))
  let candidates = [['python3'], ['python']]
  if (process.env.PLAN_LIBRARY_PYTHON) candidates = [[process.env.PLAN_LIBRARY_PYTHON]]
  else if (process.platform === 'win32') {
    // A WindowsApps alias can precede a working interpreter on the same PATH.
    const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean)
    candidates = [['py.exe', '-3'], ['python.exe'], ['python3.exe']].flatMap(([name, ...args]) =>
      dirs.map(dir => join(dir, name)).filter(path => existsSync(path)).map(path => [path, ...args]))
  }
  for (const [exe, ...args] of candidates) {
    const result = spawnSync(exe, [...args, '-B', script], { input: bytes, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true })
    if (['ENOENT', 'EACCES', 'EPERM'].includes(result.error?.code) || result.status === 9009) continue
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(result.stderr.trim() || 'ODS reader failed')
    return JSON.parse(result.stdout)
  }
  throw new Error('The ODS reader needs Python 3. Set PLAN_LIBRARY_PYTHON to its executable path.')
}

export function importProgression(db, filename, chart) {
  assert.equal(chart.format, chartFormat)
  if (!/^[a-z0-9][a-z0-9-]*$/.test(chart.key)) throw new Error('Invalid progression chart key')
  const fingerprint = digest(chart)
  const prior = db.one('SELECT id FROM progression_revision WHERE chart_key=? AND fingerprint=?', chart.key, fingerprint)
  if (prior) return { added: 0, charts: 1, seen: 0 }

  // Archive the selected sheet's semantic snapshot. A change on another tab
  // cannot introduce a revision or pull its content into the library.
  const bytes = Buffer.from(json(chart) + '\n')
  const sourceName = /\.ods$/i.test(filename) ? filename + '.' + chart.sheet + '.json' : filename
  db.run('INSERT OR IGNORE INTO source_document(filename,sha256,original) VALUES (?,?,?)', sourceName, hash(bytes), bytes)
  const document = db.one('SELECT id FROM source_document WHERE sha256=?', hash(bytes))
  registerActivity(db, 'calisthenics')
  db.run('INSERT OR IGNORE INTO progression_chart(key,activity_code) VALUES (?,?)', chart.key, 'calisthenics')
  const next = db.one('SELECT coalesce(max(revision),0)+1 AS n FROM progression_revision WHERE chart_key=?', chart.key).n
  const rev = db.insert('progression_revision', { chart_key: chart.key, revision: next, title: chart.title,
    sheet: chart.sheet, edition: chart.edition, document_id: document.id, fingerprint })
  for (const [position, name] of chart.families.entries()) {
    db.insert('progression_family', { revision_id: rev, position, name })
  }
  for (const [position, entry] of chart.entries.entries()) {
    const { cell, kind, text, detail = null } = entry
    db.insert('progression_entry', { revision_id: rev, position, cell, kind, text, detail })
    if (kind === 'skill') {
      db.insert('progression_skill', { revision_id: rev, cell, movement_id: movementId(db, text), family: entry.family,
        difficulty: entry.difficulty, milestone: Number(entry.milestone) })
    }
    for (const [i, link] of (entry.links ?? []).entries()) {
      db.run('INSERT OR IGNORE INTO resource_url(url) VALUES (?)', link.url)
      db.insert('progression_link', { revision_id: rev, cell, position: i, label: link.label, url: link.url })
    }
  }
  for (const edge of chart.edges) db.insert('progression_edge', {
    revision_id: rev, from_cell: edge.from, to_cell: edge.to, kind: edge.kind,
  })
  assert.deepEqual(exportProgression(db, rev), chart, 'Progression graph differs after import')
  return { added: 1, charts: 1, seen: 0 }
}

export function exportProgression(db, revision) {
  const r = db.one('SELECT * FROM progression_revision WHERE id=?', revision)
  if (!r) throw new Error('Unknown progression revision ' + revision)
  const families = db.rows('SELECT name FROM progression_family WHERE revision_id=? ORDER BY position', revision).map(x => x.name)
  const rows = db.rows('SELECT e.*, s.family, s.difficulty, s.milestone, m.name AS movement FROM progression_entry e ' +
    'LEFT JOIN progression_skill s USING(revision_id,cell) LEFT JOIN movement m ON m.id=s.movement_id ' +
    'WHERE e.revision_id=? ORDER BY e.position', revision)
  const entries = new Map(rows.map(e => {
    const item = { cell: e.cell, kind: e.kind, text: e.text }
    if (e.detail !== null) item.detail = e.detail
    if (e.kind === 'skill') {
      assert.equal(e.movement, e.text, 'Movement reference differs from ' + e.cell)
      Object.assign(item, { family: e.family, difficulty: e.difficulty, milestone: Boolean(e.milestone) })
    }
    return [e.cell, item]
  }))
  for (const link of db.rows('SELECT * FROM progression_link WHERE revision_id=? ORDER BY cell,position', revision)) {
    (entries.get(link.cell).links ??= []).push({ label: link.label, url: link.url })
  }
  const edges = db.rows('SELECT from_cell,to_cell,kind FROM progression_edge WHERE revision_id=? ORDER BY from_cell,to_cell,kind', revision)
    .map(e => ({ from: e.from_cell, to: e.to_cell, kind: e.kind }))
  return { format: chartFormat, key: r.chart_key, title: r.title, sheet: r.sheet,
    edition: r.edition, families, entries: [...entries.values()], edges }
}

export function currentProgressions(db) {
  return db.schemaVersion < 2 ? [] : db.rows('SELECT * FROM current_progression_revision ORDER BY chart_key')
}
