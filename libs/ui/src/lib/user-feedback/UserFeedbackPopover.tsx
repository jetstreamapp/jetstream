import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { submitUserFeedback } from '@jetstream/shared/data';
import { useGlobalEventHandler } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { InputAcceptType, InputReadFileContent } from '@jetstream/types';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { ChangeEvent, ClipboardEvent, KeyboardEvent, useCallback, useRef, useState } from 'react';
import { readFileForUpload } from '../form/file-selector/file-selector-utils';
import Grid from '../grid/Grid';
import { Popover, PopoverRef } from '../popover/Popover';
import ScopedNotification from '../scoped-notification/ScopedNotification';
import { fireToast } from '../toast/AppToast';
import Icon from '../widgets/Icon';
import { getModifierKey, KeyboardShortcut } from '../widgets/KeyboardShortcut';
import Spinner from '../widgets/Spinner';

const MAX_SCREENSHOTS = 5;
const MAX_SCREENSHOT_SIZE_MB = 10;
const MAX_MESSAGE_LENGTH = 5000;
const SCREENSHOT_ACCEPT: InputAcceptType[] = ['.png', '.jpg', '.jpeg', '.gif'];
const SCREENSHOT_MIME_TYPE = /^image\/(png|jpg|jpeg|gif)$/;

/**
 * Below this width the trigger collapses to an icon so it doesn't push the last nav items (e.g. Developer Tools)
 * into "More" on common 1280px laptop screens. The label stays as assistive text so the button is still named "Feedback".
 */
const ICON_ONLY_MAX_WIDTH_PX = 1365;

const triggerStyles = css`
  .slds-button {
    padding: 0 0.75rem;
  }
  .user-feedback-trigger__icon {
    display: none;
  }
  @media (max-width: ${ICON_ONLY_MAX_WIDTH_PX}px) {
    .slds-button {
      padding: 0 0.5rem;
    }
    .user-feedback-trigger__icon {
      display: inline-block;
    }
    .user-feedback-trigger__label {
      position: absolute;
      margin: -1px;
      border: 0;
      padding: 0;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  }
`;

/**
 * Slim "Feedback" button (pinned to the end of the nav bar) that opens a small popover to send us a message,
 * optionally with screenshots. Deliberately a single free-text box so a quick one-liner takes no more effort
 * than typing it.
 *
 * The draft lives in this component, which stays mounted with the header, so closing the popover by
 * accident or navigating to another page does not lose what the user typed.
 */
export const UserFeedbackPopover = () => {
  const popoverRef = useRef<PopoverRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { version: clientVersion } = useAtomValue(fromAppState.appInfoState);
  const [message, setMessage] = useState('');
  const [screenshots, setScreenshots] = useState<InputReadFileContent[]>([]);
  const [pendingScreenshotReads, setPendingScreenshotReads] = useState(0);
  // Attached screenshots plus reads still in flight. A ref rather than state so overlapping pastes/attachments
  // see each other's claims immediately and cannot overbook MAX_SCREENSHOTS
  const claimedScreenshotSlotsRef = useRef(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Wait for in-flight screenshot reads, otherwise a quick paste-then-send would drop the attachment
  const canSubmit = message.trim().length > 0 && !isSubmitting && pendingScreenshotReads === 0;

  const handleGlobalKeyDown = useCallback((event: globalThis.KeyboardEvent) => {
    // Match on `code` since holding Shift turns the key into ">" on most layouts
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === 'Period') {
      event.preventDefault();
      popoverRef.current?.open();
    }
  }, []);

  useGlobalEventHandler('keydown', handleGlobalKeyDown);

  async function addScreenshots(files: File[]) {
    if (isSubmitting) {
      return;
    }
    setErrorMessage(null);
    setPendingScreenshotReads((count) => count + 1);
    const errors: string[] = [];
    const newScreenshots: InputReadFileContent[] = [];
    try {
      for (const file of files) {
        // Stop reading once the slots are full rather than reading everything and discarding the excess
        if (claimedScreenshotSlotsRef.current >= MAX_SCREENSHOTS) {
          errors.push(`You can attach up to ${MAX_SCREENSHOTS} screenshots.`);
          break;
        }
        claimedScreenshotSlotsRef.current += 1;
        try {
          newScreenshots.push(await readFileForUpload(file, { accept: SCREENSHOT_ACCEPT, maxAllowedSizeMB: MAX_SCREENSHOT_SIZE_MB }));
        } catch (ex) {
          claimedScreenshotSlotsRef.current -= 1;
          errors.push(getErrorMessage(ex));
        }
      }
      setScreenshots((prev) => [...prev, ...newScreenshots]);
      if (errors.length) {
        setErrorMessage(errors[0]);
      }
    } finally {
      setPendingScreenshotReads((count) => count - 1);
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    addScreenshots(files);
  }

  /** Pasting an image into the message attaches it; pasting text behaves normally */
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && SCREENSHOT_MIME_TYPE.test(item.type))
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file);
    if (!imageFiles.length) {
      return;
    }
    event.preventDefault();
    addScreenshots(imageFiles);
  }

  function handleRemoveScreenshot(index: number) {
    claimedScreenshotSlotsRef.current -= 1;
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  }

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await submitUserFeedback({ type: 'other', message, screenshots, clientVersion });
      setMessage('');
      setScreenshots([]);
      claimedScreenshotSlotsRef.current = 0;
      popoverRef.current?.close();
      fireToast({ message: 'Thanks for the feedback! We read every message.', type: 'success' });
    } catch (ex) {
      logger.error('[UserFeedbackPopover] Error submitting feedback', ex);
      setErrorMessage('Your feedback could not be sent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <span css={triggerStyles}>
      <Popover
        ref={popoverRef}
        testId="user-feedback-popover"
        size="large"
        placement="bottom-end"
        header={
          <header className="slds-popover__header">
            <h2 className="slds-text-heading_small">Send us feedback</h2>
          </header>
        }
        content={
          <div className="slds-is-relative">
            {errorMessage && (
              <ScopedNotification theme="error" className="slds-m-bottom_x-small">
                {errorMessage}
              </ScopedNotification>
            )}
            <div className="slds-form-element">
              <label className="slds-form-element__label slds-assistive-text" htmlFor="user-feedback-message">
                Feedback
              </label>
              <div className="slds-form-element__control">
                <textarea
                  id="user-feedback-message"
                  className="slds-textarea"
                  placeholder="A bug, an idea, or anything else on your mind..."
                  rows={5}
                  maxLength={MAX_MESSAGE_LENGTH}
                  value={message}
                  autoFocus
                  readOnly={isSubmitting}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={handleMessageKeyDown}
                  onPaste={handlePaste}
                />
              </div>
            </div>
            {screenshots.length > 0 && (
              <ul
                className="slds-m-top_x-small"
                css={css`
                  display: flex;
                  flex-wrap: wrap;
                  gap: 0.25rem;
                `}
              >
                {screenshots.map((screenshot, index) => (
                  <li key={`${index}-${screenshot.filename}`} className="slds-pill">
                    <span className="slds-pill__label" title={screenshot.filename}>
                      <Icon
                        type="utility"
                        icon="image"
                        className="slds-icon slds-icon-text-default slds-icon_xx-small slds-m-right_xx-small"
                        omitContainer
                      />
                      {screenshot.filename}
                    </span>
                    <button
                      className="slds-button slds-button_icon slds-pill__remove"
                      title={`Remove ${screenshot.filename}`}
                      disabled={isSubmitting}
                      onClick={() => handleRemoveScreenshot(index)}
                    >
                      <Icon type="utility" icon="close" className="slds-button__icon" omitContainer />
                      <span className="slds-assistive-text">Remove {screenshot.filename}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="slds-assistive-text"
              accept={SCREENSHOT_ACCEPT.join(', ')}
              multiple
              tabIndex={-1}
              aria-hidden
              onChange={handleFileInputChange}
            />
            <Grid verticalAlign="center" className="slds-m-top_x-small">
              <button
                className="slds-button"
                disabled={isSubmitting || screenshots.length >= MAX_SCREENSHOTS}
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon type="utility" icon="image" className="slds-button__icon slds-button__icon_left" omitContainer />
                Attach screenshot
              </button>
              <span className="slds-text-body_small slds-text-color_weak slds-m-left_x-small">or paste an image</span>
            </Grid>
          </div>
        }
        footer={
          <footer className="slds-popover__footer">
            <Grid align="spread" verticalAlign="center">
              <KeyboardShortcut
                className="slds-text-body_small slds-text-color_weak"
                keys={[getModifierKey(), 'Enter']}
                postContent="to send"
              />
              <button className="slds-button slds-button_brand slds-is-relative" disabled={!canSubmit} onClick={handleSubmit}>
                {isSubmitting && <Spinner size="x-small" />}
                Send
              </button>
            </Grid>
          </footer>
        }
        buttonProps={{
          className: 'slds-button slds-button_neutral',
          title: `Send us feedback (${getModifierKey()}+Shift+.)`,
        }}
        buttonStyle={{ minHeight: '1.75rem', lineHeight: '1.625rem', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
      >
        <Icon type="utility" icon="chat" className="slds-button__icon user-feedback-trigger__icon" omitContainer />
        <span className="user-feedback-trigger__label">Feedback</span>
      </Popover>
    </span>
  );
};

export default UserFeedbackPopover;
