import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
}

export const json = value => JSON.stringify(stable(value))
export const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export const digest = value => hash(json(value))

export class Store {
  constructor(path, { create = false } = {}) {
    this.db = new DatabaseSync(path, { readOnly: !create })
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000')
    this.statements = new Map()
    const version = () => this.one('PRAGMA user_version').user_version
    if (version() === 0 && create) this.db.exec(readFileSync(new URL('schema.sql', import.meta.url), 'utf8'))
    if (version() === 1 && create) {
      this.transaction(() => {
        if (version() === 1) this.db.exec(readFileSync(new URL('002-progressions.sql', import.meta.url), 'utf8'))
      })
    }
    this.schemaVersion = version()
    if (![1, 2].includes(this.schemaVersion)) throw new Error('Unsupported plan library schema version ' + this.schemaVersion)
  }
  statement(sql) {
    if (!this.statements.has(sql)) this.statements.set(sql, this.db.prepare(sql))
    return this.statements.get(sql)
  }
  one(sql, ...params) { return this.statement(sql).get(...params) }
  rows(sql, ...params) { return this.statement(sql).all(...params) }
  run(sql, ...params) { return this.statement(sql).run(...params) }
  // Table and column names come only from the mapping code.
  insert(table, fields) {
    const keys = Object.keys(fields)
    const sql = 'INSERT INTO ' + table + ' (' + keys.join(',') + ') VALUES (' + keys.map(() => '?').join(',') + ')'
    return this.run(sql, ...Object.values(fields)).lastInsertRowid
  }
  transaction(fn, write = true) {
    this.db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN')
    try {
      const result = fn()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
  close() { this.db.close() }
}

// Mapped values live in typed columns. The extension bag holds additional
// source fields and the presence of explicit nulls or empty containers.
export function split(obj, columns, children = []) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Expected a JSON object')
  const rest = { ...obj }, values = {}
  for (const key of columns) {
    if (rest[key] != null) {
      values[key] = typeof rest[key] === 'boolean' ? Number(rest[key]) : rest[key]
      delete rest[key]
    }
  }
  for (const key of children) {
    if (Array.isArray(rest[key])) rest[key] = []
    else if (rest[key] && typeof rest[key] === 'object') rest[key] = {}
  }
  return { rest, values }
}

export function unpack(row, columns, extensionColumn = 'extensions') {
  const result = JSON.parse(row[extensionColumn])
  for (const key of columns) {
    if (row[key] != null) result[key] = key === 'is_recovery_week' ? Boolean(row[key]) : row[key]
  }
  return result
}

export function registerActivity(db, term) {
  const code = term === 'strength_training' ? 'strength' : term
  db.run('INSERT OR IGNORE INTO activity(code) VALUES (?)', code)
  db.run('INSERT OR IGNORE INTO activity_term(term,activity_code) VALUES (?,?)', term, code)
}

export function movementId(db, label) {
  const name = label?.trim()
  if (!name) return null
  db.run('INSERT OR IGNORE INTO movement(name) VALUES (?)', name)
  return db.one('SELECT id FROM movement WHERE name=?', name).id
}

