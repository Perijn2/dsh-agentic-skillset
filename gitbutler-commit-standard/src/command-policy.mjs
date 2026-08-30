/**
 * @module command-policy
 * @author Perijn
 * Blocks Git mutations that have a GitButler workflow equivalent.
 *
 * @remarks
 * Includes:
 *   - classifyCommand: return an allow/block decision for an argument vector.
 *
 * Usage:
 *   import { classifyCommand } from './command-policy.mjs';
 *   classifyCommand(['git', 'status']);
 */

const MUTATION_REMEDIATIONS = new Map([
  ['add', 'Use GitButler to assign changes before committing.'],
  ['commit', 'but commit -b <branch> -m "<type>: <description>"'],
  ['checkout', 'but branch new <name>, but apply <branch>, or but unapply <branch>'],
  ['switch', 'but branch new <name>, but apply <branch>, or but unapply <branch>'],
  ['branch', 'but branch new <name>'],
  ['merge', 'Use the appropriate GitButler stack or update operation.'],
  ['rebase', 'but pull or the appropriate GitButler stack operation'],
  ['push', 'but push <branch>'],
  ['pull', 'but pull'],
  ['stash', 'Assign, commit, or discard the work through GitButler.'],
  ['reset', 'Use GitButler history operations.'],
  ['restore', 'Use GitButler history operations.'],
  ['cherry-pick', 'but pick <commit>'],
  ['revert', 'Use GitButler history operations.'],
  ['clean', 'Use GitButler discard operations.'],
])

/** Return a blocking decision with a reason and remediation. */
function block(reason, remediation) {
  return { decision: 'block', reason, remediation }
}

/** Determine whether a Git argument vector has a prohibited GitButler equivalent. */
export function classifyCommand(argv) {
  if (!Array.isArray(argv) || argv.length === 0 || argv[0] !== 'git') {
    return { decision: 'allow', reason: 'not-git' }
  }
  if (argv.includes('--no-verify')) {
    return block('The standard forbids --no-verify.', 'Remove --no-verify and correct the validation failure.')
  }

  const subcommand = argv.find((argument) => !argument.startsWith('-') && argument !== 'git')
  if (!subcommand) return block('Git command cannot be classified.', 'Use a simple read-only git command or a but command.')
  if (subcommand === 'init') {
    return { decision: 'allow', reason: 'repository-bootstrap' }
  }
  if (subcommand === 'branch' && argv.slice(2).every((argument) => ['--show-current', '--no-color'].includes(argument))) {
    return { decision: 'allow', reason: 'read-only-git' }
  }
  if (!MUTATION_REMEDIATIONS.has(subcommand)) {
    return { decision: 'allow', reason: 'no-gitbutler-equivalent' }
  }
  return block(`Raw git ${subcommand} is not permitted for agent-driven mutations.`, MUTATION_REMEDIATIONS.get(subcommand))
}
