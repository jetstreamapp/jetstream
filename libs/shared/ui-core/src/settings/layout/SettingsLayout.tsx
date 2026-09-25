import { css } from '@emotion/react';
import classNames from 'classnames';
import { MouseEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

export interface SettingsNavItem {
  /** Must match the `id` of a rendered `SettingsSection` */
  id: string;
  label: string;
}

export interface SettingsLayoutProps {
  /** Sections in page order, used to build the side navigation */
  sections: SettingsNavItem[];
  children: ReactNode;
}

/** A section counts as "current" once its heading scrolls within this distance of the top of the scroll container */
const ACTIVE_SECTION_OFFSET_PX = 96;

/**
 * Input that means the user is scrolling themselves, which releases a section picked from the navigation.
 * `pointerdown` covers dragging the scroll bar, which scrolls without any wheel or key input.
 */
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

const layoutCss = css`
  display: grid;
  grid-template-columns: 12.5rem minmax(0, 1fr);
  gap: 2rem;
  max-width: 68rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;

  @media (max-width: 48em) {
    grid-template-columns: minmax(0, 1fr);
    padding-top: 1rem;
  }
`;

const navCss = css`
  position: sticky;
  top: 1.5rem;
  align-self: start;

  @media (max-width: 48em) {
    display: none;
  }
`;

const contentCss = css`
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  max-width: 52rem;
  min-width: 0;
`;

function getScrollParent(element: HTMLElement | null): HTMLElement | null {
  let current = element?.parentElement ?? null;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function scrollToSection(id: string, behavior: ScrollBehavior) {
  const section = document.getElementById(id);
  if (!section) {
    return;
  }
  section.scrollIntoView({ behavior, block: 'start' });
  // Move focus along with the scroll so keyboard and screen reader users land in the section they picked
  section.focus({ preventScroll: true });
}

/**
 * Two column settings page: a sticky list of sections that tracks the scroll position, next to the
 * sections themselves. Every section stays rendered on one page so everything can be scanned (and found
 * with the browser's find) without guessing which tab it lives under.
 */
export const SettingsLayout = ({ sections, children }: SettingsLayoutProps) => {
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  // Set when a section is picked from the navigation - holds that section as active while the smooth
  // scroll runs, and afterwards if a short section near the bottom can never reach the top of the page
  const pickedSectionIdRef = useRef<string | null>(null);
  const [activeId, setActiveId] = useState(sections[0]?.id);

  // Callers usually pass an inline array, so the effects key on the ids rather than the array identity
  const sectionIdsKey = sections.map(({ id }) => id).join('|');
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const scrollParent = getScrollParent(rootRef.current);
    if (!scrollParent) {
      return;
    }
    const sectionIds = sectionIdsKey.split('|');
    let animationFrame = 0;

    function updateActiveSection() {
      animationFrame = 0;
      if (!scrollParent) {
        return;
      }
      if (pickedSectionIdRef.current) {
        setActiveId(pickedSectionIdRef.current);
        return;
      }
      const containerTop = scrollParent.getBoundingClientRect().top;
      const isScrolledToBottom =
        scrollParent.scrollTop > 0 && scrollParent.scrollTop + scrollParent.clientHeight >= scrollParent.scrollHeight - 2;
      if (isScrolledToBottom) {
        setActiveId(sectionIds[sectionIds.length - 1]);
        return;
      }
      let currentId = sectionIds[0];
      for (const id of sectionIds) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top - containerTop <= ACTIVE_SECTION_OFFSET_PX) {
          currentId = id;
        }
      }
      setActiveId(currentId);
    }

    function handleScroll() {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(updateActiveSection);
      }
    }

    function releasePickedSection() {
      pickedSectionIdRef.current = null;
    }

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    USER_SCROLL_EVENTS.forEach((eventName) => scrollParent.addEventListener(eventName, releasePickedSection, { passive: true }));
    updateActiveSection();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      scrollParent.removeEventListener('scroll', handleScroll);
      USER_SCROLL_EVENTS.forEach((eventName) => scrollParent.removeEventListener(eventName, releasePickedSection));
    };
  }, [sectionIdsKey]);

  // Deep links such as /settings#data-storage - the scroll listener picks up the highlight from the ref
  useEffect(() => {
    const hashId = location.hash.replace(/^#/, '');
    if (hashId && sectionIdsKey.split('|').includes(hashId)) {
      pickedSectionIdRef.current = hashId;
      scrollToSection(hashId, 'auto');
    }
  }, [location.hash, sectionIdsKey]);

  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    pickedSectionIdRef.current = id;
    setActiveId(id);
    scrollToSection(id, prefersReducedMotion ? 'auto' : 'smooth');
  }

  return (
    <div ref={rootRef} css={layoutCss}>
      <nav css={navCss} className="slds-nav-vertical slds-nav-vertical_compact" aria-label="Settings sections">
        <div className="slds-nav-vertical__section">
          <ul>
            {sections.map(({ id, label }) => (
              <li key={id} className={classNames('slds-nav-vertical__item', { 'slds-is-active': id === activeId })}>
                <a
                  href={`#${id}`}
                  className="slds-nav-vertical__action"
                  aria-current={id === activeId ? 'location' : undefined}
                  onClick={(event) => handleNavClick(event, id)}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <div css={contentCss}>{children}</div>
    </div>
  );
};
