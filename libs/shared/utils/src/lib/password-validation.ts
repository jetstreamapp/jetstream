/**
 * Password validation utilities for B2B application
 * Used on both frontend and backend to ensure consistent password requirements
 */

import { PASSWORD_MIN_LENGTH, PASSWORD_NUMBER_AND_SPECIAL_CHAR_REGEX } from '@jetstream/types';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
  strengthScore: number; // 0-100
}

export interface PasswordRequirement {
  label: string;
  test: (password: string, confirmPassword?: string) => boolean;
  isRequired: boolean;
}

// Password requirements configuration
export const PASSWORD_MAX_LENGTH = 255;
// Keeping this at 5 for performance reasons
export const PASSWORD_HISTORY_COUNT = 5;
export const MAX_FAILED_LOGIN_ATTEMPTS = 6;
export const ACCOUNT_LOCKOUT_DURATION_MINUTES = 30;

// Common keyboard patterns to check against
const keyboardPatterns = ['qwerty', 'asdfgh', 'zxcvbn', '123456', 'abcdef', 'qazwsx', '1qaz2wsx', 'qwertyuiop', 'asdfghjkl', 'password123'];

// Password requirements
export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (pwd) => pwd.length >= PASSWORD_MIN_LENGTH,
    isRequired: true,
  },
  {
    label: 'At least one uppercase letter (A-Z)',
    test: (pwd) => /[A-Z]/.test(pwd),
    isRequired: true,
  },
  {
    label: 'At least one lowercase letter (a-z)',
    test: (pwd) => /[a-z]/.test(pwd),
    isRequired: true,
  },
  {
    label: 'At least one number or special character (0-9 or !@#$%^&*)',
    test: (pwd) => PASSWORD_NUMBER_AND_SPECIAL_CHAR_REGEX.test(pwd),
    isRequired: true,
  },
  {
    label: 'No more than 3 repeating characters',
    test: (pwd) => !/(.)\1{3,}/.test(pwd),
    isRequired: true,
  },
  {
    label: 'Passwords Match',
    test: (pwd, confirmPwd) => pwd === confirmPwd,
    isRequired: true,
  },
];

/**
 * Validates a password against all requirements
 * Note: This does NOT check password history or common passwords - those require DB access
 */
export function validatePassword(password: string, confirmPassword?: string, email?: string): PasswordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check length
  if (!password || password.length === 0) {
    errors.push('Password is required');
    return {
      isValid: false,
      errors,
      warnings,
      strength: 'weak',
      strengthScore: 0,
    };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be at most ${PASSWORD_MAX_LENGTH} characters long`);
  }

  // Check all requirements
  PASSWORD_REQUIREMENTS.forEach(({ label, test, isRequired }) => {
    if (!test(password, confirmPassword)) {
      if (isRequired) {
        errors.push(label);
      } else {
        warnings.push(label);
      }
    }
  });

  // Check if password contains email (if provided)
  if (email && password.toLowerCase().includes(email.split('@')[0].toLowerCase())) {
    errors.push('Password cannot contain your email address');
  }

  const lowerPassword = password.toLowerCase();
  const hasKeyboardPattern = keyboardPatterns.some((pattern) => lowerPassword.includes(pattern));
  if (hasKeyboardPattern) {
    warnings.push('Password contains a common keyboard pattern');
  }

  // Calculate strength score and classification
  const { strength, strengthScore } = calculatePasswordStrength(password);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    strength,
    strengthScore,
  };
}

/**
 * Calculates password strength on a scale of 0-100
 */
export function calculatePasswordStrength(password: string): { strength: 'weak' | 'fair' | 'good' | 'strong'; strengthScore: number } {
  let score = 0;

  // Length contribution (up to 30 points)
  if (password.length >= PASSWORD_MIN_LENGTH) {
    score += 15;
  }
  if (password.length >= 16) {
    score += 10;
  }
  if (password.length >= 20) {
    score += 5;
  }

  // Character variety (up to 40 points)
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score += 10;

  // Complexity bonus (up to 30 points)
  const charTypes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/].filter((regex) => regex.test(password)).length;

  if (charTypes === 4) score += 15;
  else if (charTypes === 3) score += 10;
  else if (charTypes === 2) score += 5;

  // No repeating characters bonus
  if (!/(.)\1{2,}/.test(password)) {
    score += 10;
  }

  // Penalize common patterns
  if (/(.)\1{3,}/.test(password)) {
    score -= 10;
  }

  // Penalize common words or patterns
  if (keyboardPatterns.some((pattern) => password.toLowerCase().includes(pattern))) {
    score -= 10;
  }

  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine strength classification
  let strength: 'weak' | 'fair' | 'good' | 'strong';
  if (score < 40) {
    strength = 'weak';
  } else if (score < 60) {
    strength = 'fair';
  } else if (score < 80) {
    strength = 'good';
  } else {
    strength = 'strong';
  }

  return { strength, strengthScore: score };
}

/**
 * Checks if a password contains the user's name or email
 */
export function containsUserInfo(password: string, email?: string, name?: string): boolean {
  const lowerPassword = password.toLowerCase();

  if (email) {
    const emailUsername = email.split('@')[0].toLowerCase();
    if (lowerPassword.includes(emailUsername)) {
      return true;
    }
  }

  if (name) {
    const nameParts = name.toLowerCase().split(' ');
    return nameParts.some((part) => part.length > 2 && lowerPassword.includes(part));
  }

  return false;
}
