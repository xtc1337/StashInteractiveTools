import React, { ChangeEventHandler, useCallback, useState } from 'react';
import { components, libraries } from '../api';
import { Button } from 'react-bootstrap';
import { faHeart as faHeartSolid } from '@fortawesome/free-solid-svg-icons';
import { faHeart } from '@fortawesome/free-regular-svg-icons';

const fullWidthProps = {
  labelProps: {
    column: true,
    sm: 3,
    xl: 12,
  },
  fieldProps: {
    sm: 9,
    xl: 12,
  },
};
const { Form, Row, Col } = libraries.Bootstrap;
const { Icon } = components;

export type ScriptEntry = {
  id: number;
  label: string;
  path: string;
  isDefault: boolean;
};
type Props = {
  disabled?: boolean;
  value?: number;

  onChange: (script: ScriptEntry) => Promise<void> | void;

  options: ScriptEntry[];
  onDefaultChanged: (script: ScriptEntry) => Promise<void>;
};

const ScriptChooser = ({
  disabled = false,
  value,
  onChange,
  options,
  onDefaultChanged,
}: Props) => {
  const [selected, setSelected] = useState(value || options[0]?.id);
  const selectedEntry = options.find((o) => o.id === selected) ?? options[0];
  const onInternalChange: ChangeEventHandler<HTMLSelectElement> = useCallback(
    async (e) => {
      const entryId = Number(e.target.value);
      setSelected(entryId);

      await onChange(options.find((o) => o.id === entryId)!);
    },
    [onChange, setSelected, options],
  );
  const onToggleDefaultInternal = useCallback(async () => {
    const updatedEntry = {
      ...selectedEntry,
      isDefault: !selectedEntry?.isDefault,
    };
    await Promise.all([onDefaultChanged(updatedEntry), onChange(updatedEntry)]);
  }, [onChange, onDefaultChanged, selectedEntry]);

  return options.length > 1 ? (
    <>
      <dt
        style={{ lineHeight: '2.5em' }}
        id="stash-interactive-tools-label-funscripts"
      >
        Scripts:
      </dt>
      <Row className="form-container" as="dd">
        <Col lg={10} xl={10}>
          <Form.Control
            as="select"
            id="stash-interactive-tools-select-funscripts"
            disabled={disabled}
            className="input-control"
            {...fullWidthProps.fieldProps}
            value={selected}
            onChange={onInternalChange}
          >
            {options.map((entry) => (
              <option value={entry.id} key={entry.label}>
                {entry.label}
              </option>
            ))}
          </Form.Control>
        </Col>
        <Col lg={1} xl={1}>
          <Button
            className="minimal d-flex align-items-center h-100"
            onClick={onToggleDefaultInternal}
          >
            <Icon icon={selectedEntry?.isDefault ? faHeartSolid : faHeart} />
          </Button>
        </Col>
      </Row>
    </>
  ) : null;
};
export default ScriptChooser;
