import { css } from '@emotion/react';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../widgets/Icon';

export interface WindowsMenuBarProps {
  onMenuAction: (action: string) => void;
}

interface MenuItem {
  label?: string;
  accelerator?: string;
  action?: string;
  type?: 'separator';
  submenu?: MenuItem[];
}

const menuStructure: MenuItem[] = [
  {
    label: 'File',
    submenu: [
      { label: 'New Window', accelerator: 'Ctrl+N', action: 'new-window' },
      { type: 'separator' },
      { label: 'Exit', action: 'quit' },
    ],
  },
  {
    label: 'View',
    submenu: [
      { label: 'Reload', accelerator: 'Ctrl+R', action: 'reload' },
      { label: 'Force Reload', accelerator: 'Ctrl+Shift+R', action: 'force-reload' },
      { type: 'separator' },
      { label: 'Reset Zoom', accelerator: 'Ctrl+0', action: 'reset-zoom' },
      { label: 'Zoom In', accelerator: 'Ctrl+Plus', action: 'zoom-in' },
      { label: 'Zoom Out', accelerator: 'Ctrl+-', action: 'zoom-out' },
    ],
  },
  {
    label: 'Help',
    submenu: [
      { label: 'Documentation', action: 'documentation' },
      { label: 'Report an issue', action: 'report-issue' },
      { label: 'Email us', action: 'email-support' },
    ],
  },
];

export const WindowsMenuBar: FunctionComponent<WindowsMenuBarProps> = ({ onMenuAction }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      // Auto-collapse menu when window is small
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
        setActiveMenu(null);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMenuClick = useCallback((index: number) => {
    setActiveMenu((prev) => (prev === index ? null : index));
  }, []);

  const handleMenuItemClick = useCallback(
    (action?: string) => {
      if (action) {
        onMenuAction(action);
      }
      setActiveMenu(null);
    },
    [onMenuAction]
  );

  const handleMenuToggle = useCallback(() => {
    setIsCollapsed((prev) => !prev);
    setActiveMenu(null);
  }, []);

  const shouldCollapse = windowWidth < 768;

  return (
    <div
      ref={menuRef}
      className="windows-menu-bar non-draggable"
      css={css`
        display: flex;
        align-items: center;
        height: 30px;
        background-color: transparent;
        color: #d7d7d7;
        font-size: 12px;
        user-select: none;
        -webkit-app-region: no-drag;
        z-index: 1000;
        position: relative;
        margin-left: 8px;
      `}
    >
      {shouldCollapse || isCollapsed ? (
        <button
          className="menu-hamburger"
          onClick={handleMenuToggle}
          css={css`
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 100%;
            background: transparent;
            border: none;
            color: inherit;
            cursor: pointer;
            padding: 0 16px;
            &:hover {
              background-color: rgba(255, 255, 255, 0.1);
            }
          `}
        >
          <Icon type="utility" icon="add" className="slds-icon slds-icon_xx-small" />
        </button>
      ) : (
        <div
          className="menu-items"
          css={css`
            display: flex;
            height: 100%;
          `}
        >
          {menuStructure.map((menu, index) => (
            <div
              key={menu.label}
              className="menu-item"
              css={css`
                position: relative;
              `}
            >
              <button
                className="menu-button"
                onClick={() => handleMenuClick(index)}
                css={css`
                  height: 100%;
                  padding: 0 12px;
                  background: transparent;
                  border: none;
                  color: inherit;
                  cursor: pointer;
                  font-size: 12px;
                  &:hover {
                    background-color: rgba(255, 255, 255, 0.1);
                  }
                  ${activeMenu === index &&
                  css`
                    background-color: rgba(255, 255, 255, 0.1);
                  `}
                `}
              >
                {menu.label}
              </button>
              {activeMenu === index && menu.submenu && (
                <div
                  className="menu-dropdown"
                  css={css`
                    position: absolute;
                    top: 100%;
                    left: 0;
                    min-width: 220px;
                    background-color: #252526;
                    border: 1px solid #454545;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                    z-index: 1001;
                  `}
                >
                  {menu.submenu.map((item, itemIndex) =>
                    item.type === 'separator' ? (
                      <div
                        key={itemIndex}
                        css={css`
                          height: 1px;
                          background-color: #454545;
                          margin: 4px 0;
                        `}
                      />
                    ) : (
                      <button
                        key={item.label}
                        className="menu-dropdown-item"
                        onClick={() => handleMenuItemClick(item.action)}
                        css={css`
                          display: flex;
                          justify-content: space-between;
                          align-items: center;
                          width: 100%;
                          padding: 6px 16px;
                          background: transparent;
                          border: none;
                          color: #cccccc;
                          cursor: pointer;
                          text-align: left;
                          font-size: 12px;
                          &:hover {
                            background-color: #094771;
                            color: #ffffff;
                          }
                        `}
                      >
                        <span>{item.label}</span>
                        {item.accelerator && (
                          <span
                            css={css`
                              opacity: 0.6;
                              font-size: 11px;
                              margin-left: 32px;
                            `}
                          >
                            {item.accelerator}
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!shouldCollapse && isCollapsed && (
        <div
          className="menu-dropdown"
          css={css`
            position: absolute;
            top: 100%;
            left: 0;
            min-width: 150px;
            background-color: #252526;
            border: 1px solid #454545;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
            z-index: 1001;
          `}
        >
          {menuStructure.map((menu, index) => (
            <button
              key={menu.label}
              className="menu-dropdown-item"
              onClick={() => {
                setIsCollapsed(false);
                handleMenuClick(index);
              }}
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
                padding: 6px 16px;
                background: transparent;
                border: none;
                color: #cccccc;
                cursor: pointer;
                text-align: left;
                font-size: 12px;
                &:hover {
                  background-color: #094771;
                  color: #ffffff;
                }
              `}
            >
              <span>{menu.label}</span>
              <Icon type="utility" icon="chevronright" className="slds-icon slds-icon_xx-small" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default WindowsMenuBar;
