import { css } from '@emotion/react';
import { getVisibleReleases, ReleaseNote, ReleasePlatform, RELEASE_NOTES } from '@jetstream/release-notes';
import { setItemInLocalStorage } from '@jetstream/shared/ui-utils';
import { Icon, Popover, PopoverRef } from '@jetstream/ui';
import { FunctionComponent, useEffect, useMemo, useRef, useState } from 'react';

const LS_WATERMARK_KEY = 'whats_new_last_seen_date';
const DOCS_RELEASE_NOTES_URL = 'https://docs.getjetstream.app/release-notes';
const DOCS_BASE_URL = 'https://docs.getjetstream.app';
const MAX_VISIBLE_RELEASES = 5;

export interface HeaderWhatsNewPopoverProps {
  platform: ReleasePlatform;
  /**
   * Optional override for testing and for consumers that want to inject a specific release list.
   */
  releases?: ReleaseNote[];
}

function readWatermark(): string | null {
  try {
    return localStorage.getItem(LS_WATERMARK_KEY);
  } catch {
    return null;
  }
}

function writeWatermark(date: string) {
  setItemInLocalStorage(LS_WATERMARK_KEY, date);
}

function formatReleaseDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map((segment) => parseInt(segment, 10));
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function resolveDocHref(docLink: string): string {
  if (/^https?:\/\//i.test(docLink)) {
    return docLink;
  }
  return `${DOCS_BASE_URL}${docLink.startsWith('/') ? '' : '/'}${docLink}`;
}

export const HeaderWhatsNewPopover: FunctionComponent<HeaderWhatsNewPopoverProps> = ({ platform, releases }) => {
  const popoverRef = useRef<PopoverRef>(null);
  const [watermark, setWatermark] = useState<string | null>(() => readWatermark());

  const allVisible = useMemo(() => getVisibleReleases(releases ?? RELEASE_NOTES, platform), [releases, platform]);
  const visible = useMemo(() => allVisible.slice(0, MAX_VISIBLE_RELEASES), [allVisible]);
  const unseenCount = useMemo(
    () => allVisible.filter(({ date }) => !watermark || date > watermark).length,
    [allVisible, watermark],
  );
  const newestDate = allVisible[0]?.date ?? null;

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === LS_WATERMARK_KEY) {
        setWatermark(event.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  function handleMarkAllRead() {
    if (!newestDate) {
      return;
    }
    writeWatermark(newestDate);
    setWatermark(newestDate);
    popoverRef.current?.close();
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen && newestDate && newestDate !== watermark) {
      writeWatermark(newestDate);
      setWatermark(newestDate);
    }
  }

  if (visible.length === 0) {
    return null;
  }

  return (
    <Popover
      ref={popoverRef}
      placement="bottom-end"
      onChange={handleOpenChange}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" title="What's new">
            What's new
          </h2>
        </header>
      }
      content={
        <ul data-testid="whats-new-release-list">
          {visible.map((release) => {
            const isUnseen = !watermark || release.date > watermark;
            return (
              <li
                key={release.slug}
                className="slds-box slds-box_x-small slds-m-bottom_x-small"
                css={
                  isUnseen
                    ? css`
                        border-left: 3px solid #1b96ff;
                      `
                    : undefined
                }
              >
                <div className="slds-grid slds-grid_vertical-align-center slds-m-bottom_xx-small">
                  <h3 className="slds-text-heading_small slds-truncate" title={release.title}>
                    {release.title}
                  </h3>
                  {isUnseen && <span className="slds-badge slds-badge_lightest slds-m-left_x-small">New</span>}
                </div>
                <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_x-small">
                  {formatReleaseDate(release.date)}
                </p>
                <p className="slds-m-bottom_x-small">{release.summary}</p>
                {release.cta && (
                  <p className="slds-m-bottom_x-small">
                    <a href={resolveDocHref(release.cta.href)} target="_blank" rel="noreferrer">
                      {release.cta.label}
                      <Icon
                        type="utility"
                        icon="new_window"
                        className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-left_xx-small"
                        omitContainer
                      />
                    </a>
                  </p>
                )}
                <ul className="slds-list_dotted slds-m-bottom_x-small">
                  {release.highlights.map((highlight, index) => (
                    <li key={`${release.slug}-${index}`} className="slds-m-bottom_xx-small">
                      <span className="text-bold">{highlight.title}</span>
                      {highlight.description && <span>: {highlight.description}</span>}
                      {highlight.docLink && (
                        <a
                          className="slds-m-left_xx-small"
                          href={resolveDocHref(highlight.docLink)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Learn more
                          <Icon
                            type="utility"
                            icon="new_window"
                            className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-left_xx-small"
                            omitContainer
                          />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
                <a
                  href={`${DOCS_RELEASE_NOTES_URL}/${release.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="slds-text-body_small"
                >
                  Read full release notes
                  <Icon
                    type="utility"
                    icon="new_window"
                    className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-left_xx-small"
                    omitContainer
                  />
                </a>
              </li>
            );
          })}
        </ul>
      }
      footer={
        <footer className="slds-popover__footer slds-grid slds-grid_align-spread">
          <a href={DOCS_RELEASE_NOTES_URL} target="_blank" rel="noreferrer" className="slds-text-body_small">
            View all release notes
            <Icon
              type="utility"
              icon="new_window"
              className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-left_xx-small"
              omitContainer
            />
          </a>
          <button type="button" className="slds-button slds-button_reset slds-text-body_small" onClick={handleMarkAllRead}>
            Mark all as read
          </button>
        </footer>
      }
      buttonProps={{
        className:
          'slds-button slds-button_icon slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__item-action cursor-pointer',
        'aria-label': unseenCount > 0 ? `What's new — ${unseenCount} unread` : "What's new",
      }}
    >
      <span
        css={css`
          position: relative;
          display: inline-flex;
        `}
      >
        <Icon type="utility" icon="notification" className="slds-button__icon slds-global-header__icon" omitContainer />
        {unseenCount > 0 && (
          <span
            data-testid="whats-new-badge"
            aria-hidden="true"
            css={css`
              position: absolute;
              top: -2px;
              right: -2px;
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #1b96ff;
              box-shadow: 0 0 0 2px #ffffff;
            `}
          />
        )}
      </span>
    </Popover>
  );
};

export default HeaderWhatsNewPopover;
