import { AnyModifierDef, ModifierPreset, PossibleValues } from './types';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Col,
  Container,
  OverlayTrigger,
  Row,
  Tooltip,
} from 'react-bootstrap';

import { components, hooks } from '../../api';
import {
  faArrowDown,
  faArrowUp,
  faFloppyDisk,
  faInfoCircle,
  faPencil,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { DeleteModifierDialog } from '../DeleteModifierDialog';
import {
  SaveModifierPresetDialog,
  SaveModifierPresetDialogProps,
} from '../SaveModifierPresetDialog';
import { useInteractiveTools } from '../../hooks';
import { toValues } from './utils';

const { Icon } = components;
const { useToast } = hooks;

type Props<T extends AnyModifierDef = AnyModifierDef> = {
  modifier: T;
  index: number;
  total: number;
  onMove: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  onEdit: (index: number) => void;
};

export const ModifierBlock = <T extends AnyModifierDef = AnyModifierDef>({
  index,
  total,
  onMove,
  onRemove,
  onEdit,
  modifier,
}: Props<T>) => {
  const [deleting, setDeleting] = useState(false);
  const onDelete = useCallback(() => {
    setDeleting(true);
  }, [setDeleting]);
  const onConfirmDelete = useCallback(() => {
    onRemove(index);
  }, [onRemove, index]);
  const info = useMemo(() => {
    return modifier.info
      ? modifier.info(toValues(modifier as AnyModifierDef))
      : modifier.description;
  }, [modifier]);
  return (
    <>
      {deleting && (
        <DeleteModifierDialog
          onDelete={onConfirmDelete}
          onClose={setDeleting}
        />
      )}
      <Container
        className="stash-interactive-tools-modifier-block rounded-sm mb-1 pt-3 pb-3"
        fluid
      >
        <Row className="stash-interactive-tools-modifier-header  d-flex ">
          <Col>
            <h5>
              {modifier.name}
              <OverlayTrigger
                placement="top"
                overlay={
                  <Tooltip id="filter-tooltip">{modifier.description}</Tooltip>
                }
              >
                <Icon className="small-icon" icon={faInfoCircle} />
              </OverlayTrigger>
            </h5>
          </Col>
          <Col
            lg="auto"
            className="align-items-center justify-content-end d-flex "
          >
            {index != 0 ? (
              <Button
                onClick={() => onMove(index, -1)}
                className="minimal d-flex justify-content-center align-items-center"
                title="Move Up"
              >
                <Icon icon={faArrowUp} />
              </Button>
            ) : null}
            {index != total - 1 ? (
              <Button
                onClick={() => onMove(index, 1)}
                className="minimal d-flex justify-content-center align-items-center"
                title="Move Down"
              >
                <Icon icon={faArrowDown} />
              </Button>
            ) : null}

            <Button
              onClick={() => onEdit(index)}
              className="minimal d-flex justify-content-center align-items-center"
              title="Edit Modifier"
            >
              <Icon icon={faPencil} />
            </Button>
            <Button
              onClick={onDelete}
              className="minimal d-flex justify-content-center align-items-center text-danger"
              title="Delete Modifier"
            >
              <Icon icon={faTrash} />
            </Button>
          </Col>
        </Row>
        <Row className="stash-interactive-tools-modifier-block-info">
          <Col>
            <small>{info}</small>
          </Col>
        </Row>
      </Container>
    </>
  );
};

type ModifiersProps = {
  modifiers: AnyModifierDef[];

  onEdit: (modifier: AnyModifierDef) => void;
  onUpdate: (modifications: AnyModifierDef[]) => void;
};
export const ActiveModifiers = ({
  modifiers,
  onUpdate,
  onEdit,
}: ModifiersProps) => {
  const { db, preset, setPreset } = useInteractiveTools();
  const { success, error } = useToast();

  const onMove = useCallback(
    (index: number, delta: number) => {
      if (delta === 0) return;

      const increment = delta > 0 ? 1 : -1;
      const newModifications = [...modifiers];
      newModifications.splice(index, 1);
      newModifications.splice(index + increment, 0, modifiers[index]);

      onUpdate(newModifications);
    },
    [modifiers, onUpdate],
  );
  const onRemove = useCallback(
    (index: number) => {
      const newModifications = [...modifiers];
      newModifications.splice(index, 1);
      onUpdate(newModifications);
    },
    [onUpdate, modifiers],
  );
  const onInternalEdit = useCallback(
    (index: number) => {
      onEdit(modifiers[index]);
    },
    [onEdit, modifiers],
  );
  const [saving, setSaving] = useState(false);
  const onSavePreset: SaveModifierPresetDialogProps['onClose'] = useCallback(
    async (params) => {
      if (!params) {
        setSaving(false);
        return;
      }
      const { name, copy } = params;
      const record: ModifierPreset = {
        name,
        modifiers: modifiers.map((m) => ({
          id: m.id,
          values: toValues(m) as Record<string, PossibleValues>,
        })),
      };
      if (!copy && preset?.id) {
        record.id = preset.id;
      }

      try {
        record.id = await db.put('presets', record);
        console.log('Saved preset', record);
        setPreset(record);
        success(`Saved preset ${name} successfully!`);
      } catch (e) {
        error('Error saving preset: ' + e);
      }
      setSaving(false);
    },
    [preset, modifiers, db, setPreset, success, error],
  );

  return (
    <>
      {saving ? (
        <SaveModifierPresetDialog onClose={onSavePreset} value={preset?.name} />
      ) : null}
      <div className="stash-interactive-tools-modifiers">
        {modifiers.map((modification, i) => (
          <ModifierBlock
            key={i}
            index={i}
            total={modifiers.length}
            modifier={modification}
            onMove={onMove}
            onEdit={onInternalEdit}
            onRemove={onRemove}
          />
        ))}
        {modifiers.length ? (
          <div className="d-flex justify-content-end mt-2">
            <Button
              onClick={() => setSaving(true)}
              className="minimal d-flex align-items-center h-100"
              title={'Save Preset'}
            >
              <Icon icon={faFloppyDisk} />
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
};
