-- Apply after schema.sql (v1). The Store applies this migration in one transaction.
CREATE TABLE movement (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0)
) STRICT;

ALTER TABLE workout_step ADD COLUMN movement_id INTEGER REFERENCES movement;
INSERT INTO movement(name)
    SELECT DISTINCT trim(exercise) FROM workout_step WHERE length(trim(exercise)) > 0;
UPDATE workout_step SET movement_id = (SELECT id FROM movement WHERE name = trim(workout_step.exercise))
    WHERE length(trim(exercise)) > 0;
CREATE INDEX step_by_movement ON workout_step(movement_id);

CREATE TABLE progression_chart (
    key TEXT PRIMARY KEY NOT NULL,
    activity_code TEXT NOT NULL REFERENCES activity
) STRICT;
CREATE TABLE progression_revision (
    id INTEGER PRIMARY KEY, chart_key TEXT NOT NULL REFERENCES progression_chart,
    revision INTEGER NOT NULL CHECK (revision > 0), sheet TEXT NOT NULL, title TEXT NOT NULL, edition TEXT NOT NULL,
    document_id INTEGER NOT NULL REFERENCES source_document, fingerprint TEXT NOT NULL,
    UNIQUE(chart_key, revision), UNIQUE(chart_key, fingerprint), UNIQUE(document_id)
) STRICT;
CREATE VIEW current_progression_revision AS
    SELECT r.* FROM progression_revision r WHERE NOT EXISTS
    (SELECT 1 FROM progression_revision n WHERE n.chart_key=r.chart_key AND n.revision>r.revision);

CREATE TABLE progression_family (
    revision_id INTEGER NOT NULL REFERENCES progression_revision, name TEXT NOT NULL, position INTEGER NOT NULL,
    PRIMARY KEY(revision_id, name), UNIQUE(revision_id, position)
) STRICT;
-- The source cell distinguishes occurrences, including two placements of Ring Planche.
CREATE TABLE progression_entry (
    revision_id INTEGER NOT NULL REFERENCES progression_revision, cell TEXT NOT NULL,
    position INTEGER NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, detail TEXT,
    PRIMARY KEY(revision_id, cell), UNIQUE(revision_id, position)
) STRICT;
CREATE TABLE progression_skill (
    revision_id INTEGER NOT NULL, cell TEXT NOT NULL, movement_id INTEGER NOT NULL REFERENCES movement,
    family TEXT NOT NULL, difficulty TEXT NOT NULL, milestone INTEGER NOT NULL CHECK(milestone IN (0,1)),
    PRIMARY KEY(revision_id, cell),
    FOREIGN KEY(revision_id, cell) REFERENCES progression_entry(revision_id, cell),
    FOREIGN KEY(revision_id, family) REFERENCES progression_family(revision_id, name)
) STRICT;
CREATE INDEX skill_by_movement ON progression_skill(movement_id);
CREATE TABLE progression_edge (
    revision_id INTEGER NOT NULL, from_cell TEXT NOT NULL, to_cell TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('next_on_chart','prerequisite')),
    PRIMARY KEY(revision_id, from_cell, to_cell, kind), CHECK(from_cell <> to_cell),
    FOREIGN KEY(revision_id, from_cell) REFERENCES progression_skill(revision_id, cell),
    FOREIGN KEY(revision_id, to_cell) REFERENCES progression_skill(revision_id, cell)
) STRICT;
CREATE INDEX progression_incoming ON progression_edge(revision_id, to_cell);
CREATE TABLE resource_url (url TEXT PRIMARY KEY NOT NULL CHECK(length(url) > 0)) STRICT;
CREATE TABLE progression_link (
    revision_id INTEGER NOT NULL, cell TEXT NOT NULL, position INTEGER NOT NULL,
    label TEXT NOT NULL, url TEXT NOT NULL REFERENCES resource_url,
    PRIMARY KEY(revision_id, cell, position),
    FOREIGN KEY(revision_id, cell) REFERENCES progression_entry(revision_id, cell)
) STRICT;
PRAGMA user_version = 2;
