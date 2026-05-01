# Training Plan JSON Template — Structure Guide

This document explains the structure and design decisions behind the `training_plan_template.json` format, built to support endurance training plans (running, cycling, swimming) with room to grow into strength and mobility in the future.

---

## Top-Level `plan` Object

The root object holds identity and metadata for the plan.

```json
{
  "plan": {
    "id": "plan_001",
    "name": "Marathon Training: Advanced 2",
    "author": "Hal Higdon",
    "version": "1.0",
    "created_at": "2024-01-01",
    "description": "...",
    "tags": ["marathon", "advanced", "road-running"]
  }
}
```

| Field | Purpose |
|---|---|
| `id` | Unique identifier for the plan (useful for referencing in a database or URL) |
| `name` | Human-readable plan name |
| `author` | Coach or program creator |
| `version` | Allows multiple iterations of the same plan to coexist |
| `tags` | Freeform labels for filtering or categorization in a UI |

---

## `meta` Block

Stores goal-level information about what the plan is designed to achieve.

```json
"meta": {
  "goal_event": "Marathon",
  "goal_distance_km": 42.195,
  "total_weeks": 18,
  "target_audience": "Experienced runners with prior marathon experience",
  "difficulty": "advanced",
  "weekly_mileage_range_km": { "min": 48, "max": 80 }
}
```

This block is particularly useful for a plan-picker UI — you can filter and display plans by difficulty, goal event, or weekly mileage commitment without loading the full schedule.

---

## `workout_definitions` — The Workout Dictionary

This is the most important flexibility mechanism in the template. Every workout type used in the plan is defined **once** here, and daily schedule entries reference them by ID. This avoids repeating descriptions throughout the schedule and makes it easy to update a workout type globally.

```json
"workout_definitions": {
  "tempo_run": {
    "id": "tempo_run",
    "label": "Tempo Run",
    "category": "threshold",
    "discipline": "running",
    "description": "Sustained effort at lactate threshold pace — comfortably hard.",
    "intensity": "moderate-high",
    "effort_zone": 4,
    "notes": "Aim for a pace 25-30 seconds per mile slower than 10K race pace."
  }
}
```

### Key fields

| Field | Purpose |
|---|---|
| `category` | Workout purpose: `endurance`, `threshold`, `speed`, `race-specific`, `recovery`, `active-recovery`, `strength-endurance` |
| `discipline` | The sport: `running`, `cycling`, `swimming`, `strength`, `mobility`, or `any` |
| `effort_zone` | Heart rate / RPE zone (0–5 scale), useful for structured training apps |
| `intensity` | Human-readable intensity label |
| `structure` | Optional block for intervals/repeats — defines reps, distances, rest type |

### Adding future workout types

To add strength or mobility workouts, just add new entries to this dictionary. No other part of the schema needs to change:

```json
"strength_circuit": {
  "id": "strength_circuit",
  "category": "strength",
  "discipline": "strength",
  "description": "Full-body circuit targeting running-specific muscle groups.",
  "intensity": "moderate",
  "effort_zone": 3
},
"mobility_yoga": {
  "id": "mobility_yoga",
  "category": "flexibility",
  "discipline": "mobility",
  "description": "30-minute yoga session focused on hips and hamstrings.",
  "intensity": "low",
  "effort_zone": 1
}
```

---

## `schedule` Array

The schedule is a flat array of week objects. Each week contains everything needed to describe that block of training.

```json
"schedule": [
  {
    "week": 1,
    "phase": "base",
    "mesocycle": "Endurance",
    "weeks_to_goal": 18,
    "total_distance_km": 48,
    "notes": "First week of training. Keep all efforts easy.",
    "days": [ ... ]
  }
]
```

| Field | Purpose |
|---|---|
| `week` | Week number (counts up from 1) |
| `phase` | Broad training phase: `base`, `build`, `peak`, `taper`, `race` |
| `mesocycle` | Named training block (e.g. Pfitzinger's "Mesocycle 1 Endurance") |
| `weeks_to_goal` | Countdown to race day — supports plans that count down rather than up |
| `total_distance_km` | Weekly mileage summary, useful for charts and progress tracking |

---

## `days` Array

Each week contains a `days` array, one entry per training day.

```json
"days": [
  {
    "day_of_week": "tuesday",
    "workouts": [
      {
        "workout_ref": "interval_800",
        "reps": 6,
        "notes": "Target 5K race pace for each rep."
      }
    ]
  }
]
```

The `workouts` field is an **array** (not a single object) to support:
- Multi-discipline brick workouts (e.g. bike + run)
- AM/PM double sessions
- Workout + mobility combinations

### Per-workout instance fields

Individual workout instances in the schedule are intentionally flexible. Only include fields that apply — everything is nullable.

| Field | When to use |
|---|---|
| `workout_ref` | Always — references a key in `workout_definitions` |
| `distance_km` / `distance_miles` | For distance-based workouts |
| `duration_min` | For time-based workouts (e.g. "30 min tempo") |
| `reps` | For intervals and repeats |
| `event` | For race days — include `event_distance_km` and race-specific notes |
| `notes` | Any day-specific coaching cues that override the general definition |

---

## Design Principles

- **Separate definition from schedule.** Workout types are described once in `workout_definitions`; the schedule only references them. This keeps the schedule readable and avoids duplication.
- **Discipline-agnostic structure.** The `discipline` field on each workout definition is the only thing that ties a workout to a sport. The week/day/workout hierarchy works identically for running, cycling, swimming, strength, or mobility.
- **Both miles and kilometers.** Endurance plans in the US commonly use miles; storing both avoids conversion logic in the app layer.
- **Phases and mesocycles coexist.** `phase` is a simple enum (`base`, `build`, `peak`, `taper`) while `mesocycle` is a freeform string for coaches who use named training blocks (as in Pfitzinger-style plans).
- **Nullable fields over rigid schema.** A rest day doesn't need a distance. A race day doesn't need reps. Fields are only included when relevant, keeping individual day objects clean.
