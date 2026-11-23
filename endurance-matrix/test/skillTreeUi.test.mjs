import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { makeCatalog } from '../src/features/skillTree/catalog.js'
import { evaluateSkill } from '../src/features/skillTree/progression.js'
import { emptyProgress } from '../src/features/skillTree/progressStorage.js'

test('tree and list expose locked skills through native buttons and accessible status labels', async () => {
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  try {
    const { default: SkillMap } = await server.ssrLoadModule('/src/features/skillTree/SkillMap.jsx')
    const { default: SkillDetails } = await server.ssrLoadModule('/src/features/skillTree/SkillDetails.jsx')
    const chart = JSON.parse(readFileSync(new URL('../public/data/progressions/bodyweight-fitness-progressions.json', import.meta.url), 'utf8'))
    const catalog = makeCatalog(chart)
    const skill = catalog.byId.get('push-up')
    const skills = [catalog.byId.get('incline-push-up'), skill]
    const progress = emptyProgress()
    const evaluations = new Map(catalog.skills.map(entry => [entry.id, evaluateSkill(entry, progress)]))
    const props = { catalog, skills, evaluations }

    const tree = renderToStaticMarkup(createElement(SkillMap, { ...props, view: 'tree' }))
    assert.match(tree, /tabindex="0" role="region" aria-label="Scrollable skill tree"/)
    assert.match(tree, /class="st-edge"/)
    assert.match(tree, /<button class="st-node" data-status="locked"[^>]*type="button"><span[^>]*>Push-Up/)
    const list = renderToStaticMarkup(createElement(SkillMap, { ...props, view: 'list' }))
    assert.match(list, /<button class="st-node" data-status="locked"[^>]*type="button"><span[^>]*>Push-Up/)
    assert.match(list, /Requires Incline Push-Up/)

    const dialog = renderToStaticMarkup(createElement(SkillDetails, {
      skill, catalog, evaluations, evaluation: evaluations.get(skill.id), goal: false,
    }))
    assert.match(dialog, /<dialog[^>]*aria-labelledby="st-detail-title"/)
    assert.match(dialog, /aria-label="Close skill details"/)
    assert.match(dialog, /<label>Reps for set 1<input type="number"/)
    assert.match(dialog, /type="checkbox" name="check"/)
    assert.match(dialog, /type="submit"[^>]*>Save attempt/)
  } finally {
    await server.close()
  }
})
