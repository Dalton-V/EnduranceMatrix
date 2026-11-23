import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { Store } from './database.mjs'
import { importDocument } from './library.mjs'
import { exportProgression, importProgression, readProgressionWorkbook } from './progressions.mjs'

const filename = 'Bodyweight Fitness Progressions.ods'
const workbook = readFileSync(new URL('../DataToParse/' + filename, import.meta.url))

test('Version 5.4 retains paths, shared placements, prerequisites and hyperlink occurrences', t => {
  const db = new Store(':memory:', { create: true })
  t.after(() => db.close())
  const load = () => db.transaction(() => importDocument(db, filename, workbook))
  assert.equal(load().added, 1)
  assert.equal(load().added, 0)
  const chart = exportProgression(db, 1)
  assert.equal(chart.sheet, 'Version 5.4')
  const skills = chart.entries.filter(e => e.kind === 'skill')
  assert.equal(skills.length, 245)
  assert.equal(new Set(skills.map(e => e.text)).size, 244)
  assert.equal(skills.filter(e => e.milestone).length, 60)
  const links = chart.entries.flatMap(e => e.links ?? [])
  assert.equal(links.length, 180)
  assert.equal(new Set(links.map(l => l.url)).size, 176)
  assert.deepEqual(chart.entries.find(e => e.cell === 'CO2').links,
    [{ label: 'Squat Sky Reach', url: 'https://youtu.be/lbozu0DPcYI?t=42s' }])
  assert.deepEqual(skills.filter(e => e.text === 'Ring Planche').map(e => e.cell), ['BY48', 'BH50'])
  assert.equal(db.one("SELECT count(*) n FROM movement WHERE name='Ring Planche'").n, 1)
  assert.deepEqual(chart.edges.filter(e => e.from === 'G11').map(e => e.to), ['D14', 'N14'])
  assert.deepEqual(chart.edges.filter(e => e.to === 'G19').map(e => e.from), ['N14', 'P11'])
  assert.ok(chart.edges.some(e => e.from === 'Y21' && e.to === 'Z30')) // Lane passes behind two labels.
  assert.deepEqual(chart.edges.filter(e => e.kind === 'prerequisite').map(e => e.to), Array(5).fill('L45'))
  assert.equal(db.one('SELECT count(*) n FROM plan').n, 0)
  assert.deepEqual(db.rows('PRAGMA foreign_key_check'), [])

  const updated = structuredClone(chart)
  updated.entries.find(e => e.cell === 'CO2').links[0].url += '&example=1'
  db.transaction(() => importProgression(db, 'revised.json', updated))
  assert.deepEqual(exportProgression(db, 1), chart)
  assert.deepEqual(exportProgression(db, 2), updated)
  assert.equal(load().added, 0)
  assert.equal(db.one('SELECT revision FROM current_progression_revision').revision, 2)

  const bad = structuredClone(updated)
  bad.edges.push({ from: 'G8', to: 'missing', kind: 'next_on_chart' })
  assert.throws(() => db.transaction(() => importProgression(db, 'bad.json', bad)), /FOREIGN KEY/)
  assert.equal(db.one('SELECT count(*) n FROM progression_revision').n, 2)
})

test('scheduled exercises can reuse the chart movement without changing their wording', t => {
  const db = new Store(':memory:', { create: true })
  t.after(() => db.close())
  const plan = { plan: { id: 'pull', name: 'Pull', workout_definitions: { strength: { label: 'Strength' } },
    schedule: [{ week: 1, days: [{ day_of_week: 'monday', workouts: [{ workout_ref: 'strength',
      steps: [{ kind: 'work', exercise: 'Pull Up', reps: 3 }] }] }] }] } }
  db.transaction(() => {
    importDocument(db, 'pull.json', Buffer.from(JSON.stringify(plan)))
    importProgression(db, filename, readProgressionWorkbook(workbook))
  })
  const row = db.one('SELECT w.exercise,s.cell FROM workout_step w JOIN progression_skill s USING(movement_id)')
  assert.deepEqual({ ...row }, { exercise: 'Pull Up', cell: 'AA11' })
})
