import { zodResolver } from '@hookform/resolvers/zod';
import { LoginConfigurationWithCallbacks } from '@jetstream/auth/types';
import { discoverOidcConfig } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { CopyToClipboard, fireToast, Input, ScopedNotification, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

export interface ConfigureSsoOidcFormProps {
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
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  issuer: z.string().min(1, 'Issuer URL is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().optional(),
  authorizationEndpoint: z.string().optional(),
  tokenEndpoint: z.string().optional(),
  userinfoEndpoint: z.string().optional(),
  jwksUri: z.string().optional(),
  endSessionEndpoint: z.string().optional(),
  scopes: z.array(z.string()),
  attributeMapping: AttributeMappingSchema,
});

type FormValues = z.infer<typeof FormSchema>;

export function ConfigureSsoOidcForm({ teamId, existingSsoConfig, onSave }: ConfigureSsoOidcFormProps) {
  const hasExisting = existingSsoConfig && existingSsoConfig.ssoProvider !== 'NONE';
  const [discovering, setDiscovering] = useState(false);

  const schema = useMemo(() => {
    return FormSchema.superRefine((data, ctx) => {
      if (!hasExisting && !data.clientSecret) {
        ctx.addIssue({
          code: 'custom',
          message: 'Client Secret is required',
          path: ['clientSecret'],
        });
      }
    });
  }, [hasExisting]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existingSsoConfig?.oidcConfiguration?.name || '',
      issuer: existingSsoConfig?.oidcConfiguration?.issuer || '',
      clientId: existingSsoConfig?.oidcConfiguration?.clientId || '',
      clientSecret: '',
      authorizationEndpoint: existingSsoConfig?.oidcConfiguration?.authorizationEndpoint || '',
      tokenEndpoint: existingSsoConfig?.oidcConfiguration?.tokenEndpoint || '',
      userinfoEndpoint: existingSsoConfig?.oidcConfiguration?.userinfoEndpoint || '',
      jwksUri: existingSsoConfig?.oidcConfiguration?.jwksUri || '',
      endSessionEndpoint: existingSsoConfig?.oidcConfiguration?.endSessionEndpoint || '',
      scopes: existingSsoConfig?.oidcConfiguration?.scopes || ['openid', 'email', 'profile'],
      attributeMapping: {
        email: existingSsoConfig?.oidcConfiguration?.attributeMapping.email || 'email',
        userName: existingSsoConfig?.oidcConfiguration?.attributeMapping.userName || 'email',
        firstName: existingSsoConfig?.oidcConfiguration?.attributeMapping.firstName || 'given_name',
        lastName: existingSsoConfig?.oidcConfiguration?.attributeMapping.lastName || 'family_name',
      },
    },
  });

  const issuer = watch('issuer');
  const authorizationEndpoint = watch('authorizationEndpoint');
  const userinfoEndpoint = watch('userinfoEndpoint');

  async function handleOidcDiscover() {
    const issuer = getValues('issuer');
    if (!issuer) {
      fireToast({ type: 'error', message: 'Please enter an issuer URL' });
      return;
    }

    try {
      setDiscovering(true);
      const discovered = await discoverOidcConfig(teamId, issuer);

      setValue('authorizationEndpoint', discovered.authorizationEndpoint || '', { shouldDirty: true });
      setValue('tokenEndpoint', discovered.tokenEndpoint || '', { shouldDirty: true });
      setValue('userinfoEndpoint', discovered.userinfoEndpoint || '', { shouldDirty: true });
      setValue('jwksUri', discovered.jwksUri || '', { shouldDirty: true });
      setValue('endSessionEndpoint', discovered.endSessionEndpoint || '', { shouldDirty: true });

      // Trigger validation for these fields if needed, or just let the user see the result
      fireToast({ type: 'success', message: 'OIDC configuration discovered successfully' });
    } catch (error) {
      fireToast({
        type: 'error',
        message: `Failed to discover OIDC configuration: ${getErrorMessage(error)}`,
      });
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <form id="sso-form" className="slds-p-around_medium" onSubmit={handleSubmit(onSave)}>
      <div>
        <h3 className="slds-text-heading_small slds-m-bottom_small">OIDC Configuration</h3>

        {existingSsoConfig?.callbackUrls?.oidc && (
          <div className="slds-m-bottom_medium">
            <ScopedNotification theme="light">
              <strong className="slds-m-bottom_x-small slds-block">Configure this callback URL in your OIDC provider:</strong>
              <div className="slds-m-top_xx-small">
                {existingSsoConfig.callbackUrls.oidc}
                <CopyToClipboard content={existingSsoConfig.callbackUrls.oidc} />
              </div>
            </ScopedNotification>
          </div>
        )}

        <div className="slds-m-bottom_small">
          <Input
            label="Issuer URL"
            isRequired
            labelHelp="Only OIDC compliant issuers are supported and a discovery document must be available at {issuer}/.well-known/openid-configuration"
            helpText="The OIDC issuer URL (e.g., https://{id}.okta.com, https://login.google.com, https://login.microsoftonline.com/{tenant-id}/v2.0)"
            hasError={!!errors?.issuer}
            errorMessage={errors?.issuer?.message}
          >
            <input
              className={classNames('slds-input', { 'active-item-yellow-bg': hasExisting && dirtyFields.issuer })}
              placeholder="https://your-idp.com"
              {...register('issuer')}
            />
          </Input>
          <button
            className="slds-button slds-button_neutral slds-m-top_x-small slds-is-relative"
            disabled={!issuer || discovering}
            onClick={handleOidcDiscover}
            type="button"
          >
            {discovering && <Spinner size="x-small" />}
            Auto-Discover Endpoints
          </button>
        </div>

        <Input
          className="slds-m-bottom_x-small"
          label="Connection Name"
          isRequired
          hasError={!!errors?.name}
          errorMessage={errors?.name?.message}
        >
          <input className={classNames('slds-input', { 'active-item-yellow-bg': hasExisting && dirtyFields.name })} {...register('name')} />
        </Input>

        <Input
          className="slds-m-bottom_x-small"
          label="Client ID"
          isRequired
          hasError={!!errors?.clientId}
          errorMessage={errors?.clientId?.message}
        >
          <input
            className={classNames('slds-input', { 'active-item-yellow-bg': hasExisting && dirtyFields.clientId })}
            {...register('clientId')}
          />
        </Input>

        <Input
          className="slds-m-bottom_x-small"
          label="Client Secret"
          isRequired={!hasExisting}
          hasError={!!errors?.clientSecret}
          errorMessage={errors?.clientSecret?.message}
        >
          <input
            className={classNames('slds-input', { 'active-item-yellow-bg': hasExisting && dirtyFields.clientSecret })}
            type="password"
            placeholder={hasExisting ? '(unchanged)' : ''}
            {...register('clientSecret')}
          />
        </Input>

        {authorizationEndpoint && (
          <>
            <Input label="Authorization Endpoint" isRequired>
              <input className="slds-input" readOnly {...register('authorizationEndpoint')} />
            </Input>

            <Input label="Token Endpoint" isRequired>
              <input className="slds-input" readOnly {...register('tokenEndpoint')} />
            </Input>

            <Input label="JWKS URI" isRequired>
              <input className="slds-input" readOnly {...register('jwksUri')} />
            </Input>

            {userinfoEndpoint && (
              <Input label="Userinfo Endpoint">
                <input className="slds-input" readOnly {...register('userinfoEndpoint')} />
              </Input>
            )}
          </>
        )}

        <div className="slds-m-top_medium">
          <h4 className="slds-text-heading_small slds-m-bottom_small">Attribute Mapping</h4>
          <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_small">Map OIDC claims to Jetstream user attributes</p>

          <Input
            label="Email Claim"
            isRequired
            hasError={!!errors?.attributeMapping?.email}
            errorMessage={errors?.attributeMapping?.email?.message}
          >
            <input
              className={classNames('slds-input', { 'active-item-yellow-bg': hasExisting && dirtyFields.attributeMapping?.email })}
              {...register('attributeMapping.email')}
            />
          </Input>

          <Input
            label="Username Claim"
            hasError={!!errors?.attributeMapping?.userName}
            errorMessage={errors?.attributeMapping?.userName?.message}
          >
            <input
              className={classNames('slds-input', { 'active-item-yellow-bg': hasExisting && dirtyFields.attributeMapping?.userName })}
              placeholder="username"
              {...register('attributeMapping.userName')}
            />
          </Input>

          <Input
            label="First Name Claim"
            hasError={!!errors?.attributeMapping?.firstName}
            errorMessage={errors?.attributeMapping?.firstName?.message}
          >
            <input
              className={classNames('slds-input', { 'active-item-yellow-bg': hasExisting && dirtyFields.attributeMapping?.firstName })}
              placeholder="given_name"
              {...register('attributeMapping.firstName')}
            />
          </Input>

          <Input
            label="Last Name Claim"
            hasError={!!errors?.attributeMapping?.lastName}
            errorMessage={errors?.attributeMapping?.lastName?.message}
          >
            <input
              className={classNames('slds-input', { 'active-item-yellow-bg': hasExisting && dirtyFields.attributeMapping?.lastName })}
              placeholder="family_name"
              {...register('attributeMapping.lastName')}
            />
          </Input>
        </div>
      </div>
    </form>
  );
}
