import { digest, json, registerActivity, split, unpack } from './database.mjs'
import { readQuantities, writeQuantities } from './quantities.mjs'

const sourceFields = ['page_title', 'canonical_url', 'source_id', 'chapter_title', 'schedule_title_in_source']
const locators = ['chapter_number', 'chapter_numbers', 'reader_pages', 'printed_pages', 'pdf_pages', 'table_sections']
const pubFields = ['title', 'format', 'file', 'url']
const summaryFields = ['goal_event', 'target_audience', 'difficulty', 'plan_type', 'training_volume_band',
  'preparation_recommendation', 'typical_week']
const definitionFields = ['label', 'category', 'discipline', 'description', 'intensity', 'effort_zone', 'notes']

export function publication(db, source, byline) {
  const obj = source?.publication ?? (source?.canonical_url ? {
    title: source.page_title, url: source.canonical_url, authors: byline ? [byline] : [],
  } : null)
  if (!obj) return null
  const fingerprint = digest(obj)
  const prior = db.one('SELECT id FROM publication WHERE fingerprint=?', fingerprint)
  if (prior) return prior.id
  const { id: sourceKey, ...info } = obj
  const { rest, values } = split(info, pubFields, ['authors'])
  const id = db.insert('publication', { source_key: sourceKey ?? null, ...values, fingerprint, extensions: json(rest) })
  for (const [position, name] of (obj.authors ?? []).entries()) {
    db.run('INSERT OR IGNORE INTO author(name) VALUES (?)', name)
    db.insert('publication_author', { publication_id: id, position, name })
  }
  return id
}

export function writeCitation(db, revision, source) {
  const { rest, values } = split(source, sourceFields, [...locators, 'dataset', 'publication'])
  if (source.chapter_number != null) delete rest.chapter_number
  db.insert('citation', { revision_id: revision, ...values, extensions: json(rest) })
  for (const kind of locators) {
    if (source[kind] == null) continue
    const entries = kind === 'chapter_number' ? [source[kind]] : source[kind]
    for (const [position, value] of entries.entries()) {
      db.insert('citation_locator', { revision_id: revision, kind, position,
        value: typeof value === 'number' ? BigInt(value) : value })
    }
  }
}

export function readCitation(db, revision) {
  const row = db.one('SELECT * FROM citation WHERE revision_id=?', revision.id)
  if (!row) return null
  const source = unpack(row, sourceFields)
  for (const loc of db.rows('SELECT * FROM citation_locator WHERE revision_id=? ORDER BY kind,position', revision.id)) {
    if (loc.kind === 'chapter_number') source[loc.kind] = loc.value
    else source[loc.kind].push(loc.value)
  }
  if (source.publication && revision.publication_id != null) {
    const pub = db.one('SELECT * FROM publication WHERE id=?', revision.publication_id)
    const obj = unpack(pub, pubFields)
    if (pub.source_key != null) obj.id = pub.source_key
    if (Array.isArray(obj.authors)) obj.authors = db.rows(
      'SELECT name FROM publication_author WHERE publication_id=? ORDER BY position', pub.id).map(r => r.name)
    source.publication = obj
  }
  if (revision.dataset_id != null) source.dataset = JSON.parse(db.one('SELECT header FROM dataset WHERE id=?', revision.dataset_id).header)
  return source
}

export function writeSummary(db, revision, scope, obj) {
  const rest = { ...obj }
  const quantities = writeQuantities(db, rest)
  const { values, rest: extensions } = split(rest, summaryFields,
    ['goal_distances_km', 'goal_event_options', 'workout_frequency', 'at_a_glance'])
  const id = db.insert('plan_summary', { revision_id: revision, scope, ...values, quantities, extensions: json(extensions) })
  for (const field of ['goal_distances_km', 'goal_event_options']) {
    for (const [position, entry] of (obj[field] ?? []).entries()) {
      const goal = field === 'goal_distances_km' ? { distance_km: entry } : entry
      const { values, rest } = split(goal, ['event', 'distance_km'])
      db.insert('goal_option', { summary_id: id, field, position, ...values, extensions: json(rest) })
    }
  }
  for (const [ref, count] of Object.entries(obj.workout_frequency ?? {})) {
    db.insert('workout_frequency', { summary_id: id, source_ref: ref, count })
  }
  if (obj.at_a_glance) writeSummary(db, revision, 'at_a_glance', obj.at_a_glance)
}

export function readSummaries(db, revision, plan) {
  for (const row of db.rows("SELECT * FROM plan_summary WHERE revision_id=? ORDER BY scope='at_a_glance', id", revision)) {
    const obj = unpack(row, summaryFields)
    readQuantities(db, row.quantities, obj)
    for (const goal of db.rows('SELECT * FROM goal_option WHERE summary_id=? ORDER BY field,position', row.id)) {
      obj[goal.field].push(goal.field === 'goal_distances_km' ? goal.distance_km : unpack(goal, ['event', 'distance_km']))
    }
    for (const freq of db.rows('SELECT * FROM workout_frequency WHERE summary_id=?', row.id)) {
      obj.workout_frequency[freq.source_ref] = freq.count
    }
    if (row.scope === 'at_a_glance') plan.meta.at_a_glance = obj
    else plan[row.scope] = obj
  }
}

export function writeDefinition(db, revision, byline, ref, obj) {
  const type = obj.canonical_type ?? ref
  const fingerprint = digest([byline, type, obj])
  let id = db.one('SELECT id FROM workout_definition WHERE fingerprint=?', fingerprint)?.id
  if (id == null) {
    db.run('INSERT OR IGNORE INTO workout_type VALUES (?)', type)
    if (obj.discipline) registerActivity(db, obj.discipline)
    const { rest, values } = split(obj, definitionFields, ['structure'])
    let structureType = null, structureQuantities = null, structureExtensions = null
    if (obj.structure) {
      const structure = split(obj.structure, ['type'])
      structureType = structure.values.type ?? null
      structureQuantities = writeQuantities(db, structure.rest)
      structureExtensions = json(structure.rest)
    }
    id = db.insert('workout_definition', { fingerprint, byline, type_code: type, ...values,
      structure_type: structureType, structure_quantities: structureQuantities,
      structure_extensions: structureExtensions, extensions: json(rest) })
  }
  db.insert('plan_definition', { revision_id: revision, ref, definition_id: id })
}

export function readDefinitions(db, revision) {
  const rows = db.rows('SELECT d.*,p.ref FROM plan_definition p JOIN workout_definition d ON d.id=p.definition_id WHERE p.revision_id=?', revision)
  return Object.fromEntries(rows.map(row => {
    const def = unpack(row, definitionFields)
    if (row.type_code !== row.ref || Object.hasOwn(def, 'canonical_type')) def.canonical_type = row.type_code
    if (row.structure_extensions != null) {
      def.structure = JSON.parse(row.structure_extensions)
      if (row.structure_type != null) def.structure.type = row.structure_type
      readQuantities(db, row.structure_quantities, def.structure)
    }
    return [row.ref, def]
  }))
}

