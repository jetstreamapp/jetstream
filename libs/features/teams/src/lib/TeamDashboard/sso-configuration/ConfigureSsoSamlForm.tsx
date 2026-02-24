import { zodResolver } from '@hookform/resolvers/zod';
import { LoginConfigurationWithCallbacks, SamlConfigurationSchema } from '@jetstream/auth/types';
import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { parseSamlMetadata } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { InputReadFileContent } from '@jetstream/types';
import { Accordion, CopyToClipboard, FileSelector, fireToast, Input, ScopedNotification, Spinner, Textarea } from '@jetstream/ui';
import classNames from 'classnames';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

export interface ConfigureSsoSamlFormProps {
  teamId: string;
  existingSsoConfig: LoginConfigurationWithCallbacks | null;
  onSave: (config: FormValues) => Promise<void>;
}

const AttributeMappingSchema = z.object({
  email: z.string().min(1, 'Email attribute is required'),
  userName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
});

const FormSchema = z.object({
  name: SamlConfigurationSchema.shape.name,
  nameIdFormat: SamlConfigurationSchema.shape.nameIdFormat,
  idpMetadataUrl: z.string().optional(),
  idpMetadataXml: z.string().optional(),
  idpEntityId: SamlConfigurationSchema.shape.idpEntityId,
  idpSsoUrl: SamlConfigurationSchema.shape.idpSsoUrl,
  idpCertificate: SamlConfigurationSchema.shape.idpCertificate,
  attributeMapping: AttributeMappingSchema,
});

type FormValues = z.infer<typeof FormSchema>;

export function ConfigureSsoSamlForm({ teamId, existingSsoConfig, onSave }: ConfigureSsoSamlFormProps) {
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  const samlConfiguration = existingSsoConfig?.samlConfiguration;
  const callbackUrls = existingSsoConfig?.callbackUrls;
  const isEditing = !!samlConfiguration;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: samlConfiguration?.name || '',
      nameIdFormat: samlConfiguration?.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      idpMetadataUrl: samlConfiguration?.idpMetadataUrl || '',
      idpMetadataXml: '',
      idpEntityId: samlConfiguration?.idpEntityId || '',
      idpSsoUrl: samlConfiguration?.idpSsoUrl || '',
      idpCertificate: samlConfiguration?.idpCertificate || '',
      attributeMapping: {
        email: samlConfiguration?.attributeMapping.email || 'email',
        userName: samlConfiguration?.attributeMapping.userName || 'email',
        firstName: samlConfiguration?.attributeMapping.firstName || 'firstName',
        lastName: samlConfiguration?.attributeMapping.lastName || 'lastName',
      },
    },
  });

  function applyParsedMetadata(data: Awaited<ReturnType<typeof parseSamlMetadata>>) {
    setValue('idpEntityId', data.entityId, { shouldDirty: true });
    setValue('idpSsoUrl', data.ssoUrl, { shouldDirty: true });
    setValue('idpCertificate', data.certificate, { shouldDirty: true });
    if (data.claimMapping) {
      setValue('attributeMapping.email', data.claimMapping.email || getValues('attributeMapping.email'), { shouldDirty: true });
      setValue('attributeMapping.userName', data.claimMapping.userName || getValues('attributeMapping.userName'), { shouldDirty: true });
      setValue('attributeMapping.firstName', data.claimMapping.firstName || getValues('attributeMapping.firstName'), { shouldDirty: true });
      setValue('attributeMapping.lastName', data.claimMapping.lastName || getValues('attributeMapping.lastName'), { shouldDirty: true });
    }
    trigger(['idpEntityId', 'idpSsoUrl', 'idpCertificate']);
    fireToast({ type: 'success', message: 'SAML configuration auto-filled from metadata' });
  }

  async function handleFetchMetadataUrl() {
    const url = getValues('idpMetadataUrl');
    if (!url) return;
    try {
      setIsFetchingMetadata(true);
      const parsed = await parseSamlMetadata(teamId, { metadataUrl: url });
      applyParsedMetadata(parsed);
    } catch (error) {
      fireToast({ type: 'error', message: `Failed to fetch metadata: ${getErrorMessage(error)}` });
    } finally {
      setIsFetchingMetadata(false);
    }
  }

  async function handleMetadataPaste() {
    const xml = getValues('idpMetadataXml');
    if (!xml) return;
    try {
      const parsed = await parseSamlMetadata(teamId, { metadataXml: xml });
      applyParsedMetadata(parsed);
    } catch (error) {
      fireToast({ type: 'error', message: `Could not parse metadata XML: ${getErrorMessage(error)}` });
    }
  }

  async function handleXmlFileUpload({ content }: InputReadFileContent) {
    if (typeof content !== 'string') return;
    try {
      const parsed = await parseSamlMetadata(teamId, { metadataXml: content });
      applyParsedMetadata(parsed);
    } catch (error) {
      fireToast({ type: 'error', message: `Could not parse metadata XML: ${getErrorMessage(error)}` });
    }
  }

  const metadataUrl = watch('idpMetadataUrl');
  const metadataXml = watch('idpMetadataXml');

  return (
    <form id="sso-form" className="slds-p-around_medium" onSubmit={handleSubmit(onSave)}>
      {callbackUrls?.saml && (
        <div className="slds-m-bottom_medium">
          <ScopedNotification theme="light">
            <div className="slds-m-bottom_small">
              <strong className="slds-m-bottom_x-small slds-block">Single Sign On URL (ACS):</strong>
              <div className="slds-m-top_xx-small">
                {callbackUrls.saml}
                <CopyToClipboard content={callbackUrls.saml} />
              </div>
            </div>
            {callbackUrls?.spEntityId && (
              <div className="slds-m-bottom_small">
                <strong className="slds-m-bottom_x-small slds-block">Audience URN (SP Entity ID):</strong>
                <div className="slds-m-top_xx-small">
                  {callbackUrls.spEntityId}
                  <CopyToClipboard content={callbackUrls.spEntityId} />
                </div>
              </div>
            )}
            <div className="slds-m-bottom_small">
              <strong className="slds-m-bottom_x-small slds-block">Metadata URL (Needed by some IdPs):</strong>
              <div className="slds-m-top_xx-small">
                {callbackUrls.samlMetadata}
                <CopyToClipboard content={callbackUrls.samlMetadata} />
              </div>
              <p className="slds-text-body_small slds-text-color_weak">
                This will return placeholder data prior to the connection being saved
              </p>
            </div>
          </ScopedNotification>
        </div>
      )}

      <fieldset className="slds-m-top_medium">
        <legend className="slds-text-heading_small slds-m-bottom_small">Configuration</legend>

        <Input
          label="Connection Name"
          className="slds-m-bottom_x-small"
          isRequired
          hasError={!!errors?.name}
          errorMessage={errors?.name?.message}
        >
          <input
            className={classNames('slds-input', { 'active-item-yellow-bg': isEditing && dirtyFields.name })}
            placeholder="SAML Provider (Okta, Azure, etc..)"
            {...register('name')}
          />
        </Input>

        <Input
          label="Name ID Format"
          isRequired
          labelHelp="Format for the NameID sent in SAML assertions - you can also leave this as 'unspecified' with your provider."
          hasError={!!errors?.nameIdFormat}
          errorMessage={errors?.nameIdFormat?.message}
        >
          <input className="slds-input" readOnly {...register('nameIdFormat')} />
        </Input>
      </fieldset>

      {/* ── IdP Configuration ─────────────────────────────────────────── */}
      <fieldset className="slds-m-top_medium">
        <legend className="slds-text-heading_small slds-m-bottom_x-small">Identity Provider Configuration</legend>
        <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_small">
          Use one of the options below to auto-fill the required fields, or enter them manually.
        </p>

        <Accordion
          className="slds-box slds-p-around_none"
          initOpenIds={['metadata-url']}
          allowMultiple={false}
          sections={[
            {
              id: 'metadata-url',
              title: 'Metadata URL (recommended if your IdP provides one)',
              content: (
                <div>
                  <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_x-small">
                    Paste the metadata URL from your IdP (e.g. the "Identity Provider metadata" link in Okta or Azure). Jetstream will fetch
                    and parse it server-side.
                  </p>
                  <div className="slds-grid slds-gutters_x-small slds-grid_vertical-align-end">
                    <div className="slds-col">
                      <Input label="Metadata URL" labelHelp="The URL to your IdP's SAML metadata XML document">
                        <input
                          className={classNames('slds-input', { 'active-item-yellow-bg': isEditing && dirtyFields.idpMetadataUrl })}
                          placeholder="https://your-idp.example.com/metadata"
                          {...register('idpMetadataUrl')}
                        />
                      </Input>
                    </div>
                    <div className="slds-col slds-grow-none">
                      <button
                        className="slds-button slds-button_neutral slds-is-relative"
                        disabled={!metadataUrl || isFetchingMetadata}
                        onClick={handleFetchMetadataUrl}
                        type="button"
                      >
                        {isFetchingMetadata && <Spinner size="x-small" />}
                        Fetch Metadata
                      </button>
                    </div>
                  </div>
                </div>
              ),
            },
            {
              id: 'upload-xml',
              title: 'Upload XML',
              content: (
                <div>
                  <p className="slds-text-title slds-m-bottom_x-small">Option 2 — Upload XML File</p>
                  <FileSelector
                    id="saml-metadata-file"
                    label="IdP Metadata XML file"
                    buttonLabel="Upload XML File"
                    accept={[INPUT_ACCEPT_FILETYPES.XML]}
                    userHelpText="Drop or select the metadata XML file downloaded from your identity provider."
                    onReadFile={handleXmlFileUpload}
                  />
                </div>
              ),
            },
            {
              id: 'paste-xml',
              title: 'Paste XML',
              content: (
                <div>
                  <p className="slds-text-title slds-m-bottom_x-small">Option 3 — Paste XML</p>
                  <Textarea id="saml-metadata" label="IdP Metadata XML" helpText="Paste the SAML metadata XML from your identity provider">
                    <textarea
                      className={classNames('slds-textarea', { 'active-item-yellow-bg': isEditing && dirtyFields.idpMetadataXml })}
                      rows={4}
                      placeholder="<EntityDescriptor...>"
                      {...register('idpMetadataXml')}
                    />
                  </Textarea>
                  <button
                    className="slds-button slds-button_neutral slds-m-top_x-small"
                    disabled={!metadataXml}
                    onClick={handleMetadataPaste}
                    type="button"
                  >
                    Auto-Fill from XML
                  </button>
                </div>
              ),
            },
          ]}
        />

        <div className="slds-text-align_center slds-m-vertical_small slds-text-color_weak">— or enter the fields below manually —</div>

        <Input label="IdP Entity ID" isRequired hasError={!!errors?.idpEntityId} errorMessage={errors?.idpEntityId?.message}>
          <input
            className={classNames('slds-input', { 'active-item-yellow-bg': isEditing && dirtyFields.idpEntityId })}
            {...register('idpEntityId')}
          />
        </Input>

        <Input label="IdP SSO URL" isRequired hasError={!!errors?.idpSsoUrl} errorMessage={errors?.idpSsoUrl?.message}>
          <input
            className={classNames('slds-input', { 'active-item-yellow-bg': isEditing && dirtyFields.idpSsoUrl })}
            placeholder="https://idp.example.com/sso/saml"
            {...register('idpSsoUrl')}
          />
        </Input>

        <Input
          label="IdP Certificate"
          isRequired
          helpText="X.509 certificate"
          hasError={!!errors?.idpCertificate}
          errorMessage={errors?.idpCertificate?.message}
        >
          <textarea
            className={classNames('slds-textarea', { 'active-item-yellow-bg': isEditing && dirtyFields.idpCertificate })}
            rows={3}
            placeholder="MIIC..."
            {...register('idpCertificate')}
          />
        </Input>

        {samlConfiguration?.idpCertificateExpiresAt && (
          <p className="slds-m-top_xx-small slds-text-body_small slds-text-color_weak">
            Certificate expires:{' '}
            <strong>
              {new Date(samlConfiguration.idpCertificateExpiresAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </strong>
          </p>
        )}
      </fieldset>

      <fieldset className="slds-m-top_medium">
        <legend className="slds-text-heading_small slds-m-bottom_small">Attribute Mapping</legend>
        <Input
          label="Email Attribute"
          isRequired
          hasError={!!errors?.attributeMapping?.email}
          errorMessage={errors?.attributeMapping?.email?.message}
        >
          <input
            className={classNames('slds-input', { 'active-item-yellow-bg': isEditing && dirtyFields.attributeMapping?.email })}
            placeholder="email"
            {...register('attributeMapping.email')}
          />
        </Input>

        <Input
          label="Username Attribute"
          labelHelp="Defaults to Email if not provided"
          hasError={!!errors?.attributeMapping?.userName}
          errorMessage={errors?.attributeMapping?.userName?.message}
        >
          <input
            className={classNames('slds-input', { 'active-item-yellow-bg': isEditing && dirtyFields.attributeMapping?.userName })}
            placeholder="username"
            {...register('attributeMapping.userName')}
          />
        </Input>

        <Input
          label="First Name Attribute"
          hasError={!!errors?.attributeMapping?.firstName}
          errorMessage={errors?.attributeMapping?.firstName?.message}
        >
          <input
            className={classNames('slds-input', { 'active-item-yellow-bg': isEditing && dirtyFields.attributeMapping?.firstName })}
            placeholder="firstName"
            {...register('attributeMapping.firstName')}
          />
        </Input>

        <Input
          label="Last Name Attribute"
          hasError={!!errors?.attributeMapping?.lastName}
          errorMessage={errors?.attributeMapping?.lastName?.message}
        >
          <input
            className={classNames('slds-input', { 'active-item-yellow-bg': isEditing && dirtyFields.attributeMapping?.lastName })}
            placeholder="lastName"
            {...register('attributeMapping.lastName')}
          />
        </Input>
      </fieldset>
    </form>
  );
}
