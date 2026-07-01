import { css } from '@emotion/react';
import { FunctionComponent, useLayoutEffect, useRef, useState } from 'react';
import { NavbarItem, NavbarItemProps } from './NavbarItem';
import { NavbarItemWaffle, NavbarItemWaffleProps } from './NavbarItemWaffle';
import { NavbarMenuItem, NavbarMenuItems, NavbarMenuItemsProps } from './NavbarMenuItems';

export type NavbarItemConfig =
  | ({ id: string; type: 'waffle' } & NavbarItemWaffleProps)
  | ({ id: string; type: 'item' } & NavbarItemProps)
  | ({ id: string; type: 'menu' } & NavbarMenuItemsProps);

export interface NavbarProps {
  items: NavbarItemConfig[];
}

function renderNavbarItem(config: NavbarItemConfig) {
  switch (config.type) {
    case 'waffle':
      return <NavbarItemWaffle key={config.id} {...config} />;
    case 'item':
      return <NavbarItem key={config.id} {...config} />;
    case 'menu':
      return <NavbarMenuItems key={config.id} {...config} />;
    default:
      return null;
  }
}

/**
 * Flatten the items that no longer fit into a single list for the "More" dropdown. Dropdown menus
 * keep their label as a section heading, while plain items become standalone links - matching the
 * Salesforce overflow pattern where nested menus are flattened into headed sections.
 */
function buildOverflowMenuItems(overflowConfigs: NavbarItemConfig[]): NavbarMenuItem[] {
  const overflowMenuItems: NavbarMenuItem[] = [];
  overflowConfigs.forEach((config) => {
    switch (config.type) {
      case 'menu':
        config.items.forEach((item, index) => {
          overflowMenuItems.push(index === 0 ? { ...item, heading: config.label } : item);
        });
        break;
      case 'item':
        overflowMenuItems.push({
          id: config.id,
          path: config.path,
          search: config.search,
          title: config.title,
          label: config.label,
        });
        break;
      // 'waffle' is always kept visible, so it never reaches the overflow menu
    }
  });
  return overflowMenuItems;
}

function computeVisibleCount(itemWidths: number[], moreWidth: number, availableWidth: number): number {
  const totalWidth = itemWidths.reduce((total, width) => total + width, 0);
  if (totalWidth <= availableWidth) {
    return itemWidths.length;
  }
  // Everything no longer fits, so reserve room for the "More" trigger and fit as many leading items as possible
  let usedWidth = moreWidth;
  let visibleCount = 0;
  for (const width of itemWidths) {
    if (usedWidth + width > availableWidth) {
      break;
    }
    usedWidth += width;
    visibleCount += 1;
  }
  // Always keep at least the first item (the Home/waffle) visible
  return Math.max(1, visibleCount);
}

/**
 * Responsive navigation bar that mirrors the Salesforce context bar: items render inline until they no
 * longer fit the available width, at which point the overflow collapses into a "More" dropdown.
 *
 * Widths are read from a hidden, inert copy of the full item list so that each item's natural width is
 * always known - even while it is collapsed into the overflow menu - which keeps the calculation stable
 * and avoids the layout feedback loop of measuring the same elements we are adding/removing.
 */
export const Navbar: FunctionComponent<NavbarProps> = ({ items }) => {
  const containerRef = useRef<HTMLUListElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) {
      return;
    }

    const recompute = () => {
      // The measurement row renders every item followed by the "More" trigger, so the trailing child is "More"
      const measuredChildren = Array.from(measure.children) as HTMLElement[];
      if (measuredChildren.length === 0) {
        return;
      }
      const moreWidth = measuredChildren[measuredChildren.length - 1].offsetWidth;
      const itemWidths = measuredChildren.slice(0, items.length).map((element) => element.offsetWidth);
      setVisibleCount(computeVisibleCount(itemWidths, moreWidth, container.clientWidth));
    };

    const resizeObserver = new ResizeObserver(recompute);
    resizeObserver.observe(container);
    recompute();
    return () => resizeObserver.disconnect();
  }, [items]);

  const hasOverflow = visibleCount < items.length;
  const visibleItems = hasOverflow ? items.slice(0, visibleCount) : items;
  const overflowMenuItems = hasOverflow ? buildOverflowMenuItems(items.slice(visibleCount)) : [];

  return (
    <div className="slds-context-bar">
      <nav
        className="slds-context-bar__secondary"
        role="navigation"
        css={css`
          position: relative;
        `}
      >
        <ul
          className="slds-grid"
          ref={containerRef}
          css={css`
            flex: 1 1 auto;
            min-width: 0;
          `}
        >
          {visibleItems.map(renderNavbarItem)}
          {hasOverflow && <NavbarMenuItems label="More" items={overflowMenuItems} />}
        </ul>

        {/* Hidden, inert copy of the full list used only to measure each item's natural width */}
        <div
          aria-hidden
          css={css`
            position: absolute;
            inset: 0;
            overflow: hidden;
            visibility: hidden;
            pointer-events: none;
          `}
        >
          <ul
            className="slds-grid"
            ref={measureRef}
            inert
            css={css`
              position: absolute;
              top: 0;
              left: 0;
            `}
          >
            {items.map(renderNavbarItem)}
            <NavbarMenuItems label="More" items={[]} />
          </ul>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
