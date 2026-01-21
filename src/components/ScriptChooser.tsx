import React, { ChangeEventHandler, useCallback, useState } from 'react';
import { libraries } from '../api';

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

export type Script = {
  label: string;
  path: string;
};
type Props = {
  value: string;
  defaultScript: string;
  onChange: (script: string) => Promise<void> | void;

  options: Script[];
};

const ScriptChooser = ({ value, onChange, options, defaultScript }: Props) => {
  const [selected, setSelected] = useState(value || defaultScript);
  const onInternalChange: ChangeEventHandler<HTMLSelectElement> = useCallback(
    async (e) => {
      setSelected(e.target.value);
      await onChange(e.target.value);
    },
    [onChange, setSelected],
  );
  return options.length > 1 ? (
    <>
      <dt
        style={{ lineHeight: '2.5em' }}
        id="stash-interactive-tools-label-funscripts"
      >
        Scripts:
      </dt>
      <Row className="form-container" as="dd">
        <Col lg={11} xl={11}>
          <Form.Control
            as="select"
            id="stash-interactive-tools-select-funscripts"
            className="input-control"
            {...fullWidthProps.fieldProps}
            value={selected}
            onChange={onInternalChange}
          >
            {options.map((entry) => (
              <option value={entry.path} key={entry.label}>
                {entry.label}
              </option>
            ))}
          </Form.Control>
        </Col>
      </Row>
    </>
  ) : null;
};
export default ScriptChooser;
