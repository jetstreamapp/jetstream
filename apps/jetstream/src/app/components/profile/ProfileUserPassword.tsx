import { css } from '@emotion/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginConfigAbility } from '@jetstream/acl';
import type { UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { containsUserInfo, PASSWORD_REQUIREMENTS } from '@jetstream/shared/utils';
import { DropDownItem, PasswordSchema } from '@jetstream/types';
import { ConfirmationModalPromise, DropDown, FormRowItem, Icon, Input, ReadOnlyFormItem, Spinner } from '@jetstream/ui';
import { FunctionComponent, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

function getFormSchema(email: string, name: string) {
  return z
    .object({
      password: PasswordSchema,
      confirmPassword: z.string(),
    })
    .superRefine((data, ctx) => {
      if (data.password !== data.confirmPassword) {
        ctx.addIssue({
          code: 'custom',
          message: 'Passwords do not match',
          path: ['confirmPassword'],
        });
      } else if (containsUserInfo(data.password, email, name)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password cannot contain your name or email address',
          path: ['password'],
        });
      }
    });
}

type Form = z.infer<ReturnType<typeof getFormSchema>>;

export interface ProfileUserPasswordProps {
  fullUserProfile: UserProfileUiWithIdentities;
  loginConfigAbility: LoginConfigAbility;
  onSetPassword: (password: string) => Promise<void>;
  onResetPassword: () => Promise<void>;
  onRemovePassword: () => Promise<void>;
}

export const ProfileUserPassword: FunctionComponent<ProfileUserPasswordProps> = ({
  fullUserProfile,
  loginConfigAbility,
  onResetPassword,
  onRemovePassword,
  onSetPassword,
}) => {
  const items = useMemo(() => {
    const items: DropDownItem[] = [];

    if (loginConfigAbility.can('update', 'Password')) {
      items.push({
        id: 'reset-password',
        value: 'Reset Password',
        icon: { type: 'utility', icon: 'refresh', description: 'Reset password' },
      });
    }

    if (loginConfigAbility.can('remove', 'Password') && fullUserProfile.identities.some(({ type }) => type === 'oauth')) {
      items.push({
        id: 'remove-password',
        value: 'Remove Password',
        icon: { type: 'utility', icon: 'delete', description: 'Delete password' },
      });
    }
    return items;
  }, [fullUserProfile.identities, loginConfigAbility]);

  async function handleSelection(id: string) {
    try {
      switch (id) {
        case 'reset-password': {
          await onResetPassword();
          break;
        }
        case 'remove-password': {
          if (
            await ConfirmationModalPromise({
              content: 'Are you sure you want to remove your password?',
            })
          ) {
            await onRemovePassword();
          }
          break;
        }
        default:
          return;
      }
    } catch {
      //
    }
  }

  if (fullUserProfile.hasPasswordSet && items.length > 0) {
    return (
      <FormRowItem>
        <ReadOnlyFormItem label="Password" horizontal omitEdit>
          <DropDown items={items} buttonClassName="slds-button" buttonContent={'Password Options'} onSelected={handleSelection} />
        </ReadOnlyFormItem>
      </FormRowItem>
    );
  }

  if (loginConfigAbility.can('update', 'Password')) {
    return <SetPassword email={fullUserProfile.email} name={fullUserProfile.name} onSetPassword={onSetPassword} />;
  }

  return null;
};

function SetPassword({ email, name, onSetPassword }: { email: string; name: string; onSetPassword: (password: string) => Promise<void> }) {
  const [changePasswordActive, setChangePasswordActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const formSchema = useMemo(() => getFormSchema(email, name), [email, name]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const watchPassword = watch('password');
  const watchConfirmPassword = watch('confirmPassword');

  async function handleSetPassword(data: Form) {
    try {
      setLoading(true);
      await onSetPassword(data.password);
    } catch {
      //TODO: handle error
    } finally {
      setLoading(false);
    }
  }

  function handleCancelEdit() {
    setChangePasswordActive(false);
    reset({ confirmPassword: '', password: '' });
  }

  if (changePasswordActive) {
    return (
      <form className="slds-is-relative slds-m-top_small" onSubmit={handleSubmit(handleSetPassword)}>
        {loading && <Spinner />}

        <input hidden readOnly name="username" value={email} autoComplete="username" />

        <FormRowItem>
          <Input id="password" label="Password" hasError={!!errors?.password?.message} errorMessage={errors?.password?.message}>
            <input
              id="password"
              className="slds-input"
              required
              type="password"
              maxLength={255}
              autoComplete="new-password"
              {...register('password')}
            />
          </Input>
        </FormRowItem>

        <FormRowItem>
          <Input
            id="confirm-password"
            label="Confirm Password"
            hasError={!!errors?.confirmPassword?.message}
            errorMessage={errors?.confirmPassword?.message}
          >
            <input
              id="confirm-password"
              className="slds-input"
              required
              type="password"
              maxLength={255}
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
          </Input>
        </FormRowItem>

        {watchPassword && (
          <FormRowItem>
            <PasswordRequirements password={watchPassword} confirmPassword={watchConfirmPassword} />
          </FormRowItem>
        )}

        <FormRowItem>
          <div className="slds-m-top_x-small">
            <button type="submit" className="slds-button slds-button_brand slds-m-right_x-small">
              Save
            </button>
            <button type="button" className="slds-button slds-button_neutral" onClick={() => handleCancelEdit()}>
              Cancel
            </button>
          </div>
        </FormRowItem>
      </form>
    );
  }

  return (
    <FormRowItem>
      <ReadOnlyFormItem label="Password" horizontal omitEdit>
        <button className="slds-button" onClick={() => setChangePasswordActive(true)}>
          Set Password
        </button>
      </ReadOnlyFormItem>
    </FormRowItem>
  );
}

function PasswordRequirements({ password, confirmPassword }: { password: string; confirmPassword: string }) {
  return (
    <ul
      className="slds-text-body_small slds-m-top_xx-small"
      css={css`
        list-style: none;
      `}
    >
      {PASSWORD_REQUIREMENTS.filter(({ isRequired }) => isRequired).map(({ label, test }) => {
        const isValid = test(password, confirmPassword);
        return (
          <li
            key={label}
            className={isValid ? 'slds-text-color_success' : 'slds-text-color_weak'}
            css={css`
              display: flex;
              align-items: center;
              gap: 0.375rem;
            `}
          >
            <Icon
              type="utility"
              icon={isValid ? 'success' : 'error'}
              className={`slds-icon slds-icon_xx-small ${isValid ? 'slds-icon-text-success' : 'slds-icon-text-default'}`}
              omitContainer
              description={isValid ? 'Met' : 'Not met'}
            />
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
