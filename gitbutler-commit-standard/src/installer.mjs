/**
 * @module installer
 * @author Perijn
 * Plans global installation without directly mutating developer configuration.
 *
 * @remarks
 * Includes:
 *   - buildInstallPlan: derive required prerequisite and hook actions.
 *
 * Usage:
 *   const plan = buildInstallPlan({ butAvailable: true, previousHooksPath: '' });
 */

/** Describe the guarded changes required to install the standard. */
export function buildInstallPlan({ butAvailable, previousHooksPath, managedHooksPath }) {
  return {
    installGitButler: !butAvailable,
    replaceHooksPath: false,
    requiresHooksPathConfirmation: false,
    removeLegacyHooksPath: previousHooksPath === managedHooksPath,
  }
}
