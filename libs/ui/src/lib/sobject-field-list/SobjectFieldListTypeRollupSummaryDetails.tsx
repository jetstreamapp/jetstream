import { css } from '@emotion/react';
import { queryWithCache } from '@jetstream/shared/data';
import { FieldWrapper, SalesforceOrgUi } from '@jetstream/types';
import copyToClipboard from 'copy-to-clipboard';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '../..';
import ErrorBoundaryWithoutContent from '../utils/ErrorBoundaryWithoutContent';
import Icon from '../widgets/Icon';
import Tooltip from '../widgets/Tooltip';

export interface SobjectFieldListTypeRollupSummaryDetailsProps {
  org: SalesforceOrgUi;
  field: FieldWrapper;
}

export interface CustomField {
  Id: string;
  Metadata: {
    externalId: boolean;
    label: string;
    summarizedField: string;
    summaryFilterItems: {
      field: string;
      operation: string;
      value: string;
    }[];
    summaryForeignKey: string;
    summaryOperation: string;
    trackHistory: boolean;
    trackTrending: boolean;
    type: string;
  };
}

function copy(value?: string) {
  value && copyToClipboard(value);
}

const copyToClipboardMsg = (
  <em className="slds-m-top_x-small">
    <small>click to copy to clipboard</small>
  </em>
);

const cache = new Map<string, { label: string; items: string[] }>();

const TooltipContent = ({
  org,
  field,
  onContent: _onContent,
}: SobjectFieldListTypeRollupSummaryDetailsProps & { onContent: (value: string) => void }) => {
  const key = `${org.id}::${field.sobject}::${field.name}`;
  const isMounted = useRef(true);
  const [content, setContent] = useState<{ label: string; items: string[] } | undefined>(() => cache.get(key));
  const [loading, setLoading] = useState(false);
  const onContent = useRef(_onContent);
  onContent.current = _onContent;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (cache.has(key)) {
      return;
    }
    setLoading(true);
    const abortController = new AbortController();
    setTimeout(() => {
      if (abortController.signal.aborted) {
        return;
      }
      fetchSummaryMetadata();
    }, 1000);
    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (content) {
      onContent.current(`${content.label}\n${content.items.join('\n')}`);
    }
  }, [content]);

  // should wait 1 sec before querying in case user does not hover long enough
  const fetchSummaryMetadata = useCallback(async () => {
    let [namespace, developerName, suffix] = field.name.split('__');
    if (!suffix) {
      suffix = developerName;
      developerName = namespace;
      namespace = '';
    }
    let query: string | undefined = undefined;
    try {
      setLoading(true);
      query = `SELECT Id, Metadata FROM CustomField
      WHERE EntityDefinition.QualifiedApiName = '${field.sobject}'
      AND DeveloperName = '${developerName}'
      ${namespace ? `AND NamespacePrefix = '${namespace}'` : ''}
      LIMIT 1`;
      const results = await queryWithCache<CustomField>(org, query, true);
      const { summarizedField, summaryOperation, summaryFilterItems } = results.data.queryResults.records[0].Metadata;
      const value = {
        label: `${summaryOperation.toUpperCase()}${summarizedField ? `(${summarizedField})` : ''}`,
        items: summaryFilterItems.map(({ field, operation, value }) => `${field} ${operation} ${value}`),
      };
      cache.set(key, value);
      if (isMounted.current) {
        setContent(value);
      }
    } catch (ex) {
      if (isMounted.current) {
        setContent({ label: `Oops. There was a problem getting the Roll-Up Summary content.`, items: [] });
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Fragment>
      {loading && (
        <div
          css={css`
            height: 2rem;
            width: 3rem;
          `}
        >
          <Spinner hasContainer={false} className="slds-spinner slds-spinner_x-small slds-spinner_inverse " />
        </div>
      )}
      {!loading && content && (
        <div>
          <div>
            <strong>{content.label}</strong>
          </div>
          <ul className="slds-list_dotted">
            {content.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {copyToClipboardMsg}
        </div>
      )}
    </Fragment>
  );
};

export const SobjectFieldListTypeRollupSummaryDetails: FunctionComponent<SobjectFieldListTypeRollupSummaryDetailsProps> = ({
  field,
  org,
}) => {
  const [content, setContent] = useState<string | null>(null);
  return (
    <ErrorBoundaryWithoutContent>
      <Tooltip
        id={`${field.name}-type-tooltip`}
        content={<TooltipContent field={field} org={org} onContent={setContent} />}
        onClick={() => content && copy(content)}
      >
        <span className="slds-badge__icon slds-badge__icon_left slds-badge__icon_inverse">
          <Icon
            type="utility"
            icon="search"
            className="slds-icon slds-icon_xx-small"
            containerClassname="slds-icon_container slds-icon-utility-moneybag slds-current-color"
          />
        </span>
        {field.type}
      </Tooltip>
    </ErrorBoundaryWithoutContent>
  );
};

export default SobjectFieldListTypeRollupSummaryDetails;
