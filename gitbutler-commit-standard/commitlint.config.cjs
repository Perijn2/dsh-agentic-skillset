/**
 * @module commitlint-config
 * @author Perijn
 * Defines the package-local Conventional Commits validation profile.
 *
 * @remarks
 * Includes:
 *   - commitlint configuration: extends conventional rules and requires commit bodies.
 *
 * Usage:
 *   node node_modules/@commitlint/cli/cli.js --config commitlint.config.cjs --edit <message-file>
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-empty': [2, 'never'],
  },
}
