import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { adapt } from './adapters.mjs'
import { Store } from './database.mjs'
import { exportRevision, importDocument } from './library.mjs'

function memory(t) {
  const db = new Store(':memory:', { create: true })
  t.after(() => db.close())
  return db
}
function load(db, doc) {
  return db.transaction(() => importDocument(db, 'strength.json', Buffer.from(JSON.stringify(doc))))
}
function example() {
  return { plan: { id: 'strength', name: 'Basic strength', author: 'Coach A', tags: [],
    activity_types: ['strength_training'], workout_definitions: { circuit: {
      canonical_type: 'strength_circuit', discipline: 'strength', label: 'Foundation circuit' } },
    schedule: [{ week: 1, days: [{ day_of_week: 'monday', workouts: [{ workout_ref: 'circuit',
      notes: null, steps: [{ kind: 'circuit', sets: 3, steps: [
        { kind: 'work', exercise: 'squat', reps: { min: 8, max: 12 }, load_kg: 20 },
        { kind: 'work', exercise: 'push-up', reps: 10 },
        { kind: 'hold', exercise: 'calf stretch', hold_sec: 20 },
        { kind: 'recovery', rest_sec: 60 },
      ] }] }], alternative_workouts: [], additional_options: [[]] }] }] } }
}

test('strength, calisthenics and stretching retain ordered nested instructions and queryable units', t => {
  const db = memory(t), doc = example()
  doc.plan.meta = { goal_distance_km: null, training_volume_band: { min: null, max: 30, unit: 'miles' } }
  doc.plan.schedule[0].days[0].workouts[0].equipment = { optional: ['bench'] }
  load(db, doc)
  assert.deepEqual(exportRevision(db, 1), doc)
  const row = db.one("SELECT q.lower_bound, q.upper_bound, f.unit FROM workout_step s JOIN quantity q ON q.set_id=s.quantities JOIN quantity_field f ON f.field=q.field WHERE s.exercise='squat' AND f.kind='repetitions'")
  assert.deepEqual({ ...row }, { lower_bound: 8, upper_bound: 12, unit: 'count' })
  assert.equal(db.one("SELECT activity_code FROM activity_term WHERE term='strength_training'").activity_code, 'strength')
  assert.deepEqual(db.rows('PRAGMA foreign_key_check'), [])
})

test('re-import, new revision, replay of old input and invalid batch', t => {
  const db = memory(t), original = example(), revised = structuredClone(original)
  revised.plan.schedule[0].days[0].workouts[0].steps[0].sets = 4
  assert.equal(load(db, original).added, 1)
  assert.equal(load(db, original).added, 0)
  assert.equal(load(db, revised).added, 1)
  assert.equal(load(db, original).added, 0)
  assert.equal(db.one('SELECT revision FROM current_plan_revision').revision, 2)
  assert.deepEqual(exportRevision(db, 1), original)
  assert.deepEqual(exportRevision(db, 2), revised)
  const invalid = structuredClone(original)
  invalid.plan.schedule[0].days[0].workouts[0].workout_ref = 'unknown'
  assert.throws(() => db.transaction(() => {
    importDocument(db, 'new.json', Buffer.from(JSON.stringify({ plan: { ...original.plan, id: 'new' } })))
    importDocument(db, 'bad.json', Buffer.from(JSON.stringify(invalid)))
  }), /FOREIGN KEY/)
  assert.equal(db.one('SELECT count(*) n FROM plan').n, 1)
  assert.equal(db.one('SELECT count(*) n FROM source_document').n, 2)
})

test('coaches can use different names and instructions for the same type', t => {
  const db = memory(t), first = example(), second = structuredClone(first)
  second.plan.id = 'second'
  second.plan.author = 'Coach B'
  const def = second.plan.workout_definitions.circuit
  second.plan.workout_definitions = { bodyweight: { ...def, description: 'No external load' } }
  second.plan.schedule[0].days[0].workouts[0].workout_ref = 'bodyweight'
  load(db, first)
  db.transaction(() => importDocument(db, 'second.json', Buffer.from(JSON.stringify(second))))
  assert.equal(db.one('SELECT count(*) n FROM workout_type').n, 1)
  assert.equal(db.one('SELECT count(*) n FROM workout_definition').n, 2)
  assert.deepEqual(exportRevision(db, 2), second)
})

test('book adapter preserves published units, choices, citations and session boundaries', () => {
  const book = JSON.parse(readFileSync(new URL('../DataToParse/training_plans.json', import.meta.url), 'utf8'))
  const plans = [...adapt(book, 'training_plans.json')].map(entry => entry.payload.plan)
  const first = plans[0], raw = book.plans[0]
  assert.deepEqual(first.source.reader_pages, raw.source.reader_pages)
  assert.deepEqual(first.comparison, raw.comparison)
  assert.deepEqual(first.schedule[0].total_distance_km_range, raw.schedule[0].total_distance_km)
  const [mon, tue] = first.schedule[0].days
  assert.equal(mon.workouts[0].workout_ref, 'rest')
  assert.equal(mon.alternative_workouts[0].workout_ref, 'cross_training')
  assert.deepEqual(tue.workouts[0].distance_miles_range, { min: 8, max: 9 })
  assert.deepEqual(tue.workouts[0].distance_km_range, { min: 13, max: 14 })
  assert.deepEqual(tue.workouts[0].steps[0].duration_min, { min: 20, max: 25 })
  const days = plans.flatMap(p => p.schedule.flatMap(w => w.days))
  const pair = days.find(d => d.workouts[0]?.session === 'AM' && /LT PM/.test(d.workouts[0].source_text))
  assert.equal(pair.workouts[0].steps, undefined)
  assert.equal(pair.workouts[1].steps[0].intensity, 'LT')
  // Every source workout narrative survives at its original day, including doubles and post-race weeks.
  for (const [i, plan] of plans.entries()) {
    for (const [j, week] of book.plans[i].schedule.entries()) {
      for (const [k, day] of week.days.entries()) {
        const exported = plan.schedule[j].days[k].workouts
        for (const workout of day.workouts) assert.ok(exported.some(x => x.source_text === workout.source_text))
      }
    }
  }
})

