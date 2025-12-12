import type { UserConfig } from '@commitlint/types';
import { RuleConfigSeverity } from '@commitlint/types';

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [RuleConfigSeverity.Error, 'always', 200],
    'type-enum': [
      RuleConfigSeverity.Error,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation changes
        'style', // Code style changes (formatting, missing semi colons, etc)
        'refactor', // Code changes that neither fix a bug nor add a feature
        'perf', // Performance improvements
        'test', // Adding or updating tests
        'chore', // Other changes (maintenance, etc.)
        'ci', // CI/CD changes
        'build', // Build system or external dependencies changes
        'revert', // Revert a previous commit
      ],
    ],
  },
  // ...
};

export default Configuration;
