import { components } from '../api';
import { Button, Form, Row, Col } from 'react-bootstrap';
import {
  faPencil,
  faBookmark,
  faPowerOff,
} from '@fortawesome/free-solid-svg-icons';
import {
  AnyModifierContext,
  AnyModifierDef,
  ModifierPreset,
  MODIFIERS,
  presetToModifierDef,
} from './modifiers';
import React, { ChangeEventHandler, useCallback, useState } from 'react';
import { ModifierEditor } from './ModifierEditor';
import { ActiveModifiers } from './modifiers/block';
import { useInteractiveTools } from '../hooks';
import { ManagePresetsDialog } from './ManagePresetsDialog';

const { Icon } = components;

export const ModifyScript = () => {
  const [add, setAdd] = useState(false);
  const [managePresets, setManagePresets] = useState(false);
  const onAddModification = useCallback(() => {
    setAdd(true);
  }, [setAdd]);
  const onManagePresets = useCallback(() => {
    setManagePresets(true);
  }, [setManagePresets]);
  const [currentModifier, setCurrentModifier] = useState<AnyModifierDef | null>(
    null,
  );

  const [activeModifications, setActiveModifications] = useState<
    AnyModifierDef[]
  >([]);

  const {
    updateModifiers,
    presets,
    preset: activePreset,
    setPreset,
  } = useInteractiveTools();
  const onCurrentModifierChanged: ChangeEventHandler<HTMLSelectElement> =
    useCallback(
      (e) => {
        const modifier = MODIFIERS.find(
          (m) => m.id === e.target.value,
        ) as unknown as AnyModifierDef;
        setCurrentModifier(modifier ? { ...modifier } : null);
      },
      [setCurrentModifier],
    );
  const onUpdateModifiers = useCallback(
    (modifiers: AnyModifierDef[]) => {
      setActiveModifications(modifiers);
      updateModifiers(modifiers);
    },
    [updateModifiers],
  );
  const onModifierChanged = useCallback(
    <T extends AnyModifierDef, O extends AnyModifierContext>(
      modifier: T,
      values: O,
    ) => {
      const updated = [...activeModifications];
      const foundIndex = updated.findIndex((m) => m === modifier);
      const updatedModifier = {
        ...modifier,

        options: modifier.options.map((option) => {
          return {
            ...option,
            value: values[option.name] ?? option.defaultValue,
          };
        }),
      };
      if (foundIndex >= 0) {
        updated[foundIndex] = updatedModifier;
      } else {
        updated.push(updatedModifier);
      }

      setAdd(false);
      setCurrentModifier(null);
      onUpdateModifiers(updated);
    },
    [activeModifications, onUpdateModifiers],
  );
  const onCloseManagePresets = useCallback(
    (preset?: ModifierPreset, toDelete?: boolean) => {
      if (preset) {
        setPreset(preset, toDelete);
        if (!toDelete) {
          onUpdateModifiers(presetToModifierDef(preset));
        }
      }
      setManagePresets(false);
    },
    [setPreset, onUpdateModifiers, setManagePresets],
  );
  const onRemoveCurrentPreset = useCallback(() => {
    setPreset(null);
    onUpdateModifiers([]);
  }, [setPreset, onUpdateModifiers]);

  return (
    <>
      {managePresets ? (
        <ManagePresetsDialog presets={presets} onClose={onCloseManagePresets} />
      ) : null}
      <div className="container stash-interactive-tools-modify">
        <Form.Group>
          <Row className="d-flex justify-content-between align-items-center">
            <Col xs="auto">
              <Button
                disabled={!!currentModifier}
                onClick={onAddModification}
                className="minimal d-flex align-items-center h-100"
                title="Add modifier"
              >
                <Icon icon={faPencil} />
              </Button>
            </Col>
            <Col className="d-flex justify-content-center align-items-center">
              {activePreset ? (
                <>
                  <Icon icon={faBookmark} />
                  <span>{activePreset.name}</span>
                  <Button
                    onClick={onRemoveCurrentPreset}
                    id="remove-modifier-preset"
                    className="minimal d-flex align-items-center h-100"
                    title="Remove Preset"
                  >
                    <Icon icon={faPowerOff} />
                  </Button>
                </>
              ) : null}
            </Col>
            <Col xs="auto">
              {presets.length ? (
                <Button
                  onClick={onManagePresets}
                  className="minimal d-flex align-items-center h-100"
                  title="Manage Presets"
                >
                  <Icon icon={faBookmark} />
                </Button>
              ) : null}
            </Col>
          </Row>
        </Form.Group>

        {add && (
          <Form.Group>
            <Form.Control
              as="select"
              id="stash-interactive-tools-select-modifier"
              className="input-control"
              value={currentModifier?.id}
              onChange={onCurrentModifierChanged}
            >
              <option value="">Select Modification</option>
              {MODIFIERS.map((modifier) => (
                <option value={modifier.id} key={modifier.id}>
                  {modifier.name}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
        )}
        {currentModifier && (
          <ModifierEditor
            modifier={currentModifier}
            onChange={onModifierChanged}
          />
        )}
        {!currentModifier && activeModifications.length > 0 && (
          <ActiveModifiers
            onEdit={setCurrentModifier}
            modifiers={activeModifications}
            onUpdate={onUpdateModifiers}
          />
        )}
      </div>
    </>
  );
};
