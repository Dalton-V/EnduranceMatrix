const DEFAULT_PLAN_FILES = [
  '5k_training_novice_hal_higdon_plan.json',
  '10k_training_novice_hal_higdon_plan.json',
  'marathon_training_novice_1_hal_higdon_plan.json',
]

export async function loadPlanCatalog() {
  const response = await fetch('/data/plans_index.json')
  if (!response.ok) throw new Error('Could not load the training plan catalog.')
  const { plans } = await response.json()
  const names = new Map(plans.map(plan => [plan.file.replace(/^plans\//, ''), plan.name]))
  const files = [...names.keys()]
  const defaults = [...new Set([...DEFAULT_PLAN_FILES.filter(file => names.has(file)), ...files])].slice(0, 3)
  return { files, names, defaults }
}
