module.exports = {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      breakingHeaderPattern: /^(\w+)(?:\(.+\))?!:/,
    },
  },
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation only changes
        'style', // Code style changes (formatting, etc)
        'refactor', // Code refactoring
        'perf', // Performance improvements
        'test', // Adding or updating tests
        'build', // Build system or dependencies
        'ci', // CI/CD changes
        'chore', // Other changes
        'revert', // Revert a previous commit
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [1, 'always'],
    'body-max-line-length': [2, 'always', 120],
    'footer-leading-blank': [1, 'always'],
    'footer-max-line-length': [2, 'always', 120],
  },
  prompt: {
    questions: {
      type: {
        description: 'Select the type of change that you are committing',
        enum: [
          {
            name: 'feat:     A new feature',
            value: 'feat',
          },
          {
            name: 'fix:      A bug fix',
            value: 'fix',
          },
          {
            name: 'docs:     Documentation only changes',
            value: 'docs',
          },
          {
            name: 'style:    Changes that do not affect the code meaning',
            value: 'style',
          },
          {
            name: 'refactor: A code change that neither fixes a bug nor adds a feature',
            value: 'refactor',
          },
          {
            name: 'perf:     A code change that improves performance',
            value: 'perf',
          },
          {
            name: 'test:     Adding missing tests or correcting existing tests',
            value: 'test',
          },
          {
            name: 'build:    Changes that affect the build system or external dependencies',
            value: 'build',
          },
          {
            name: 'ci:       Changes to CI configuration files and scripts',
            value: 'ci',
          },
          {
            name: 'chore:    Other changes that do not modify src or test files',
            value: 'chore',
          },
          {
            name: 'revert:   Reverts a previous commit',
            value: 'revert',
          },
        ],
      },
      scope: {
        description: 'Select the scope of this change (optional)',
      },
      subject: {
        description: 'Write a short, imperative tense description of the change',
      },
      body: {
        description: 'Provide a longer description of the change (optional)',
      },
      isBreaking: {
        description: 'Are there any breaking changes?',
      },
      breakingBody: {
        description:
          'A BREAKING CHANGE commit requires a body. Please enter a longer description of the commit itself',
      },
      breaking: {
        description: 'Describe the breaking changes',
      },
      footer: {
        description: 'List any issue closed by this change (optional)',
      },
    },
  },
};
