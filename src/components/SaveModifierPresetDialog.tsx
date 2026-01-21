import React, { useCallback, useState } from 'react';
import { Form } from 'react-bootstrap';
import { SettingModal } from './SettingModal';

export type SaveModifierPresetDialogProps = {
  onClose: (values?: { name: string; copy: boolean }) => void;
  value?: string;
};
/*
const SettingModel = React.lazy<
  React.ComponentType<Parameters<typeof components.SettingModel>[0]>
>(
  () =>
    //eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    import('./components/Settings/Settings'),
);  */
export const SaveModifierPresetDialog = ({
  onClose,
  value = '',
}: SaveModifierPresetDialogProps) => {
  const [copy, setCopy] = useState(false);
  const internalClose = useCallback(
    (confirm: boolean, name: string) => {
      onClose(confirm ? { name, copy } : undefined);
    },
    [onClose, copy],
  );

  return (
    <SettingModal<string>
      heading="Save Modifier Preset"
      close={internalClose}
      value={value}
      renderField={(v: string, setValue) => (
        <>
          <Form.Control
            placeholder="Enter name of preset"
            className="text-input"
            value={v}
            isValid={v.length > 1}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setValue(e.currentTarget.value)
            }
          />
          <div className="save-modifier-preset-copy">
            <Form.Label htmlFor="save-modifier-preset-copy-toggle">
              Save as copy
            </Form.Label>
            <Form.Switch
              id="save-modifier-preset-copy-toggle"
              checked={copy}
              onChange={() => setCopy(!copy)}
            />
          </div>
        </>
      )}
    />
  );
};
