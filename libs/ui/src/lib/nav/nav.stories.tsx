import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';
import React from 'react';
import Icon from '../widgets/Icon';
import Navbar from './Navbar';
import NavbarItem from './NavbarItem';
import NavbarMenuItems from './NavbarMenuItems';

export default {
  title: 'Nav',
};

export const navBarWithItems = () => (
  <Navbar>
    <NavbarItem path="/" title="Home" label="Home" />
    <NavbarItem path="/Foo" title="Foo" label="Foo" />
    <NavbarItem path="/Bar" title="Bar" label="Bar" />
    <NavbarItem path="/Baz" title="Baz" label="Baz" />
  </Navbar>
);

export const navBarNestedInHeader = () => (
  <Navbar>
    <NavbarItem path="/" title="Home" label="Home" />
    <NavbarItem path="/Foo" title="Foo" label="Foo" />
    <NavbarItem path="/Bar" title="Bar" label="Bar" />
    <NavbarItem path="/Baz" title="Baz" label="Baz" />
  </Navbar>
);

export const navBarWithMenu = () => (
  <Navbar>
    <NavbarItem path="/" title="Home" label="Home" />
    <NavbarMenuItems
      label="My Drop Down Menu"
      path={text('path', undefined)}
      items={[
        {
          id: '1',
          action: action('clickMenuAction'),
          title: 'Home',
          label: (
            <span>
              <Icon
                type="utility"
                icon="add"
                className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-right_x-small"
                omitContainer
              />
              Fancy Action
            </span>
          ),
        },
        { id: '1', path: '/', title: 'Home', label: 'Home' },
        { id: '2', path: '/foo', title: 'Foo', label: 'Foo', heading: 'Fancy Routes Below' },
        { id: '2', path: '/bar', title: 'Bar', label: 'Bar' },
        { id: '2', path: '/baz', title: 'Baz', label: 'Baz' },
      ]}
    />
  </Navbar>
);
