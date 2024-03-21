import { emailSupport } from '@jetstream/shared/data';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { InputReadFileContent } from '@jetstream/types';
import { FileSelector, Icon, ScopedNotification, Spinner, Textarea, fireToast } from '@jetstream/ui';
import { useState } from 'react';

const MAX_ATTACHMENTS = 3;

interface EmailSupportProps {
  placeholder?: string;
}

/**
 * Form to allow users to send an email to support with attachments.
 */
export function EmailSupport({ placeholder = 'Tell us what happened.' }: EmailSupportProps) {
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [emailBody, setEmailBody] = useState('');
  const [attachments, setAttachments] = useState<InputReadFileContent[]>([]);

  function handleAddAttachment(fileContent: InputReadFileContent) {
    if (attachments.length >= MAX_ATTACHMENTS) {
      fireToast({
        message: `Only ${MAX_ATTACHMENTS} attachments are allowed.`,
        type: 'error',
      });
      return;
    }
    setAttachments((priorData) => {
      // ensure that we don't have two files with the same name - if so, keep new one in place of old one
      const hasExistingItem = priorData.find((item) => item.filename === fileContent.filename);
      if (hasExistingItem) {
        return priorData.map((item) => (item.filename === fileContent.filename ? fileContent : item));
      } else {
        return [...priorData, fileContent];
      }
    });
  }

  function handleClearAttachment(index: number) {
    setAttachments((priorData) => priorData.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    try {
      setLoading(true);
      setErrorMessage(undefined);
      await emailSupport(emailBody, attachments);
      setIsSent(true);
    } catch (ex) {
      rollbar.error('Error sending support email', {
        errorName: ex.name,
        message: ex.message,
        stack: ex.stack,
        emailBody,
      });
      setErrorMessage(`Uh Oh, something went wrong. Please try again later.`);
    } finally {
      setLoading(false);
    }
  }

  const isValid = emailBody.length > 0;

  if (isSent) {
    return (
      <ScopedNotification theme="success">Thank you for your feedback, if we need more information we will contact you.</ScopedNotification>
    );
  }

  return (
    <div className="slds-is-relative">
      {loading && <Spinner />}
      <h3 className="slds-text-heading_small slds-m-bottom_small">Want to tell us more about what went wrong?</h3>
      {errorMessage && (
        <ScopedNotification theme="error" className="slds-m-vertical_small">
          {errorMessage}
        </ScopedNotification>
      )}
      <Textarea id={`support-textarea`} label={'Email Body'} isRequired>
        <textarea
          id={`support-textarea`}
          name="emailBody"
          className="slds-textarea"
          placeholder={placeholder}
          value={emailBody}
          disabled={loading}
          rows={10}
          onChange={(event) => setEmailBody(event.target.value)}
        />
      </Textarea>
      <FileSelector
        id="support-files"
        label="Attachments"
        onReadFile={handleAddAttachment}
        maxAllowedSizeMB={5}
        disabled={loading}
        omitFilename
        allowMultipleFiles
      />
      <ul>
        {attachments.map((attachment, i) => (
          <li key={attachment.filename}>
            {attachment.filename}{' '}
            <button
              className="slds-button slds-button_icon slds-input__icon slds-input__icon_right"
              onClick={() => handleClearAttachment(i)}
            >
              <Icon type="utility" icon="clear" className="slds-button__icon" omitContainer description="Remove attachment" />
            </button>
          </li>
        ))}
      </ul>
      <button
        className="slds-button slds-button_brand slds-m-top_small"
        type="submit"
        onClick={handleSubmit}
        disabled={loading || !isValid}
      >
        Send
      </button>
    </div>
  );
}
