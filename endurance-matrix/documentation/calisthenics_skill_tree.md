# Calisthenics Skill Tree

Open **Skill Tree** in the main navigation or visit `/calisthenics/skill-tree`. The React page loads the existing Bodyweight Fitness Progressions export from `public/data/progressions`. The export supplies movement names, source difficulty, demonstration links, and chart connections. The route loads independently of the endurance plan index.

## Add or update a movement

1. Update the movement in the progression library and regenerate the browser export with the existing library exporter. From the repository root, run `node plan-library/cli.mjs export --out endurance-matrix/public/data`.
2. In `src/features/skillTree/skillIdentities.json`, map the movement’s permanent skill ID to its source cell. Give multiple placements of the same movement one ID. When a worksheet revision moves a skill, update the cell and keep the ID. When removing a skill, keep its ID reserved. Exported user history continues to retain old IDs.
3. In `skillSettings.js`, set any tracking profile, additional categories, or alternate display label. A skill can belong to several categories. Tracking supports repetitions, timed holds, side-specific sets, unmeasured practice, added load, and assistance.
4. Review incoming links. A single chart link becomes a prerequisite and multiple incoming chart paths become alternatives by default. Explicit source prerequisites are mandatory. Use `PREREQUISITE_OVERRIDES` to adjust ambiguous chart routes or define compound requirements. For example, `[['pull-up'], ['dip', 'ring-dip']]` requires a pull-up and either dip variation. The detail panel retains replaced outgoing paths as related routes. The catalog validates references and rejects cycles.

## Add a readiness benchmark

Add an entry keyed by skill ID in `benchmarks.js`. Use a `sets` criterion with a minimum value per set, the number of qualifying sets, and optional load or assistance limits. Use a `check` criterion for technique, control, or range of motion that the athlete confirms when logging an attempt. A benchmark can require qualifying attempts on multiple distinct dates. All required criteria must be recorded together on a qualifying attempt. Unilateral attempts count a set only if both sides meet the target.

Include the source or rationale in the benchmark. Increase its version when changing the meaning of a technique check. Previous measurements and check history remain available. Technique checks from an older version need reconfirmation. A skill without a configured benchmark supports practice and a labeled mastery override.

## Progress and verification

`progressStorage.js` reads, validates, migrates, and writes the progress snapshot. It is the persistence boundary for a future account-based implementation. The view derives readiness, unlocks, and milestones from logged attempts and mastery records. Merging an import adds missing attempt IDs and goals and preserves local records when IDs conflict. Replacement and reset require confirmation. A skill reset removes its attempts and mastery. Dependents recalculate availability as prerequisites change.

From `endurance-matrix`, run `npm test`, `npm run lint`, and `npm run build`.
