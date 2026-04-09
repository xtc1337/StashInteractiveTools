from __future__ import annotations

import json
from dataclasses import MISSING, fields, is_dataclass
from enum import Enum
from typing import Any, Callable, TypeVar, Union, get_args, get_origin

T = TypeVar("T")
FieldResolver = Callable[[Any, dict[str, Any], str], Any]


class JsonValidationError(ValueError):
    pass


def _is_optional(tp: Any) -> bool:
    origin = get_origin(tp)
    return origin is Union and type(None) in get_args(tp)


def _strip_optional(tp: Any) -> Any:
    if not _is_optional(tp):
        return tp
    return next(t for t in get_args(tp) if t is not type(None))


def _get_json_key(field) -> str:
    return field.metadata.get("json_name", field.name)


def _has_default(field) -> bool:
    return field.default is not MISSING or field.default_factory is not MISSING


def _convert_value(
        value: Any,
        expected_type: Any,
        path: str = "root",
        resolves: dict[str, FieldResolver] | None = None,
        parent_data: dict[str, Any] | None = None,
) -> Any:
    if expected_type is Any:
        return value

    if value is None:
        if _is_optional(expected_type):
            return None
        raise JsonValidationError(f"{path}: expected {expected_type}, got null")

    expected_type = _strip_optional(expected_type)
    origin = get_origin(expected_type)
    args = get_args(expected_type)

    if origin is list:
        if not isinstance(value, list):
            raise JsonValidationError(f"{path}: expected list, got {type(value).__name__}")
        item_type = args[0] if args else Any
        return [
            _convert_value(item, item_type, f"{path}[{i}]", resolves, value if isinstance(value, dict) else parent_data)
            for i, item in enumerate(value)
        ]

    if origin is dict:
        if not isinstance(value, dict):
            raise JsonValidationError(f"{path}: expected dict, got {type(value).__name__}")
        key_type, val_type = args if args else (Any, Any)
        if key_type not in (Any, str):
            raise JsonValidationError(f"{path}: only string keys are supported")
        return {
            str(k): _convert_value(v, val_type, f"{path}.{k}", resolves, value)
            for k, v in value.items()
        }

    if is_dataclass(expected_type):
        if not isinstance(value, dict):
            raise JsonValidationError(f"{path}: expected object, got {type(value).__name__}")
        return bind_json(expected_type, value, path, resolves)

    if isinstance(expected_type, type) and issubclass(expected_type, Enum):
        try:
            return expected_type(value)
        except ValueError:
            if isinstance(value, str) and value in expected_type.__members__:
                return expected_type[value]
            allowed = [e.value for e in expected_type]
            raise JsonValidationError(
                f"{path}: expected one of {allowed}, got {value!r}"
            )

    if expected_type is bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lowered = value.lower().strip()
            if lowered in {"true", "1", "yes", "on"}:
                return True
            if lowered in {"false", "0", "no", "off"}:
                return False
        raise JsonValidationError(f"{path}: expected bool, got {value!r}")

    try:
        if isinstance(value, expected_type):
            return value
        return expected_type(value)
    except Exception:
        name = getattr(expected_type, "__name__", str(expected_type))
        raise JsonValidationError(f"{path}: expected {name}, got {type(value).__name__}")


def bind_json(
        model_cls: type[T],
        data: dict[str, Any],
        path: str = "root",
        resolves: dict[str, FieldResolver] | None = None,
) -> T:
    """
    Validate a dict and bind it to a dataclass instance.

    Supports:
    - nested dataclasses
    - generic dataclasses
    - enums
    - Optional[T]
    - list[T]
    - dict[str, T]
    - field remapping via metadata={"json_name": "..."}
    - optional per-field resolvers via resolves={field_name: resolver}
    """
    if not is_dataclass(model_cls):
        raise TypeError("model_cls must be a dataclass")

    values = {}
    resolves = resolves or {}

    for field in fields(model_cls):
        json_key = _get_json_key(field)

        if json_key not in data:
            if _is_optional(field.type) or _has_default(field):
                continue
            raise JsonValidationError(f"{path}: missing required field '{json_key}'")

        raw_value = data[json_key]

        resolver = resolves.get(field.name)
        expected_type = field.type
        if resolver is not None:
            resolved_type = resolver(raw_value, data, path)
            if resolved_type is not None:
                expected_type = resolved_type

        values[field.name] = _convert_value(
            raw_value,
            expected_type,
            f"{path}.{json_key}",
            resolves,
            data,
        )

    return model_cls(**values)


def bind_from_json(
        model_cls: type[T],
        json_string: str | dict[str, Any],
        resolves: dict[str, FieldResolver] | None = None,
) -> T:
    """
    Parse JSON text, validate it, and bind it to a dataclass instance.

    Args:
        model_cls: Dataclass type to instantiate.
        json_string: JSON string or already-parsed dict.
        resolves: Optional field resolvers keyed by dataclass field name.

    Raises:
        JsonValidationError: if the JSON is invalid or does not match the model.
        TypeError: if model_cls is not a dataclass.
    """
    if isinstance(json_string, str):
        try:
            data = json.loads(json_string)
        except json.JSONDecodeError as e:
            raise JsonValidationError(f"Invalid JSON: {e}") from e
    else:
        data = json_string

    if not isinstance(data, dict):
        raise JsonValidationError("Top-level JSON value must be an object")

    return bind_json(model_cls, data, resolves=resolves)
