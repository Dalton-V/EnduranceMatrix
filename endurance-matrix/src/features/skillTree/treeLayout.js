export const NODE_WIDTH = 182
export const NODE_HEIGHT = 92
const COLUMN = 226
const ROW = 111

export function layoutTree(skills, families) {
  const visible = new Map()
  const levels = new Map()
  for (const skill of [...skills].sort((a, b) => a.depth - b.depth)) {
    const ancestors = skill.prerequisites.flat().filter(id => levels.has(id))
    levels.set(skill.id, Math.max(-1, ...ancestors.map(id => levels.get(id))) + 1)
  }
  const groups = new Map()
  for (const skill of skills) {
    if (!groups.has(skill.family)) groups.set(skill.family, [])
    groups.get(skill.family).push(skill)
  }
  let top = 0
  const lanes = []
  for (const family of families) {
    if (!groups.has(family)) continue
    const columns = new Map()
    for (const skill of groups.get(family)) {
      const level = levels.get(skill.id)
      const row = columns.get(level) ?? 0
      visible.set(skill.id, { x: 18 + level * COLUMN, y: top + 43 + row * ROW })
      columns.set(level, row + 1)
    }
    const height = 43 + Math.max(...columns.values()) * ROW + 6
    lanes.push({ family, top, height })
    top += height
  }
  const edges = skills.flatMap(skill => {
    const incoming = new Map()
    for (const group of skill.prerequisites) {
      for (const id of group) {
        if (visible.has(id)) incoming.set(id, group.length > 1 && incoming.get(id) !== false)
      }
    }
    return [...incoming].map(([from, alternative]) => ({ from, to: skill.id, alternative }))
  })
  const width = Math.max(0, ...levels.values()) * COLUMN + NODE_WIDTH + 36
  return { width, height: top, visible, lanes, edges }
}

export function focusPath(catalog, id) {
  const included = new Set()
  function visit(id) {
    if (included.has(id)) return
    included.add(id)
    catalog.byId.get(id).prerequisites.flat().forEach(visit)
  }
  visit(id)
  catalog.byId.get(id).next.forEach(next => included.add(next))
  return included
}
