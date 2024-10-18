import { IconType } from '@jetstream/icon-factory';
import { action } from '@storybook/addon-actions';
import { boolean, number, select, text } from '@storybook/addon-knobs';
import uniqueId from 'lodash/uniqueId';
import Logo from '../../assets/jetstream-logo-v1-200w.png';
import AutoFullHeightContainer from './AutoFullHeightContainer';
import Header from './Header';
import Page from './Page';
import PageHeader from './page-header/PageHeader';
import PageHeaderActions from './page-header/PageHeaderActions';
import PageHeaderRow from './page-header/PageHeaderRow';
import PageHeaderTitle from './page-header/PageHeaderTitle';
import Panel from './Panel';

export default {
  title: 'Layout',
};

export const autoFullHeightContainer = () => (
  <AutoFullHeightContainer
    className={text('className', '')}
    bottomBuffer={number('bottomBuffer', 0)}
    fillHeight={boolean('fillHeight', true)}
  >
    <div>
      {new Array(100).fill(null, 0, 100).map((item, i) => (
        <div>item {i}</div>
      ))}
    </div>
  </AutoFullHeightContainer>
);

export const header = () => (
  <Header
    logo={Logo}
    userProfile={{
      id: '99c4e2fe-65e9-4255-a860-700426b4a5b2',
      userId: 'jetstream|5fa5e9b82156490068cdc895',
      name: 'paustint@gmail.com',
      picture: null,
      email: 'paustint@gmail.com',
      emailVerified: false,
      preferences: {
        skipFrontdoorLogin: false,
      },
    }}
    userMenuItems={[
      { id: uniqueId('icon'), value: 'item 1', icon: { type: 'utility', icon: 'help' } },
      { id: uniqueId('icon'), value: 'item 2', icon: { type: 'custom', icon: 'custom34' } },
      { id: uniqueId('icon'), value: 'item 3', icon: { type: 'action', icon: 'apex' } },
      { id: uniqueId('icon'), value: 'item 4', icon: { type: 'standard', icon: 'delegated_account' } },
    ]}
    onUserMenuItemSelected={action('onUserMenuItemSelected')}
  >
    <div>This is the content within the header</div>
  </Header>
);

export const panel = () => (
  <Panel
    heading={text('heading', 'My Panel Heading')}
    isOpen={boolean('isOpen', true)}
    size={select(
      'size',
      {
        sm: 'sm',
        md: 'md',
        lg: 'lg',
        xl: 'xl',
        full: 'full',
      },
      'lg'
    )}
    fullHeight={boolean('fullHeight', true)}
    position={select(
      'position',
      {
        left: 'left',
        right: 'right',
      },
      'left'
    )}
    onClosed={action('onClosed')}
  >
    <div>This is the content within the panel</div>
  </Panel>
);

export const page = () => (
  <Page>
    <PageHeader>
      <PageHeaderRow>
        <PageHeaderTitle
          icon={{ type: text('icon.Type', 'standard') as IconType, icon: text('icon.icon', 'opportunity') as any }}
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
          <button className="slds-button slds-button_neutral">Button</button>
        </PageHeaderActions>
      </PageHeaderRow>
    </PageHeader>
    <div style={{ height: 500 }}>Page content goes here - be sure to set height to 100%</div>
  </Page>
);
