import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { submitUserFeedback } from '@jetstream/shared/data';
import { InputReadFileContent } from '@jetstream/types';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import Checkbox from '../form/checkbox/Checkbox';
import FileSelector from '../form/file-selector/FileSelector';
import { RadioButton } from '../form/radio/RadioButton';
import RadioGroup from '../form/radio/RadioGroup';
import Textarea from '../form/textarea/Textarea';
import Grid from '../grid/Grid';
import Modal from '../modal/Modal';
import ScopedNotification from '../scoped-notification/ScopedNotification';
import { fireToast } from '../toast/AppToast';
import Icon from '../widgets/Icon';
import Spinner from '../widgets/Spinner';
import Tooltip from '../widgets/Tooltip';

export type FeedbackType = 'bug' | 'feature' | 'other' | 'testimonial';
export type FeedbackPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

const STORAGE_KEY = 'jetstream-feedback-widget-position';
const HIDDEN_STORAGE_KEY = 'jetstream-feedback-widget-hidden';

const allowFromClipboardAcceptType = /^image\/(png|jpg|jpeg|gif)$/;

const getFeedbackHelpText = (type: FeedbackType): string => {
  switch (type) {
    case 'bug':
      return 'Please describe what happened and what you expected to happen.';
    case 'feature':
      return 'Tell us about the feature you would like to see.';
    case 'testimonial':
      return 'Share your experience with us!';
    case 'other':
      return 'Let us know what is on your mind.';
  }
};

const getPositionStyles = (position: FeedbackPosition) => {
  switch (position) {
    case 'bottom-right':
      return { bottom: '1.5rem', right: '1.5rem' };
    case 'bottom-left':
      return { bottom: '1.5rem', left: '1.5rem' };
    case 'top-right':
      return { top: '1.5rem', right: '1.5rem' };
    case 'top-left':
      return { top: '1.5rem', left: '1.5rem' };
  }
};

export const UserFeedbackWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [screenshots, setScreenshots] = useState<InputReadFileContent[]>([]);
  const [canFeatureTestimonial, setCanFeatureTestimonial] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [position, setPosition] = useState<FeedbackPosition>('bottom-right');
  const [isHidden, setIsHidden] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { version: clientVersion } = useAtomValue(fromAppState.appInfoState);

  // Load position from localStorage on mount
  useEffect(() => {
    const savedPosition = localStorage.getItem(STORAGE_KEY);
    if (savedPosition && ['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(savedPosition)) {
      setPosition(savedPosition as FeedbackPosition);
    }
  }, []);

  // Load hidden state from sessionStorage on mount
  useEffect(() => {
    const isHiddenFromStorage = sessionStorage.getItem(HIDDEN_STORAGE_KEY) === 'true';
    if (isHiddenFromStorage) {
      setIsHidden(true);
    }
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showContextMenu]);

  const handleOpen = () => {
    setIsOpen(true);
    setSubmitError(null);
  };

  const reset = () => {
    setFeedbackType('bug');
    setMessage('');
    setScreenshots([]);
    setCanFeatureTestimonial(false);
    setSubmitError(null);
  };

  const handleClose = (doReset = false) => {
    setIsOpen(false);
    if (doReset) {
      reset();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Submit to API
      await submitUserFeedback({
        type: feedbackType,
        message,
        screenshots,
        canFeatureTestimonial: feedbackType === 'testimonial' ? canFeatureTestimonial : undefined,
        clientVersion,
      });

      reset();
      setIsOpen(false);

      fireToast({ message: 'Thank you for your feedback!', type: 'success' });
    } catch (error) {
      logger.error('[UserFeedbackWidget] Error submitting feedback', error);
      setSubmitError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (fileContent: InputReadFileContent) => {
    if (screenshots.length >= 5) {
      fireToast({ message: 'You can only upload up to 5 screenshots.', type: 'warning' });
      return;
    }
    setScreenshots((prev) => {
      if (prev.length >= 5) {
        setTimeout(() => fireToast({ message: 'You can only upload up to 5 screenshots.', type: 'warning' }), 0);
        return prev;
      }
      return [...prev, fileContent];
    });
  };

  const handleRemoveScreenshot = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePositionChange = (newPosition: FeedbackPosition) => {
    setPosition(newPosition);
    localStorage.setItem(STORAGE_KEY, newPosition);
    setShowContextMenu(false);
  };

  const handleHideForSession = () => {
    setIsHidden(true);
    sessionStorage.setItem(HIDDEN_STORAGE_KEY, 'true');
    setShowContextMenu(false);
    fireToast({
      message: 'Feedback button hidden for this session and will be visible again when you open Jetstream in a new tab.',
      type: 'info',
    });
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setShowContextMenu(true);
  };

  const canSubmit = message.trim().length > 0;
  const positionStyles = getPositionStyles(position);

  if (isHidden) {
    return null;
  }

  return (
    <>
      {/* Floating feedback button */}

      <button
        ref={buttonRef}
        aria-label="Send Feedback"
        className="slds-button slds-button_icon slds-button_icon-container slds-button_icon-border-filled"
        onClick={handleOpen}
        onContextMenu={handleContextMenu}
        css={css`
          position: fixed;
          ${positionStyles.top ? `top: ${positionStyles.top}` : ''};
          ${positionStyles.bottom ? `bottom: ${positionStyles.bottom}` : ''};
          ${positionStyles.left ? `left: ${positionStyles.left}` : ''};
          ${positionStyles.right ? `right: ${positionStyles.right}` : ''};
          z-index: 9000;
          width: 3.5rem;
          height: 3.5rem;
          border-radius: 50%;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
          background-color: #0176d3;
          border-color: #0176d3;
          transition: all 0.2s ease;
          opacity: 0.6;

          &:hover {
            background-color: #014486;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
            opacity: 1;
          }

          &:active {
            transform: translateY(0);
          }
        `}
      >
        <Tooltip
          content={isOpen || showContextMenu ? undefined : 'Send us your feedback. Right click for positioning options.'}
          openDelay={300}
        >
          <Icon type="standard" icon="feedback" className="" omitContainer />
          <span className="slds-assistive-text">Send Feedback</span>
        </Tooltip>
      </button>

      {/* Context menu for positioning */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          css={css`
            position: fixed;
            ${positionStyles.top ? `top: calc(${positionStyles.top} + 4rem)` : ''};
            ${positionStyles.bottom ? `bottom: calc(${positionStyles.bottom} + 4rem)` : ''};
            ${positionStyles.left ? `left: ${positionStyles.left}` : ''};
            ${positionStyles.right ? `right: ${positionStyles.right}` : ''};
            z-index: 5001;
            background: white;
            border-radius: 0.25rem;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
            min-width: 200px;
            padding: 0.5rem 0;
          `}
        >
          <div
            css={css`
              padding: 0.5rem 1rem;
              font-size: 0.75rem;
              font-weight: 600;
              color: #3e3e3c;
              text-transform: uppercase;
              letter-spacing: 0.025em;
            `}
          >
            Button Position
          </div>
          {(['bottom-right', 'bottom-left', 'top-right', 'top-left'] as FeedbackPosition[]).map((pos) => (
            <button
              key={pos}
              onClick={() => handlePositionChange(pos)}
              css={css`
                display: flex;
                align-items: center;
                width: 100%;
                padding: 0.5rem 1rem;
                border: none;
                background: ${pos === position ? '#f3f2f2' : 'transparent'};
                text-align: left;
                cursor: pointer;
                font-size: 0.875rem;
                color: #181818;
                transition: background-color 0.1s ease;

                &:hover {
                  background-color: #f3f2f2;
                }
              `}
            >
              {pos === position && (
                <Icon
                  type="utility"
                  icon="check"
                  className="slds-icon slds-icon-text-success slds-icon_xx-small"
                  containerClassname="slds-m-right_x-small"
                />
              )}
              <span style={{ marginLeft: pos === position ? '0' : '1.25rem' }}>
                {pos
                  .split('-')
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')}
              </span>
            </button>
          ))}
          <div
            css={css`
              height: 1px;
              background-color: #dddbda;
              margin: 0.5rem 0;
            `}
          />
          <button
            onClick={handleHideForSession}
            css={css`
              display: flex;
              align-items: center;
              width: 100%;
              padding: 0.5rem 1rem;
              border: none;
              background: transparent;
              text-align: left;
              cursor: pointer;
              font-size: 0.875rem;
              color: #181818;
              transition: background-color 0.1s ease;

              &:hover {
                background-color: #f3f2f2;
              }
            `}
          >
            <Icon
              type="utility"
              icon="hide"
              className="slds-icon slds-icon-text-default slds-icon_xx-small"
              containerClassname="slds-m-right_x-small"
            />
            Hide for session
          </button>
        </div>
      )}

      {/* Feedback modal */}
      {isOpen && (
        <Modal
          header="Send Feedback"
          tagline="Help us improve by sharing your thoughts, reporting issues, or requesting features."
          size="md"
          closeDisabled={isSubmitting}
          footer={
            <>
              <button className="slds-button slds-button_neutral" onClick={() => handleClose(true)} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                className="slds-button slds-button_brand slds-is-relative"
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting && <Spinner size="x-small" />}
                Submit Feedback
              </button>
            </>
          }
          onClose={() => handleClose()}
        >
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
            `}
          >
            {/* Error message */}
            {submitError && <ScopedNotification theme="error">{submitError}</ScopedNotification>}

            {/* Feedback type selection */}
            <RadioGroup label="What type of feedback do you have?" required isButtonGroup>
              <RadioButton
                name="feedback-type"
                label="Report a Bug"
                value="bug"
                checked={feedbackType === 'bug'}
                onChange={(value) => setFeedbackType(value as FeedbackType)}
                disabled={isSubmitting}
              />
              <RadioButton
                name="feedback-type"
                label="Request a Feature"
                value="feature"
                checked={feedbackType === 'feature'}
                onChange={(value) => setFeedbackType(value as FeedbackType)}
                disabled={isSubmitting}
              />
              <RadioButton
                name="feedback-type"
                label="Share a Testimonial"
                value="testimonial"
                checked={feedbackType === 'testimonial'}
                onChange={(value) => setFeedbackType(value as FeedbackType)}
                disabled={isSubmitting}
              />
              <RadioButton
                name="feedback-type"
                label="Other"
                value="other"
                checked={feedbackType === 'other'}
                onChange={(value) => setFeedbackType(value as FeedbackType)}
                disabled={isSubmitting}
              />
            </RadioGroup>

            {/* Feedback message */}
            <Textarea id="feedback-message" label="Your Feedback" isRequired helpText={getFeedbackHelpText(feedbackType)}>
              <textarea
                id="feedback-message"
                className="slds-textarea"
                placeholder="Type your feedback here..."
                rows={6}
                maxLength={5000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting}
              />
            </Textarea>

            {/* Testimonial consent checkbox */}
            {feedbackType === 'testimonial' && (
              <Checkbox
                id="testimonial-consent"
                checked={canFeatureTestimonial}
                label="I give permission for this testimonial to be featured on the website or in marketing materials"
                helpText="We may include your name and testimonial in our promotional materials to help others learn about Jetstream."
                onChange={setCanFeatureTestimonial}
                disabled={isSubmitting}
              />
            )}

            {/* Screenshot upload */}
            <FileSelector
              id="feedback-screenshot"
              allowMultipleFiles
              allowFromClipboard
              allowFromClipboardAcceptType={allowFromClipboardAcceptType}
              label="Screenshots (Optional)"
              buttonLabel="Upload Screenshot"
              userHelpText="You can include up to 5 screenshots. 10MB max size per file."
              accept={['.png', '.jpg', '.jpeg', '.gif']}
              maxAllowedSizeMB={10}
              onReadFile={handleFileUpload}
              omitFilename
              disabled={screenshots.length >= 5 || isSubmitting}
            />

            {/* Display uploaded screenshots */}
            {screenshots.length > 0 && (
              <Grid
                wrap
                css={css`
                  gap: 0.5rem;
                `}
              >
                {screenshots.map((screenshot, index) => (
                  <div
                    key={`${index}-${screenshot.filename}`}
                    css={css`
                      position: relative;
                      display: inline-flex;
                      align-items: center;
                      padding: 0.25rem 0.5rem;
                      background-color: #f3f3f3;
                      border: 1px solid #dddbda;
                      border-radius: 0.25rem;
                      font-size: 0.875rem;
                    `}
                  >
                    <Icon
                      type="utility"
                      icon="image"
                      className="slds-icon slds-icon-text-default slds-icon_xx-small"
                      description="Image icon"
                    />
                    <span
                      className="slds-m-left_xx-small slds-m-right_x-small"
                      css={css`
                        max-width: 200px;
                        min-width: 200px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                      `}
                    >
                      {screenshot.filename}
                    </span>
                    <button
                      className="slds-button slds-button_icon slds-button_icon-x-small"
                      title="Remove"
                      onClick={() => handleRemoveScreenshot(index)}
                      disabled={isSubmitting}
                    >
                      <Icon type="utility" icon="close" className="slds-button__icon" omitContainer />
                      <span className="slds-assistive-text">Remove</span>
                    </button>
                  </div>
                ))}
              </Grid>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
