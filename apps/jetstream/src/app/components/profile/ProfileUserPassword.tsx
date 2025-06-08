import { zodResolver } from '@hookform/resolvers/zod';
import type { UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { DropDownItem } from '@jetstream/types';
import { ConfirmationModalPromise, DropDown, FormRowItem, Input, ReadOnlyFormItem, Spinner } from '@jetstream/ui';
import { FunctionComponent, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const FormSchema = z
  .object({
    password: z.string().min(8).max(255),
    confirmPassword: z.string().min(8).max(255),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
  });

type Form = z.infer<typeof FormSchema>;

export interface ProfileUserPasswordProps {
  fullUserProfile: UserProfileUiWithIdentities;
  onSetPassword: (password: string) => Promise<void>;
  onResetPassword: () => Promise<void>;
  onRemovePassword: () => Promise<void>;
}

export const ProfileUserPassword: FunctionComponent<ProfileUserPasswordProps> = ({
  fullUserProfile,
  onResetPassword,
  onRemovePassword,
  onSetPassword,
}) => {
  const items = useMemo(() => {
    const items: DropDownItem[] = [
      {
        id: 'reset-password',
        value: 'Reset Password',
        icon: { type: 'utility', icon: 'refresh', description: 'Reset password' },
      },
    ];

    if (fullUserProfile.identities.some((i) => i.type === 'oauth')) {
      items.push({
        id: 'remove-password',
        value: 'Remove Password',
        icon: { type: 'utility', icon: 'delete', description: 'Delete password' },
      });
    }
    return items;
  }, [fullUserProfile.identities]);

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
    } catch (ex) {
      //
    }
  }

  if (fullUserProfile.hasPasswordSet) {
    return (
      <FormRowItem>
        <ReadOnlyFormItem label="Password" horizontal omitEdit>
          <DropDown items={items} buttonClassName="slds-button" buttonContent={'Password Options'} onSelected={handleSelection} />
        </ReadOnlyFormItem>
      </FormRowItem>
    );
  }

  return <SetPassword username={fullUserProfile.email} onSetPassword={onSetPassword} />;
};

function SetPassword({ username, onSetPassword }: { username: string; onSetPassword: (password: string) => Promise<void> }) {
  const [changePasswordActive, setChangePasswordActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  async function handleSetPassword(data: Form) {
    try {
      setLoading(true);
      await onSetPassword(data.password);
    } catch (ex) {
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

        <input hidden readOnly name="username" value={username} autoComplete="username" />

        <FormRowItem>
          <Input
            label="Password"
            className="slds-form-element_horizontal slds-is-editing"
            hasError={!!errors?.password?.message}
            errorMessage={errors?.password?.message}
          >
            <input
              className="slds-input"
              required
              type="password"
              minLength={8}
              maxLength={255}
              autoComplete="new-password"
              {...register('password')}
            />
          </Input>
        </FormRowItem>

        <FormRowItem>
          <Input
            label="Confirm"
            hasError={!!errors?.confirmPassword?.message}
            errorMessage={errors?.confirmPassword?.message}
            className="slds-form-element_horizontal slds-is-editing"
          >
            <input
              className="slds-input"
              required
              type="password"
              minLength={8}
              maxLength={255}
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
          </Input>
        </FormRowItem>

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
