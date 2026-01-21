import { ModalComponent } from './Modal';
import {
  faBookmark,
  faShare,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';

import React from 'react';
import { ModifierPreset } from './modifiers';
import { useIntl } from 'react-intl';
import { Button, Col, Container, Row } from 'react-bootstrap';
import { components } from '../api';

const { Icon } = components;
type ViewSavedPresetsDialogProps = {
  presets: ModifierPreset[];
  onClose: (preset?: ModifierPreset, toDelete?: boolean) => void;
};

export const ManagePresetsDialog = ({
  presets,
  onClose,
}: ViewSavedPresetsDialogProps) => {
  const intl = useIntl();
  return (
    <ModalComponent
      show
      icon={faBookmark}
      header={'Manage Presets'}
      accept={{
        onClick: () => onClose(),
      }}
      cancel={{
        onClick: () => onClose(),
        text: intl.formatMessage({ id: 'actions.cancel' }),
        variant: 'secondary',
      }}
    >
      <Container
        className="stash-interactive-tools-modifier-block rounded-sm mb-1 pt-3 pb-3"
        fluid
      >
        {presets.map((preset) => (
          <Row key={preset.id}>
            <Col>
              <span>{preset.name}</span>
            </Col>
            <Col xs="auto">
              <Button
                className="minimal d-flex align-items-center h-100"
                title="Apply Preset"
                onClick={() => onClose(preset)}
              >
                <Icon icon={faShare} />
              </Button>
            </Col>
            <Col xs="auto">
              <Button
                className="minimal d-flex align-items-center h-100"
                title="Delete Preset"
                onClick={() => onClose(preset, true)}
              >
                <Icon icon={faTrash} style={{ color: 'var(--danger)' }} />
              </Button>
            </Col>
          </Row>
        ))}
      </Container>
    </ModalComponent>
  );
};
