import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Button, Form, Modal, ModalProps } from 'react-bootstrap';

export interface ISettingModal<T> {
  heading?: React.ReactNode;
  headingID?: string;
  subHeadingID?: string;
  subHeading?: React.ReactNode;
  value: T | undefined;
  close: (confirm: boolean, v?: T) => void;
  renderField: (
    value: T | undefined,
    setValue: (v?: T) => void,
    error?: string,
  ) => JSX.Element;
  modalProps?: ModalProps;
  validate?: (v: T) => boolean | undefined;
  error?: string | undefined;
}
export const SettingModal = <T,>(props: ISettingModal<T>) => {
  const {
    heading,
    headingID,
    subHeading,
    subHeadingID,
    value,
    close,
    renderField,
    modalProps,
    validate,
    error,
  } = props;

  const intl = useIntl();
  const [currentValue, setCurrentValue] = useState<T | undefined>(value);

  return (
    <Modal show onHide={() => close(false)} id="setting-dialog" {...modalProps}>
      <Form
        onSubmit={(e) => {
          close(true, currentValue);
          e.preventDefault();
        }}
      >
        <Modal.Header
          closeButton
          {...({} as React.ComponentProps<typeof Modal.Header>)}
        >
          {headingID ? <FormattedMessage id={headingID} /> : heading}
        </Modal.Header>
        <Modal.Body>
          {renderField(currentValue, setCurrentValue, error)}
          {subHeadingID ? (
            <div className="sub-heading">
              {intl.formatMessage({ id: subHeadingID })}
            </div>
          ) : subHeading ? (
            <div className="sub-heading">{subHeading}</div>
          ) : undefined}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => close(false)}>
            <FormattedMessage id="actions.cancel" />
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={
              currentValue === undefined ||
              (validate && !validate(currentValue))
            }
          >
            <FormattedMessage id="actions.confirm" />
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};
