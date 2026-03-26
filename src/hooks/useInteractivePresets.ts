import { useCallback, useState } from 'react';
import { ModifierPreset } from '../components/modifiers';
import { DB } from '../utils/db';

export const useInteractivePresets = () => {
  const [presets, updatePresets] = useState<ModifierPreset[]>([]);
  const [preset, setPreset] = useState<ModifierPreset | null>(null);
  const savePresetInternal = useCallback(
    (updatedPreset: ModifierPreset | null, toDelete = false) => {
      setPreset(toDelete ? null : updatedPreset);
      if (updatedPreset) {
        const commitChanges = () => {
          updatePresets((savedPresets) => {
            const presetIndex = savedPresets.findIndex(
              (p) => p.id === updatedPreset.id,
            );

            if (toDelete) {
              if (presetIndex !== -1) {
                savedPresets.splice(presetIndex, 1);
              }
              return [...savedPresets];
            } else if (presetIndex !== -1) {
              savedPresets[presetIndex] = updatedPreset;
            } else {
              savedPresets.push(updatedPreset);
            }

            return [...savedPresets];
          });
        };
        if (toDelete && updatedPreset.id) {
          DB.delete('presets', updatedPreset.id).then(commitChanges);
        } else {
          commitChanges();
        }
      }
    },
    [setPreset, updatePresets],
  );
  return {
    presets,
    preset,
    updatePresets,
    setPreset: savePresetInternal,
  };
};
