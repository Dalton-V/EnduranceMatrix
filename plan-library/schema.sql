-- SQLite 3.37+. Enable foreign keys on every connection.
-- Base schema (v1). Apply 002-progressions.sql next for the movement library.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

-- Archived plan JSON bytes or the selected progression sheet's JSON snapshot.
CREATE TABLE source_document (
    id INTEGER PRIMARY KEY,
    filename TEXT NOT NULL,
    sha256 TEXT NOT NULL UNIQUE,
    original BLOB NOT NULL
) STRICT;
CREATE TABLE author (name TEXT PRIMARY KEY NOT NULL) STRICT;
CREATE TABLE publication (
    id INTEGER PRIMARY KEY,
    fingerprint TEXT UNIQUE NOT NULL,
    source_key TEXT, title TEXT, file TEXT, format TEXT, url TEXT,
    extensions TEXT NOT NULL DEFAULT '{}'
) STRICT;
CREATE TABLE publication_author (
    publication_id INTEGER NOT NULL REFERENCES publication,
    position INTEGER NOT NULL, name TEXT NOT NULL REFERENCES author,
    PRIMARY KEY (publication_id, position)
) STRICT;
CREATE TABLE dataset (
    id INTEGER PRIMARY KEY,
    -- Shared extraction conventions, units, notes and schema version.
    header TEXT UNIQUE NOT NULL CHECK (json_type(header) = 'object')
) STRICT;
CREATE TABLE plan (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    filename TEXT COLLATE NOCASE UNIQUE NOT NULL
) STRICT;
CREATE TABLE plan_revision (
    id INTEGER PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plan,
    revision INTEGER NOT NULL CHECK (revision > 0),
    fingerprint TEXT NOT NULL,
    name TEXT NOT NULL, author TEXT, version TEXT, created_at TEXT, description TEXT,
    source_url TEXT, publication_id INTEGER REFERENCES publication, dataset_id INTEGER REFERENCES dataset,
    envelope_extensions TEXT NOT NULL DEFAULT '{}', extensions TEXT NOT NULL DEFAULT '{}',
    UNIQUE (plan_id, revision), UNIQUE (plan_id, fingerprint)
) STRICT;
CREATE VIEW current_plan_revision AS
    SELECT r.* FROM plan_revision r WHERE NOT EXISTS
    (SELECT 1 FROM plan_revision newer WHERE newer.plan_id=r.plan_id AND newer.revision>r.revision);
CREATE TABLE import_record (
    document_id INTEGER NOT NULL REFERENCES source_document, pointer TEXT NOT NULL,
    adapter TEXT NOT NULL, revision_id INTEGER NOT NULL REFERENCES plan_revision,
    PRIMARY KEY (document_id, adapter, pointer)
) STRICT;
CREATE TABLE citation (
    revision_id INTEGER PRIMARY KEY REFERENCES plan_revision,
    source_id TEXT, page_title TEXT, canonical_url TEXT, chapter_title TEXT, schedule_title_in_source TEXT,
    extensions TEXT NOT NULL DEFAULT '{}'
) STRICT;
CREATE TABLE citation_locator (
    revision_id INTEGER NOT NULL REFERENCES citation, kind TEXT NOT NULL,
    position INTEGER NOT NULL, value ANY NOT NULL CHECK (typeof(value) IN ('integer','text')),
    PRIMARY KEY (revision_id, kind, position)
) STRICT;
CREATE TABLE tag (name TEXT PRIMARY KEY NOT NULL) STRICT;
CREATE TABLE plan_tag (
    revision_id INTEGER NOT NULL REFERENCES plan_revision, position INTEGER NOT NULL,
    name TEXT NOT NULL REFERENCES tag, PRIMARY KEY (revision_id, position)
) STRICT;
CREATE TABLE activity (code TEXT PRIMARY KEY NOT NULL) STRICT;
CREATE TABLE activity_term (
    term TEXT PRIMARY KEY NOT NULL, activity_code TEXT NOT NULL REFERENCES activity
) STRICT;
CREATE TABLE plan_activity (
    revision_id INTEGER NOT NULL REFERENCES plan_revision, position INTEGER NOT NULL,
    term TEXT NOT NULL REFERENCES activity_term, PRIMARY KEY (revision_id, position)
) STRICT;
CREATE TABLE coaching_guidance (
    revision_id INTEGER NOT NULL REFERENCES plan_revision, position INTEGER NOT NULL,
    topic TEXT, text TEXT, extensions TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (revision_id, position)
) STRICT;

-- A field maps a published name to a semantic quantity and unit. Preserve the
-- printed bounds in each unit, even if a source rounds them independently.
CREATE TABLE unit (code TEXT PRIMARY KEY NOT NULL) STRICT;
CREATE TABLE quantity_field (
    field TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, unit TEXT NOT NULL REFERENCES unit
) STRICT;
CREATE TABLE quantity_set (id INTEGER PRIMARY KEY) STRICT;
CREATE TABLE quantity (
    set_id INTEGER NOT NULL REFERENCES quantity_set, field TEXT NOT NULL REFERENCES quantity_field,
    shape TEXT NOT NULL CHECK (shape IN ('scalar','range')),
    lower_bound REAL, upper_bound REAL, unit_override TEXT REFERENCES unit,
    extensions TEXT NOT NULL DEFAULT '{}',
    CHECK (lower_bound IS NULL OR upper_bound IS NULL OR lower_bound <= upper_bound),
    CHECK (shape <> 'scalar' OR (lower_bound IS NOT NULL AND lower_bound IS upper_bound)),
    PRIMARY KEY (set_id, field)
) STRICT;
CREATE VIEW measured_value AS
    SELECT q.set_id, q.field, f.kind, coalesce(q.unit_override, f.unit) AS unit,
           q.shape, q.lower_bound, q.upper_bound
    FROM quantity q JOIN quantity_field f ON f.field=q.field;
CREATE TABLE plan_summary (
    id INTEGER PRIMARY KEY, revision_id INTEGER NOT NULL REFERENCES plan_revision,
    scope TEXT NOT NULL CHECK (scope IN ('meta','at_a_glance','comparison','comparison_index')),
    goal_event TEXT, target_audience TEXT, difficulty TEXT, plan_type TEXT,
    training_volume_band TEXT, preparation_recommendation TEXT, typical_week TEXT,
    quantities INTEGER REFERENCES quantity_set, extensions TEXT NOT NULL DEFAULT '{}',
    UNIQUE (revision_id, scope)
) STRICT;
CREATE TABLE goal_option (
    summary_id INTEGER NOT NULL REFERENCES plan_summary, field TEXT NOT NULL,
    position INTEGER NOT NULL, event TEXT, distance_km REAL, extensions TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (summary_id, field, position)
) STRICT;
CREATE TABLE workout_type (code TEXT PRIMARY KEY NOT NULL) STRICT;
CREATE TABLE workout_frequency (
    summary_id INTEGER NOT NULL REFERENCES plan_summary, source_ref TEXT NOT NULL,
    count INTEGER NOT NULL CHECK (count >= 0), PRIMARY KEY (summary_id, source_ref)
) STRICT;
-- A definition is an immutable edition of a coach's wording. Source refs
-- in a plan may be mapped to the same cross-source workout type.
CREATE TABLE workout_definition (
    id INTEGER PRIMARY KEY, fingerprint TEXT UNIQUE NOT NULL, byline TEXT,
    type_code TEXT NOT NULL REFERENCES workout_type, label TEXT, category TEXT,
    discipline TEXT REFERENCES activity_term, description TEXT, intensity TEXT,
    effort_zone REAL, notes TEXT, structure_type TEXT, structure_quantities INTEGER REFERENCES quantity_set,
    structure_extensions TEXT, extensions TEXT NOT NULL DEFAULT '{}'
) STRICT;
CREATE TABLE plan_definition (
    revision_id INTEGER NOT NULL REFERENCES plan_revision, ref TEXT NOT NULL,
    definition_id INTEGER NOT NULL REFERENCES workout_definition,
    PRIMARY KEY (revision_id, ref)
) STRICT;
CREATE TABLE plan_week (
    id INTEGER PRIMARY KEY, revision_id INTEGER NOT NULL REFERENCES plan_revision,
    position INTEGER NOT NULL, week INTEGER NOT NULL CHECK (week > 0),
    week_label TEXT, phase TEXT, mesocycle TEXT, is_recovery_week INTEGER CHECK (is_recovery_week IN (0,1)),
    weeks_to_goal INTEGER, weeks_after_goal INTEGER, source_week INTEGER, notes TEXT, weekly_volume_source_text TEXT,
    quantities INTEGER REFERENCES quantity_set, extensions TEXT NOT NULL DEFAULT '{}',
    UNIQUE (revision_id, week), UNIQUE (revision_id, position), UNIQUE (id, revision_id)
) STRICT;
CREATE TABLE plan_day (
    id INTEGER PRIMARY KEY, week_id INTEGER NOT NULL, revision_id INTEGER NOT NULL,
    position INTEGER NOT NULL, day_of_week TEXT NOT NULL CHECK
        (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
    extensions TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (week_id, revision_id) REFERENCES plan_week(id, revision_id),
    UNIQUE (week_id, day_of_week), UNIQUE (week_id, position), UNIQUE (id, revision_id)
) STRICT;
-- Choose one option. Perform all workouts within that option in order.
CREATE TABLE day_option (
    id INTEGER PRIMARY KEY, day_id INTEGER NOT NULL, revision_id INTEGER NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    FOREIGN KEY (day_id, revision_id) REFERENCES plan_day(id, revision_id),
    UNIQUE (day_id, position), UNIQUE (id, revision_id)
) STRICT;
CREATE TABLE scheduled_workout (
    id INTEGER PRIMARY KEY, option_id INTEGER NOT NULL, revision_id INTEGER NOT NULL,
    position INTEGER NOT NULL, workout_ref TEXT NOT NULL, source_workout_ref TEXT,
    session TEXT, event TEXT, notes TEXT, source_text TEXT,
    quantities INTEGER REFERENCES quantity_set, extensions TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (option_id, revision_id) REFERENCES day_option(id, revision_id),
    FOREIGN KEY (revision_id, workout_ref) REFERENCES plan_definition(revision_id, ref),
    UNIQUE (option_id, position)
) STRICT;
-- Steps can be nested into repeats, choices or circuits. Parents always
-- precede children, which also rules out cycles when editing through SQL.
CREATE TABLE workout_step (
    id INTEGER PRIMARY KEY, workout_id INTEGER NOT NULL REFERENCES scheduled_workout,
    parent_id INTEGER, position INTEGER NOT NULL, kind TEXT NOT NULL,
    exercise TEXT, intensity TEXT, instruction TEXT, quantities INTEGER REFERENCES quantity_set,
    extensions TEXT NOT NULL DEFAULT '{}', UNIQUE (id, workout_id),
    FOREIGN KEY (parent_id, workout_id) REFERENCES workout_step(id, workout_id),
    CHECK (id > 0 AND (parent_id IS NULL OR parent_id < id))
) STRICT;
CREATE UNIQUE INDEX step_order ON workout_step(workout_id, ifnull(parent_id,0), position);
CREATE INDEX workout_by_definition ON scheduled_workout(revision_id, workout_ref);
CREATE INDEX definition_by_type ON workout_definition(type_code);
CREATE INDEX import_by_revision ON import_record(revision_id);
CREATE INDEX quantity_by_field ON quantity(field, lower_bound, upper_bound);
PRAGMA user_version = 1;
COMMIT;
