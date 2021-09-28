import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { TITLES } from '@jetstream/shared/constants';
import { submitFeedback, uploadImage } from '@jetstream/shared/data';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { convertDeltaToMarkdown } from '@jetstream/shared/utils';
import { ImageWithUpload, UserProfileUi } from '@jetstream/types';
import { ScopedNotification } from '@jetstream/ui';
import type { DeltaOperation } from 'quill';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { useTitle } from 'react-use';
import FeedbackForm from './FeedbackForm';

/**
 *
 * TODO:
 * retain prior ticket details from sessionStorage (or localStorage?)
 * (images might get tricky in this case)
 *
 * Should we email the user letting them know we received their ticket?
 *
 */

const NL1 = `\n`;
const NL = `${NL1}${NL1}`;
const HR = `${NL}<hr />${NL}`;

export interface FeedbackProps {
  userProfile: UserProfileUi;
}

export const Feedback: FunctionComponent<FeedbackProps> = ({ userProfile }) => {
  useTitle(TITLES.FEEDBACK);
  const rollbar = useRollbar();
  const isMounted = useRef(null);
  const [loading, setLoading] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<number>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleSubmit({ title, content, images }: { title: string; content: DeltaOperation[]; images: ImageWithUpload[] }) {
    setLoading(true);
    setHasError(false);
    setSubmittedTicketId(null);

    let body = `**Submitted By** ${userProfile.email} (${userProfile.sub})${NL}`;

    try {
      const { flagVersion, flags, isDefault } = userProfile['http://getjetstream.app/app_metadata'].featureFlags;

      try {
        body += `**Feature Flags Version** \`${flagVersion}\` - **Default Flags** \`${isDefault}\`${NL1}`;
        body += `**Feature Flags** \`${flags.join(', ')}\`${HR}`;
      } catch (ex) {
        // error initializing feature flag data
        logger.warn('[FEEDBACK] Error adding feature flags');
      }

      await uploadInlineImagesAndReplaceWithUrl(content);

      body += convertDeltaToMarkdown(content);

      if (images?.length) {
        body += HR;
        body += images.map(({ filename, url }) => `![${filename}](${url})`).join(NL);
        body += NL;
      }
      logger.log('[FEEDBACK]', { title, body });

      const { id } = await submitFeedback({ title, body });
      setSubmittedTicketId(id);
    } catch (ex) {
      logger.error('[FEEDBACK] Error creating ticket', ex);
      setHasError(true);
      rollbar.critical('Error submitting feedback', {
        title,
        body,
        message: ex.message,
        stack: ex.stack,
      });
    } finally {
      setLoading(false);
    }
  }

  /**
   * Upload Base64 images to cloudinary and replace with actual URL
   */
  async function uploadInlineImagesAndReplaceWithUrl(content: DeltaOperation[]) {
    const contentWithImages = content.filter((content) => content.insert?.image);
    for (const { insert } of contentWithImages) {
      const { url } = await uploadImage({ content: insert.image });
      insert.image = url;
    }
  }

  return (
    <div className="slds-align_absolute-center">
      {!submittedTicketId && <FeedbackForm loading={loading} hasError={hasError} onSubmit={handleSubmit} />}

      {submittedTicketId && (
        <div
          css={css`
            max-width: 800px;
          `}
        >
          <ScopedNotification theme="success" className="slds-m-vertical_medium">
            We have received your feedback, your ticket number is #{submittedTicketId}.
            <p>
              You can always reach our support team at{' '}
              <a href="mailto:support@getjetstream.app" target="_blank" rel="noreferrer">
                support@getjetstream.app
              </a>
              .
            </p>
            <div className="slds-align_absolute-center slds-m-vertical_medium">
              <button className="slds-button slds-button_neutral" onClick={() => setSubmittedTicketId(null)}>
                Submit Another Ticket
              </button>
            </div>
          </ScopedNotification>
        </div>
      )}
    </div>
  );
};

export default Feedback;
