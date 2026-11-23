const routine = {
  label: 'Bodyweight Fitness Recommended Routine',
  url: 'https://www.reddit.com/r/bodyweightfitness/wiki/kb/recommended_routine/',
}
const pullUpGuide = {
  label: 'Bodyweight Fitness Pull-Up Progression',
  url: 'https://www.reddit.com/r/bodyweightfitness/wiki/exercises/pullup/',
}
const dipGuide = {
  label: 'Bodyweight Fitness Dip Progression',
  url: 'https://www.reddit.com/r/bodyweightfitness/wiki/exercises/dip/',
}
const handstandGuide = {
  label: 'GMB Fitness Freestanding Handstand Guide',
  url: 'https://gmb.io/freestanding-handstand/',
}

function benchmark(target, sets, technique, options = {}) {
  return {
    version: 1,
    consistency: 1,
    ...options,
    criteria: [
      { id: 'performance', type: 'sets', target, sets, ...options.performance },
      ...technique.map(([id, label]) => ({ id, type: 'check', label })),
    ],
  }
}

const push = [
  ['range', 'Use a consistent depth and finish each rep with straight arms.'],
  ['control', 'Keep shoulders and hips moving together without sagging or twisting.'],
]
const row = [['range', 'Begin with straight arms and pull to a consistent height without using momentum.']]
const squat = [['control', 'Use a repeatable depth with stable feet and a controlled descent.']]
const dip = [['control', 'Finish with straight arms and control the descent through a repeatable range.']]
const hang = [['control', 'Maintain the intended shoulder position without swinging.']]
const plank = [['line', 'Maintain a steady trunk position throughout each set.']]
const lever = [['shape', 'Keep elbows straight and hold the intended lever shape without swinging.']]
const balance = [
  ['position', 'Maintain active shoulders and controlled alignment.'],
  ['exit', 'Demonstrate a controlled exit.'],
]

const strength = (technique, source = routine) => benchmark(8, 3, technique, { source })
const illustrative = (target, sets, technique, options) => benchmark(target, sets, technique, {
  rationale: 'A practice checkpoint for this tree. Adjust the target to your training background and form.',
  ...options,
})

export const BENCHMARKS = {
  'incline-push-up': strength(push),
  'push-up': strength(push),
  'diamond-push-up': strength(push),
  'archer-push-up': illustrative(5, 3, [...push, ['sides', 'Use a comparable range on both sides.']]),
  'vertical-row': strength(row),
  'incline-row': strength(row),
  row: strength(row),
  'scapular-pull': strength([['control', 'Keep the elbows straight and return to the hang under control.']], pullUpGuide),
  'pull-up': strength([
    ['range', 'Start each rep with straight arms and clear the bar without craning your neck.'],
    ['control', 'Avoid kicking or swinging to complete a rep.'],
  ], pullUpGuide),
  'c2b-pull-up': illustrative(3, 3, [['height', 'Reach the bar with your chest without a kip.']], { source: pullUpGuide }),
  'sup-hold': benchmark(60, 3, [['control', 'Maintain straight arms and a steady shoulder position.']], { source: dipGuide }),
  dip: strength(dip),
  'ring-dip': illustrative(5, 3, [...dip, ['rings', 'Control ring movement throughout the rep.']]),
  'muscle-up': illustrative(1, 1, [
    ['transition', 'Control the transition without getting one elbow over the bar ahead of the other.'],
    ['support', 'Finish in stable support.'],
  ]),
  'assisted-squat': strength(squat),
  'parallel-squat': strength(squat),
  'full-squat': strength(squat),
  'split-squat': strength(squat),
  'bulgarian-split-squat': strength(squat),
  'pistol-squat': illustrative(3, 2, [...squat, ['sides', 'Use a comparable range on both sides.']]),
  plank: illustrative(30, 3, plank),
  'hollow-hold': illustrative(20, 3, [['line', 'Keep the lower back in contact with the floor.']]),
  'l-hang': illustrative(10, 3, [...hang, ['line', 'Hold the legs at a consistent height.']]),
  'banded-pallof-press': benchmark(12, 3, [['control', 'Resist rotation on both sides.']], { source: routine }),
  'hanging-knees-to-chest': illustrative(8, 3, hang),
  'wall-handstand': benchmark(30, 3, balance, {
    source: handstandGuide,
    rationale: 'The guide suggests 20 to 30 seconds per set as an approximate checkpoint. Log chest-to-wall holds here.',
  }),
  handstand: illustrative(10, 3, balance),
  'tuck-font-lever': illustrative(15, 3, lever),
  'adv-tuck-front-lever': illustrative(10, 3, lever),
  'tuck-back-lever': illustrative(10, 3, lever),
  'tuck-planche': illustrative(10, 3, [['shape', 'Hold the tuck shape with straight arms and steady shoulder position.']]),
}
