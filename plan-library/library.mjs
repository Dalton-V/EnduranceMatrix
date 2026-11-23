import assert from 'node:assert/strict'
import { basename } from 'node:path'
import { adapt, adapterFor } from './adapters.mjs'
import { digest, hash, json, registerActivity, split, unpack } from './database.mjs'
import { publication, readCitation, readDefinitions, readSummaries, writeCitation, writeDefinition, writeSummary } from './metadata.mjs'
import { readSchedule, writeSchedule } from './schedule.mjs'
import { chartFormat, importProgression, readProgressionWorkbook } from './progressions.mjs'

const planFields = ['name', 'author', 'version', 'created_at', 'description']
const children = ['tags', 'activity_types', 'coaching_guidance', 'workout_definitions', 'schedule',
  'source', 'meta', 'comparison', 'comparison_index']

function checkFilename(filename) {
  if (basename(filename) !== filename || !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.json$/i.test(filename)) {
    throw new Error('Unsafe or unsupported plan filename ' + filename)
  }
}

function provider(payload) {
  const source = payload.plan.source
  if (source?.publication?.id) return 'publication:' + source.publication.id
  const url = source?.canonical_url ?? payload.source_url
  return url ? 'web:' + new URL(url).hostname : 'author:' + (payload.plan.author ?? '')
}

function savePlan(db, payload, filename) {
  checkFilename(filename)
  const { plan, ...envelope } = payload
  if (!plan.id || !plan.name || !Array.isArray(plan.schedule) || !plan.workout_definitions) {
    throw new Error('Plan needs an ID, a name, a schedule and a workout dictionary')
  }
  const origin = provider(payload)
  const existing = db.one('SELECT * FROM plan WHERE id=?', plan.id)
  if (existing && existing.provider !== origin) throw new Error('Plan ID already belongs to another provider: ' + plan.id)
  const fingerprint = digest(payload)
  const prior = db.one('SELECT id FROM plan_revision WHERE plan_id=? AND fingerprint=?', plan.id, fingerprint)
  if (prior) return { id: prior.id, added: false }
  if (!existing) db.insert('plan', { id: plan.id, provider: origin, filename })
  const next = db.one('SELECT coalesce(max(revision),0)+1 AS n FROM plan_revision WHERE plan_id=?', plan.id).n
  const { id: planId, ...body } = plan
  const { rest, values } = split(body, planFields, children)
  const wrapper = split(envelope, ['source_url'])
  let datasetId = null
  if (plan.source?.dataset) {
    const header = json(plan.source.dataset)
    db.run('INSERT OR IGNORE INTO dataset(header) VALUES (?)', header)
    datasetId = db.one('SELECT id FROM dataset WHERE header=?', header).id
  }
  const id = db.insert('plan_revision', { plan_id: planId, revision: next, fingerprint,
    publication_id: publication(db, plan.source, plan.author), dataset_id: datasetId,
    ...values, ...wrapper.values, extensions: json(rest), envelope_extensions: json(wrapper.rest) })
  for (const [position, name] of (plan.tags ?? []).entries()) {
    db.run('INSERT OR IGNORE INTO tag(name) VALUES (?)', name)
    db.insert('plan_tag', { revision_id: id, position, name })
  }
  for (const [position, term] of (plan.activity_types ?? []).entries()) {
    registerActivity(db, term)
    db.insert('plan_activity', { revision_id: id, position, term })
  }
  for (const [position, note] of (plan.coaching_guidance ?? []).entries()) {
    const { rest, values } = split(note, ['topic', 'text'])
    db.insert('coaching_guidance', { revision_id: id, position, ...values, extensions: json(rest) })
  }
  if (plan.source) writeCitation(db, id, plan.source)
  for (const scope of ['meta', 'comparison', 'comparison_index']) if (plan[scope]) writeSummary(db, id, scope, plan[scope])
  for (const [ref, def] of Object.entries(plan.workout_definitions)) writeDefinition(db, id, plan.author ?? null, ref, def)
  writeSchedule(db, id, plan.schedule)
  // Validate before this revision can become visible. Compare every input field,
  // including null vs missing, nested option order and source-only attributes.
  const restored = exportRevision(db, id)
  assert.deepEqual(restored, payload, 'Relational round-trip differed for ' + planId)
  return { id, added: true }
}

export function importDocument(db, filename, bytes) {
  if (/\.ods$/i.test(filename)) return importProgression(db, filename, readProgressionWorkbook(bytes))
  const document = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))
  if (document.format === chartFormat) return importProgression(db, filename, document)
  const sha = hash(bytes)
  db.run('INSERT OR IGNORE INTO source_document(filename,sha256,original) VALUES (?,?,?)', filename, sha, bytes)
  const documentId = db.one('SELECT id FROM source_document WHERE sha256=?', sha).id
  const adapter = adapterFor(document)
  let added = 0, seen = 0
  for (const { payload, filename: outputName, pointer } of adapt(document, filename, adapter)) {
    try {
      const result = savePlan(db, payload, outputName)
      db.run('INSERT OR IGNORE INTO import_record VALUES (?,?,?,?)', documentId, pointer, adapter, result.id)
      const recorded = db.one('SELECT revision_id FROM import_record WHERE document_id=? AND adapter=? AND pointer=?', documentId, adapter, pointer)
      if (recorded.revision_id !== result.id) throw new Error('Source adapter interpretation changed. Assign a new adapter version.')
      added += Number(result.added)
      seen++
    } catch (error) {
      throw new Error(filename + pointer + ' (' + payload.plan.id + '): ' + error.message, { cause: error })
    }
  }
  if (!seen) throw new Error('No plans in ' + filename)
  return { added, seen }
}

export function exportRevision(db, id) {
  const row = db.one('SELECT * FROM plan_revision WHERE id=?', id)
  if (!row) throw new Error('Unknown revision ' + id)
  const plan = { ...unpack(row, planFields), id: row.plan_id }
  for (const [key, table, column] of [['tags', 'plan_tag', 'name'], ['activity_types', 'plan_activity', 'term']]) {
    const values = db.rows('SELECT ' + column + ' AS value FROM ' + table + ' WHERE revision_id=? ORDER BY position', id)
    if (values.length || Array.isArray(plan[key])) plan[key] = values.map(r => r.value)
  }
  const notes = db.rows('SELECT * FROM coaching_guidance WHERE revision_id=? ORDER BY position', id)
  if (notes.length || Array.isArray(plan.coaching_guidance)) plan.coaching_guidance = notes.map(r => unpack(r, ['topic', 'text']))
  const source = readCitation(db, row)
  if (source) plan.source = source
  readSummaries(db, id, plan)
  plan.workout_definitions = readDefinitions(db, id)
  plan.schedule = readSchedule(db, id)
  return { ...unpack(row, ['source_url'], 'envelope_extensions'), plan }
}

export function currentPlans(db) {
  return db.rows('SELECT r.id, p.filename FROM current_plan_revision r JOIN plan p ON p.id=r.plan_id ORDER BY p.filename')
}

