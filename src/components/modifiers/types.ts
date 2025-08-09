import { Funscript } from 'funscript-utils/lib/types';

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

// === Grouping / Collection ===

export type ModifierGroup = {
  type: 'group';
  title: string;
  options: readonly ModifierOption[];
};

export type ModifierEntry = ModifierOption; //| ModifierGroup;

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

export type AnyModifierDef = ModifierDef<readonly ModifierEntry[]>;
export type AnyModifierContext = ModifierContext<ModifierOption[]>;
export type PossibleValues = string | number | boolean;

// === DSL Helpers ===

export type ModifierPreset = {
  id?: number;
  name: string;
  modifiers: {
    id: string;
    values: Record<string, PossibleValues>;
  }[];
};
