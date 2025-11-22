import { PASSWORD_REQUIREMENTS, validatePassword } from '@jetstream/shared/utils';
import { FunctionComponent } from 'react';

interface PasswordStrengthIndicatorProps {
  password: string;
  confirmPassword: string;
  email?: string;
  showRequirements?: boolean;
}

export const PasswordStrengthIndicator: FunctionComponent<PasswordStrengthIndicatorProps> = ({
  password,
  confirmPassword,
  email,
  showRequirements = true,
}) => {
  if (!password) {
    return null;
  }

  const validation = validatePassword(password, email);

  const strengthColors = {
    weak: 'bg-red-500',
    fair: 'bg-orange-500',
    good: 'bg-yellow-500',
    strong: 'bg-green-500',
  };

  const strengthLabels = {
    weak: 'Weak',
    fair: 'Fair',
    good: 'Good',
    strong: 'Strong',
  };

  const strengthTextColors = {
    weak: 'text-red-700',
    fair: 'text-orange-700',
    good: 'text-yellow-700',
    strong: 'text-green-700',
  };

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${strengthColors[validation.strength]}`}
            style={{ width: `${validation.strengthScore}%` }}
          />
        </div>
        <span className={`text-sm font-medium ${strengthTextColors[validation.strength]}`}>{strengthLabels[validation.strength]}</span>
      </div>

      {showRequirements && (
        <>
          {/* Requirements checklist */}
          <div className="text-xs space-y-1">
            {PASSWORD_REQUIREMENTS.filter((req) => req.isRequired).map((req, index) => {
              const isValid = req.test(password, confirmPassword);
              return (
                <div key={index} className={`flex items-center gap-1 ${isValid ? 'text-green-600' : 'text-gray-500'}`}>
                  <span className="font-mono">{isValid ? '✓' : '○'}</span>
                  <span>{req.label}</span>
                </div>
              );
            })}
          </div>

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div className="text-xs text-orange-600 space-y-1">
              {validation.warnings.map((warning, index) => (
                <div key={index} className="flex items-center gap-1">
                  <span>⚠</span>
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
