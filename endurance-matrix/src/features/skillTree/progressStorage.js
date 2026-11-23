import { CATEGORIES, METRICS } from './skillSettings.js'

export const STORAGE_KEY = 'endurance-matrix.skill-tree'
export const PROGRESS_VERSION = 2
export const MAX_IMPORT_SIZE = 4 * 1024 * 1024
export const MAX_SETS = 30

const validId = value => typeof value === 'string' && value.length <= 100 &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && !['constructor', 'prototype'].includes(value)
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const isNumber = value => Number.isFinite(value) && value >= 0 && value <= 10000
const exceedsQuota = text => text.length > MAX_IMPORT_SIZE || new TextEncoder().encode(text).length > MAX_IMPORT_SIZE

export function emptyProgress() {
  return { version: PROGRESS_VERSION, selectedGoals: [], skills: {}, preferences: { category: 'all' } }
}

export function localDate(now = new Date()) {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(value => String(value).padStart(2, '0')).join('-')
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

export function validateSession(value) {
  if (!isObject(value)) throw new Error('A training attempt is invalid.')
  const { id, date, metric, sets, loadKg, assistanceKg, checks, benchmarkVersion, notes } = value
  const measurement = Object.hasOwn(METRICS, metric) ? METRICS[metric] : null
  if (!validId(id) || !validDate(date) || !measurement || !Array.isArray(sets) || sets.length > MAX_SETS ||
      Boolean(sets.length) !== Boolean(measurement.fields.length) ||
      sets.some(set => !Array.isArray(set) || set.length !== measurement.fields.length ||
        set.some(number => !isNumber(number) || (metric.endsWith('reps') && !Number.isInteger(number)))) ||
      ![loadKg, assistanceKg].every(amount => amount === null || isNumber(amount)) ||
      !Array.isArray(checks) || checks.length > 100 || checks.some(check => !validId(check)) ||
      !Number.isSafeInteger(benchmarkVersion) || benchmarkVersion < 0 ||
      typeof notes !== 'string' || notes.length > 2000) {
    throw new Error('Check the attempt date, performance values, and notes.')
  }
  return { id, date, metric, sets, loadKg, assistanceKg, checks: [...new Set(checks)], benchmarkVersion, notes }
}

function validateSkill(record) {
  if (!isObject(record) || !Array.isArray(record.sessions)) throw new Error('A skill record is invalid.')
  const sessions = record.sessions.map(validateSession)
  if (new Set(sessions.map(session => session.id)).size !== sessions.length) throw new Error('Duplicate training attempt.')
  const { mastery } = record
  if (mastery !== null && (!isObject(mastery) || !validTimestamp(mastery.at) || typeof mastery.override !== 'boolean')) {
    throw new Error('A mastery record is invalid.')
  }
  return { mastery: mastery && { at: mastery.at, override: mastery.override }, sessions }
}

function migrateProgress(data) {
  if (data.version !== 1) return data
  if (!isObject(data.skills)) throw new Error('The version 1 skill records are invalid.')
  return {
    version: PROGRESS_VERSION,
    selectedGoals: data.selectedGoals ?? [],
    preferences: data.preferences ?? { category: 'all' },
    skills: Object.fromEntries(Object.entries(data.skills).map(([id, skill]) => {
      if (!isObject(skill) || !Array.isArray(skill.sessions)) throw new Error('A version 1 skill record is invalid.')
      return [id, {
        mastery: skill.masteredAt == null ? null : { at: skill.masteredAt, override: skill.manualOverride ?? false },
        sessions: skill.sessions.map(session => {
          if (!isObject(session) || !Array.isArray(session.sets)) throw new Error('A version 1 attempt is invalid.')
          return {
            ...session, sets: session.sets.map(set => Array.isArray(set) ? set : [set]),
            loadKg: session.loadKg ?? null, assistanceKg: session.assistanceKg ?? null,
            checks: session.checks ?? [], benchmarkVersion: session.benchmarkVersion ?? 0, notes: session.notes ?? '',
          }
        }),
      }]
    })),
  }
}

export function parseProgress(text) {
  if (exceedsQuota(text)) throw new Error('The progress file is too large.')
  let original
  try {
    original = JSON.parse(text)
  } catch {
    throw new Error('The progress file is not valid JSON.')
  }
  if (!isObject(original)) throw new Error('The progress file must contain a progress record.')
  const data = migrateProgress(original)
  if (data.version !== PROGRESS_VERSION) throw new Error('This progress format is unsupported.')
  if (!isObject(data.skills) || !Array.isArray(data.selectedGoals) || data.selectedGoals.some(id => !validId(id)) ||
      !isObject(data.preferences)) throw new Error('Skills, goals, or preferences are invalid.')
  const skills = Object.fromEntries(Object.entries(data.skills).map(([id, record]) => {
    if (!validId(id)) throw new Error('A skill identifier is invalid.')
    return [id, validateSkill(record)]
  }))
  const { category } = data.preferences
  return {
    version: PROGRESS_VERSION, skills, selectedGoals: [...new Set(data.selectedGoals)],
    preferences: { category: Object.hasOwn(CATEGORIES, category) ? category : 'all' },
  }
}

export function mergeProgress(local, incoming) {
  const skills = { ...local.skills }
  for (const [id, record] of Object.entries(incoming.skills)) {
    const current = skills[id]
    if (!current) {
      skills[id] = record
      continue
    }
    const sessions = new Map(record.sessions.map(session => [session.id, session]))
    current.sessions.forEach(session => sessions.set(session.id, session))
    skills[id] = { sessions: [...sessions.values()], mastery: current.mastery ?? record.mastery }
  }
  return { ...local, skills, selectedGoals: [...new Set([...local.selectedGoals, ...incoming.selectedGoals])] }
}

export function updateSkill(progress, id, updater) {
  const skills = { ...progress.skills }
  const updated = updater(skills[id] ?? { mastery: null, sessions: [] })
  if (updated) skills[id] = updated
  else delete skills[id]
  return { ...progress, skills }
}

export function createProgressStore(getStorage) {
  let snapshot = { progress: emptyProgress(), warning: '' }
  let dirty = false
  let lastRaw

  function read() {
    let raw
    try {
      raw = getStorage().getItem(STORAGE_KEY)
    } catch {
      return { ...snapshot, warning: 'Browser storage is unavailable. Export your progress to keep this session.' }
    }
    if (raw === lastRaw) return dirty ? snapshot : { ...snapshot, warning: '' }
    try {
      const progress = raw === null ? emptyProgress() : parseProgress(raw)
      if (dirty) return snapshot
      lastRaw = raw
      return { progress, warning: '' }
    } catch {
      return { ...snapshot, warning: 'Stored progress could not be read. A replacement import or full reset can recover storage.' }
    }
  }

  return {
    load() {
      snapshot = read()
      return snapshot
    },
    update(change, { replace = false } = {}) {
      snapshot = read()
      const progress = change(snapshot.progress)
      if (!replace && progress === snapshot.progress) return snapshot
      try {
        const storage = getStorage()
        const existing = storage.getItem(STORAGE_KEY)
        if (!replace && existing !== lastRaw && (existing !== null || dirty)) {
          throw new Error('Stored progress changed since it was read.')
        }
        const serialized = JSON.stringify(progress)
        if (exceedsQuota(serialized)) throw new Error('Progress exceeds the supported storage size.')
        storage.setItem(STORAGE_KEY, serialized)
        lastRaw = serialized
        dirty = false
        snapshot = { progress, warning: '' }
      } catch {
        dirty = true
        snapshot = { progress, warning: 'Changes are in memory only. Export your progress before leaving this page.' }
      }
      return snapshot
    },
  }
}
