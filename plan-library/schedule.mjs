import { json, movementId, split, unpack } from './database.mjs'
import { readQuantities, writeQuantities } from './quantities.mjs'

const weekFields = ['week', 'phase', 'mesocycle', 'source_week', 'week_label', 'weeks_to_goal', 'weeks_after_goal',
  'is_recovery_week', 'notes', 'weekly_volume_source_text']
const workoutFields = ['workout_ref', 'source_workout_ref', 'session', 'event', 'source_text', 'notes']
const stepFields = ['kind', 'exercise', 'intensity', 'instruction']

function measured(db, item, fields, children) {
  const { rest, values } = split(item, fields, children)
  const quantities = writeQuantities(db, rest)
  return { ...values, quantities, extensions: json(rest) }
}

function readMeasured(db, row, fields) {
  const obj = unpack(row, fields)
  readQuantities(db, row.quantities, obj)
  return obj
}

function saveSteps(db, workoutId, parent, steps) {
  for (const [position, step] of steps.entries()) {
    const id = db.insert('workout_step', { workout_id: workoutId, parent_id: parent, position, movement_id: movementId(db, step.exercise),
      ...measured(db, step, stepFields, ['steps']) })
    if (step.steps) saveSteps(db, workoutId, id, step.steps)
  }
}

export function writeSchedule(db, revision, schedule) {
  for (const [position, week] of schedule.entries()) {
    const weekId = db.insert('plan_week', { revision_id: revision, position,
      ...measured(db, week, weekFields, ['days']) })
    for (const [dayPos, day] of week.days.entries()) {
      const { values, rest } = split(day, ['day_of_week'], ['workouts', 'alternative_workouts', 'additional_options'])
      const dayId = db.insert('plan_day', { week_id: weekId, revision_id: revision,
        position: dayPos, ...values, extensions: json(rest) })
      const options = [day.workouts, day.alternative_workouts, ...(day.additional_options ?? [])]
      for (const [optionPos, workouts] of options.entries()) {
        if (workouts == null) continue
        const optionId = db.insert('day_option', { day_id: dayId, revision_id: revision, position: optionPos })
        for (const [workoutPos, workout] of workouts.entries()) {
          const id = db.insert('scheduled_workout', { option_id: optionId, revision_id: revision,
            position: workoutPos, ...measured(db, workout, workoutFields, ['steps']) })
          if (workout.steps) saveSteps(db, id, null, workout.steps)
        }
      }
    }
  }
}

function readSteps(db, workoutId) {
  const roots = [], byId = new Map()
  // Parent IDs precede their children. Sorting sibling lists separately keeps
  // author-defined positions intact even when rows were inserted out of order.
  const rows = db.rows('SELECT * FROM workout_step WHERE workout_id=? ORDER BY id', workoutId)
  for (const row of rows) byId.set(row.id, readMeasured(db, row, stepFields))
  for (const row of rows.sort((a, b) => a.position - b.position)) {
    const list = row.parent_id == null ? roots : (byId.get(row.parent_id).steps ??= [])
    list.push(byId.get(row.id))
  }
  return roots
}

export function readSchedule(db, revision) {
  return db.rows('SELECT * FROM plan_week WHERE revision_id=? ORDER BY position', revision).map(week => {
    const result = readMeasured(db, week, weekFields)
    result.days = db.rows('SELECT * FROM plan_day WHERE week_id=? ORDER BY position', week.id).map(day => {
      const resultDay = unpack(day, ['day_of_week'])
      for (const option of db.rows('SELECT * FROM day_option WHERE day_id=? ORDER BY position', day.id)) {
        const workouts = db.rows('SELECT * FROM scheduled_workout WHERE option_id=? ORDER BY position', option.id).map(row => {
          const workout = readMeasured(db, row, workoutFields)
          const steps = readSteps(db, row.id)
          if (steps.length) workout.steps = steps
          return workout
        })
        if (option.position === 0) resultDay.workouts = workouts
        else if (option.position === 1) resultDay.alternative_workouts = workouts
        else (resultDay.additional_options ??= []).push(workouts)
      }
      return resultDay
    })
    return result
  })
}

