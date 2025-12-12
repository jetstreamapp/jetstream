module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
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
};
