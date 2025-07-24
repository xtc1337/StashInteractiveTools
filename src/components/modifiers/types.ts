import { Funscript } from 'funscript-utils/lib/types';
import { MODIFIERS } from './index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;
declare module 'funscript-utils/lib/types' {
  interface Funscript {
    range: number;
  }
}

// === Core Option Types ===

export type ModifierOptionType = 'input' | 'toggle' | 'dropdown';
export type OptionValueType = string | number;

export type DropdownChoice<Value extends string | number> = {
  label: string;
  value: Value;
};

// === Individual Option Shapes ===

export type InputOption<Name extends string, Value extends OptionValueType> = {
  type: 'input';
  name: Name;
  title: string;
  defaultValue: Value;
  value?: Value;
  lines?: number;
  enabled?: (ctx: Record<string, Any>) => boolean;
};

export type ToggleOption<Name extends string> = {
  type: 'toggle';
  name: Name;
  title: string;
  defaultValue: boolean;
  value?: boolean;
  enabled?: (ctx: Record<string, Any>) => boolean;
};

export type DropdownOption<
  Name extends string,
  Value extends OptionValueType,
> = {
  type: 'dropdown';
  name: Name;
  title: string;
  defaultValue: Value;
  value?: Value;
  options: readonly DropdownChoice<Value>[];
  enabled?: (ctx: Record<string, Any>) => boolean;
};

export type ModifierOption =
  | InputOption<string, OptionValueType>
  | ToggleOption<string>
  | DropdownOption<string, OptionValueType>;

// === DSL Helpers ===

export function input<Name extends string, Value extends OptionValueType>(
  name: Name,
  defaultValue: Value,
  title: string,
  opts?: Partial<Pick<InputOption<Name, Value>, 'value' | 'enabled'>>,
): InputOption<Name, Value> {
  return { name, defaultValue, title, type: 'input', ...opts };
}

export function toggle<Name extends string>(
  name: Name,
  defaultValue: boolean,
  title: string,
  opts?: Partial<Pick<ToggleOption<Name>, 'value' | 'enabled'>>,
): ToggleOption<Name> {
  return { name, defaultValue, title, type: 'toggle', ...opts };
}

export function dropdown<
  Name extends string,
  Value extends string | number,
  const Options extends readonly DropdownChoice<OptionValueType>[],
>(
  name: Name,
  defaultValue: Value,
  title: string,
  options: Options,
  opts?: Partial<Pick<DropdownOption<Name, Value>, 'value' | 'enabled'>>,
): DropdownOption<Name, Options[number]['value']> {
  return {
    name,
    defaultValue,
    title,
    type: 'dropdown',
    options,
    ...opts,
  };
}

// === Grouping / Collection ===

export type ModifierGroup = {
  type: 'group';
  title: string;
  options: readonly ModifierOption[];
};

export type ModifierEntry = ModifierOption; //| ModifierGroup;

export function group(
  title: string,
  options: readonly ModifierOption[],
): ModifierGroup {
  return { type: 'group', title, options };
}

export function createOptions<const Entries extends readonly ModifierEntry[]>(
  entries: Entries,
): Entries {
  return entries;
}

// 🧠 Context Inference

type Flatten<Entries extends readonly ModifierEntry[]> = Extract<
  Entries[number],
  { type: ModifierOptionType }
>;

type DropdownValue<T> = T extends DropdownOption<Any, infer V> ? V : never;
type InputValue<T> = T extends InputOption<Any, infer V> ? V : never;
type ToggleValue<T> = T extends ToggleOption<Any> ? boolean : never;

type OptionToContext<T extends ModifierOption> =
  T extends DropdownOption<infer N, Any>
    ? { [K in N]: DropdownValue<T> }
    : T extends InputOption<infer N, Any>
      ? { [K in N]: InputValue<T> }
      : T extends ToggleOption<infer N>
        ? { [K in N]: ToggleValue<T> }
        : never;

type UnionToIntersection<U> = (U extends Any ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never;

export type ModifierContext<Entries extends readonly ModifierEntry[]> =
  UnionToIntersection<OptionToContext<Flatten<Entries>>>;

//✅ Modifier Definition Factory
export type ModifierDef<Entries extends readonly ModifierEntry[]> = {
  id: string;
  name: string;
  description: string;
  options: Entries;
  info?: (ctx: ModifierContext<Entries>) => string;
  apply: (
    script: Funscript,
    ctx: ModifierContext<Entries>,
    onError?: (error: string) => void,
  ) => Funscript | Promise<Funscript>;
};

export function createModifierDef<
  const Entries extends readonly ModifierEntry[],
>(def: ModifierDef<Entries>): ModifierDef<Entries> {
  return def;
}

export type AnyModifierDef = ModifierDef<readonly ModifierEntry[]>;
export type AnyModifierContext = ModifierContext<ModifierOption[]>;
export type PossibleValues = string | number | boolean;

export function toValues<T extends AnyModifierDef = AnyModifierDef>(
  modifier: T,
) {
  type Values = ModifierContext<T['options']> & {
    [key: string]: PossibleValues;
  };
  return modifier.options.reduce(
    (acc, option) => ({
      ...acc,
      [option.name]: option.value ?? option.defaultValue,
    }),
    {} as Record<string, PossibleValues>,
  ) as Values;
}

export function presetToModifierDef(preset: ModifierPreset) {
  return preset.modifiers.map((saved) => {
    const modifier = MODIFIERS.find(
      (m) => m.id === saved.id,
    ) as unknown as AnyModifierDef;
    modifier.options.forEach((option: ModifierOption) => {
      option.value = saved.values[option.name] ?? option.defaultValue;
    });
    return modifier;
  });
}
export function withOrWithout(value: boolean, text: string) {
  return `${text} : ${value ? '✓' : '✘'} `;
}

export type ModifierPreset = {
  id?: number;
  name: string;
  modifiers: {
    id: string;
    values: Record<string, PossibleValues>;
  }[];
};
