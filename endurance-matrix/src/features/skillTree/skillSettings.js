export const CATEGORIES = {
  push: 'Push',
  pull: 'Pull',
  core: 'Core',
  legs: 'Legs',
  balance: 'Balance & Inversions',
  static: 'Static Holds',
  dynamic: 'Dynamic Skills',
  mobility: 'Mobility & Prerequisites',
}

export const FAMILY_CATEGORIES = {
  'Horizontal Pull': 'pull',
  'Vertical Pull': 'pull',
  'Vertical Push': 'push',
  'Horizontal Push': 'push',
  Core: 'core',
  Legs: 'legs',
  Mobility: 'mobility',
}

export const METRICS = {
  reps: { label: 'Repetitions', unit: 'reps', fields: ['Reps'] },
  hold: { label: 'Hold duration', unit: 'sec', fields: ['Seconds'] },
  'unilateral-reps': { label: 'Repetitions per side', unit: 'reps per side', fields: ['Left reps', 'Right reps'] },
  'unilateral-hold': { label: 'Hold duration per side', unit: 'sec per side', fields: ['Left seconds', 'Right seconds'] },
  practice: { label: 'Practice', fields: [] },
}

// Each row is an AND group. IDs within a row are alternate routes (OR).
// These override worksheet joins whose incoming lanes are ambiguous, or where
// the path in a worksheet is useful context but not a sensible mastery gate.
export const PREREQUISITE_OVERRIDES = {
  'pull-up': [['pull-up-negative']],
  'archer-push-up': [['push-up', 'ring-push-up']],
  'wall-handstand': [['wall-plank']],
  'wall-hes-pu-neg': [['wall-handstand'], ['decline-pike-pu']],
  'ring-shld-stand': [['ring-sup-hold']],
  'tuck-handstand': [['handstand']],
  'muscle-up': [['c2b-pull-up'], ['dip', 'ring-dip'], ['mu-neg', 'kipping-mu']],
  'strict-bar-mu': [['muscle-up']],
  'straddle-font-lever': [['adv-tuck-front-lever']],
  'front-lever': [['one-leg-front-lever', 'straddle-font-lever']],
  'straddle-back-lever': [['adv-tuck-back-lever']],
  'back-lever': [['one-leg-back-lever', 'straddle-back-lever']],
}

// Keep non-repetition movements explicit. Some chart entries are guides or
// drills with no single performance metric.
const holds = `
  G8 Y9 N14 AJ8 AT8 AT9 AT10 AU11 AS13 AS14 AS15 AS16 AS17 AS18 AS19
  AI14 AI16 AI18 AI19 AK21 AK22 AG28 AG29 AG30 AG31
  AU32 AU33 AI37 AI38 AI39 AS38 AI43 AI44 AI45 AI46 AI48
  CB8 BV9 BU13 BU14 BN17 BX19 BU21 BU23 BN28 BU28 BW32 BW33 BN36 BN37
  BX38 BX41 BN42 BY48 BH50 BG51 BZ51
  D14 D15 D31 D32 G19 F28 E36 G37 O35 AE25 P46 CI10 CR15
`
const unilateralHolds = `
  AG10 AS20 AS21 AQ28 AQ29 AS41 AS42 AI15 AI17 BU22 BU29 BU30
  BN41 BX42 D30 E35 CG14 CG15
`
const unilateralReps = `
  O19 O28 O29 O30 W38 W39 W41 W48 W37 BD25 BD26 BF29 BD32 BD33 BD34 BD35 BD46
  DC8 DA13 CW14 CZ17 CX18 CV20 CV21 CV22 CV23 CV28 CV29 CW25 CY26 CY31 CV32 CV33
  CX38 CV41 CZ43 CJ12 CK13 CI23 CM31 CM32 CK41 CG44
`
const practice = 'CJ2 CO2 CW2 CZ2 L45 AS39 AS49'

export const TRACKING = Object.fromEntries([
  ['hold', holds], ['unilateral-hold', unilateralHolds],
  ['unilateral-reps', unilateralReps], ['practice', practice],
].flatMap(([metric, cells]) => cells.trim().split(/\s+/).map(cell => [cell, metric])))

export const LOADED_CELLS = new Set('CI22 CJ30 CG43 CV28'.split(' '))
export const ASSISTED_CELLS = new Set('CV8 CV22'.split(' '))

// Categories can overlap with the worksheet families without duplicating skills.
export const CATEGORY_TAGS = {
  core: 'N14 AI14 AI15 AI16 AI17 AI18 AI19 AI37 AI38 AI39 AI43 AI44 AI45 AI46 AI48 CB8 BV9 AG10 CZ2',
  balance: 'AT8 AT9 AT10 AU11 AU24 AU25 AV28 AV29 AX30 AU32 AU33 AT35 AT36 AS38 AS39 AS41 AS42 AU44 AS49 AG50 BU14 BN17 BX19 BW32 BN43',
  dynamic: 'Z20 Y21 Y28 Z30 X31 X32 X33 X43 G41 D42 H43 D33 D45 D46 D47 S47 BN43 AG50',
  mobility: 'G8 F9 E10 G11 AS13 AS14 AS15 AS16 AS17 AS18 AS19 AS20 AS21 AQ28 AQ29 CV20',
}

export const SKILL_LABELS = {
  'sup-hold': 'Support Hold',
  'pull-up': 'Pull-Up',
  'push-up': 'Push-Up',
  'incline-push-up': 'Incline Push-Up',
  'c2b-pull-up': 'Chest-to-Bar Pull-Up',
  'mu-neg': 'Muscle-Up Negative',
  'kipping-mu': 'Kipping Muscle-Up',
  'muscle-up': 'Muscle-Up',
  'strict-bar-mu': 'Strict Bar Muscle-Up',
  handstand: 'Freestanding Handstand',
  'hs-pu': 'Handstand Push-Up',
  'wall-hs-pu': 'Wall Handstand Push-Up',
  'tuck-font-lever': 'Tuck Front Lever',
  'adv-tuck-front-lever': 'Advanced Tuck Front Lever',
  'straddle-font-lever': 'Straddle Front Lever',
  'adv-tuck-pl': 'Advanced Tuck Planche',
  'str-planche': 'Straddle Planche',
}
