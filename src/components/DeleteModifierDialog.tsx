import { useIntl } from 'react-intl';
import { ModalComponent } from './Modal';
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import React from 'react';

type DeleteModifierDialogProps = {
  onDelete: () => void;
  onClose: (confirmed: boolean) => void;
};
export const DeleteModifierDialog = ({
  onDelete,
  onClose,
}: DeleteModifierDialogProps) => {
  const intl = useIntl();
  const singularEntity = 'Modifier';

  const header = intl.formatMessage(
    { id: 'dialogs.delete_entity_title' },
    { count: 1, singularEntity },
  );
  const message = intl.formatMessage(
    { id: 'dialogs.delete_entity_simple_desc' },
    { count: 1, singularEntity },
  );
  return (
    <ModalComponent
      show
      icon={faTrashAlt}
      header={header}
      accept={{
        variant: 'danger',
        onClick: onDelete,
        text: intl.formatMessage({ id: 'actions.delete' }),
      }}
      cancel={{
        onClick: () => onClose(false),
        text: intl.formatMessage({ id: 'actions.cancel' }),
        variant: 'secondary',
      }}
    >
      <p>{message}</p>
    </ModalComponent>
  );
};
