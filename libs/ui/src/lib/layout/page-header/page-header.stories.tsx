import { select, text } from '@storybook/addon-knobs';
import React from 'react';
import { IconType } from '../../../../../types/src';
import Icon from '../../widgets/Icon';
import PageHeader from './PageHeader';
import PageHeaderActions from './PageHeaderActions';
import PageHeaderMetadataCol from './PageHeaderMetadataCol';
import PageHeaderRow from './PageHeaderRow';
import PageHeaderTitle from './PageHeaderTitle';

export default {
  title: 'Page Header',
  component: PageHeader,
};

export const base = () => (
  <PageHeader>
    <PageHeaderRow>
      <PageHeaderTitle
        icon={{ type: text('icon.Type', 'standard') as IconType, icon: text('icon.icon', 'opportunity') }}
        label="Query"
        metaLabel="Do a really fancy query"
      />
      <PageHeaderActions
        colType="actions"
        buttonType={select(
          '1st Row buttonType',
          {
            separate: 'separate',
            listGroup: 'list-group',
          },
          'list-group'
        )}
      >
        <button className="slds-button slds-button_neutral">Button 1</button>
        <button className="slds-button slds-button_neutral">Button 2</button>
        <button className="slds-button slds-button_neutral">Button 3</button>
      </PageHeaderActions>
    </PageHeaderRow>
    <PageHeaderRow>
      <PageHeaderMetadataCol>Put some optional metadata here</PageHeaderMetadataCol>
      <PageHeaderActions
        colType="actions"
        buttonType={select(
          '2nd Row buttonType',
          {
            separate: 'separate',
            listGroup: 'list-group',
          },
          'separate'
        )}
      >
        <button className="slds-button slds-button_icon slds-button_icon-border-filled" title="Refresh List">
          <Icon type="utility" icon="refresh" description="Refresh List" className="slds-button__icon" omitContainer />
        </button>
        <button className="slds-button slds-button_icon slds-button_icon-border-filled" title="Charts">
          <Icon type="utility" icon="chart" description="Charts" className="slds-button__icon" omitContainer />
        </button>
      </PageHeaderActions>
    </PageHeaderRow>
  </PageHeader>
);

export const withNoTitleMeta = () => (
  <PageHeader>
    <PageHeaderRow>
      <PageHeaderTitle icon={{ type: text('icon.Type', 'standard') as IconType, icon: text('icon.icon', 'opportunity') }} label="Query" />
      <PageHeaderActions
        colType="actions"
        buttonType={select(
          '1st Row buttonType',
          {
            separate: 'separate',
            listGroup: 'list-group',
          },
          'separate'
        )}
      >
        <button className="slds-button slds-button_neutral">Button 1</button>
        <button className="slds-button slds-button_neutral">Button 2</button>
        <button className="slds-button slds-button_neutral">Button 3</button>
      </PageHeaderActions>
    </PageHeaderRow>
    <PageHeaderRow>
      <PageHeaderMetadataCol>10 items • Updated 13 minutes ago</PageHeaderMetadataCol>
      <PageHeaderActions
        colType="actions"
        buttonType={select(
          '2nd Row buttonType',
          {
            separate: 'separate',
            listGroup: 'list-group',
          },
          'list-group'
        )}
      >
        <button className="slds-button slds-button_icon slds-button_icon-border-filled" title="Refresh List">
          <Icon type="utility" icon="refresh" description="Refresh List" className="slds-button__icon" omitContainer />
        </button>
        <button className="slds-button slds-button_icon slds-button_icon-border-filled" title="Charts">
          <Icon type="utility" icon="chart" description="Charts" className="slds-button__icon" omitContainer />
        </button>
      </PageHeaderActions>
    </PageHeaderRow>
  </PageHeader>
);

export const withNoMeta = () => (
  <PageHeader>
    <PageHeaderRow>
      <PageHeaderTitle icon={{ type: text('icon.Type', 'standard') as IconType, icon: text('icon.icon', 'opportunity') }} label="Query" />
      <PageHeaderActions
        colType="actions"
        buttonType={select(
          '1st Row buttonType',
          {
            separate: 'separate',
            listGroup: 'list-group',
          },
          'separate'
        )}
      >
        <button className="slds-button slds-button_neutral">Button 1</button>
        <button className="slds-button slds-button_neutral">Button 2</button>
        <button className="slds-button slds-button_neutral">Button 3</button>
      </PageHeaderActions>
    </PageHeaderRow>
    <PageHeaderRow>
      <PageHeaderMetadataCol />
      <PageHeaderActions
        colType="actions"
        buttonType={select(
          '2nd Row buttonType',
          {
            separate: 'separate',
            listGroup: 'list-group',
          },
          'list-group'
        )}
      >
        <button className="slds-button slds-button_icon slds-button_icon-border-filled" title="Refresh List">
          <Icon type="utility" icon="refresh" description="Refresh List" className="slds-button__icon" omitContainer />
        </button>
        <button className="slds-button slds-button_icon slds-button_icon-border-filled" title="Charts">
          <Icon type="utility" icon="chart" description="Charts" className="slds-button__icon" omitContainer />
        </button>
      </PageHeaderActions>
    </PageHeaderRow>
  </PageHeader>
);

export const singleRow = () => (
  <PageHeader>
    <PageHeaderRow>
      <PageHeaderTitle
        icon={{ type: text('icon.Type', 'standard') as IconType, icon: text('icon.icon', 'opportunity') }}
        label="Query"
        metaLabel="Do a really fancy query"
      />
      <PageHeaderActions
        colType="actions"
        buttonType={select(
          '1st Row buttonType',
          {
            separate: 'separate',
            listGroup: 'list-group',
          },
          'list-group'
        )}
      >
        <button className="slds-button slds-button_neutral">Button 1</button>
        <button className="slds-button slds-button_neutral">Button 2</button>
        <button className="slds-button slds-button_neutral">Button 3</button>
      </PageHeaderActions>
    </PageHeaderRow>
  </PageHeader>
);
