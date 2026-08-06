# Tagging Rules Builder — Design

Date: 2026-08-06
Status: Approved, ready for implementation planning

## Problem

Tagging today is a single hardcoded rule. `assets/tasks/tag.py` tags any scene with more
than one funscript using the `multi_script_tag` plugin setting, and untags scenes that no
longer qualify. There is no way for a user to express any other tagging rule.

Funscript files carry two sources of information the plugin does not currently use:

- a `metadata` object with loose, scripter-defined keys (`tags`, `creator`, `type`, …)
- an optional `channels` object whose keys name the multi-axis channels present

This design adds a UI for building tagging rules over both, and a task that applies them.

## Scope

**In scope:** a two-tab rule builder in the plugin settings panel; server-side persistence
of those rules; a new task that evaluates them across the library and applies tags.

**Out of scope:** removing tags (the new task is add-only); triggering the task from the
builder UI; any change to `tag.py`'s existing multi-script behaviour.

## Concepts

A **rule** turns values found in a scene's funscripts into Stash tags. Rules come in two
kinds, presented as the two tabs:

- **Metadata rule** — reads `metadata[field_name]` from the funscript JSON. The matched
  value becomes the tag name, optionally passed through a `{value}` template.
- **Channel rule** — matches against the keys of the funscript's `channels` object and
  applies a fixed tag name.

Both kinds carry a list of **filters**. A filter is `{include|exclude} × {exact|regex} ×
pattern`. Includes, when any are present, act as an allow-list — a value must match at
least one to survive. When a rule has no include filters, every value passes that stage.
Excludes are applied afterwards, so an exclude always wins.

Every rule resolves a tag name to a Stash tag either by creating it when absent
(**create**) or by applying it only if it already exists (**skip**). Each rule may
override a global default.

## Architecture

Rules are authored in the browser, persisted server-side in the plugin's SQLite database,
and consumed by a Python task. Persistence and application are deliberately separate:
`manage.py` only accepts and returns rules, and a new `extract_metadata` task applies them.

```
PluginSettings.tsx
  └── TagRuleBuilder ──useTagRules──> runPluginOperation(mode: manage)
                                          └── manage.py: GET_TAG_RULES / SAVE_TAG_RULES
                                                  └── TagRule / TagRuleFilter (SQLite)
                                                          ^
Settings → Tasks → "extract_metadata" ──> extract_metadata.py ──┘
                                                  └── funscripts on disk → Stash tags
```

## Data model

Two new peewee models in `assets/db.py`, added to the `create_tables` list in
`ensure_db()`. No migration is required — `create_tables` runs with `safe=True`, and the
`assets/migrations/` mechanism exists only for altering tables that already ship.

### Enums

`kind`, `mode` and `match_type` are closed sets, so they are enums rather than bare
strings. They live in `assets/db.py` beside the models, which is the lowest point in the
import graph that `manage.py` and `extract_metadata.py` both already reach through
`Config`. `manage.py`'s existing `ManageAction(Enum)` is the precedent.

```python
class RuleKind(str, Enum):
    METADATA = 'metadata'
    CHANNEL  = 'channel'

class FilterMode(str, Enum):
    INCLUDE = 'include'
    EXCLUDE = 'exclude'

class MatchType(str, Enum):
    EXACT = 'exact'
    REGEX = 'regex'
```

The `str` mixin matters for two reasons: `json.dumps` serialises members directly, so
`GET_TAG_RULES` needs no manual unwrapping; and comparisons against raw strings still hold,
so nothing breaks if a value arrives unconverted from an older client.

peewee has no native enum column, so a small field class handles the conversion and keeps
the storage format a plain string:

```python
class EnumField(CharField):
    def __init__(self, enum_cls, *args, **kwargs):
        self.enum_cls = enum_cls
        kwargs.setdefault('max_length', 32)
        super().__init__(*args, **kwargs)

    def db_value(self, value):
        if value is None:
            return None
        return value.value if isinstance(value, Enum) else str(value)

    def python_value(self, value):
        return None if value is None else self.enum_cls(value)
```

Reads therefore hand back enum members, not strings, so evaluation code in
`extract_metadata.py` branches on `RuleKind.METADATA` rather than a string literal.

### Models

```python
class TagRule(BaseModel):
    kind         = EnumField(RuleKind)
    enabled      = BooleanField(default=True)
    sort_order   = IntegerField(default=0)
    field_name   = CharField(null=True)         # metadata only: key under `metadata`
    is_array     = BooleanField(default=False)  # metadata only
    tag_template = CharField(null=True)         # '{value}'; null -> raw value
    tag_name     = CharField(null=True)         # channel only: fixed tag to apply
    auto_create  = BooleanField(null=True)      # null -> inherit global default

class TagRuleFilter(BaseModel):
    rule       = ForeignKeyField(TagRule, backref='filters', on_delete='CASCADE')
    mode       = EnumField(FilterMode)
    match_type = EnumField(MatchType)
    pattern    = TextField()
```

One filter table serves both rule kinds. `field_name` is freeform because the funscript
metadata convention is loose — scripters use arbitrary keys, so there is no schema to
validate against.

`sort_order` controls presentation only. Because the task is add-only and unions every
rule's output, rule order cannot change which tags a scene ends up with.

`on_delete='CASCADE'` is declared for documentation, but peewee's SQLite backend does not
enforce foreign keys unless the connection is opened with `pragmas={'foreign_keys': 1}`,
which `assets/db.py` does not do. Rather than change that pragma globally and alter
behaviour for the existing `Funscript` table, `SAVE_TAG_RULES` deletes `TagRuleFilter`
rows explicitly inside its transaction before deleting the rules themselves.

The global auto-create default is a new `BOOLEAN` entry in the `settings:` block of
`assets/StashInteractiveTools.yml`, alongside `enable_tagging`. It is read in
`config.py`'s `get_config()` like the other plugin settings. It lives there rather than in
the database so it appears in the same settings panel as the builder itself.

## Backend: persistence

Two new members of `ManageAction` in `assets/tasks/manage.py`, with dataclass payloads
registered in the existing `ACTIONS` dict so `resolve_payload` picks them up unchanged:

- `GET_TAG_RULES` — returns the full rule set, ordered by `sort_order`
- `SAVE_TAG_RULES` — replaces the entire rule set inside `db.atomic()`

Replace-all rather than per-row CRUD: the set is a few dozen rows at most, the UI edits a
list and commits it as a unit, and reorder and delete need no special handling.

Neither payload carries a `scene_id`, so they do not subclass `BasePayload`.

The payload dataclasses type their `kind`, `mode` and `match_type` fields as the enums
above, which makes validation free: `bind_json` already coerces enum-typed fields
(`assets/helpers.py:79-88`) and raises `JsonValidationError: expected one of ['include',
'exclude'], got 'includes'` on anything unrecognised. No hand-written membership checks
are needed in `manage.py`, and a malformed value is rejected at the boundary rather than
reaching the database.

`GET_TAG_RULES` returns camelCase keys, matching the convention `init.py`'s `for_json`
already establishes (`truePath`, `isDefault`, `sortOrder`). Enum members serialise to
their string values through the `str` mixin.

## Backend: application

New module `assets/tasks/extract_metadata.py`, registered in the `tasks:` block of
`assets/StashInteractiveTools.yml` alongside `tag` and `remap`.

It paginates scenes exactly as `tag_scenes()` does — `find_scenes` with `per_page: 100`,
sorted by `updated_at`, reporting `config.log.progress(seen/total)` — using a static
fragment:

```
id
tags { id }
files { path }
```

Stash only needs to say where the video is and which tags the scene already has.
Everything a rule evaluates comes off disk.

### Per-scene evaluation

1. `init_task.get_funscripts(file, scene_id)` globs the scene's funscript paths.
   `init.py` is reused purely as a file locator here; no label parsing is involved.
2. For each path, `load_funscript(path)` returns the parsed JSON.
3. Candidate values are collected per rule:
   - **Metadata rule** — the value at `metadata[field_name]`. Splitting `field_name` on
     `.` gives nested descent (`chapters.name`). A missing key contributes nothing.
   - **Channel rule** — the keys of the `channels` object. Only key names are read, so it
     does not matter whether each value is an object or a bare actions array. A funscript
     with no `channels` object contributes nothing, which is the common case.
4. Filters run over the candidate values. For an array field each entry is evaluated
   separately; for a scalar the filters act as a guard on the single value. Exact matches
   compare the whole value case-insensitively; regex matches anywhere unless anchored.
   Non-string scalars are coerced with `str()`.

   `is_array` is the user's declaration of the expected shape, not a guarantee. The
   evaluator inspects the actual value: a list is always iterated and a non-list is always
   treated as a single value, whichever way the toggle is set. The toggle drives the UI
   and the help text; it never causes a shape mismatch to fail.

5. Surviving values become tag names — Metadata rules through the optional `{value}`
   template, Channel rules via the rule's fixed `tag_name`. A template containing no
   `{value}` placeholder yields that literal string, collapsing every match to one tag.
6. Tag names are unioned across all of the scene's funscripts.
7. Each name resolves to a tag id via `stash.find_tag(name, create=...)`, where `create`
   is the rule's `auto_create` when set and the global default otherwise. Results are
   held in a name → id cache for the duration of the run.
8. Tags are applied with the existing `BULK_SCENE_UPDATE` mutation, batched per page in
   `ADD` mode.

The task is **add-only**. It never issues `mode='REMOVE'`, so it cannot strip a tag a user
applied by hand or another plugin set.

### Why disk rather than the `Funscript` table

The `Funscript` table already holds a row per script with its label, which makes it look
like the natural source. It is not: rows are written by `init`, and `init` only runs when
someone opens that scene's Interactive tab in the UI. The table is a cache of visited
scenes, not an index of the library.

A sweep backed by that table would tag the scenes you happened to have clicked into and
silently skip the rest — succeeding visibly while missing most of the library, which is
worse than failing outright. Reading the filesystem covers every scene. The cost is one
directory glob per scene, which `tag.py` already pays on every run.

### Error handling

A funscript with unreadable or invalid JSON is skipped and logged; the sweep continues.
This matches how the plugin already treats broken funscripts elsewhere (the README
documents them as a recognised state in the heatmap).

Rules that fail validation server-side (empty `field_name` on a metadata rule, empty
`tag_name` on a channel rule, an uncompilable regex) are logged by name and skipped rather
than aborting the run.

### Shared helper

`remap.py` duplicates `open(path, 'br')` + `json.load` + `except json.JSONDecodeError`
three times (lines 120, 274, 353). Since every rule in the new task needs the same load,
this becomes a `load_funscript(path)` helper in `assets/helpers.py`, used by both
`remap.py` and `extract_metadata.py` rather than adding a fourth copy.

## Frontend

New folder `src/components/tagging/`, rendered by `PluginSettings.tsx` beneath its
existing `settings.map(...)` block. `PluginSettings` already replaces the native panel
wholesale via `patch.instead` in `src/index.tsx`, so no new patch point is needed.

### Components

**`TagRuleBuilder.tsx`** — the host. Holds a local working copy of the rule list plus a
dirty flag, and renders Save and Discard. Above the tabs it renders the global
auto-create default. The two tabs use a `Tab.Container` with `Nav.Link`s, the same
react-bootstrap idiom `src/index.tsx` already uses for the scene panel. Save posts the
whole list, matching the replace-all backend action.

**`MetadataRuleRow.tsx`** — one metadata rule: a freeform `field_name` input, the
`is_array` switch, the optional template input, the auto-create override
(Inherit / Create / Skip), and a `MatchFilterList`.

**`ChannelRuleRow.tsx`** — one channel rule: a required `tag_name` input, the auto-create
override, and a `MatchFilterList` matched against `channels` keys.

Both rows carry an enable toggle, reorder arrows, and delete, following the row controls
already in `src/components/modifiers/block.tsx`.

**`MatchFilterList.tsx`** — shared by both tabs. Add/remove rows of
`{include|exclude} × {exact|regex} × pattern`. Regex patterns are checked live with a
`new RegExp()` try/catch so an invalid pattern surfaces inline rather than being skipped
server-side mid-sweep.

Using the same widget for channel rules rather than a single match field means
"twist or roll → Multi-Axis" is expressible, and it maps 1:1 onto the shared
`TagRuleFilter` table for both rule kinds.

The filter list renders for scalar metadata fields as well as arrays, but its help text
switches on `is_array`, because it does two different jobs:

- array — "Chooses which entries of this field become tags."
- scalar — "Guards the rule — the tag is only applied if the value matches."

**`HelpIcon.tsx`** — the rollover help. Extracted from the idiom already present at
`src/components/modifiers/block.tsx:77`:

```tsx
<OverlayTrigger placement="top" overlay={<Tooltip id={id}>{text}</Tooltip>}>
  <Icon className="small-icon" icon={faInfoCircle} />
</OverlayTrigger>
```

**`types.ts`** — the `TagRule` and `TagRuleFilter` interfaces, plus TypeScript `enum`s
mirroring the Python ones member-for-member. The codebase already uses `enum` for wire
values (`InteractiveBackendOperation`, `InteractiveBackendManageAction`,
`HapticInterface`), so this follows the house style:

```ts
export enum RuleKind {
  METADATA = 'metadata',
  CHANNEL = 'channel',
}
export enum FilterMode {
  INCLUDE = 'include',
  EXCLUDE = 'exclude',
}
export enum MatchType {
  EXACT = 'exact',
  REGEX = 'regex',
}
```

The string values are the contract between the two sides and must stay identical to the
Python members. `auto_create` stays a nullable boolean rather than becoming an enum —
`null` already means inherit, and the tri-state select maps onto `null | true | false`
without a third name.

### Help text

| Control         | Text                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `field_name`    | Key inside the funscript's `metadata` object — e.g. `tags`, `creator`, `type`. Use dots for nested keys. Funscripts without this key are skipped. |
| `is_array`      | On if the value is a list. Each entry is then evaluated separately and can become its own tag.                                                    |
| template        | Optional. `{value}` is replaced by the matched value — `Scripter: {value}` turns `foo` into `Scripter: foo`. Leave blank to use the value as-is.  |
| exact vs regex  | Exact compares the whole value, case-insensitively. Regex matches anywhere in the value unless you anchor with `^` and `$`.                       |
| include/exclude | With no includes, everything passes. Add one and only matching values pass. Excludes run afterwards and always win.                               |
| auto-create     | Create makes the Stash tag if it doesn't exist. Skip only applies tags that already exist. Inherit follows the default above.                     |
| channel match   | Matched against the keys of the funscript's `channels` object. Funscripts without one are skipped.                                                |

### Hook

**`src/hooks/useTagRules.ts`** wraps the two manage actions. The existing
`useInteractiveBackendManage` hardcodes `payload: { sceneId }`, which these actions do not
have, so this is a sibling hook calling `useInteractiveBackend(MANAGE, { action, payload })`
directly rather than widening the existing one and risking its current callers.

`useInteractiveBackend` runs `deepSnakeCase` over outbound args, so the TS side stays
camelCase in both directions.

### Validation

Save is disabled with inline errors when a metadata rule has an empty `field_name`, a
channel rule has an empty `tag_name`, or any regex pattern fails to compile. The backend
re-checks the same conditions and skips offending rules at run time, so a rule saved by an
older UI cannot break a sweep.

The enum fields need no UI validation of their own — they are rendered as selects, so an
invalid value cannot be produced, and `bind_json` rejects one at the boundary if it ever
is.

## Testing

- **Rule evaluation** is the part worth testing directly: given a funscript dict and a
  rule, assert the set of tag names produced. Covers array vs scalar, include/exclude
  precedence, exact vs regex, template substitution, missing keys, non-string scalars,
  and absent `channels`.
- **`load_funscript`** — valid JSON, malformed JSON, unreadable file.
- **Persistence round-trip** — `SAVE_TAG_RULES` then `GET_TAG_RULES` returns an equivalent
  set, and a save replacing a larger set with a smaller one leaves no orphaned
  `TagRuleFilter` rows behind.
- **Enum handling** — `EnumField` stores the string value and reads back a member; an
  unrecognised `kind`, `mode` or `match_type` in a save payload raises
  `JsonValidationError` rather than persisting. A cheap assertion that the TypeScript enum
  values match the Python ones guards the wire contract from drifting.
- **Frontend** — `MatchFilterList` regex validation, and that Save is blocked on each
  invalid-rule condition.

Full-sweep behaviour against a live Stash library is verified manually by running the task
from Settings → Tasks.

## Decisions

| Decision              | Choice                                   | Reason                                                           |
| --------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| Storage               | SQLite via peewee, new tables            | Server-owned, structured, room for per-rule state later          |
| Closed-set columns    | Enums both sides, via `EnumField`        | Free validation in `bind_json`; no string literals in branches   |
| Persistence transport | New `manage.py` actions                  | Reuses the existing action-dispatch and payload-binding plumbing |
| Application           | Separate `extract_metadata` task         | Keeps accepting rules and applying them independent              |
| Save granularity      | Replace-all                              | Small set; makes reorder and delete trivial                      |
| Tag removal           | Add-only                                 | Cannot strip manually applied or third-party tags                |
| Metadata tag name     | Field value, optional `{value}` template | Values are the point; the template covers namespacing            |
| Channel tag name      | Fixed per rule                           | A channel key is a condition, not a value worth tagging verbatim |
| Filters on scalars    | Yes                                      | Symmetry; the array toggle then only controls iterate-vs-single  |
| Auto-create           | Global default + per-rule override       | Avoids repeating the same choice on every rule                   |
| Funscript scope       | Union across all of a scene's funscripts | Simplest model; no per-script scoping needed yet                 |
| Placement             | Inside `PluginSettings`                  | Where tagging config already lives; no new patch point           |
| Trigger               | Stash task only                          | Consistent with `tag` and `remap`                                |
