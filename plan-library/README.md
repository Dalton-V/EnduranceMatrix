# Training plan library

[training.sqlite](training.sqlite) holds the plans and movement progressions. The importer initializes new databases with [schema.sql](schema.sql) followed by [002-progressions.sql](002-progressions.sql). It also upgrades an existing version 1 library in place on its next import. The React app loads a static JSON index and individual plan files.

The initial library contains 55 Hal Higdon plans and 36 plans from *Advanced Marathoning* and *Faster Road Racing*. The 91 plans cover 1,037 scheduled weeks, including the supplied post-race weeks.

## Use the tools

Run these commands from the repository root with Node 22.18 or Node 24. The tools use the built-in SQLite driver and the Node standard library.

~~~sh
# Check the included database against its original inputs.
node plan-library/cli.mjs verify

# Import a new shipped-format plan, a directory of plan files, or a book collection.
node plan-library/cli.mjs import path/to/new-plan.json

# Write the index and plan files the app reads.
node plan-library/cli.mjs export --out endurance-matrix/public/data

# Inspect an earlier revision as shipped JSON.
node plan-library/cli.mjs show --plan am_marathon_up_to_55_18week --revision 1
~~~

To build a separate library from the repository inputs and inspect the release before publishing it, use a new database path and output directory.

~~~sh
node plan-library/cli.mjs import --db tmp/rebuilt.sqlite
node plan-library/cli.mjs verify --db tmp/rebuilt.sqlite
node plan-library/cli.mjs export --db tmp/rebuilt.sqlite --out tmp/release
node --test plan-library/library.test.mjs plan-library/progressions.test.mjs
~~~

The default import reads the original single-plan files in `endurance-matrix/public/data/plans`, the collection in `DataToParse/training_plans.json`, and the bodyweight progression workbook when present. It recognizes generated book exports by filename and publication ID. Explicit input paths import the files named. The `sources` command lists the archived documents and their SHA-256 digests. Use `restore --source DIGEST --out NEW_FILE` to recover an original JSON plan document or the selected worksheet's extracted JSON snapshot.

## Bodyweight movement progressions

The first worksheet in `Bodyweight Fitness Progressions.ods` is **Version 5.4**, published March 13, 2019. The reader stops at the end of that sheet. It uses the legend to decode difficulty, milestones and Iron Cross prerequisite highlighting. It follows the colored lanes through forks, joins and shared checkpoints. An empty gap ends a lane. The resulting JSON contains the graph, movement names, six families, guidance, abbreviations and source hyperlinks.

| Stored relationship | Meaning |
| --- | --- |
| `progression_chart → progression_revision` | A calisthenics reference chart has its own identity and revision history. Its source archive contains a semantic snapshot of the selected worksheet. |
| `progression_entry → progression_skill → movement` | A skill placement keeps its source cell, family, difficulty and milestone status. Both appearances of “Ring Planche” point to the same movement. Workout steps with an exactly matching, trimmed exercise name can reference the same movement. |
| `progression_edge` | `next_on_chart` follows a drawn progression path. `prerequisite` records an explicit Iron Cross requirement. For example, Pike Skin the Cat branches to Tuck Back Lever and L-Hang. |
| `progression_entry → progression_link → resource_url` | Every hyperlink has its original anchor text, exact destination and position on its entry. Shared URLs can appear on several movements or resources. |

Version 5.4 contains 245 skill placements, 236 path connections, five explicit prerequisite connections and 180 hyperlink occurrences. Source spellings and links, including video timestamps, are preserved. The two occurrences of a repeated movement can have different predecessors and successors. The optional ordering guidance for one-leg and straddle levers is retained as a progression note.

~~~sh
node plan-library/cli.mjs import "DataToParse/Bodyweight Fitness Progressions.ods"
node plan-library/cli.mjs verify --workbook "DataToParse/Bodyweight Fitness Progressions.ods"
node plan-library/cli.mjs show --progression bodyweight-fitness-progressions --revision 1
node plan-library/cli.mjs export --out endurance-matrix/public/data
~~~

ODS import and direct workbook verification use Python 3's standard library. The CLI discovers Python on the executable search path, or accepts an explicit executable path through `PLAN_LIBRARY_PYTHON`. Ordinary database verification and export use Node alone. A repeat import of the same selected sheet adds zero revisions.

The standalone export is `progressions/bodyweight-fitness-progressions.json` under the output directory. Entries are identified by source cell within a revision. To find the next movements and demonstration links for a skill, query its outgoing edges.

~~~sql
SELECT target.text AS next_movement, link.url
FROM current_progression_revision r
JOIN progression_edge edge ON edge.revision_id = r.id
JOIN progression_entry start ON start.revision_id = r.id AND start.cell = edge.from_cell
JOIN progression_entry target ON target.revision_id = r.id AND target.cell = edge.to_cell
LEFT JOIN progression_link link ON link.revision_id = r.id AND link.cell = target.cell
WHERE r.chart_key = 'bodyweight-fitness-progressions'
  AND start.text = 'Pike Skin the Cat' AND edge.kind = 'next_on_chart'
ORDER BY target.position, link.position;
~~~

## Relational model

| Relationship | Meaning |
| --- | --- |
| `plan → plan_revision` | One stable public ID and filename. Each new validated content version gets a revision number. The source's own version string is a separate field. |
| `plan_revision → plan_week → plan_day → day_option → scheduled_workout` | Ordered weeks and weekdays. Choose one option and perform its workouts in order. Two workouts can have distinct AM/PM session labels. |
| `scheduled_workout → workout_step → workout_step` | Ordered steps can contain other steps. A repeat or circuit can enclose exercises, intensity cues, and recovery rules. |
| `plan_definition → workout_definition → workout_type` | A plan's local workout reference selects an exact definition. Matching byline, canonical type, and content allows definition reuse. Different coaching instructions get separate rows. |
| `plan_activity → activity_term → activity` | Source terms and discipline names resolve to common activities. For example, both `strength_training` and `strength` resolve to `strength`. |
| `quantity_set → quantity → quantity_field → unit` | Workouts, steps, weeks, summaries and definition structures own sets of measurements. Each value has a purpose, unit, scalar/range shape and bounds. |
| `plan_revision → publication → publication_author → author` | Source edition, ordered credits and exact display byline. `citation` and `citation_locator` identify the pages, chapters, table sections or URL for a specific revision. |
| `source_document → import_record → plan_revision` | One archived input can supply many plans. Each import records the versioned adapter, revision and JSON Pointer of the source entry. |

Foreign keys enforce definition scope, so a scheduled workout can only refer to a definition attached to its own plan revision. Step parents belong to the same workout. Sibling order, day names and numeric bounds have database constraints. Open connections with `PRAGMA foreign_keys = ON`.

## Input and export mapping

The book adapter converts its collection into individual app documents. Both adapters then use the same relational writer. The exporter rebuilds each file from relational rows and the preserved source-specific fields. The source archive is read only by audit and restore operations.

| Shipped input | Book collection input | SQLite destination | Shipped output |
| --- | --- | --- | --- |
| Filename, `plan.id`, identity, version and byline | `plans[i].plan` | `plan`, `plan_revision` | Original single-plan filename or `<book plan id>.json`, with the stable ID under `plan.id` |
| Root `source_url`, `plan.source` | Top-level `sources` joined on `plans[i].source.source_id`, plus the entry's locators | `publication`, ordered authors, `citation`, ordered locators | Original URL and citation for web plans. Book citations include `source.publication` with title, authors, file and format |
| Envelope and additional attributes | Top-level schema version, description, units and data notes | Revision extensions and shared `dataset` | Original envelope, book extraction conventions under `source.dataset` |
| `tags`, `activity_types`, `coaching_guidance` | Header tags and entry-level activities | Ordered `plan_tag`, `plan_activity`, `coaching_guidance` | Original lists, order, topics and text |
| `meta`, `at_a_glance`, goal alternatives | Header `meta`, entry `comparison`, top-level `comparison_index` joined by plan ID | `plan_summary` by scope, `goal_option`, `quantity`, `workout_frequency` | Metadata, options and both source-reported comparison summaries. Published totals may differ from sums of individual sessions |
| Per-plan `workout_definitions`, including interval structure | Collection-wide definitions joined by workout reference | `workout_type`, `workout_definition`, `plan_definition`, structure quantities | Local dictionary, wording, intensity, discipline and rep distance. Each book export contains the definitions relevant to that plan |
| Schedule position, week number, phase, mesocycle, estimates and notes | Same hierarchy, plus printed week label, countdown, weeks after goal, recovery flag and printed weekly volume | `plan_week` and week quantities | Ordered `schedule` including recovery and transition weeks. The goal duration and the number of scheduled weeks remain distinct |
| Ordered weekdays, `workouts`, `alternative_workouts` | Day workouts, double sessions and rest-or-cross-training choices | `plan_day`, `day_option`, ordered `scheduled_workout` | Primary and alternative arrays. `additional_options` can hold further ordered alternatives |
| Workout ref, notes, event, distance, duration, reps, pace segment and recovery | Ref, verbatim `source_text`, session label, independently printed mile/km bounds, event and event bounds | `scheduled_workout` with typed quantities | Scalars remain scalars. Book range objects move to the corresponding `*_range` fields, including equal-ended ranges. Target pace and recovery quantities retain their distinct meanings |
| Optional ordered `steps` on a workout | Explicit threshold segments, timed efforts, strides, ladders, interval sets, pace and recovery in the schedule wording | `workout_step` and step quantities | Nested `steps` alongside the original instructions. A recovery percentage carries the unit “% interval time” |

All 55 original single-plan exports compare equal as parsed JSON, including explicit nulls, absent keys and list order. Source-specific attributes without a dedicated column remain in their owning row's `extensions`. Stored empty containers and null markers preserve field presence. Byte-exact recovery also preserves input whitespace and property ordering.

### Worked example

In week 1 of `am_marathon_up_to_55_18week`, Tuesday prescribes **8–9 miles (13–14 km) with 20–25 minutes at LT pace**. SQLite holds two total-distance measurements on the workout and one duration measurement on a child work step. The source's rounded kilometer range and the full printed sentence survive. Monday's “Rest or cross-train” becomes a rest option and a cross-training option. Each keeps the supplied combined reference in `source_workout_ref`.

Query the Tuesday prescription, including its child targets, directly from the database.

~~~sql
WITH session AS (
    SELECT s.id, s.quantities
    FROM current_plan_revision r
    JOIN plan_week w ON w.revision_id = r.id
    JOIN plan_day d ON d.week_id = w.id
    JOIN day_option o ON o.day_id = d.id
    JOIN scheduled_workout s ON s.option_id = o.id
    WHERE r.plan_id = 'am_marathon_up_to_55_18week'
      AND w.week = 1 AND d.day_of_week = 'tuesday' AND o.position = 0
), quantities AS (
    SELECT 'whole workout' AS scope, quantities FROM session
    UNION ALL
    SELECT step.kind, step.quantities
    FROM session JOIN workout_step step ON step.workout_id = session.id
)
SELECT scope, q.kind, q.unit, q.lower_bound, q.upper_bound
FROM quantities
JOIN measured_value q ON q.set_id = quantities.quantities;
~~~

The book adapter uses the source's individual AM and PM distances when a printed sentence describes both sessions. Where a single entry explicitly appends a second recovery run with its own distance, the adapter emits both sessions and keeps the complete line. It also retains the source's original type when it assigns a more specific type from the text. General coaching advice and ambiguous wording remain available verbatim. The supplied JSON transcriptions are the reference for verification.

## Adding sources and activities

A source adapter in [adapters.mjs](adapters.mjs) yields one `{ payload, filename, pointer }` for each plan. Stable public IDs must be unique across providers. The importer reports collisions so the adapter can choose a source-qualified ID. Use the optional `canonical_type` on a workout definition to map a source alias to an existing shared workout type. Preserve the source's own key as the dictionary key referenced by its schedule.

New disciplines and exercise names are data. A circuit below uses the same schedule, nested steps and quantity tables as the endurance plans.

~~~json
{
  "workout_ref": "strength_circuit",
  "steps": [{
    "kind": "circuit",
    "sets": 3,
    "steps": [
      { "kind": "work", "exercise": "squat", "reps": { "min": 8, "max": 12 }, "load_kg": 20 },
      { "kind": "work", "exercise": "push-up", "reps": 10 },
      { "kind": "hold", "exercise": "calf stretch", "hold_sec": 20 },
      { "kind": "recovery", "rest_sec": 60 }
    ]
  }]
}
~~~

Define `strength_circuit` in the plan's workout dictionary. To make a new measurement queryable, register a `unit` and `quantity_field` mapping before import or add a mapping in [quantities.mjs](quantities.mjs). The same fields work on workouts and nested steps.

## Revision and publication behavior

An entire import runs in one SQLite transaction. A revision becomes current after its schedule references, database constraints and JSON reconstruction pass. A changed plan gets a new revision even when its published version string stays the same. Importing identical plan content, or replaying an older known edition, preserves the current revision. Reformatting an original file can add a new source archive record while reusing the existing plan revision.

Edit a plan by importing an updated source or a revised single-plan JSON document. Keep validated revisions as history. Verification checks their stored fingerprints and reproduces them against the archived documents using the source adapter. Changes to adapter interpretation require a versioned migration that retains the earlier interpretation for historic verification.

Export uses a consistent SQLite read transaction, validates the payloads, atomically replaces changed files and writes the index last. It preserves formatting on equivalent existing files. Only files listed in the index appear in the app. Two writers cannot export to the same directory simultaneously. An interrupted process may leave `.plan-library-export.lock` containing its process ID. After confirming that process has exited, remove that file and rerun the export.

