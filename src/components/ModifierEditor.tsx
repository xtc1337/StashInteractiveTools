import React, { useCallback, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import {
  AnyModifierDef,
  DropdownOption,
  InputOption,
  ModifierContext,
  ModifierOption,
  OptionValueType,
  PossibleValues,
  ToggleOption,
} from './modifiers';
import { toValues } from './modifiers';

type OptionChanged<T extends PossibleValues = PossibleValues> = (
  option: ModifierOption,
  value: T,
) => void;
type Props<T extends AnyModifierDef = AnyModifierDef> = {
  modifier: T;
  onChange: (modifier: T, values: ModifierContext<T['options']>) => void;
};

type InputProps<T extends OptionValueType = OptionValueType> = {
  onChange: OptionChanged<T>;
  value?: T;
  option: InputOption<string, T>;
};
const ModifierEditorInput: React.FC<InputProps> = ({
  onChange,
  option,
  value,
}) => {
  const asValue = option.lines && option.lines > 1 ? 'textarea' : 'input';
  const asNumber = typeof option.defaultValue === 'number';
  return (
    <Form.Control
      id={option.name}
      className={`text-input`}
      value={value ?? option.defaultValue}
      as={asValue}
      type={asNumber ? 'number' : 'text'}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const updatedValue = asNumber
          ? parseInt(e.currentTarget.value)
          : e.currentTarget.value;

        onChange(option, updatedValue);
      }}
    />
  );
};

type ToggleProps = {
  onChange: OptionChanged<boolean>;
  value?: boolean;
  option: ToggleOption<string>;
};
const ModifierEditorToggle: React.FC<ToggleProps> = ({
  onChange,
  option,
  value,
}) => {
  return (
    <Form.Switch
      id={option.name}
      checked={value ?? option.defaultValue}
      onChange={() => onChange(option, !value)}
    />
  );
};
type DropdownProps<T extends OptionValueType = OptionValueType> = {
  onChange: OptionChanged<T>;
  value?: T;
  option: DropdownOption<string, T>;
};
const ModifierEditorDropdown: React.FC<DropdownProps> = () => {
  return <div>Dropdown</div>;
};

const Editors = {
  input: ModifierEditorInput,
  toggle: ModifierEditorToggle,
  dropdown: ModifierEditorDropdown,
};

export const ModifierEditor = <T extends AnyModifierDef>({
  modifier,
  onChange,
}: Props<T>) => {
  const [values, setValues] = useState(() => toValues(modifier));

  const onInternalChange = useCallback(
    (option: ModifierOption, value: OptionValueType) => {
      setValues((prev) => ({ ...prev, [option.name]: value }));
    },
    [],
  );
  const Options = modifier.options.map((option) => {
    const Editor = Editors[option.type] as React.FC<{
      onChange: OptionChanged;
      option: typeof option;
      value?: PossibleValues;
    }>;
    return (
      <Form.Group key={option.name} className="mt-3">
        <h6>{option.title}</h6>
        <Editor
          option={option}
          value={values[option.name]}
          onChange={onInternalChange}
        />
      </Form.Group>
    );
  });
  const onCommitChanges = useCallback(() => {
    onChange(modifier, values);
  }, [values, onChange, modifier]);

  return (
    <>
      <div className="sub-heading font-italic">{modifier.description}</div>
      {Options}
      <Form.Group>
        <div className="d-flex justify-content-end">
          <Button
            onClick={onCommitChanges}
            className="d-flex align-items-center h-100"
            title="Save"
          >
            Save
          </Button>
        </div>
      </Form.Group>
    </>
  );
};
