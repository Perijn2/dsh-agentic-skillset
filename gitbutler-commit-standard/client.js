/**
 * @module gitbutler-commit-standard-client
 * @author Perijn
 * Displays the GitButler commit-standard controls in Harness settings.
 *
 * @remarks
 * Includes:
 *   - Settings sidebar section: configure enforcement and profile discovery.
 *
 * Usage:
 *   Loaded by the Harness web client from package metadata.
 */

window.__ModuleLoader__.load({
  id: 'gitbutler-commit-standard',
  factory: (require) => {
    const React = require('react')
    const module = { exports: {} }
    const NAV_MARKER = 'data-gitbutler-commit-standard-settings-nav'
    const SETTINGS_LABEL = 'GitButler Commit Standard'
    const settingsCss = `
.gcs-settings-section { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 760px; }
.gcs-settings-header { display: flex; flex-direction: column; gap: 4px; padding: 0 2px; }
.gcs-settings-heading { margin: 0; color: var(--dsw-alias-label-primary); font-size: 20px; font-weight: 600; line-height: 28px; }
.gcs-settings-summary { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.gcs-settings-intro { margin: 0; padding: 0 2px; color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 20px; }
.gcs-settings-group { box-sizing: border-box; display: flex; flex: none; flex-direction: column; gap: 8px; padding: 20px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 16px; background: var(--dsw-alias-bg-layer-3); }
.gcs-settings-group-heading { padding: 0 2px 6px; color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 600; line-height: 20px; }
.gcs-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 2px; border-bottom: 1px solid var(--dsw-alias-border-l2); }
.gcs-settings-row:last-child { border-bottom: none; }
.gcs-settings-row-text { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.gcs-settings-title { color: var(--dsw-alias-label-primary); font-size: 14px; line-height: 22px; }
.gcs-settings-description { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.gcs-switch { position: relative; display: inline-flex; flex: none; cursor: pointer; }
.gcs-switch-input { position: absolute; width: 1px; height: 1px; margin: 0; opacity: 0; }
.gcs-switch-track { box-sizing: border-box; display: inline-flex; align-items: center; width: 36px; height: 20px; padding: 2px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-2); transition: background .15s, border-color .15s; }
.gcs-switch-thumb { display: block; width: 14px; height: 14px; border-radius: 50%; background: var(--dsw-alias-label-tertiary); transition: transform .15s, background .15s; }
.gcs-switch:hover .gcs-switch-track { border-color: var(--dsw-alias-label-dimmed); }
.gcs-switch-input:checked + .gcs-switch-track { border-color: var(--dsw-alias-button-primary-fill); background: var(--dsw-alias-button-primary-fill); }
.gcs-switch-input:checked + .gcs-switch-track .gcs-switch-thumb { transform: translate(16px); background: var(--dsw-alias-bg-layer-3); }
.gcs-switch-input:focus-visible + .gcs-switch-track { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.gcs-switch-input:disabled + .gcs-switch-track { cursor: not-allowed; opacity: .55; }
[data-gitbutler-commit-standard-settings-nav] > svg:first-child { display: none; }
[data-gitbutler-commit-standard-settings-nav]::before { content: ''; flex: none; width: 16px; height: 16px; background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='18' cy='18' r='3'/%3E%3Ccircle cx='6' cy='6' r='3'/%3E%3Cpath d='M6 9v6a3 3 0 0 0 3 3h6'/%3E%3Cline x1='6' x2='6' y1='12' y2='9'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='18' cy='18' r='3'/%3E%3Ccircle cx='6' cy='6' r='3'/%3E%3Cpath d='M6 9v6a3 3 0 0 0 3 3h6'/%3E%3Cline x1='6' x2='6' y1='12' y2='9'/%3E%3C/svg%3E") center / contain no-repeat; }
@media (prefers-reduced-motion: reduce) { .gcs-switch-track, .gcs-switch-thumb { transition: none; } }
`

    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="gitbutler-commit-standard/settings"]') === null) {
      const style = document.createElement('style')
      style.dataset.plugin = 'gitbutler-commit-standard'
      style.dataset.pluginCss = 'gitbutler-commit-standard/settings'
      style.textContent = settingsCss
      document.head.appendChild(style)
    }

    function registerSettingsNavIcon() {
      let disposed = false
      const sync = () => {
        if (disposed) return
        for (const button of document.querySelectorAll('[role="dialog"] nav button')) {
          if (button.textContent?.trim() === SETTINGS_LABEL) button.setAttribute(NAV_MARKER, '')
          else button.removeAttribute(NAV_MARKER)
        }
      }
      sync()
      const observer = new MutationObserver(sync)
      observer.observe(document.body, { childList: true, subtree: true, characterData: true })
      return () => {
        disposed = true
        observer.disconnect()
        document.querySelectorAll(`[${NAV_MARKER}]`).forEach((element) => element.removeAttribute(NAV_MARKER))
      }
    }

    function Switch({ checked, disabled, label, onChange }) {
      return React.createElement('label', { className: 'gcs-switch' },
        React.createElement('input', {
          className: 'gcs-switch-input',
          type: 'checkbox',
          checked,
          disabled,
          'aria-label': label,
          onChange: (event) => { onChange(event.target.checked) },
        }),
        React.createElement('span', { className: 'gcs-switch-track', 'aria-hidden': 'true' },
          React.createElement('span', { className: 'gcs-switch-thumb' }),
        ),
      )
    }

    function SettingsRow({ checked, description, disabled, label, onChange }) {
      return React.createElement('div', { className: 'gcs-settings-row' },
        React.createElement('span', { className: 'gcs-settings-row-text' },
          React.createElement('span', { className: 'gcs-settings-title' }, label),
          React.createElement('span', { className: 'gcs-settings-description' }, description),
        ),
        React.createElement(Switch, { checked, disabled, label, onChange }),
      )
    }

    function GitButlerSettingsSection({ scope }) {
      const snapshot = React.useSyncExternalStore(
        (listener) => scope.subscribe(listener), () => scope.getSnapshot(), () => scope.getSnapshot(),
      )
      if (snapshot.status !== 'ready') return null
      const value = snapshot.value || {}
      const fields = [
        ['enabled', 'Enable standard', 'Turns on GitButler enforcement and commit-message validation.'],
        ['commandGuard', 'Require GitButler for Git mutations', 'Blocks raw Git mutations and directs agents to the but CLI.'],
        ['commitlint', 'Validate Conventional Commit messages', 'Checks commit messages against the Conventional Commits ruleset.'],
      ]
      return React.createElement('section', { className: 'gcs-settings-section' },
        React.createElement('header', { className: 'gcs-settings-header' },
          React.createElement('h1', { className: 'gcs-settings-heading' }, 'GitButler Commit Standard'),
          React.createElement('p', { className: 'gcs-settings-summary' }, 'This standard routes Git mutations through the but CLI and validates commit messages with Conventional Commits.'),
        ),
        React.createElement('p', { className: 'gcs-settings-intro' }, 'Raw Git mutations are blocked; read-only Git inspection remains available.'),
        React.createElement('div', { className: 'gcs-settings-group' },
          React.createElement('div', { className: 'gcs-settings-group-heading' }, 'Enforcement'),
          ...fields.map(([field, label, description]) => React.createElement(SettingsRow, {
            key: field,
            checked: value[field] !== false,
            description,
            disabled: !snapshot.writable,
            label,
            onChange: (next) => { void scope.set(field, next) },
          })),
        ),
      )
    }
    module.exports.name = 'gitbutler-commit-standard'
    module.exports.inject = ['slots', 'settingsScope']
    module.exports.apply = (ctx) => {
      const scope = ctx.settingsScope.bind({ namespace: 'gitbutler-commit-standard' })
      ctx.effect(() => registerSettingsNavIcon(), 'gitbutler-commit-standard: settings navigation icon')
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'gitbutler-commit-standard',
        order: 25,
        label: () => SETTINGS_LABEL,
        inject: () => ({ scope }),
      }, GitButlerSettingsSection))
    }
    return module.exports
  },
})
