import { Input, Modal } from '@jetstream/ui';
import capitalize from 'lodash/capitalize';
import { Fragment, FunctionComponent, useState } from 'react';
import { create, InstanceProps } from 'react-modal-promise';

type ResolveOptions = { cancelled: false; teamName: string } | { cancelled: true; teamName?: never };
type CommonModalProps = InstanceProps<ResolveOptions, never>;

export interface TeamNameModalProps extends CommonModalProps {
  isOpen: boolean;
  email: string;
  onResolve: (options: ResolveOptions) => void;
}
const TeamNameModal: FunctionComponent<TeamNameModalProps> = ({ isOpen, email, onResolve }) => {
  const [teamName, setTeamName] = useState(() => capitalize(email.split('@')[1].split('.')[0]));
  if (!isOpen) {
    return null;
  }

  const submitDisabled = !teamName || teamName.length < 1 || teamName.length > 255;

  return (
    <Modal
      header="Choose a team name"
      closeOnEsc={false}
      closeOnBackdropClick={false}
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onResolve({ cancelled: true })}>
            Cancel
          </button>
          <button
            className="slds-button slds-button_brand"
            disabled={submitDisabled}
            onClick={() => onResolve({ cancelled: false, teamName: teamName.trim() })}
          >
            Continue
          </button>
        </Fragment>
      }
      onClose={() => onResolve({ cancelled: true })}
    >
      <Input label="Team Name" id="team-name">
        <input
          id="team-name"
          className="slds-input"
          required
          value={teamName}
          minLength={1}
          maxLength={255}
          autoComplete="off"
          onChange={(event) => setTeamName(event.target.value)}
        />
      </Input>
    </Modal>
  );
};

export const TeamNameModalPromise = create<TeamNameModalProps, ResolveOptions>(TeamNameModal);
