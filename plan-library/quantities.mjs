import { json } from './database.mjs'

// Source field -> (meaning, unit). Range suffixes carry the same meaning.
const fields = new Map()
function metric(kind, unit, ...names) {
  for (const name of names) fields.set(name, { kind, unit })
}
for (const [suffix, unit] of Object.entries({ km: 'km', miles: 'mi', m: 'm' })) {
  for (const kind of ['distance', 'total_distance', 'estimated_total_distance', 'event_distance',
    'goal_distance', 'pace_distance', 'recovery_distance', 'rep_distance', 'longest_workout',
    'longest_scheduled_run', 'peak_weekly_mileage', 'lowest_weekly_mileage', 'initial_weekly_mileage',
    'base_training_target', 'required_current_weekly_mileage_min', 'recommended_current_weekly_mileage']) {
    metric(kind, unit, kind + '_' + suffix, kind + '_' + suffix + '_range')
  }
  metric('weekly_distance', unit, 'weekly_mileage_range_' + suffix)
  metric('all_weeks_distance', unit, 'all_scheduled_weekly_mileage_range_' + suffix)
}
metric('weekly_volume_band', 'mi', 'training_volume_band')
metric('duration', 'min', 'duration_min', 'duration_min_range')
metric('duration', 's', 'duration_sec')
metric('rest_duration', 's', 'rest_sec')
metric('hold_duration', 's', 'hold_sec')
metric('longest_workout_duration', 'min', 'longest_workout_min')
metric('load', 'kg', 'load_kg')
metric('load', 'lb', 'load_lb')
metric('repetitions', 'count', 'reps')
metric('sets', 'count', 'sets')
metric('downhill_repetitions', 'count', 'downhill_reps')
metric('relative_recovery_duration', '% interval time', 'interval_time_pct')
metric('relative_distance', '% race distance', 'race_distance_pct')
for (const name of ['total_weeks', 'length_weeks', 'training_weeks_to_goal', 'schedule_weeks_including_post_race',
  'post_race_recovery_weeks', 'post_race_transition_weeks', 'published_length_weeks_range']) metric(name, 'week', name)
for (const name of ['run_days_per_week', 'rest_or_cross_train_days_per_week', 'double_run_days_across_schedule']) metric(name, 'day', name)
metric('quality_workouts', 'count', 'quality_workouts_across_schedule')

// Add new target fields here, or register a quantity_field in the database.
// Missing values stay missing. Explicit nulls remain in the owner's extensions.
export function writeQuantities(db, rest) {
  let set = null
  for (const [field, value] of Object.entries(rest)) {
    if (value == null || (field === 'training_volume_band' && typeof value === 'string')) continue
    const spec = fields.get(field) ?? db.one('SELECT kind, unit FROM quantity_field WHERE field=?', field)
    if (!spec) continue
    let low, high, extensions = {}
    if (typeof value === 'number') {
      low = high = value
    } else {
      if (typeof value !== 'object' || Array.isArray(value) || !('min' in value || 'max' in value)) {
        throw new Error('Expected a number or range for ' + field)
      }
      low = value.min ?? null
      high = value.max ?? null
      extensions = { ...value }
      if (low !== null) delete extensions.min
      if (high !== null) delete extensions.max
    }
    if ([low, high].some(n => n !== null && !Number.isFinite(n))) throw new Error('Invalid bounds for ' + field)
    const printedUnit = extensions.unit
    const aliases = { miles: 'mi', kilometers: 'km', kilometres: 'km', minutes: 'min', seconds: 's' }
    const unit = printedUnit == null ? spec.unit : (Object.hasOwn(aliases, printedUnit) ? aliases[printedUnit] : printedUnit)
    if (set === null) set = db.run('INSERT INTO quantity_set DEFAULT VALUES').lastInsertRowid
    db.run('INSERT OR IGNORE INTO unit VALUES (?)', spec.unit)
    if (unit !== spec.unit) db.run('INSERT OR IGNORE INTO unit VALUES (?)', unit)
    db.run('INSERT OR IGNORE INTO quantity_field VALUES (?,?,?)', field, spec.kind, spec.unit)
    db.insert('quantity', { set_id: set, field, shape: typeof value === 'number' ? 'scalar' : 'range',
      lower_bound: low, upper_bound: high, unit_override: unit === spec.unit ? null : unit, extensions: json(extensions) })
    delete rest[field]
  }
  return set
}

export function readQuantities(db, id, obj) {
  if (id == null) return
  for (const row of db.rows('SELECT * FROM quantity WHERE set_id=?', id)) {
    if (row.shape === 'scalar') obj[row.field] = row.lower_bound
    else {
      const range = JSON.parse(row.extensions)
      if (row.lower_bound != null) range.min = row.lower_bound
      if (row.upper_bound != null) range.max = row.upper_bound
      obj[row.field] = range
    }
  }
}

