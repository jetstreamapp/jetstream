import { YesNo } from '@jetstream/types';
import { Grid } from '@jetstream/ui';
import { fromDeployMetadataState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { RadioButtonItem, RadioButtonSelection } from './RadioButtonSelection';

const INCL_MANAGED_PACKAGE_RADIO_BUTTONS: RadioButtonItem<YesNo>[] = [
  {
    name: 'No',
    label: 'Unmanaged Only',
    value: 'No',
  },
  {
    name: 'Yes',
    label: 'Include Managed',
    value: 'Yes',
  },
];

export interface ManagedPackageSelectionProps {
  requireConfirmSelection?: boolean;
  onSubmit?: () => void;
}

export interface ManagedPackageSelectionRequireSelectionProps extends ManagedPackageSelectionProps {
  requireConfirmSelection: true;
  onSubmit: () => void;
}

export const ManagedPackageSelection: FunctionComponent<ManagedPackageSelectionProps | ManagedPackageSelectionRequireSelectionProps> = ({
  requireConfirmSelection,
  onSubmit,
}) => {
  const [_includeManagedPackageItems, _setIncludeManagedPackageItems] = useRecoilState<YesNo>(
    fromDeployMetadataState.includeManagedPackageItems
  );

  const [includeManagedPackageItems, setIncludeManagedPackageItems] = useState(_includeManagedPackageItems);

  useEffect(() => {
    if (!requireConfirmSelection) {
      _setIncludeManagedPackageItems(includeManagedPackageItems);
    }
  }, [includeManagedPackageItems]);

  function handleSubmit() {
    _setIncludeManagedPackageItems(includeManagedPackageItems);
    onSubmit && onSubmit();
  }

  return (
    <Fragment>
      {requireConfirmSelection && (
        <Grid align="center">
          <button className="slds-button slds-button_brand" onClick={handleSubmit}>
            Submit
          </button>
        </Grid>
      )}
      <div className="slds-align_absolute-center">
        <RadioButtonSelection
          label={'Include Managed Package Metadata'}
          items={INCL_MANAGED_PACKAGE_RADIO_BUTTONS}
          checkedValue={includeManagedPackageItems}
          labelHelp="Managed components may not allow deployment or modification"
          onChange={(value) => setIncludeManagedPackageItems(value as YesNo)}
        />
      </div>
    </Fragment>
  );
};

export default ManagedPackageSelection;
