import { components, hooks } from '../api';
import React, { PropsWithChildren } from 'react';
import * as GQL from '../generated-graphql';
import { createDebugConsole, HapticInterface } from '../utils';
import { Form } from 'react-bootstrap';

export type PluginSettingsProps = PropsWithChildren<{
  pluginID: string;
  settings: GQL.PluginSetting[];
}>;
interface IPluginSettingProps {
  pluginID: string;
  setting: GQL.PluginSetting;
  dropdownOptions?: { value: string; label: string }[];
  value: unknown;
  onChange: (value: unknown) => void;
}
type SettingsConfig = {
  defaultValue: unknown;
  dropdownOptions?: { value: string; label: string }[];
};
const SETTING_CONFIGS: Partial<Record<string, SettingsConfig>> = {
  hapticInterface: {
    defaultValue: HapticInterface.HANDY_DEFAULT,
    dropdownOptions: [
      { value: HapticInterface.HANDY_DEFAULT, label: 'Handy (default)' },
      { value: HapticInterface.HANDY_FW4, label: 'Handy FW4' },
      { value: HapticInterface.HANDY_FW4_BLUETOOTH, label: 'Handy FW4 BT' },
    ],
  },
};

const logger = createDebugConsole('PluginSettings:');

const PluginSetting: React.FC<IPluginSettingProps> = ({
  pluginID,
  setting,
  value,
  onChange,
  dropdownOptions,
}) => {
  const { BooleanSetting, StringSetting, NumberSetting, Setting } = components;

  const commonProps = {
    heading: setting.display_name ? setting.display_name : setting.name,
    id: `plugin-${pluginID}-${setting.name}`,
    subHeading: setting.description ?? undefined,
  };

  if (dropdownOptions)
    return (
      <Setting
        {...commonProps}
        value={value}
        onChange={(v: unknown) => onChange(v)}
        options={dropdownOptions}
      >
        <Form.Control
          className="input-control"
          as="select"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.currentTarget.value)}
        >
          {dropdownOptions.map(({ label, value }) => (
            <option key={label} value={value}>
              {label}
            </option>
          ))}
        </Form.Control>
      </Setting>
    );

  switch (setting.type) {
    case GQL.PluginSettingTypeEnum.Boolean:
      return (
        <BooleanSetting
          {...commonProps}
          checked={(value as boolean) ?? false}
          onChange={() => onChange(!value)}
        />
      );
    case GQL.PluginSettingTypeEnum.String:
      return (
        <StringSetting
          {...commonProps}
          value={(value as string) ?? ''}
          onChange={(v: unknown) => onChange(v)}
        />
      );
    case GQL.PluginSettingTypeEnum.Number:
      return (
        <NumberSetting
          {...commonProps}
          value={(value as number) ?? 0}
          onChange={(v: unknown) => onChange(v)}
        />
      );
  }
};

export const PluginSettings = ({ pluginID, settings }: PluginSettingsProps) => {
  const { plugins, savePluginSettings } = hooks.useSettings();
  const pluginSettings = plugins[pluginID] ?? {};

  return (
    <div className="plugin-settings">
      {settings.map((setting) => {
        let value = pluginSettings[setting.name];
        const config = SETTING_CONFIGS[setting.name];
        if (
          config?.defaultValue !== undefined &&
          (value === undefined || (typeof value == 'string' && !value))
        ) {
          value = config.defaultValue;
        }
        return (
          <PluginSetting
            key={setting.name}
            pluginID={pluginID}
            setting={setting}
            value={value}
            dropdownOptions={config?.dropdownOptions}
            onChange={(v) => {
              logger.debug(`Updating setting ${setting.name} to ${v}`);
              savePluginSettings(pluginID, {
                ...pluginSettings,
                [setting.name]: v,
              });
            }}
          />
        );
      })}
    </div>
  );
};
