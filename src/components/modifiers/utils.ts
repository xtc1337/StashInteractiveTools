import {
  AnyModifierDef,
  DropdownChoice,
  DropdownOption,
  InputOption,
  ModifierContext,
  ModifierDef,
  ModifierEntry,
  ModifierGroup,
  ModifierOption,
  ModifierPreset,
  OptionValueType,
  PossibleValues,
  ToggleOption,
} from './types';

export function createModifierDef<
  const Entries extends readonly ModifierEntry[],
>(def: ModifierDef<Entries>): ModifierDef<Entries> {
  return def;
}

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

export function presetToModifierDef(
  preset: ModifierPreset,
  modifiers: AnyModifierDef[],
) {
  return preset.modifiers.map((saved) => {
    const modifier = modifiers.find(
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
