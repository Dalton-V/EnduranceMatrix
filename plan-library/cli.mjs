import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { adapt } from './adapters.mjs'
import { digest, hash, Store } from './database.mjs'
import { currentPlans, exportRevision, importDocument } from './library.mjs'
import { chartFormat, currentProgressions, exportProgression, readProgressionWorkbook } from './progressions.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const defaultDb = join(root, 'plan-library', 'training.sqlite')
const defaultInputs = [join(root, 'endurance-matrix/public/data/plans'), join(root, 'DataToParse/training_plans.json')]
const usage = [
  'node plan-library/cli.mjs import [--db FILE] [DIRECTORY | JSON_FILE | ODS_FILE ...]',
  'node plan-library/cli.mjs verify [--db FILE] [--workbook ODS_FILE]',
  'node plan-library/cli.mjs export --out DATA_DIRECTORY [--db FILE]',
  'node plan-library/cli.mjs show --plan ID [--revision NUMBER] [--db FILE]',
  'node plan-library/cli.mjs show --progression KEY [--revision NUMBER] [--db FILE]',
  'node plan-library/cli.mjs sources [--db FILE]',
  'node plan-library/cli.mjs restore --source SHA256 --out NEW_FILE [--db FILE]',
].join('\n')

function inputs(paths) {
  return paths.flatMap(path => statSync(path).isDirectory()
    ? readdirSync(path, { withFileTypes: true }).filter(f => f.isFile() && /\.(json|ods)$/i.test(f.name))
      .map(f => join(path, f.name)).sort() : [path])
}

function bootstrapInputs() {
  const [planDir, bookPath] = defaultInputs
  const book = JSON.parse(readFileSync(bookPath, 'utf8'))
  const booksByFilename = new Map(book.plans.map(entry => [entry.plan.id + '.json', entry.source.source_id]))
  const originals = inputs([planDir]).filter(path => {
    const sourceKey = booksByFilename.get(basename(path))
    if (!sourceKey) return true
    const candidate = JSON.parse(readFileSync(path, 'utf8'))
    return candidate.plan?.source?.publication?.id !== sourceKey
  })
  const workbook = join(root, 'DataToParse/Bodyweight Fitness Progressions.ods')
  return [...originals, bookPath, ...(existsSync(workbook) ? [workbook] : [])]
}

function verify(db, workbookPath) {
  assert.deepEqual(db.rows('PRAGMA foreign_key_check'), [])
  assert.equal(db.one('PRAGMA integrity_check').integrity_check, 'ok')
  let revisions = 0, charts = 0
  const audited = new Set()
  for (const doc of db.rows('SELECT * FROM source_document ORDER BY id')) {
    const bytes = Buffer.from(doc.original)
    assert.equal(hash(bytes), doc.sha256, 'Damaged source ' + doc.filename)
    const original = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))
    if (original.format === chartFormat) {
      const revision = db.one('SELECT id,fingerprint FROM progression_revision WHERE document_id=?', doc.id)
      assert.equal(revision?.fingerprint, digest(original), 'Damaged progression snapshot ' + doc.filename)
      assert.deepEqual(exportProgression(db, revision.id), original)
      charts++
      continue
    }
    const adapters = db.rows('SELECT adapter, count(*) AS n FROM import_record WHERE document_id=? GROUP BY adapter', doc.id)
    assert.ok(adapters.length, 'Source has no import records: ' + doc.filename)
    for (const { adapter, n } of adapters) {
      let entries = 0
      for (const entry of adapt(original, doc.filename, adapter)) {
        const revision = db.one('SELECT r.id, r.fingerprint FROM import_record i JOIN plan_revision r ON r.id=i.revision_id WHERE i.document_id=? AND i.adapter=? AND i.pointer=?',
          doc.id, adapter, entry.pointer)
        assert.equal(revision?.fingerprint, digest(entry.payload), 'Import mismatch for ' + doc.filename + entry.pointer)
        if (!audited.has(revision.id)) {
          assert.deepEqual(exportRevision(db, revision.id), entry.payload, 'Source mismatch for ' + entry.payload.plan.id)
          audited.add(revision.id)
          revisions++
        }
        entries++
      }
      assert.equal(entries, n, 'Unexpected import records for ' + doc.filename)
    }
  }
  assert.equal(revisions, db.one('SELECT count(*) AS n FROM plan_revision').n, 'Revision lacks source evidence')
  if (db.schemaVersion >= 2) assert.equal(charts, db.one('SELECT count(*) n FROM progression_revision').n)
  if (workbookPath) {
    const chart = readProgressionWorkbook(readFileSync(workbookPath))
    const revision = currentProgressions(db).find(r => r.chart_key === chart.key)
    assert.ok(revision, 'Workbook has no current progression chart')
    assert.deepEqual(exportProgression(db, revision.id), chart, 'Stored chart differs from the first worksheet')
  }
  return 'Verified ' + currentPlans(db).length + ' plans, ' + revisions + ' plan revisions and ' + charts + ' progression revisions.'
}

function changedJSON(path, obj) {
  const previous = existsSync(path) ? readFileSync(path) : null
  if (previous !== null) {
    const current = JSON.parse(previous.toString('utf8').replace(/^\uFEFF/, ''))
    if (digest(current) === digest(obj)) return null
  }
  return { path, previous, next: JSON.stringify(obj, null, 2) + '\n' }
}

function atomicWrite(path, content) {
  const temp = path + '.' + randomUUID() + '.tmp'
  try {
    writeFileSync(temp, content, { flag: 'wx' })
    renameSync(temp, path)
  } finally {
    if (existsSync(temp)) unlinkSync(temp)
  }
}

// If an ordinary filesystem error interrupts a release, restore every file
// already replaced. Keep the prior manifest available until its plans exist.
function applyRelease(changes) {
  const applied = []
  try {
    for (const change of changes) {
      atomicWrite(change.path, change.next)
      applied.push(change)
    }
  } catch (error) {
    for (const { path, previous } of applied.reverse()) {
      if (previous === null) unlinkSync(path)
      else atomicWrite(path, previous)
    }
    throw error
  }
}

function publish(db, out) {
  if (!out) throw new Error('Supply --out with the target data directory')
  mkdirSync(out, { recursive: true })
  const lock = join(out, '.plan-library-export.lock')
  writeFileSync(lock, String(process.pid), { flag: 'wx' })
  try {
    const dir = join(out, 'plans')
    mkdirSync(dir, { recursive: true })
    const plans = []
    // Read and validate the full release before changing any published file.
    const release = currentPlans(db).map(row => {
      if (basename(row.filename) !== row.filename || !/^[\w-][\w.-]*\.json$/i.test(row.filename)) throw new Error('Invalid stored filename')
      const payload = exportRevision(db, row.id)
      assert.equal(digest(payload), db.one('SELECT fingerprint FROM plan_revision WHERE id=?', row.id).fingerprint,
        'Revision differs from its validated content: ' + payload.plan.id)
      return { filename: row.filename, payload }
    })
    const changes = []
    for (const { filename, payload } of release) {
      const { id, name, author, version, description, tags, meta } = payload.plan
      plans.push({ id, file: 'plans/' + filename, name, author, version, description, tags, meta })
      const change = changedJSON(join(dir, filename), payload)
      if (change) changes.push(change)
    }
    const changed = changes.length
    const charts = currentProgressions(db)
    if (charts.length) mkdirSync(join(out, 'progressions'), { recursive: true })
    for (const chart of charts) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(chart.chart_key)) throw new Error('Invalid progression chart key')
      const payload = exportProgression(db, chart.id)
      assert.equal(digest(payload), chart.fingerprint, 'Progression content differs from its validated revision')
      const change = changedJSON(join(out, 'progressions', chart.chart_key + '.json'), payload)
      if (change) changes.push(change)
    }
    const manifest = changedJSON(join(out, 'plans_index.json'), { total_plans: plans.length, plans })
    if (manifest) changes.push(manifest)
    applyRelease(changes)
    return 'Exported ' + plans.length + ' plans and ' + charts.length + ' progression charts to ' + out + ' (' + changed + ' plan files written).'
  } finally {
    unlinkSync(lock)
  }
}

function main() {
  const [command, ...args] = process.argv.slice(2)
  if (!command || ['--help', '-h', 'help'].includes(command)) return console.log(usage)
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: Object.fromEntries(
    ['db', 'out', 'plan', 'progression', 'revision', 'source', 'workbook'].map(key => [key, { type: 'string' }])) })
  if (command !== 'import' && positionals.length) throw new Error('Unexpected arguments\n' + usage)
  const db = new Store(resolve(values.db ?? defaultDb), { create: command === 'import' })
  try {
    if (command === 'import') {
      const paths = positionals.length ? inputs(positionals) : bootstrapInputs()
      if (!paths.length) throw new Error('No supported inputs found')
      const result = db.transaction(() => {
        let added = 0, seen = 0, charts = 0
        for (const path of paths) {
          const r = importDocument(db, basename(path), readFileSync(path))
          added += r.added
          seen += r.seen
          charts += r.charts ?? 0
        }
        return { added, seen, charts }
      })
      console.log('Imported ' + result.seen + ' plans and ' + result.charts + ' progression charts. Added ' + result.added + ' revisions.')
    } else if (command === 'verify') {
      console.log(db.transaction(() => verify(db, values.workbook), false))
    } else if (command === 'export') {
      console.log(db.transaction(() => publish(db, values.out), false))
    } else if (command === 'show') {
      if (Boolean(values.plan) === Boolean(values.progression)) throw new Error('Supply --plan ID or --progression KEY')
      const payload = db.transaction(() => {
        if (values.progression) {
          const row = values.revision === undefined
            ? currentProgressions(db).find(r => r.chart_key === values.progression)
            : db.schemaVersion >= 2 && db.one('SELECT id FROM progression_revision WHERE chart_key=? AND revision=?', values.progression, values.revision)
          if (!row) throw new Error('No matching progression revision')
          return exportProgression(db, row.id)
        }
        const row = values.revision === undefined
          ? db.one('SELECT id FROM current_plan_revision WHERE plan_id=?', values.plan)
          : db.one('SELECT id FROM plan_revision WHERE plan_id=? AND revision=?', values.plan, values.revision)
        if (!row) throw new Error('No matching plan revision')
        return exportRevision(db, row.id)
      }, false)
      console.log(JSON.stringify(payload, null, 2))
    } else if (command === 'sources') {
      for (const doc of db.rows('SELECT sha256,filename FROM source_document ORDER BY filename,id')) console.log(doc.sha256, doc.filename)
    } else if (command === 'restore') {
      if (!values.source || !values.out) throw new Error('Supply --source SHA256 and --out NEW_FILE')
      const doc = db.one('SELECT original FROM source_document WHERE sha256=?', values.source)
      if (!doc) throw new Error('Unknown source digest')
      assert.equal(hash(doc.original), values.source)
      writeFileSync(values.out, doc.original, { flag: 'wx' })
    } else throw new Error(usage)
  } finally { db.close() }
}

try { main() } catch (error) {
  console.error(error.message)
  process.exitCode = 1
}

