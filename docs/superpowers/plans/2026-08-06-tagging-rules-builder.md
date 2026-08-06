# Tagging Rules Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users build tagging rules over funscript `metadata` fields and `channels` keys in the plugin settings panel, and apply them across the library with a new Stash task.

**Architecture:** Rules are authored in React inside the existing `PluginSettings` panel, persisted server-side in the plugin's SQLite database through two new `manage.py` actions, and applied by a separate `extract_metadata` task that reads funscripts off disk. Rule evaluation is a pure module with no database or Stash dependency, so it can be unit tested directly.

**Tech Stack:** Python 3.10 + peewee + stashapi; React 18 + react-bootstrap 1.6.6 + TypeScript, bundled by rollup. Tests: pytest (Python), vitest + jsdom + Testing Library (frontend).

**Spec:** `docs/superpowers/specs/2026-08-06-tagging-rules-builder-design.md`

## Global Constraints

- Python 3.10.2 — the venv at `venv/`. Use `venv/Scripts/python.exe` on Windows.
- Commits are linted by commitlint with `@commitlint/config-conventional`. Every commit message must be `type: subject` (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`).
- Husky hooks run on commit. Do not pass `--no-verify`.
- Enum string values are the wire contract between Python and TypeScript. They must stay byte-identical: `metadata`/`channel`, `include`/`exclude`, `exact`/`regex`.
- `useInteractiveBackend` runs `deepSnakeCase` on outbound args, so the frontend sends **snake_case** and Python payload dataclasses use snake_case field names. Responses go the other way: Python emits **camelCase**, matching `init.py`'s existing `for_json`.
- The `extract_metadata` task is add-only. It must never call `update_tags(..., mode='REMOVE')`.
- Existing plugin behaviour must not change. `tag.py`, `init.py` and `remap.py` keep their current outputs.
- Never commit `assets/stash_interactive_tools.db` or `__pycache__`.

## File Structure

**Created**

| File                                                        | Responsibility                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `assets/rule_types.py`                                      | The three shared enums. No dependencies, so both peewee models and the pure evaluator can import it. |
| `assets/tasks/rule_eval.py`                                 | Pure rule evaluation: field resolution, filtering, tag naming. No peewee, no stashapi.               |
| `assets/tasks/extract_metadata.py`                          | The Stash task. Walks scenes, loads funscripts, calls `rule_eval`, applies tags.                     |
| `tests/conftest.py`                                         | pytest path setup and an in-memory database fixture.                                                 |
| `tests/test_helpers.py`                                     | `load_funscript` and `_is_optional`.                                                                 |
| `tests/test_db.py`                                          | `EnumField` round-trip and model creation.                                                           |
| `tests/test_rule_eval.py`                                   | The bulk of the coverage — every evaluation branch.                                                  |
| `tests/test_manage_tag_rules.py`                            | Persistence round-trip and payload validation.                                                       |
| `tests/test_enum_parity.py`                                 | Asserts the TypeScript enum values match the Python ones.                                            |
| `src/components/tagging/types.ts`                           | TS enums and interfaces mirroring the Python side.                                                   |
| `src/components/tagging/validation.ts`                      | Pure rule validation. No imports from `../../api`, so it tests without a PluginApi stub.             |
| `src/components/tagging/helpText.ts`                        | Help strings, kept out of the components so the copy is reviewable in one place.                     |
| `src/components/tagging/HelpIcon.tsx`                       | Hover help icon.                                                                                     |
| `src/components/tagging/MatchFilterList.tsx`                | The include/exclude filter editor, shared by both tabs.                                              |
| `src/components/tagging/MetadataRuleRow.tsx`                | One metadata rule.                                                                                   |
| `src/components/tagging/ChannelRuleRow.tsx`                 | One channel rule.                                                                                    |
| `src/components/tagging/TagRuleBuilder.tsx`                 | Tab host, working copy, save/discard.                                                                |
| `src/components/tagging/index.ts`                           | Barrel export.                                                                                       |
| `src/hooks/useTagRules.ts`                                  | Wraps the two manage actions.                                                                        |
| `src/components/tagging/__tests__/validation.test.ts`       | Validation unit tests.                                                                               |
| `src/components/tagging/__tests__/MatchFilterList.test.tsx` | Component test.                                                                                      |
| `vitest.config.ts`, `vitest.setup.ts`                       | Frontend test harness.                                                                               |
| `pytest.ini`, `requirements-dev.txt`                        | Python test harness.                                                                                 |

**Modified**

| File                                | Change                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `assets/helpers.py`                 | Add `load_funscript` + `FunscriptLoadError`; fix `_is_optional` for PEP 604 unions. |
| `assets/db.py`                      | Add `EnumField`, `TagRule`, `TagRuleFilter`; register them in `ensure_db()`.        |
| `assets/config.py`                  | Add `TagRule()`/`TagRuleFilter()` accessors and `TAG_RULE_AUTO_CREATE`.             |
| `assets/tasks/manage.py`            | Add `GET_TAG_RULES` and `SAVE_TAG_RULES`.                                           |
| `assets/tasks/remap.py`             | Replace three inline JSON loads with `load_funscript`.                              |
| `assets/StashInteractiveTools.yml`  | Add the `tagRuleAutoCreate` setting and the `extract_metadata` task.                |
| `src/components/PluginSettings.tsx` | Render `TagRuleBuilder`.                                                            |
| `src/components/index.tsx`          | Export the tagging barrel.                                                          |
| `package.json`                      | Add test deps and scripts.                                                          |
| `.gitignore`                        | Ignore `__pycache__`, `*.db`, `.pytest_cache`.                                      |

**Deviation from the spec:** the spec places the enums in `assets/db.py`. They go in `assets/rule_types.py` instead, so `rule_eval.py` stays free of peewee. Task 12 updates the spec to match.

---

### Task 1: pytest harness, `load_funscript`, and the optional-union fix

**Files:**

- Create: `pytest.ini`, `requirements-dev.txt`, `tests/conftest.py`, `tests/test_helpers.py`
- Modify: `assets/helpers.py`, `.gitignore`

**Interfaces:**

- Consumes: nothing.
- Produces: `helpers.load_funscript(path) -> dict` raising `helpers.FunscriptLoadError` with `.reason: LoadErrorReason` and `.path`. `helpers.LoadErrorReason.INVALID_JSON` / `.UNREADABLE`. A working `pytest` invocation. `_is_optional` recognising `X | None`.

- [ ] **Step 1: Install pytest and record it**

```bash
cd /e/DEV/_FreeLance/stash-interactive-tools
venv/Scripts/python.exe -m pip install pytest
```

Create `requirements-dev.txt`:

```
pytest>=8.0
```

- [ ] **Step 2: Add pytest config**

Create `pytest.ini`:

```ini
[pytest]
testpaths = tests
python_files = test_*.py
```

- [ ] **Step 3: Add the conftest**

The plugin's modules import each other flatly (`config.py` does `from helpers import bind_from_json`), because `StashInteractiveTools.py` inserts `assets/` and `assets/tasks/` onto `sys.path` at startup. Tests must reproduce that.

Create `tests/conftest.py`:

```python
import sys
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "assets"
for entry in (ASSETS, ASSETS / "tasks"):
    path = str(entry)
    if path not in sys.path:
        sys.path.insert(0, path)
```

- [ ] **Step 4: Ignore test and build artefacts**

Append to `.gitignore`:

```
# Python
__pycache__/
*.py[cod]
.pytest_cache/
assets/*.db
```

- [ ] **Step 5: Write the failing tests**

Create `tests/test_helpers.py`:

```python
import json
from typing import Optional

import pytest

from helpers import (
    FunscriptLoadError,
    LoadErrorReason,
    _is_optional,
    load_funscript,
)


def test_load_funscript_returns_parsed_json(tmp_path):
    path = tmp_path / "a.funscript"
    path.write_text(json.dumps({"actions": [{"at": 0, "pos": 50}]}))

    assert load_funscript(path) == {"actions": [{"at": 0, "pos": 50}]}


def test_load_funscript_raises_invalid_json(tmp_path):
    path = tmp_path / "bad.funscript"
    path.write_text("{not json")

    with pytest.raises(FunscriptLoadError) as excinfo:
        load_funscript(path)

    assert excinfo.value.reason is LoadErrorReason.INVALID_JSON
    assert excinfo.value.path == path


def test_load_funscript_raises_unreadable(tmp_path):
    with pytest.raises(FunscriptLoadError) as excinfo:
        load_funscript(tmp_path / "missing.funscript")

    assert excinfo.value.reason is LoadErrorReason.UNREADABLE


def test_is_optional_recognises_typing_optional():
    assert _is_optional(Optional[str]) is True


def test_is_optional_recognises_pep604_union():
    assert _is_optional(str | None) is True


def test_is_optional_rejects_plain_type():
    assert _is_optional(str) is False
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `venv/Scripts/python.exe -m pytest tests/test_helpers.py -v`

Expected: FAIL — `ImportError: cannot import name 'FunscriptLoadError' from 'helpers'`.

- [ ] **Step 7: Implement in `assets/helpers.py`**

Add `types` to the imports at the top of the file:

```python
import types
```

Replace `_is_optional` (currently lines 16-18):

```python
def _is_optional(tp: Any) -> bool:
    origin = get_origin(tp)
    if origin is not Union and origin is not types.UnionType:
        return False
    return type(None) in get_args(tp)
```

`get_origin(str | None)` returns `types.UnionType` on Python 3.10, not `typing.Union`, so without this branch a `str | None` dataclass field is treated as required and `bind_json` raises "missing required field" on any payload that omits it.

Append to the end of the file:

```python
class LoadErrorReason(str, Enum):
    INVALID_JSON = "invalid_json"
    UNREADABLE = "unreadable"


class FunscriptLoadError(Exception):
    """Raised when a funscript cannot be read or parsed.

    Carries `reason` so callers can react differently to a corrupt file and a
    missing one, which is what `remap.py` already does.
    """

    def __init__(self, path: Any, reason: LoadErrorReason, cause: Exception):
        super().__init__(f"{path}: {reason.value}")
        self.path = path
        self.reason = reason
        self.__cause__ = cause


def load_funscript(path: Any) -> dict[str, Any]:
    try:
        with open(path, "br") as fun_file:
            return json.load(fun_file)
    except json.JSONDecodeError as e:
        raise FunscriptLoadError(path, LoadErrorReason.INVALID_JSON, e) from e
    except OSError as e:
        raise FunscriptLoadError(path, LoadErrorReason.UNREADABLE, e) from e
```

`json` and `Enum` are already imported at the top of `helpers.py`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `venv/Scripts/python.exe -m pytest tests/test_helpers.py -v`

Expected: PASS, 6 passed.

- [ ] **Step 9: Commit**

```bash
git add pytest.ini requirements-dev.txt tests/conftest.py tests/test_helpers.py assets/helpers.py .gitignore
git commit -m "test: add pytest harness and funscript loader helper"
```

---

### Task 2: Enums and peewee models

**Files:**

- Create: `assets/rule_types.py`, `tests/test_db.py`
- Modify: `assets/db.py`, `assets/config.py`

**Interfaces:**

- Consumes: the pytest harness from Task 1.
- Produces: `rule_types.RuleKind` (`METADATA='metadata'`, `CHANNEL='channel'`), `rule_types.FilterMode` (`INCLUDE='include'`, `EXCLUDE='exclude'`), `rule_types.MatchType` (`EXACT='exact'`, `REGEX='regex'`). `db.TagRule`, `db.TagRuleFilter`, `db.EnumField`. `Config.TagRule()`, `Config.TagRuleFilter()`, `Config.TAG_RULE_AUTO_CREATE`. A `tag_rules_db` pytest fixture.

- [ ] **Step 1: Write the failing tests**

Add the in-memory database fixture to `tests/conftest.py`:

```python
import pytest


@pytest.fixture
def tag_rules_db():
    """Bind the models to a throwaway in-memory database.

    Importing `db` creates a SqliteDatabase pointing at the real plugin file but
    does not connect to it, so binding here keeps tests off that file entirely.
    """
    from peewee import SqliteDatabase

    from db import TagRule, TagRuleFilter

    models = [TagRule, TagRuleFilter]
    test_database = SqliteDatabase(":memory:")
    with test_database.bind_ctx(models):
        test_database.create_tables(models)
        yield test_database
        test_database.drop_tables(models)
```

Create `tests/test_db.py`:

```python
from db import TagRule, TagRuleFilter
from rule_types import FilterMode, MatchType, RuleKind


def test_enum_values_are_the_wire_contract():
    assert RuleKind.METADATA.value == "metadata"
    assert RuleKind.CHANNEL.value == "channel"
    assert FilterMode.INCLUDE.value == "include"
    assert FilterMode.EXCLUDE.value == "exclude"
    assert MatchType.EXACT.value == "exact"
    assert MatchType.REGEX.value == "regex"


def test_enum_members_compare_equal_to_their_strings():
    assert RuleKind.METADATA == "metadata"


def test_enum_field_stores_a_string_and_reads_back_a_member(tag_rules_db):
    rule = TagRule.create(kind=RuleKind.METADATA, field_name="tags")

    cursor = tag_rules_db.execute_sql(
        "SELECT kind FROM tagrule WHERE id = ?", (rule.id,)
    )
    assert cursor.fetchone()[0] == "metadata"

    assert TagRule.get_by_id(rule.id).kind is RuleKind.METADATA


def test_filters_are_reachable_from_the_rule(tag_rules_db):
    rule = TagRule.create(kind=RuleKind.METADATA, field_name="tags")
    TagRuleFilter.create(
        rule=rule,
        mode=FilterMode.EXCLUDE,
        match_type=MatchType.REGEX,
        pattern="^unknown$",
    )

    stored = list(rule.filters)
    assert len(stored) == 1
    assert stored[0].mode is FilterMode.EXCLUDE
    assert stored[0].match_type is MatchType.REGEX


def test_rule_defaults(tag_rules_db):
    rule = TagRule.create(kind=RuleKind.CHANNEL, tag_name="Multi-Axis")

    assert rule.enabled is True
    assert rule.sort_order == 0
    assert rule.is_array is False
    assert rule.auto_create is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `venv/Scripts/python.exe -m pytest tests/test_db.py -v`

Expected: FAIL — `ModuleNotFoundError: No module named 'rule_types'`.

- [ ] **Step 3: Create the enums**

Create `assets/rule_types.py`:

```python
from enum import Enum


class RuleKind(str, Enum):
    METADATA = "metadata"
    CHANNEL = "channel"


class FilterMode(str, Enum):
    INCLUDE = "include"
    EXCLUDE = "exclude"


class MatchType(str, Enum):
    EXACT = "exact"
    REGEX = "regex"
```

These live in their own module rather than in `db.py` so `rule_eval.py` can import them without pulling in peewee. The `str` mixin means `json.dumps` serialises members directly and `==` against a raw string still holds.

- [ ] **Step 4: Add the field class and models**

In `assets/db.py`, add to the imports at the top:

```python
from enum import Enum

from rule_types import FilterMode, MatchType, RuleKind
```

Add after the existing `Funscript` model:

```python
class EnumField(CharField):
    """CharField that stores an Enum's value and reads back the member."""

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


class TagRule(BaseModel):
    kind = EnumField(RuleKind)
    enabled = BooleanField(default=True)
    sort_order = IntegerField(default=0)
    field_name = CharField(null=True)
    is_array = BooleanField(default=False)
    tag_template = CharField(null=True)
    tag_name = CharField(null=True)
    auto_create = BooleanField(null=True)


class TagRuleFilter(BaseModel):
    rule = ForeignKeyField(TagRule, backref='filters', on_delete='CASCADE')
    mode = EnumField(FilterMode)
    match_type = EnumField(MatchType)
    pattern = TextField()
```

Update `ensure_db()`:

```python
def ensure_db():
    db.connect(reuse_if_open=True)
    db.create_tables([Funscript, SchemaMigration, TagRule, TagRuleFilter],
                     safe=True)
    return
```

`create_tables(safe=True)` creates the new tables on first run, so no entry in `assets/migrations/` is needed. The `on_delete='CASCADE'` is documentation only — peewee's SQLite backend does not enforce foreign keys unless the connection sets `pragmas={'foreign_keys': 1}`, which this one does not, so Task 4 deletes filter rows explicitly.

- [ ] **Step 5: Add the config accessors**

In `assets/config.py`, add next to the existing `Funscript()` and `SchemaMigration()` static methods:

```python
    @staticmethod
    def TagRule() -> 'TagRule':
        return Config.ensure_db().TagRule

    @staticmethod
    def TagRuleFilter() -> 'TagRuleFilter':
        return Config.ensure_db().TagRuleFilter
```

Add the class attribute next to `ENABLE_TAGGING`:

```python
    TAG_RULE_AUTO_CREATE: bool = False
```

And in `get_config()`, next to the other `c.get(...)` reads:

```python
    config.TAG_RULE_AUTO_CREATE = bool(c.get('tagRuleAutoCreate', False))
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `venv/Scripts/python.exe -m pytest tests/test_db.py -v`

Expected: PASS, 5 passed.

- [ ] **Step 7: Commit**

```bash
git add assets/rule_types.py assets/db.py assets/config.py tests/conftest.py tests/test_db.py
git commit -m "feat: add tag rule enums and peewee models"
```

---

### Task 3: Pure rule evaluation

This is the highest-risk logic in the feature and the reason the test harness exists. It has no database or Stash dependency.

**Files:**

- Create: `assets/tasks/rule_eval.py`, `tests/test_rule_eval.py`

**Interfaces:**

- Consumes: `rule_types.RuleKind`, `FilterMode`, `MatchType`.
- Produces:

  - `rule_eval.Filter(mode, match_type, pattern)` dataclass
  - `rule_eval.Rule(kind, field_name=None, is_array=False, tag_template=None, tag_name=None, auto_create=None, filters=[])` dataclass
  - `resolve_field(data: dict, path: str) -> Any | None`
  - `candidate_values(rule: Rule, funscript: dict) -> list[str]`
  - `passes_filters(value: str, filters: list[Filter]) -> bool`
  - `tag_name_for(rule: Rule, value: str) -> str`
  - `rule_errors(rule: Rule) -> list[str]`
  - `tag_names_for_scene(rules: list[Rule], funscripts: list[dict], default_auto_create: bool) -> dict[str, bool]` — tag name to whether it may be created

- [ ] **Step 1: Write the failing tests**

Create `tests/test_rule_eval.py`:

```python
from rule_eval import (
    Filter,
    Rule,
    candidate_values,
    passes_filters,
    resolve_field,
    rule_errors,
    tag_name_for,
    tag_names_for_scene,
)
from rule_types import FilterMode, MatchType, RuleKind


def metadata_rule(**kwargs):
    return Rule(kind=RuleKind.METADATA, field_name="tags", **kwargs)


def include(pattern, match_type=MatchType.EXACT):
    return Filter(mode=FilterMode.INCLUDE, match_type=match_type,
                  pattern=pattern)


def exclude(pattern, match_type=MatchType.EXACT):
    return Filter(mode=FilterMode.EXCLUDE, match_type=match_type,
                  pattern=pattern)


# --- resolve_field ---------------------------------------------------------

def test_resolve_field_reads_a_top_level_key():
    assert resolve_field({"creator": "alice"}, "creator") == "alice"


def test_resolve_field_descends_dotted_paths():
    assert resolve_field({"a": {"b": "c"}}, "a.b") == "c"


def test_resolve_field_returns_none_for_a_missing_key():
    assert resolve_field({"creator": "alice"}, "nope") is None


def test_resolve_field_returns_none_when_descending_a_non_dict():
    assert resolve_field({"a": "scalar"}, "a.b") is None


# --- candidate_values ------------------------------------------------------

def test_candidate_values_reads_metadata():
    script = {"metadata": {"tags": ["a", "b"]}}
    assert candidate_values(metadata_rule(is_array=True), script) == ["a", "b"]


def test_candidate_values_wraps_a_scalar():
    script = {"metadata": {"creator": "alice"}}
    rule = Rule(kind=RuleKind.METADATA, field_name="creator")
    assert candidate_values(rule, script) == ["alice"]


def test_candidate_values_iterates_a_list_even_when_is_array_is_false():
    """is_array is the user's declaration, not a guarantee."""
    script = {"metadata": {"tags": ["a", "b"]}}
    assert candidate_values(metadata_rule(is_array=False), script) == ["a", "b"]


def test_candidate_values_wraps_a_scalar_even_when_is_array_is_true():
    script = {"metadata": {"tags": "solo"}}
    assert candidate_values(metadata_rule(is_array=True), script) == ["solo"]


def test_candidate_values_coerces_non_strings():
    script = {"metadata": {"tags": [1, True]}}
    assert candidate_values(metadata_rule(is_array=True), script) == ["1", "True"]


def test_candidate_values_drops_nones():
    script = {"metadata": {"tags": ["a", None]}}
    assert candidate_values(metadata_rule(is_array=True), script) == ["a"]


def test_candidate_values_is_empty_for_a_missing_key():
    assert candidate_values(metadata_rule(), {"metadata": {}}) == []


def test_candidate_values_is_empty_when_there_is_no_metadata():
    assert candidate_values(metadata_rule(), {"actions": []}) == []


def test_candidate_values_reads_channel_keys():
    rule = Rule(kind=RuleKind.CHANNEL, tag_name="Multi-Axis")
    script = {"channels": {"twist": {}, "surge": []}}
    assert sorted(candidate_values(rule, script)) == ["surge", "twist"]


def test_candidate_values_is_empty_without_a_channels_object():
    rule = Rule(kind=RuleKind.CHANNEL, tag_name="Multi-Axis")
    assert candidate_values(rule, {"actions": []}) == []


# --- passes_filters --------------------------------------------------------

def test_everything_passes_when_there_are_no_filters():
    assert passes_filters("anything", []) is True


def test_includes_act_as_an_allow_list():
    assert passes_filters("twist", [include("twist")]) is True
    assert passes_filters("surge", [include("twist")]) is False


def test_exact_matching_is_case_insensitive_and_whole_value():
    assert passes_filters("Twist", [include("twist")]) is True
    assert passes_filters("twisted", [include("twist")]) is False


def test_regex_matches_anywhere_unless_anchored():
    regex = MatchType.REGEX
    assert passes_filters("twisted", [include("twist", regex)]) is True
    assert passes_filters("twisted", [include("^twist$", regex)]) is False


def test_an_exclude_beats_an_include():
    filters = [include("twist"), exclude("twist")]
    assert passes_filters("twist", filters) is False


def test_an_exclude_applies_when_there_are_no_includes():
    assert passes_filters("unknown", [exclude("unknown")]) is False
    assert passes_filters("alice", [exclude("unknown")]) is True


# --- tag_name_for ----------------------------------------------------------

def test_metadata_tag_name_defaults_to_the_value():
    assert tag_name_for(metadata_rule(), "alice") == "alice"


def test_metadata_template_substitutes_value():
    rule = metadata_rule(tag_template="Scripter: {value}")
    assert tag_name_for(rule, "alice") == "Scripter: alice"


def test_a_template_without_a_placeholder_is_a_literal():
    rule = metadata_rule(tag_template="Has Tags")
    assert tag_name_for(rule, "alice") == "Has Tags"


def test_channel_tag_name_is_fixed():
    rule = Rule(kind=RuleKind.CHANNEL, tag_name="Multi-Axis")
    assert tag_name_for(rule, "twist") == "Multi-Axis"


# --- rule_errors -----------------------------------------------------------

def test_a_metadata_rule_needs_a_field_name():
    rule = Rule(kind=RuleKind.METADATA, field_name="")
    assert rule_errors(rule) == ["field_name is required for a metadata rule"]


def test_a_channel_rule_needs_a_tag_name():
    rule = Rule(kind=RuleKind.CHANNEL, tag_name=None)
    assert rule_errors(rule) == ["tag_name is required for a channel rule"]


def test_an_uncompilable_regex_is_an_error():
    rule = metadata_rule(filters=[include("[unclosed", MatchType.REGEX)])
    assert rule_errors(rule) == ["invalid regex: [unclosed"]


def test_a_valid_rule_has_no_errors():
    assert rule_errors(metadata_rule()) == []


# --- tag_names_for_scene ---------------------------------------------------

def test_tag_names_union_across_funscripts():
    rule = metadata_rule(is_array=True)
    scripts = [
        {"metadata": {"tags": ["a"]}},
        {"metadata": {"tags": ["b"]}},
    ]
    assert tag_names_for_scene([rule], scripts, False) == {"a": False,
                                                           "b": False}


def test_disabled_rules_contribute_nothing():
    rule = metadata_rule(is_array=True, enabled=False)
    scripts = [{"metadata": {"tags": ["a"]}}]
    assert tag_names_for_scene([rule], scripts, False) == {}


def test_invalid_rules_are_skipped_rather_than_raising():
    good = metadata_rule(is_array=True)
    bad = metadata_rule(filters=[include("[unclosed", MatchType.REGEX)])
    scripts = [{"metadata": {"tags": ["a"]}}]

    assert tag_names_for_scene([good, bad], scripts, False) == {"a": False}


def test_auto_create_falls_back_to_the_default():
    rule = metadata_rule(is_array=True, auto_create=None)
    scripts = [{"metadata": {"tags": ["a"]}}]
    assert tag_names_for_scene([rule], scripts, True) == {"a": True}


def test_a_rule_can_override_the_default():
    rule = metadata_rule(is_array=True, auto_create=False)
    scripts = [{"metadata": {"tags": ["a"]}}]
    assert tag_names_for_scene([rule], scripts, True) == {"a": False}


def test_create_wins_when_two_rules_produce_the_same_name():
    creating = metadata_rule(is_array=True, auto_create=True)
    skipping = Rule(kind=RuleKind.METADATA, field_name="creator",
                    auto_create=False)
    scripts = [{"metadata": {"tags": ["a"], "creator": "a"}}]

    assert tag_names_for_scene([creating, skipping], scripts, False) == {
        "a": True}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `venv/Scripts/python.exe -m pytest tests/test_rule_eval.py -v`

Expected: FAIL — `ModuleNotFoundError: No module named 'rule_eval'`.

- [ ] **Step 3: Implement**

Create `assets/tasks/rule_eval.py`:

```python
"""Pure evaluation of tagging rules against funscript JSON.

Deliberately free of peewee, stashapi and Config so it can be unit tested
directly. Callers convert their own rows into `Rule` objects.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from rule_types import FilterMode, MatchType, RuleKind


@dataclass
class Filter:
    mode: FilterMode
    match_type: MatchType
    pattern: str


@dataclass
class Rule:
    kind: RuleKind
    enabled: bool = True
    field_name: str | None = None
    is_array: bool = False
    tag_template: str | None = None
    tag_name: str | None = None
    auto_create: bool | None = None
    filters: list[Filter] = field(default_factory=list)


def resolve_field(data: dict, path: str) -> Any | None:
    current: Any = data
    for part in path.split('.'):
        if not isinstance(current, dict):
            return None
        if part not in current:
            return None
        current = current[part]
    return current


def candidate_values(rule: Rule, funscript: dict) -> list[str]:
    if rule.kind is RuleKind.CHANNEL:
        channels = funscript.get('channels')
        return list(channels) if isinstance(channels, dict) else []

    metadata = funscript.get('metadata')
    if not isinstance(metadata, dict) or not rule.field_name:
        return []

    value = resolve_field(metadata, rule.field_name)
    if value is None:
        return []

    # `is_array` drives the UI, but the file decides. A list is always
    # iterated and a non-list is always a single value, so a mismatched
    # toggle degrades gracefully instead of failing.
    values = value if isinstance(value, list) else [value]
    return [str(v) for v in values if v is not None]


def _matches(value: str, f: Filter) -> bool:
    if f.match_type is MatchType.REGEX:
        return re.search(f.pattern, value) is not None
    return value.casefold() == f.pattern.casefold()


def passes_filters(value: str, filters: list[Filter]) -> bool:
    includes = [f for f in filters if f.mode is FilterMode.INCLUDE]
    excludes = [f for f in filters if f.mode is FilterMode.EXCLUDE]

    if includes and not any(_matches(value, f) for f in includes):
        return False
    return not any(_matches(value, f) for f in excludes)


def tag_name_for(rule: Rule, value: str) -> str:
    if rule.kind is RuleKind.CHANNEL:
        return rule.tag_name or ''
    if rule.tag_template:
        return rule.tag_template.replace('{value}', value)
    return value


def rule_errors(rule: Rule) -> list[str]:
    errors: list[str] = []
    if rule.kind is RuleKind.METADATA and not rule.field_name:
        errors.append('field_name is required for a metadata rule')
    if rule.kind is RuleKind.CHANNEL and not rule.tag_name:
        errors.append('tag_name is required for a channel rule')
    for f in rule.filters:
        if f.match_type is MatchType.REGEX:
            try:
                re.compile(f.pattern)
            except re.error:
                errors.append(f'invalid regex: {f.pattern}')
    return errors


def tag_names_for_scene(
        rules: list[Rule],
        funscripts: list[dict],
        default_auto_create: bool,
) -> dict[str, bool]:
    """Map every tag name the rules produce to whether it may be created.

    When two rules produce the same name and disagree, create wins — the
    output is a union, so any rule asking for the tag is enough.
    """
    names: dict[str, bool] = {}
    for rule in rules:
        if not rule.enabled or rule_errors(rule):
            continue
        create = (default_auto_create if rule.auto_create is None
                  else rule.auto_create)
        for funscript in funscripts:
            for value in candidate_values(rule, funscript):
                if not passes_filters(value, rule.filters):
                    continue
                name = tag_name_for(rule, value)
                if not name:
                    continue
                names[name] = names.get(name, False) or create
    return names
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `venv/Scripts/python.exe -m pytest tests/test_rule_eval.py -v`

Expected: PASS, 34 passed.

- [ ] **Step 5: Commit**

```bash
git add assets/tasks/rule_eval.py tests/test_rule_eval.py
git commit -m "feat: add pure tagging rule evaluation"
```

---

### Task 4: Persist rules through `manage.py`

**Files:**

- Modify: `assets/tasks/manage.py`
- Create: `tests/test_manage_tag_rules.py`

**Interfaces:**

- Consumes: `db.TagRule`, `db.TagRuleFilter`, `rule_types.*`.
- Produces: `ManageAction.GET_TAG_RULES`, `ManageAction.SAVE_TAG_RULES`. `manage.rule_for_json(rule) -> dict` emitting camelCase. `manage.save_tag_rules(payload)` and `manage.get_tag_rules(payload)`. Payload dataclasses `TagRulePayload`, `TagRuleFilterPayload`, `SaveTagRulesPayload`, `GetTagRulesPayload`.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_manage_tag_rules.py`:

```python
import pytest

from db import TagRule, TagRuleFilter
from helpers import JsonValidationError, bind_json
from rule_types import FilterMode, MatchType, RuleKind


def make_payload(**overrides):
    payload = {
        'kind': 'metadata',
        'enabled': True,
        'sort_order': 0,
        'field_name': 'tags',
        'is_array': True,
        'filters': [
            {'mode': 'exclude', 'match_type': 'regex', 'pattern': '^unknown$'},
        ],
    }
    payload.update(overrides)
    return payload


def test_payload_binds_enums_from_strings():
    import manage

    bound = bind_json(manage.TagRulePayload, make_payload())

    assert bound.kind is RuleKind.METADATA
    assert bound.filters[0].mode is FilterMode.EXCLUDE
    assert bound.filters[0].match_type is MatchType.REGEX


def test_payload_rejects_an_unknown_enum_value():
    import manage

    with pytest.raises(JsonValidationError) as excinfo:
        bind_json(manage.TagRulePayload, make_payload(kind='scene'))

    assert "expected one of ['metadata', 'channel']" in str(excinfo.value)


def test_optional_fields_may_be_omitted():
    import manage

    bound = bind_json(manage.TagRulePayload,
                      {'kind': 'channel', 'tag_name': 'Multi-Axis'})

    assert bound.field_name is None
    assert bound.auto_create is None
    assert bound.filters == []


def test_save_then_get_round_trips(tag_rules_db):
    import manage

    payload = bind_json(manage.SaveTagRulesPayload,
                        {'rules': [make_payload()]})
    manage.save_tag_rules(payload)

    result = manage.get_tag_rules(bind_json(manage.GetTagRulesPayload, {}))

    assert result['rules'] == [{
        'id': result['rules'][0]['id'],
        'kind': 'metadata',
        'enabled': True,
        'sortOrder': 0,
        'fieldName': 'tags',
        'isArray': True,
        'tagTemplate': None,
        'tagName': None,
        'autoCreate': None,
        'filters': [{
            'mode': 'exclude',
            'matchType': 'regex',
            'pattern': '^unknown$',
        }],
    }]


def test_save_replaces_the_previous_set_and_leaves_no_orphan_filters(
        tag_rules_db):
    import manage

    first = bind_json(manage.SaveTagRulesPayload,
                      {'rules': [make_payload(), make_payload(sort_order=1)]})
    manage.save_tag_rules(first)
    assert TagRuleFilter.select().count() == 2

    second = bind_json(manage.SaveTagRulesPayload,
                       {'rules': [make_payload(filters=[])]})
    manage.save_tag_rules(second)

    assert TagRule.select().count() == 1
    assert TagRuleFilter.select().count() == 0


def test_saving_an_empty_set_clears_everything(tag_rules_db):
    import manage

    manage.save_tag_rules(
        bind_json(manage.SaveTagRulesPayload, {'rules': [make_payload()]}))
    manage.save_tag_rules(
        bind_json(manage.SaveTagRulesPayload, {'rules': []}))

    assert TagRule.select().count() == 0
    assert TagRuleFilter.select().count() == 0


def test_rules_come_back_in_sort_order(tag_rules_db):
    import manage

    manage.save_tag_rules(bind_json(manage.SaveTagRulesPayload, {'rules': [
        make_payload(sort_order=2, field_name='b'),
        make_payload(sort_order=1, field_name='a'),
    ]}))

    result = manage.get_tag_rules(bind_json(manage.GetTagRulesPayload, {}))

    assert [r['fieldName'] for r in result['rules']] == ['a', 'b']
```

The `tag_rules_db` fixture binds the models to an in-memory database, but `manage.py`'s functions reach the models through `config.TagRule()`. To keep the functions testable, they take the model classes from module-level names that the tests' fixture has already bound — so `save_tag_rules` and `get_tag_rules` import `TagRule`/`TagRuleFilter` from `db` directly rather than through `config`, matching what the fixture binds.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `venv/Scripts/python.exe -m pytest tests/test_manage_tag_rules.py -v`

Expected: FAIL — `AttributeError: module 'manage' has no attribute 'TagRulePayload'`.

- [ ] **Step 3: Implement**

In `assets/tasks/manage.py`, extend the imports:

```python
from dataclasses import dataclass, field
from typing import Generic, List, TypeVar

from db import TagRule, TagRuleFilter
from rule_types import FilterMode, MatchType, RuleKind
```

Add the two actions to the existing enum:

```python
class ManageAction(Enum):
    SET_AS_DEFAULT = "SET_AS_DEFAULT"
    UPDATE_NAME   = "UPDATE_NAME"
    DELETE_SCENES  = "DELETE_SCENES"
    GET_TAG_RULES  = "GET_TAG_RULES"
    SAVE_TAG_RULES = "SAVE_TAG_RULES"
```

Add the payloads. These use snake_case field names because `useInteractiveBackend` runs `deepSnakeCase` over everything it sends. They do not subclass `BasePayload` — there is no scene involved.

```python
@dataclass
class TagRuleFilterPayload:
    mode: FilterMode
    match_type: MatchType
    pattern: str


@dataclass
class TagRulePayload:
    kind: RuleKind
    enabled: bool = True
    sort_order: int = 0
    field_name: str | None = None
    is_array: bool = False
    tag_template: str | None = None
    tag_name: str | None = None
    auto_create: bool | None = None
    filters: List[TagRuleFilterPayload] = field(default_factory=list)


@dataclass
class SaveTagRulesPayload:
    rules: List[TagRulePayload] = field(default_factory=list)


@dataclass
class GetTagRulesPayload:
    pass
```

The `str | None` annotations rely on the `_is_optional` fix from Task 1. Do not add `from __future__ import annotations` to this module — it would turn every annotation into a string and break `bind_json`'s type inspection.

Add the handlers:

```python
def rule_for_json(rule) -> dict:
    return {
        'id': rule.id,
        'kind': rule.kind.value,
        'enabled': rule.enabled,
        'sortOrder': rule.sort_order,
        'fieldName': rule.field_name,
        'isArray': rule.is_array,
        'tagTemplate': rule.tag_template,
        'tagName': rule.tag_name,
        'autoCreate': rule.auto_create,
        'filters': [
            {
                'mode': f.mode.value,
                'matchType': f.match_type.value,
                'pattern': f.pattern,
            }
            for f in rule.filters
        ],
    }


def get_tag_rules(payload: GetTagRulesPayload):
    rules = TagRule.select().order_by(TagRule.sort_order, TagRule.id)
    return {'rules': [rule_for_json(rule) for rule in rules]}


def save_tag_rules(payload: SaveTagRulesPayload):
    database = TagRule._meta.database
    with database.atomic():
        # Delete filters first and explicitly. ON DELETE CASCADE is declared
        # on the model but SQLite will not honour it unless the connection
        # sets pragmas={'foreign_keys': 1}, which this one does not.
        TagRuleFilter.delete().execute()
        TagRule.delete().execute()

        for incoming in payload.rules:
            rule = TagRule.create(
                kind=incoming.kind,
                enabled=incoming.enabled,
                sort_order=incoming.sort_order,
                field_name=incoming.field_name,
                is_array=incoming.is_array,
                tag_template=incoming.tag_template,
                tag_name=incoming.tag_name,
                auto_create=incoming.auto_create,
            )
            for f in incoming.filters:
                TagRuleFilter.create(
                    rule=rule,
                    mode=f.mode,
                    match_type=f.match_type,
                    pattern=f.pattern,
                )

    return get_tag_rules(GetTagRulesPayload())
```

`TagRule._meta.database` is used rather than `config.db()` so the in-memory binding in the test fixture is respected.

Register both in the existing dict:

```python
ACTIONS={
    ManageAction.SET_AS_DEFAULT: [SetAsDefaultPayload, manage_set_as_default],
    ManageAction.UPDATE_NAME:[UpdateNamePayload,manage_update_name],
    ManageAction.DELETE_SCENES:[DeleteScenesPayload,manage_delete_scene],
    ManageAction.GET_TAG_RULES:[GetTagRulesPayload,get_tag_rules],
    ManageAction.SAVE_TAG_RULES:[SaveTagRulesPayload,save_tag_rules]
}
```

Finally, `run()` must make sure the tables exist before either action touches them. Add one line at the top of `run`:

```python
def run(c: 'Config'):
    global config
    config = c
    c.ensure_db()
    request = config.bind(ManageActionRequest,{
        'payload':resolve_payload
    })
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `venv/Scripts/python.exe -m pytest tests/test_manage_tag_rules.py -v`

Expected: PASS, 7 passed.

- [ ] **Step 5: Run the whole suite**

Run: `venv/Scripts/python.exe -m pytest -v`

Expected: PASS, all tests.

- [ ] **Step 6: Commit**

```bash
git add assets/tasks/manage.py tests/test_manage_tag_rules.py
git commit -m "feat: persist tagging rules via manage actions"
```

---

### Task 5: The `extract_metadata` task

**Files:**

- Create: `assets/tasks/extract_metadata.py`
- Modify: `assets/StashInteractiveTools.yml`

**Interfaces:**

- Consumes: `rule_eval.Rule`, `Filter`, `tag_names_for_scene`; `helpers.load_funscript`, `FunscriptLoadError`; `db.TagRule`; `config.TAG_RULE_AUTO_CREATE`.
- Produces: `extract_metadata.rules_from_db() -> list[Rule]`, `extract_metadata.load_scene_funscripts(file, scene_id) -> list[dict]`, `extract_metadata.run(config)`.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_rule_eval.py`:

```python
def test_rules_from_db_converts_rows(tag_rules_db):
    import extract_metadata
    from db import TagRule, TagRuleFilter

    row = TagRule.create(kind=RuleKind.METADATA, field_name="tags",
                         is_array=True, sort_order=1)
    TagRuleFilter.create(rule=row, mode=FilterMode.EXCLUDE,
                         match_type=MatchType.EXACT, pattern="unknown")

    rules = extract_metadata.rules_from_db()

    assert len(rules) == 1
    assert rules[0].kind is RuleKind.METADATA
    assert rules[0].field_name == "tags"
    assert rules[0].is_array is True
    assert rules[0].filters[0].mode is FilterMode.EXCLUDE
    assert rules[0].filters[0].pattern == "unknown"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `venv/Scripts/python.exe -m pytest tests/test_rule_eval.py::test_rules_from_db_converts_rows -v`

Expected: FAIL — `ModuleNotFoundError: No module named 'extract_metadata'`.

- [ ] **Step 3: Implement the task**

Create `assets/tasks/extract_metadata.py`:

```python
import time
from typing import TYPE_CHECKING

from db import TagRule
from helpers import FunscriptLoadError, load_funscript
from rule_eval import Filter, Rule, rule_errors, tag_names_for_scene

if TYPE_CHECKING:
    from assets.config import Config

config: 'Config'

BULK_SCENE_UPDATE = "mutation BulkSceneUpdate($input: BulkSceneUpdateInput!) {\n  bulkSceneUpdate(input: $input) { id } } "
SCENE_FRAGMENT = """
id
tags { id }
files {
 path
}
"""


def rules_from_db() -> list:
    rules = []
    query = TagRule.select().order_by(TagRule.sort_order, TagRule.id)
    for row in query:
        rules.append(Rule(
            kind=row.kind,
            enabled=row.enabled,
            field_name=row.field_name,
            is_array=row.is_array,
            tag_template=row.tag_template,
            tag_name=row.tag_name,
            auto_create=row.auto_create,
            filters=[
                Filter(mode=f.mode, match_type=f.match_type,
                       pattern=f.pattern)
                for f in row.filters
            ],
        ))
    return rules


def load_scene_funscripts(init_task, file, scene_id) -> list:
    """Parse every funscript belonging to a scene, skipping unreadable ones."""
    loaded = []
    for path in init_task.get_funscripts(file, scene_id):
        try:
            loaded.append(load_funscript(path))
        except FunscriptLoadError as e:
            config.log.warning(f'Skipping {e.path}: {e.reason.value}')
    return loaded


def resolve_tag_id(name, create, cache):
    if name in cache:
        return cache[name]
    tag = config.stash.find_tag(name, create=create)
    tag_id = tag.get('id') if tag else None
    if tag_id is None:
        config.log.debug(f'No tag "{name}" and not creating it')
    cache[name] = tag_id
    return tag_id


def add_tags(ids, tag_id):
    config.log.debug(f'Adding tag {tag_id} to scene ids: {ids}')
    config.stash.call_GQL(BULK_SCENE_UPDATE, {
        'input': {
            'ids': ids,
            'tag_ids': {'mode': 'ADD', 'ids': [tag_id]}
        }
    })


def extract_metadata():
    rules = rules_from_db()
    for rule in rules:
        errors = rule_errors(rule)
        if errors:
            label = rule.field_name or rule.tag_name or rule.kind.value
            config.log.error(f'Skipping rule "{label}": {"; ".join(errors)}')

    active = [r for r in rules if r.enabled and not rule_errors(r)]
    if not active:
        config.log.info('No usable tagging rules configured')
        return

    default_create = config.TAG_RULE_AUTO_CREATE
    init_task = config.get_task('init')
    tag_cache: dict = {}

    page = 1
    total = -1
    seen = 0
    while seen != total:
        total, scenes = config.stash.find_scenes({
            'interactive': True
        }, {
            'page': page,
            'per_page': 100,
            'direction': 'DESC',
            'sort': 'updated_at'
        }, "", SCENE_FRAGMENT, True)
        seen += len(scenes)
        if not len(scenes):
            break

        # tag id -> scene ids, so each tag needs one bulk call per page
        batch: dict = {}
        for scene in scenes:
            file = scene['files'][0]['path']
            scene_id = scene['id']
            funscripts = load_scene_funscripts(init_task, file, scene_id)
            if not funscripts:
                continue

            names = tag_names_for_scene(active, funscripts, default_create)
            for name, create in names.items():
                tag_id = resolve_tag_id(name, create, tag_cache)
                if tag_id is None:
                    continue
                if {'id': tag_id} in scene['tags']:
                    continue
                batch.setdefault(tag_id, []).append(scene_id)

        for tag_id, scene_ids in batch.items():
            add_tags(scene_ids, tag_id)
            time.sleep(0.200)

        config.log.progress(seen / total)
        page += 1


def run(c: 'Config'):
    global config
    config = c
    c.ensure_db()
    extract_metadata()
```

This mirrors `tag.py`'s pagination exactly, including the `time.sleep(0.200)` between bulk updates. It never issues a `REMOVE`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `venv/Scripts/python.exe -m pytest tests/test_rule_eval.py -v`

Expected: PASS, 35 passed.

- [ ] **Step 5: Register the setting and the task**

In `assets/StashInteractiveTools.yml`, add to `settings:` directly after `multi_script_tag`:

```yaml
tagRuleAutoCreate:
  displayName: Create missing tags by default when applying tagging rules
  type: BOOLEAN
```

And add to `tasks:` after the `tag` entry:

```yaml
- name: 'Extract Metadata'
  description: Apply the tagging rules configured in the plugin settings
  defaultArgs:
    mode: extract_metadata
```

- [ ] **Step 6: Commit**

```bash
git add assets/tasks/extract_metadata.py assets/StashInteractiveTools.yml tests/test_rule_eval.py
git commit -m "feat: add extract_metadata task to apply tagging rules"
```

---

### Task 6: vitest harness

**Files:**

- Create: `vitest.config.ts`, `vitest.setup.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: nothing.
- Produces: `yarn test` running vitest against `src/**/*.test.ts(x)`. A global `PluginApi` stub so modules importing `src/api.ts` load under test.

- [ ] **Step 1: Install the dependencies**

`react-dom` is genuinely missing — only `@types/react-dom` is present — and Testing Library needs it.

```bash
cd /e/DEV/_FreeLance/stash-interactive-tools
yarn add -D vitest jsdom react-dom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Add the scripts**

In `package.json`, add to `scripts`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Write the setup file**

`src/api.ts` runs `const api = window.PluginApi;` and destructures `libraries.Apollo` at module load, so any component test crashes on import without this. `src/hooks/useInteractiveBackend.ts:1` also reads a bare `PluginApi` global.

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import React from 'react';

// Minimal stand-in for the Stash host. `src/api.ts` reads this at module load,
// so it must exist before any component module is imported.
const pluginApi = {
  React,
  libraries: { Apollo: { gql: () => ({}) } },
  hooks: {},
  GQL: {},
  patch: { before: () => {}, after: () => {}, instead: () => {} },
  utils: { StashService: { getClient: () => ({}) } },
  components: {
    Icon: ({ icon, ...rest }: { icon: unknown }) =>
      React.createElement('i', { 'data-testid': 'icon', ...rest }),
  },
  loadableComponents: {},
  Event: { addEventListener: () => {}, removeEventListener: () => {} },
};

(globalThis as Record<string, unknown>).PluginApi = pluginApi;
(window as unknown as Record<string, unknown>).PluginApi = pluginApi;
```

- [ ] **Step 4: Write the config**

`tsconfig.json` sets `"jsx": "react"` (the classic runtime), and the components import React explicitly, so esbuild must be told to match.

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'transform' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

- [ ] **Step 5: Verify the harness runs**

Create a throwaway file `src/components/tagging/__tests__/harness.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('vitest harness', () => {
  it('runs', () => {
    expect(true).toBe(true);
  });
});
```

Run: `yarn test`

Expected: PASS, 1 test. Then delete the file:

```bash
rm src/components/tagging/__tests__/harness.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add package.json yarn.lock vitest.config.ts vitest.setup.ts
git commit -m "test: add vitest harness with PluginApi stub"
```

---

### Task 7: Frontend types and validation

**Files:**

- Create: `src/components/tagging/types.ts`, `src/components/tagging/validation.ts`, `src/components/tagging/__tests__/validation.test.ts`, `tests/test_enum_parity.py`

**Interfaces:**

- Consumes: nothing from `../../api`, deliberately — these modules are importable without the PluginApi stub.
- Produces:

  - `RuleKind`, `FilterMode`, `MatchType` enums
  - `TagRuleFilter { mode; matchType; pattern }`
  - `TagRule { id?; kind; enabled; sortOrder; fieldName; isArray; tagTemplate; tagName; autoCreate; filters }`
  - `isValidRegex(pattern: string): boolean`
  - `ruleErrors(rule: TagRule): string[]`
  - `rulesValid(rules: TagRule[]): boolean`
  - `emptyRule(kind: RuleKind, sortOrder: number): TagRule`

- [ ] **Step 1: Write the failing tests**

Create `src/components/tagging/__tests__/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FilterMode, MatchType, RuleKind, TagRule } from '../types';
import { emptyRule, isValidRegex, ruleErrors, rulesValid } from '../validation';

const metadataRule = (overrides: Partial<TagRule> = {}): TagRule => ({
  ...emptyRule(RuleKind.METADATA, 0),
  fieldName: 'tags',
  ...overrides,
});

describe('isValidRegex', () => {
  it('accepts a compilable pattern', () => {
    expect(isValidRegex('^twist$')).toBe(true);
  });

  it('rejects an uncompilable pattern', () => {
    expect(isValidRegex('[unclosed')).toBe(false);
  });
});

describe('ruleErrors', () => {
  it('requires fieldName on a metadata rule', () => {
    expect(ruleErrors(metadataRule({ fieldName: '' }))).toEqual([
      'A field name is required.',
    ]);
  });

  it('requires tagName on a channel rule', () => {
    const rule = emptyRule(RuleKind.CHANNEL, 0);
    expect(ruleErrors(rule)).toEqual(['A tag name is required.']);
  });

  it('reports an uncompilable regex filter', () => {
    const rule = metadataRule({
      filters: [
        {
          mode: FilterMode.INCLUDE,
          matchType: MatchType.REGEX,
          pattern: '[unclosed',
        },
      ],
    });
    expect(ruleErrors(rule)).toEqual(['Invalid regex: [unclosed']);
  });

  it('ignores an uncompilable pattern on an exact filter', () => {
    const rule = metadataRule({
      filters: [
        {
          mode: FilterMode.INCLUDE,
          matchType: MatchType.EXACT,
          pattern: '[unclosed',
        },
      ],
    });
    expect(ruleErrors(rule)).toEqual([]);
  });

  it('returns nothing for a valid rule', () => {
    expect(ruleErrors(metadataRule())).toEqual([]);
  });
});

describe('rulesValid', () => {
  it('is true when every rule is valid', () => {
    expect(rulesValid([metadataRule()])).toBe(true);
  });

  it('is false when any rule is invalid', () => {
    expect(rulesValid([metadataRule(), metadataRule({ fieldName: '' })])).toBe(
      false,
    );
  });

  it('is true for an empty list', () => {
    expect(rulesValid([])).toBe(true);
  });
});

describe('emptyRule', () => {
  it('starts a metadata rule enabled with no filters', () => {
    const rule = emptyRule(RuleKind.METADATA, 3);
    expect(rule.enabled).toBe(true);
    expect(rule.sortOrder).toBe(3);
    expect(rule.filters).toEqual([]);
    expect(rule.autoCreate).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test`

Expected: FAIL — cannot resolve `../types`.

- [ ] **Step 3: Write the types**

Create `src/components/tagging/types.ts`:

```ts
// These string values are the wire contract with assets/rule_types.py.
// tests/test_enum_parity.py fails if they drift.
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

export interface TagRuleFilter {
  mode: FilterMode;
  matchType: MatchType;
  pattern: string;
}

export interface TagRule {
  id?: number;
  kind: RuleKind;
  enabled: boolean;
  sortOrder: number;
  fieldName: string | null;
  isArray: boolean;
  tagTemplate: string | null;
  tagName: string | null;
  /** null means inherit the global default. */
  autoCreate: boolean | null;
  filters: TagRuleFilter[];
}
```

- [ ] **Step 4: Write the validation**

Create `src/components/tagging/validation.ts`:

```ts
import { MatchType, RuleKind, TagRule } from './types';

export const isValidRegex = (pattern: string): boolean => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

export const ruleErrors = (rule: TagRule): string[] => {
  const errors: string[] = [];
  if (rule.kind === RuleKind.METADATA && !rule.fieldName) {
    errors.push('A field name is required.');
  }
  if (rule.kind === RuleKind.CHANNEL && !rule.tagName) {
    errors.push('A tag name is required.');
  }
  rule.filters.forEach((filter) => {
    if (filter.matchType === MatchType.REGEX && !isValidRegex(filter.pattern)) {
      errors.push(`Invalid regex: ${filter.pattern}`);
    }
  });
  return errors;
};

export const rulesValid = (rules: TagRule[]): boolean =>
  rules.every((rule) => ruleErrors(rule).length === 0);

export const emptyRule = (kind: RuleKind, sortOrder: number): TagRule => ({
  kind,
  enabled: true,
  sortOrder,
  fieldName: null,
  isArray: false,
  tagTemplate: null,
  tagName: null,
  autoCreate: null,
  filters: [],
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn test`

Expected: PASS, 11 tests.

- [ ] **Step 6: Write the enum parity test**

The two enum definitions are the contract between the sides and nothing else checks them. Python owns this test because it can read the TypeScript source trivially.

Create `tests/test_enum_parity.py`:

```python
import re
from pathlib import Path

from rule_types import FilterMode, MatchType, RuleKind

TYPES_TS = (Path(__file__).resolve().parent.parent
            / "src" / "components" / "tagging" / "types.ts")


def parse_ts_enum(name: str) -> dict:
    source = TYPES_TS.read_text(encoding="utf-8")
    match = re.search(rf"export enum {name} \{{(.*?)\}}", source, re.DOTALL)
    assert match, f"enum {name} not found in {TYPES_TS}"
    return dict(re.findall(r"(\w+)\s*=\s*'([^']*)'", match.group(1)))


def as_dict(enum_cls) -> dict:
    return {member.name: member.value for member in enum_cls}


def test_rule_kind_matches():
    assert parse_ts_enum("RuleKind") == as_dict(RuleKind)


def test_filter_mode_matches():
    assert parse_ts_enum("FilterMode") == as_dict(FilterMode)


def test_match_type_matches():
    assert parse_ts_enum("MatchType") == as_dict(MatchType)
```

- [ ] **Step 7: Run the parity test**

Run: `venv/Scripts/python.exe -m pytest tests/test_enum_parity.py -v`

Expected: PASS, 3 passed.

- [ ] **Step 8: Commit**

```bash
git add src/components/tagging/types.ts src/components/tagging/validation.ts src/components/tagging/__tests__/validation.test.ts tests/test_enum_parity.py
git commit -m "feat: add tagging rule types and validation"
```

---

### Task 8: HelpIcon, help text, and MatchFilterList

**Files:**

- Create: `src/components/tagging/helpText.ts`, `src/components/tagging/HelpIcon.tsx`, `src/components/tagging/MatchFilterList.tsx`, `src/components/tagging/__tests__/MatchFilterList.test.tsx`

**Interfaces:**

- Consumes: `types.ts`, `validation.ts`.
- Produces:

  - `<HelpIcon id={string} text={string} />`
  - `HELP` object with the keys `fieldName`, `isArray`, `template`, `matchType`, `filterMode`, `autoCreate`, `channelMatch`, `filtersArray`, `filtersScalar`
  - `<MatchFilterList filters={TagRuleFilter[]} helpText={string} onChange={(filters: TagRuleFilter[]) => void} />`

- [ ] **Step 1: Write the failing test**

Create `src/components/tagging/__tests__/MatchFilterList.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MatchFilterList } from '../MatchFilterList';
import { FilterMode, MatchType, TagRuleFilter } from '../types';

const regexFilter = (pattern: string): TagRuleFilter => ({
  mode: FilterMode.INCLUDE,
  matchType: MatchType.REGEX,
  pattern,
});

describe('MatchFilterList', () => {
  it('renders one row per filter', () => {
    render(
      <MatchFilterList
        filters={[regexFilter('a'), regexFilter('b')]}
        helpText="help"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getAllByLabelText('Pattern')).toHaveLength(2);
  });

  it('flags an uncompilable regex', () => {
    render(
      <MatchFilterList
        filters={[regexFilter('[unclosed')]}
        helpText="help"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Invalid regular expression')).toBeInTheDocument();
  });

  it('does not flag an uncompilable pattern on an exact filter', () => {
    render(
      <MatchFilterList
        filters={[
          {
            mode: FilterMode.INCLUDE,
            matchType: MatchType.EXACT,
            pattern: '[unclosed',
          },
        ]}
        helpText="help"
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByText('Invalid regular expression'),
    ).not.toBeInTheDocument();
  });

  it('appends a filter when Add is clicked', async () => {
    const onChange = vi.fn();
    render(
      <MatchFilterList filters={[]} helpText="help" onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }));

    expect(onChange).toHaveBeenCalledWith([
      { mode: FilterMode.INCLUDE, matchType: MatchType.EXACT, pattern: '' },
    ]);
  });

  it('removes the chosen filter', async () => {
    const onChange = vi.fn();
    render(
      <MatchFilterList
        filters={[regexFilter('a'), regexFilter('b')]}
        helpText="help"
        onChange={onChange}
      />,
    );

    const [first] = screen.getAllByRole('button', { name: 'Remove filter' });
    await userEvent.click(first);

    expect(onChange).toHaveBeenCalledWith([regexFilter('b')]);
  });

  it('reports a changed pattern', async () => {
    const onChange = vi.fn();
    render(
      <MatchFilterList
        filters={[regexFilter('')]}
        helpText="help"
        onChange={onChange}
      />,
    );

    await userEvent.type(screen.getByLabelText('Pattern'), 'x');

    expect(onChange).toHaveBeenCalledWith([regexFilter('x')]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test`

Expected: FAIL — cannot resolve `../MatchFilterList`.

- [ ] **Step 3: Write the help text**

Keeping the copy in one module makes it reviewable without reading JSX.

Create `src/components/tagging/helpText.ts`:

```ts
export const HELP = {
  fieldName:
    "Key inside the funscript's metadata object — e.g. tags, creator, type. Use dots for nested keys. Funscripts without this key are skipped.",
  isArray:
    'On if the value is a list. Each entry is then evaluated separately and can become its own tag.',
  template:
    'Optional. {value} is replaced by the matched value — "Scripter: {value}" turns foo into "Scripter: foo". Leave blank to use the value as-is.',
  matchType:
    'Exact compares the whole value, case-insensitively. Regex matches anywhere in the value unless you anchor with ^ and $.',
  filterMode:
    'With no includes, everything passes. Add one and only matching values pass. Excludes run afterwards and always win.',
  autoCreate:
    "Create makes the Stash tag if it doesn't exist. Skip only applies tags that already exist. Inherit follows the default above.",
  channelMatch:
    "Matched against the keys of the funscript's channels object. Funscripts without one are skipped.",
  filtersArray: 'Chooses which entries of this field become tags.',
  filtersScalar:
    'Guards the rule — the tag is only applied if the value matches.',
};
```

- [ ] **Step 4: Write HelpIcon**

This lifts the idiom already at `src/components/modifiers/block.tsx:77-84`.

Create `src/components/tagging/HelpIcon.tsx`:

```tsx
import React from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { components } from '../../api';

const { Icon } = components;

export type HelpIconProps = {
  id: string;
  text: string;
};

export const HelpIcon: React.FC<HelpIconProps> = ({ id, text }) => (
  <OverlayTrigger placement="top" overlay={<Tooltip id={id}>{text}</Tooltip>}>
    <Icon className="small-icon" icon={faInfoCircle} />
  </OverlayTrigger>
);
```

- [ ] **Step 5: Write MatchFilterList**

Create `src/components/tagging/MatchFilterList.tsx`:

```tsx
import React, { useCallback } from 'react';
import { Button, Col, Form, Row } from 'react-bootstrap';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { components } from '../../api';
import { FilterMode, MatchType, TagRuleFilter } from './types';
import { isValidRegex } from './validation';
import { HelpIcon } from './HelpIcon';
import { HELP } from './helpText';

const { Icon } = components;

export type MatchFilterListProps = {
  filters: TagRuleFilter[];
  /** Differs between array and scalar fields — see HELP.filtersArray. */
  helpText: string;
  onChange: (filters: TagRuleFilter[]) => void;
};

export const MatchFilterList: React.FC<MatchFilterListProps> = ({
  filters,
  helpText,
  onChange,
}) => {
  const update = useCallback(
    (index: number, patch: Partial<TagRuleFilter>) => {
      onChange(
        filters.map((filter, i) =>
          i === index ? { ...filter, ...patch } : filter,
        ),
      );
    },
    [filters, onChange],
  );

  const remove = useCallback(
    (index: number) => onChange(filters.filter((_, i) => i !== index)),
    [filters, onChange],
  );

  const add = useCallback(
    () =>
      onChange([
        ...filters,
        {
          mode: FilterMode.INCLUDE,
          matchType: MatchType.EXACT,
          pattern: '',
        },
      ]),
    [filters, onChange],
  );

  return (
    <Form.Group className="stash-interactive-tools-filter-list mt-2">
      <Form.Label>
        Filters
        <HelpIcon id="filters-help" text={helpText} />
        <HelpIcon id="filter-mode-help" text={HELP.filterMode} />
      </Form.Label>

      {filters.map((filter, index) => {
        const invalid =
          filter.matchType === MatchType.REGEX && !isValidRegex(filter.pattern);
        return (
          <Row key={index} className="align-items-center mb-1">
            <Col xs="auto">
              <Form.Control
                aria-label="Mode"
                as="select"
                value={filter.mode}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  update(index, { mode: e.currentTarget.value as FilterMode })
                }
              >
                <option value={FilterMode.INCLUDE}>Include</option>
                <option value={FilterMode.EXCLUDE}>Exclude</option>
              </Form.Control>
            </Col>
            <Col xs="auto">
              <Form.Control
                aria-label="Match type"
                as="select"
                value={filter.matchType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  update(index, {
                    matchType: e.currentTarget.value as MatchType,
                  })
                }
              >
                <option value={MatchType.EXACT}>Exact</option>
                <option value={MatchType.REGEX}>Regex</option>
              </Form.Control>
            </Col>
            <Col xs="auto" className="d-flex align-items-center">
              <HelpIcon id={`match-type-help-${index}`} text={HELP.matchType} />
            </Col>
            <Col>
              <Form.Control
                aria-label="Pattern"
                type="text"
                isInvalid={invalid}
                value={filter.pattern}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  update(index, { pattern: e.currentTarget.value })
                }
              />
              {invalid && (
                <Form.Text className="text-danger">
                  Invalid regular expression
                </Form.Text>
              )}
            </Col>
            <Col xs="auto">
              <Button
                variant="minimal"
                title="Remove filter"
                aria-label="Remove filter"
                onClick={() => remove(index)}
              >
                <Icon icon={faTrash} />
              </Button>
            </Col>
          </Row>
        );
      })}

      <Button variant="secondary" size="sm" onClick={add}>
        Add filter
      </Button>
    </Form.Group>
  );
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `yarn test`

Expected: PASS, 17 tests (11 validation + 6 filter list).

- [ ] **Step 7: Commit**

```bash
git add src/components/tagging/helpText.ts src/components/tagging/HelpIcon.tsx src/components/tagging/MatchFilterList.tsx src/components/tagging/__tests__/MatchFilterList.test.tsx
git commit -m "feat: add help icon and match filter list for tagging rules"
```

---

### Task 9: Rule rows

**Files:**

- Create: `src/components/tagging/MetadataRuleRow.tsx`, `src/components/tagging/ChannelRuleRow.tsx`

**Interfaces:**

- Consumes: `types.ts`, `validation.ts`, `HelpIcon`, `MatchFilterList`, `HELP`.
- Produces: `<MetadataRuleRow rule index total onChange onMove onRemove />` and `<ChannelRuleRow ... />`, both with props typed as:

  - `rule: TagRule`
  - `index: number`
  - `total: number`
  - `onChange: (index: number, rule: TagRule) => void`
  - `onMove: (index: number, delta: number) => void`
  - `onRemove: (index: number) => void`

- [ ] **Step 1: Write the shared row props and the metadata row**

There are no automated tests for these two components — they are assembly over the already-tested `MatchFilterList` and `validation`. They are verified by the build in Step 4 and by the manual check in Task 11.

Create `src/components/tagging/MetadataRuleRow.tsx`:

```tsx
import React, { useCallback } from 'react';
import { Button, Col, Container, Form, Row } from 'react-bootstrap';
import {
  faArrowDown,
  faArrowUp,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { components } from '../../api';
import { TagRule, TagRuleFilter } from './types';
import { ruleErrors } from './validation';
import { HelpIcon } from './HelpIcon';
import { HELP } from './helpText';
import { MatchFilterList } from './MatchFilterList';

const { Icon } = components;

export type RuleRowProps = {
  rule: TagRule;
  index: number;
  total: number;
  onChange: (index: number, rule: TagRule) => void;
  onMove: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
};

/** null = inherit, true = create, false = skip. */
export const autoCreateToSelect = (value: boolean | null): string =>
  value === null ? 'inherit' : value ? 'create' : 'skip';

export const selectToAutoCreate = (value: string): boolean | null =>
  value === 'inherit' ? null : value === 'create';

export const MetadataRuleRow: React.FC<RuleRowProps> = ({
  rule,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}) => {
  const patch = useCallback(
    (changes: Partial<TagRule>) => onChange(index, { ...rule, ...changes }),
    [index, rule, onChange],
  );

  const onFiltersChange = useCallback(
    (filters: TagRuleFilter[]) => patch({ filters }),
    [patch],
  );

  const errors = ruleErrors(rule);

  return (
    <Container
      className="stash-interactive-tools-rule-row rounded-sm mb-2 pt-2 pb-2"
      fluid
    >
      <Row className="align-items-center">
        <Col xs="auto">
          <Form.Switch
            id={`metadata-rule-enabled-${index}`}
            label="Enabled"
            checked={rule.enabled}
            onChange={() => patch({ enabled: !rule.enabled })}
          />
        </Col>
        <Col xs="auto" className="ml-auto">
          {index !== 0 && (
            <Button
              variant="minimal"
              title="Move Up"
              aria-label="Move up"
              onClick={() => onMove(index, -1)}
            >
              <Icon icon={faArrowUp} />
            </Button>
          )}
          {index !== total - 1 && (
            <Button
              variant="minimal"
              title="Move Down"
              aria-label="Move down"
              onClick={() => onMove(index, 1)}
            >
              <Icon icon={faArrowDown} />
            </Button>
          )}
          <Button
            variant="minimal"
            title="Delete"
            aria-label="Delete rule"
            onClick={() => onRemove(index)}
          >
            <Icon icon={faTrash} style={{ color: 'var(--danger)' }} />
          </Button>
        </Col>
      </Row>

      <Form.Group>
        <Form.Label>
          Metadata field
          <HelpIcon id={`field-name-help-${index}`} text={HELP.fieldName} />
        </Form.Label>
        <Form.Control
          aria-label="Metadata field"
          type="text"
          placeholder="tags"
          value={rule.fieldName ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            patch({ fieldName: e.currentTarget.value })
          }
        />
      </Form.Group>

      <Form.Group>
        <Form.Switch
          id={`metadata-rule-is-array-${index}`}
          label="Value is a list"
          checked={rule.isArray}
          onChange={() => patch({ isArray: !rule.isArray })}
        />
        <HelpIcon id={`is-array-help-${index}`} text={HELP.isArray} />
      </Form.Group>

      <Form.Group>
        <Form.Label>
          Tag name template
          <HelpIcon id={`template-help-${index}`} text={HELP.template} />
        </Form.Label>
        <Form.Control
          aria-label="Tag name template"
          type="text"
          placeholder="{value}"
          value={rule.tagTemplate ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            patch({ tagTemplate: e.currentTarget.value || null })
          }
        />
      </Form.Group>

      <Form.Group>
        <Form.Label>
          Missing tags
          <HelpIcon id={`auto-create-help-${index}`} text={HELP.autoCreate} />
        </Form.Label>
        <Form.Control
          aria-label="Missing tags"
          as="select"
          value={autoCreateToSelect(rule.autoCreate)}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            patch({ autoCreate: selectToAutoCreate(e.currentTarget.value) })
          }
        >
          <option value="inherit">Inherit default</option>
          <option value="create">Create</option>
          <option value="skip">Skip</option>
        </Form.Control>
      </Form.Group>

      <MatchFilterList
        filters={rule.filters}
        helpText={rule.isArray ? HELP.filtersArray : HELP.filtersScalar}
        onChange={onFiltersChange}
      />

      {errors.map((error) => (
        <Form.Text key={error} className="text-danger">
          {error}
        </Form.Text>
      ))}
    </Container>
  );
};
```

- [ ] **Step 2: Write the channel row**

Create `src/components/tagging/ChannelRuleRow.tsx`:

```tsx
import React, { useCallback } from 'react';
import { Button, Col, Container, Form, Row } from 'react-bootstrap';
import {
  faArrowDown,
  faArrowUp,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { components } from '../../api';
import { TagRule, TagRuleFilter } from './types';
import { ruleErrors } from './validation';
import { HelpIcon } from './HelpIcon';
import { HELP } from './helpText';
import { MatchFilterList } from './MatchFilterList';
import {
  autoCreateToSelect,
  RuleRowProps,
  selectToAutoCreate,
} from './MetadataRuleRow';

const { Icon } = components;

export const ChannelRuleRow: React.FC<RuleRowProps> = ({
  rule,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}) => {
  const patch = useCallback(
    (changes: Partial<TagRule>) => onChange(index, { ...rule, ...changes }),
    [index, rule, onChange],
  );

  const onFiltersChange = useCallback(
    (filters: TagRuleFilter[]) => patch({ filters }),
    [patch],
  );

  const errors = ruleErrors(rule);

  return (
    <Container
      className="stash-interactive-tools-rule-row rounded-sm mb-2 pt-2 pb-2"
      fluid
    >
      <Row className="align-items-center">
        <Col xs="auto">
          <Form.Switch
            id={`channel-rule-enabled-${index}`}
            label="Enabled"
            checked={rule.enabled}
            onChange={() => patch({ enabled: !rule.enabled })}
          />
        </Col>
        <Col xs="auto" className="ml-auto">
          {index !== 0 && (
            <Button
              variant="minimal"
              title="Move Up"
              aria-label="Move up"
              onClick={() => onMove(index, -1)}
            >
              <Icon icon={faArrowUp} />
            </Button>
          )}
          {index !== total - 1 && (
            <Button
              variant="minimal"
              title="Move Down"
              aria-label="Move down"
              onClick={() => onMove(index, 1)}
            >
              <Icon icon={faArrowDown} />
            </Button>
          )}
          <Button
            variant="minimal"
            title="Delete"
            aria-label="Delete rule"
            onClick={() => onRemove(index)}
          >
            <Icon icon={faTrash} style={{ color: 'var(--danger)' }} />
          </Button>
        </Col>
      </Row>

      <Form.Group>
        <Form.Label>
          Tag to apply
          <HelpIcon id={`channel-tag-help-${index}`} text={HELP.channelMatch} />
        </Form.Label>
        <Form.Control
          aria-label="Tag to apply"
          type="text"
          placeholder="Multi-Axis"
          value={rule.tagName ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            patch({ tagName: e.currentTarget.value })
          }
        />
      </Form.Group>

      <Form.Group>
        <Form.Label>
          Missing tags
          <HelpIcon
            id={`channel-auto-create-help-${index}`}
            text={HELP.autoCreate}
          />
        </Form.Label>
        <Form.Control
          aria-label="Missing tags"
          as="select"
          value={autoCreateToSelect(rule.autoCreate)}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            patch({ autoCreate: selectToAutoCreate(e.currentTarget.value) })
          }
        >
          <option value="inherit">Inherit default</option>
          <option value="create">Create</option>
          <option value="skip">Skip</option>
        </Form.Control>
      </Form.Group>

      <MatchFilterList
        filters={rule.filters}
        helpText={HELP.channelMatch}
        onChange={onFiltersChange}
      />

      {errors.map((error) => (
        <Form.Text key={error} className="text-danger">
          {error}
        </Form.Text>
      ))}
    </Container>
  );
};
```

- [ ] **Step 3: Run the existing tests to check nothing regressed**

Run: `yarn test`

Expected: PASS, 17 tests.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors from `src/components/tagging/`.

- [ ] **Step 5: Commit**

```bash
git add src/components/tagging/MetadataRuleRow.tsx src/components/tagging/ChannelRuleRow.tsx
git commit -m "feat: add metadata and channel rule rows"
```

---

### Task 10: The hook

**Files:**

- Create: `src/hooks/useTagRules.ts`
- Modify: `src/hooks/index.tsx`, `src/hooks/useInteractiveBackend.ts`

**Interfaces:**

- Consumes: `InteractiveBackendOperation.MANAGE`, `useInteractiveBackend`, `TagRule` from `../components/tagging/types`.
- Produces: `useTagRules()` returning `{ rules, loading, loaded, load, save }` where `rules: TagRule[]`, `load: () => Promise<void>`, `save: (rules: TagRule[]) => Promise<void>`.

- [ ] **Step 1: Make `invokeBackend` return its result**

`useInteractiveBackend`'s `invokeBackend` currently awaits the mutation and returns nothing, so `await invokeGet()` would always be `undefined`. `useInteractiveBackendInit` works around this by reading the `data` field instead, but a load/save hook needs the value at the call site.

In `src/hooks/useInteractiveBackend.ts`, change the callback to return the unwrapped payload:

```ts
const invokeBackend = useCallback(
  async (...extraArgs: MaybeArg<A>) => {
    const result = await mutation({
      variables: {
        plugin_id: 'StashInteractiveTools',
        args: {
          mode: operation,
          ...deepSnakeCase(merge(args, extraArgs[0] || {})),
        },
      },
    });
    return result.data?.runPluginOperation as T | undefined;
  },
  [mutation, operation, args],
);
```

This is backward compatible — every existing caller discards the return value and reads `data` from the second element of the tuple, which is unchanged.

- [ ] **Step 2: Add the actions to the manage enum**

In `src/hooks/useInteractiveBackend.ts`, extend the enum. The existing commented-out members stay as they are.

```ts
export enum InteractiveBackendManageAction {
  SET_AS_DEFAULT = 'SET_AS_DEFAULT',
  GET_TAG_RULES = 'GET_TAG_RULES',
  SAVE_TAG_RULES = 'SAVE_TAG_RULES',
  // DELETE = 'DELETE',
  // ADD = 'ADD',
  // UPDATE_NAME = 'UPDATE_NAME',
  // MOVE_UP = 'MOVE_UP',
  // MOVE_DOWN = 'MOVE_DOWN',
  // RENAME = 'RENAME',
  //
  // CLEAR = 'CLEAR',
}
```

Do **not** add entries to `InteractiveBackendManagePayload`. That map is consumed by `useInteractiveBackendManage`, which hardcodes `payload: { sceneId }` — a shape these actions do not have. The new hook calls `useInteractiveBackend` directly instead, leaving the existing hook and its callers untouched.

- [ ] **Step 3: Write the hook**

Create `src/hooks/useTagRules.ts`:

```ts
import { useCallback, useState } from 'react';
import {
  InteractiveBackendManageAction,
  InteractiveBackendOperation,
  useInteractiveBackend,
} from './useInteractiveBackend';
import { TagRule } from '../components/tagging/types';
import { createDebugConsole } from '../utils';

const logger = createDebugConsole('useTagRules:');

type TagRulesResponse = { rules?: TagRule[] };

/**
 * Reads and writes the tag rule set through the `manage` backend operation.
 *
 * Kept separate from `useInteractiveBackendManage`, which hardcodes a
 * `{ sceneId }` payload that these two actions do not use.
 */
export const useTagRules = () => {
  const [rules, setRules] = useState<TagRule[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [invokeGet, { loading: loadingGet }] =
    useInteractiveBackend<TagRulesResponse>(
      InteractiveBackendOperation.MANAGE,
      {
        action: InteractiveBackendManageAction.GET_TAG_RULES,
        payload: {},
      },
    );

  const [invokeSave, { loading: loadingSave }] = useInteractiveBackend<
    TagRulesResponse,
    { payload: { rules: TagRule[] } }
  >(InteractiveBackendOperation.MANAGE, {
    action: InteractiveBackendManageAction.SAVE_TAG_RULES,
  });

  const load = useCallback(async () => {
    const result = await invokeGet();
    logger.debug('loaded rules', result);
    setRules(result?.rules ?? []);
    setLoaded(true);
  }, [invokeGet]);

  const save = useCallback(
    async (updated: TagRule[]) => {
      const normalised = updated.map((rule, index) => ({
        ...rule,
        sortOrder: index,
      }));
      const result = await invokeSave({ payload: { rules: normalised } });
      logger.debug('saved rules', result);
      setRules(result?.rules ?? normalised);
    },
    [invokeSave],
  );

  return {
    rules,
    loaded,
    loading: loadingGet || loadingSave,
    load,
    save,
  };
};
```

`save` renumbers `sortOrder` from the array position, so reordering in the UI needs no separate bookkeeping. `deepSnakeCase` converts `sortOrder` to `sort_order` on the way out, matching `TagRulePayload`.

- [ ] **Step 4: Export it**

Add to `src/hooks/index.tsx`:

```ts
export * from './useTagRules';
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTagRules.ts src/hooks/index.tsx src/hooks/useInteractiveBackend.ts
git commit -m "feat: add useTagRules hook"
```

---

### Task 11: The builder and settings wiring

**Files:**

- Create: `src/components/tagging/TagRuleBuilder.tsx`, `src/components/tagging/index.ts`
- Modify: `src/components/PluginSettings.tsx`, `src/components/index.tsx`

**Interfaces:**

- Consumes: `useTagRules`, `MetadataRuleRow`, `ChannelRuleRow`, `emptyRule`, `rulesValid`, `RuleKind`.
- Produces: `<TagRuleBuilder />`, rendered by `PluginSettings`.

- [ ] **Step 1: Write the builder**

Create `src/components/tagging/TagRuleBuilder.tsx`:

```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Nav, Tab } from 'react-bootstrap';
import { useTagRules } from '../../hooks/useTagRules';
import { RuleKind, TagRule } from './types';
import { emptyRule, rulesValid } from './validation';
import { MetadataRuleRow } from './MetadataRuleRow';
import { ChannelRuleRow } from './ChannelRuleRow';

export const TagRuleBuilder: React.FC = () => {
  const { rules, loaded, loading, load, save } = useTagRules();
  const [working, setWorking] = useState<TagRule[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  useEffect(() => {
    setWorking(rules);
    setDirty(false);
  }, [rules]);

  const commit = useCallback((next: TagRule[]) => {
    setWorking(next);
    setDirty(true);
  }, []);

  const onChange = useCallback(
    (index: number, rule: TagRule) =>
      commit(working.map((existing, i) => (i === index ? rule : existing))),
    [working, commit],
  );

  const onRemove = useCallback(
    (index: number) => commit(working.filter((_, i) => i !== index)),
    [working, commit],
  );

  const onMove = useCallback(
    (index: number, delta: number) => {
      const next = [...working];
      const target = index + delta;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      commit(next);
    },
    [working, commit],
  );

  const addRule = useCallback(
    (kind: RuleKind) => commit([...working, emptyRule(kind, working.length)]),
    [working, commit],
  );

  // Indices are into `working`, so the row callbacks address the real array
  // rather than the filtered view.
  const byKind = useMemo(() => {
    const metadata: number[] = [];
    const channel: number[] = [];
    working.forEach((rule, index) => {
      (rule.kind === RuleKind.METADATA ? metadata : channel).push(index);
    });
    return { metadata, channel };
  }, [working]);

  const valid = rulesValid(working);

  const renderRows = (indices: number[], kind: RuleKind) => {
    const Row = kind === RuleKind.METADATA ? MetadataRuleRow : ChannelRuleRow;
    return indices.map((index) => (
      <Row
        key={index}
        rule={working[index]}
        index={index}
        total={working.length}
        onChange={onChange}
        onMove={onMove}
        onRemove={onRemove}
      />
    ));
  };

  return (
    <div className="stash-interactive-tools-tag-rules setting-section">
      <h4>Tagging Rules</h4>
      <div className="sub-heading font-italic">
        Applied by the Extract Metadata task in Settings &gt; Tasks.
      </div>

      <Tab.Container defaultActiveKey="metadata">
        <Nav variant="tabs">
          <Nav.Item>
            <Nav.Link eventKey="metadata">Metadata</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="channels">Channels</Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content className="mt-3">
          <Tab.Pane eventKey="metadata">
            {renderRows(byKind.metadata, RuleKind.METADATA)}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => addRule(RuleKind.METADATA)}
            >
              Add metadata rule
            </Button>
          </Tab.Pane>

          <Tab.Pane eventKey="channels">
            {renderRows(byKind.channel, RuleKind.CHANNEL)}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => addRule(RuleKind.CHANNEL)}
            >
              Add channel rule
            </Button>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>

      <div className="d-flex justify-content-end mt-3">
        <Button
          variant="secondary"
          className="mr-2"
          disabled={!dirty || loading}
          onClick={() => {
            setWorking(rules);
            setDirty(false);
          }}
        >
          Discard
        </Button>
        <Button
          disabled={!dirty || !valid || loading}
          onClick={() => void save(working)}
        >
          Save
        </Button>
      </div>
      {!valid && (
        <div className="text-danger text-right">
          Fix the errors above before saving.
        </div>
      )}
    </div>
  );
};
```

`index` is the position in `working`, not in the filtered tab view, so `onMove` and `onRemove` address the real array. `total` is `working.length` for the same reason — the move arrows are therefore hidden at the ends of the combined list rather than the tab's list, which is a deliberate simplification given `sortOrder` has no effect on the outcome.

- [ ] **Step 2: Add the barrel**

Create `src/components/tagging/index.ts`:

```ts
export * from './types';
export * from './validation';
export * from './TagRuleBuilder';
```

Add to `src/components/index.tsx`:

```ts
export * from './tagging';
```

- [ ] **Step 3: Render it in the settings panel**

In `src/components/PluginSettings.tsx`, add the import:

```ts
import { TagRuleBuilder } from './tagging/TagRuleBuilder';
```

Then render it after the settings list, inside the existing wrapper div:

```tsx
return (
  <div className="plugin-settings">
    {settings.map((setting) => {
      // ...unchanged...
    })}
    <TagRuleBuilder />
  </div>
);
```

- [ ] **Step 4: Typecheck and test**

Run: `npx tsc --noEmit && yarn test`

Expected: no type errors; 17 tests pass.

- [ ] **Step 5: Build**

Run: `yarn rollup`

Expected: build completes and writes to `dist/`.

- [ ] **Step 6: Manual verification**

1. Deploy the built plugin to Stash and reload the UI.
2. Open Settings → Plugins → Stash Interactive Tools. The Tagging Rules section appears below the existing settings with Metadata and Channels tabs.
3. Add a metadata rule with field `tags`, toggle "Value is a list" on, and confirm the filter help text reads "Chooses which entries of this field become tags." Toggle it off and confirm it changes to the guard wording.
4. Hover each info icon and confirm the tooltip appears.
5. Add a regex filter with pattern `[unclosed` and confirm the field turns red, "Invalid regular expression" appears, and Save is disabled.
6. Fix the pattern, click Save, reload the page, and confirm the rule persists.
7. Add a channel rule with tag name `Multi-Axis`, save, reload, confirm both tabs keep their rules.
8. Run Settings → Tasks → Extract Metadata and confirm the log shows progress and no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/tagging/TagRuleBuilder.tsx src/components/tagging/index.ts src/components/index.tsx src/components/PluginSettings.tsx
git commit -m "feat: render tagging rule builder in plugin settings"
```

---

### Task 12: Adopt `load_funscript` in `remap.py`, and sync the spec

**Files:**

- Modify: `assets/tasks/remap.py`, `docs/superpowers/specs/2026-08-06-tagging-rules-builder-design.md`

**Interfaces:**

- Consumes: `helpers.load_funscript`, `FunscriptLoadError`, `LoadErrorReason`.
- Produces: no new interface — this removes the three duplicated JSON loads.

This task is last and separable on purpose: it touches working code that the rest of the feature does not depend on. If anything here looks risky mid-implementation, skip it and keep the rest.

- [ ] **Step 1: Add the import**

In `assets/tasks/remap.py`, add:

```python
from helpers import FunscriptLoadError, LoadErrorReason, load_funscript
```

- [ ] **Step 2: Replace the load in `make_heatmap` (lines 117-127)**

Current code copies `broken.png` or `missing.png` and then **falls through** to `fun_data['actions']`, which raises `UnboundLocalError` because `fun_data` was never assigned. That is a pre-existing bug, not one introduced here, and the rewrite makes it visible. Fix it with the `return` the original intent clearly wanted:

```python
def make_heatmap(funscriptpath, heatmappath, sceneduration, text, backgroundcolor=(0,0,0,255), timedisplay=False):
   # read the funscript
   try:
     fun_data = load_funscript(funscriptpath)
   except FunscriptLoadError as e:
     if e.reason is LoadErrorReason.INVALID_JSON:
        config.log.error(f"Error: {funscriptpath} file is not valid JSON ({e.__cause__})")
        fallback = "broken.png"
     else:
        config.log.error(f"Error: Could not open {funscriptpath} ({e.__cause__})")
        fallback = "missing.png"
     shutil.copyfile(os.path.join(os.path.dirname(__file__), fallback), heatmappath)
     return

   action_length = len(fun_data['actions'])
```

- [ ] **Step 3: Replace the load in `remap_scene` (around line 274)**

The body inside the `with` block stays exactly as it is; only the open/parse changes. The existing `except json.JSONDecodeError` handler at line 321 becomes an `except FunscriptLoadError` handler with the same body.

```python
          try:
             fun_data = load_funscript(funscript)
             if fun_data['actions'][0]["at"] == 66 and fun_data['actions'][1]["pos"] in [83,84]:
                # ...rest of the block unchanged...
```

- [ ] **Step 4: Replace the load around line 353**

```python
       if os.path.isfile(funscript):
          try:
            fun_data = load_funscript(funscript)
          except FunscriptLoadError as e:
             if e.reason is LoadErrorReason.INVALID_JSON:
                config.log.error(f"Error: {funscript} file is not valid JSON ({e.__cause__})")
                fallback = "broken.png"
             else:
                config.log.error(f"Error: Could not open {funscript} ({e.__cause__})")
                fallback = "missing.png"
             shutil.copyfile(os.path.join(os.path.dirname(__file__), fallback), heatmap)
             sceneflag = True
             images_list.append(heatmap)
             continue
```

- [ ] **Step 5: Verify the module still imports and the suite passes**

Run: `venv/Scripts/python.exe -c "import sys; sys.path[:0]=['assets','assets/tasks']; import remap; print('ok')"`

Expected: `ok`.

Run: `venv/Scripts/python.exe -m pytest -v`

Expected: PASS, all tests.

- [ ] **Step 6: Manually verify remap still works**

Run Settings → Tasks → Build MultiHeatmap against a library containing at least one scene with a deliberately corrupted `.funscript`. Confirm the heatmap still renders and the broken script still shows the broken image rather than crashing the task.

- [ ] **Step 7: Sync the spec**

The spec puts the enums in `assets/db.py`; they are in `assets/rule_types.py` so `rule_eval.py` stays free of peewee. In the spec's "Enums" subsection, change:

> They live in `assets/db.py` beside the models, which is the lowest point in the import graph that `manage.py` and `extract_metadata.py` both already reach through `Config`.

to:

> They live in `assets/rule_types.py`, a dependency-free module imported by both `db.py` and the pure evaluator, so `rule_eval.py` never pulls in peewee.

- [ ] **Step 8: Commit**

```bash
git add assets/tasks/remap.py docs/superpowers/specs/2026-08-06-tagging-rules-builder-design.md
git commit -m "refactor: use shared load_funscript helper in remap"
```

---

## Spec Coverage

| Spec section                                                   | Task                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Enums (`RuleKind`, `FilterMode`, `MatchType`), `EnumField`     | 2                                                                |
| `TagRule` / `TagRuleFilter` models, no migration needed        | 2                                                                |
| Explicit filter deletion instead of relying on CASCADE         | 4                                                                |
| Global `tagRuleAutoCreate` setting, read in `config.py`        | 2 (config), 5 (yml)                                              |
| `sort_order` is presentation-only                              | 3 (`tag_names_for_scene` ignores order), 10 (renumbered on save) |
| `GET_TAG_RULES` / `SAVE_TAG_RULES`, replace-all, camelCase out | 4                                                                |
| Free enum validation via `bind_json`                           | 4                                                                |
| `extract_metadata` task, static fragment, pagination           | 5                                                                |
| Dotted field descent, array vs scalar, `str()` coercion        | 3                                                                |
| `is_array` is a declaration, not a guarantee                   | 3                                                                |
| Channel keys from the `channels` object                        | 3                                                                |
| Include allow-list, exclude wins                               | 3                                                                |
| Template with and without `{value}`                            | 3                                                                |
| Union across a scene's funscripts; create wins on conflict     | 3                                                                |
| Add-only, batched `BULK_SCENE_UPDATE`                          | 5                                                                |
| Broken JSON skipped and logged                                 | 1 (helper), 5 (task)                                             |
| Invalid rules logged and skipped, not fatal                    | 3, 5                                                             |
| `load_funscript` shared with `remap.py`                        | 1, 12                                                            |
| `TagRuleBuilder`, tabs, working copy, save/discard             | 11                                                               |
| `MetadataRuleRow`, `ChannelRuleRow`                            | 9                                                                |
| `MatchFilterList` shared, live regex check                     | 8                                                                |
| Filter help text switches on `is_array`                        | 8 (strings), 9 (wiring)                                          |
| `HelpIcon` from the `block.tsx` idiom                          | 8                                                                |
| All seven help strings                                         | 8                                                                |
| `useTagRules` as a sibling hook                                | 10                                                               |
| Save blocked on invalid rules                                  | 7 (logic), 11 (button)                                           |
| Placement inside `PluginSettings`                              | 11                                                               |
| Stash task only, no Run-now button                             | 5                                                                |
| Testing: rule evaluation                                       | 3                                                                |
| Testing: `load_funscript`                                      | 1                                                                |
| Testing: persistence round-trip and orphan cleanup             | 4                                                                |
| Testing: TS/Python enum parity                                 | 7                                                                |
| Testing: frontend regex validation and save blocking           | 7, 8                                                             |
