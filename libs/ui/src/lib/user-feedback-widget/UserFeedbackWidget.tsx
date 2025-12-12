import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { submitUserFeedback } from '@jetstream/shared/data';
import { InputReadFileContent } from '@jetstream/types';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useState } from 'react';
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

export type FeedbackType = 'bug' | 'feature' | 'other' | 'testimonial';

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

export const UserFeedbackWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [screenshots, setScreenshots] = useState<InputReadFileContent[]>([]);
  const [canFeatureTestimonial, setCanFeatureTestimonial] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { version: clientVersion } = useAtomValue(fromAppState.appInfoState);

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

  const canSubmit = message.trim().length > 0;

  return (
    <>
      {/* Floating feedback button */}
      <button
        className="slds-button slds-button_icon slds-button_icon-container slds-button_icon-border-filled"
        title="Send Feedback"
        onClick={handleOpen}
        css={css`
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          z-index: 9000;
          width: 3.5rem;
          height: 3.5rem;
          border-radius: 50%;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
          background-color: #0176d3;
          border-color: #0176d3;
          transition: all 0.2s ease;
          opacity: 0.75;

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
        <Icon type="standard" icon="feedback" className="" omitContainer />
        <span className="slds-assistive-text">Send Feedback</span>
      </button>

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
