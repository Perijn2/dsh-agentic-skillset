/**
 * @module coding-doc-standard-client
 * @author Perijn
 * Provides the Coding Documentation Standard Settings sidebar page.
 *
 * @remarks
 * Includes the documentation-enforcement toggle and language policy controls.
 *
 * Usage:
 * Loaded by the DeepSeek Harness web client from package metadata.
 */

window.__ModuleLoader__.load({
  id: 'coding-doc-standard',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const NS = 'coding-doc-standard'
    const fields = [
      ['enabled', 'Enforce documentation checks', 'Blocks non-compliant code changes before they are written.'],
      ['python', 'Python', 'Apply the standard to Python files.'],
      ['typescriptJavascript', 'TypeScript / JavaScript', 'Apply the standard to TypeScript and JavaScript files.'],
      ['rust', 'Rust', 'Apply the standard to Rust files.'],
      ['cCpp', 'C / C++', 'Apply the standard to C and C++ files.'],
    ]
    const settingsCss = `
.cds-settings-section { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 760px; }
.cds-settings-header { display: flex; flex-direction: column; gap: 4px; padding: 0 2px; }
.cds-settings-heading { margin: 0; color: var(--dsw-alias-label-primary); font-size: 20px; font-weight: 600; line-height: 28px; }
.cds-settings-summary { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.cds-settings-group { box-sizing: border-box; display: flex; flex: none; flex-direction: column; gap: 8px; padding: 20px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 16px; background: var(--dsw-alias-bg-layer-3); }
.cds-settings-group-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 0 2px 6px; color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 600; line-height: 20px; }
.cds-settings-count { border-radius: 999px; padding: 1px 8px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-accent-soft, var(--dsw-alias-bg-layer-2)); font-size: 11px; font-weight: 500; line-height: 16px; }
.cds-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 2px; border-bottom: 1px solid var(--dsw-alias-border-l2); }
.cds-settings-row:last-child { border-bottom: none; }
.cds-settings-row-text { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.cds-settings-title { color: var(--dsw-alias-label-primary); font-size: 14px; line-height: 22px; }
.cds-settings-description { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.cds-switch { position: relative; display: inline-flex; flex: none; cursor: pointer; }
.cds-switch-input { position: absolute; width: 1px; height: 1px; margin: 0; opacity: 0; }
.cds-switch-track { box-sizing: border-box; display: inline-flex; align-items: center; width: 36px; height: 20px; padding: 2px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-2); transition: background .15s, border-color .15s; }
.cds-switch-thumb { display: block; width: 14px; height: 14px; border-radius: 50%; background: var(--dsw-alias-label-tertiary); transition: transform .15s, background .15s; }
.cds-switch:hover .cds-switch-track { border-color: var(--dsw-alias-label-dimmed); }
.cds-switch-input:checked + .cds-switch-track { border-color: var(--dsw-alias-button-primary-fill); background: var(--dsw-alias-button-primary-fill); }
.cds-switch-input:checked + .cds-switch-track .cds-switch-thumb { transform: translate(16px); background: var(--dsw-alias-bg-layer-3); }
.cds-switch-input:focus-visible + .cds-switch-track { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.cds-switch-input:disabled + .cds-switch-track { cursor: not-allowed; opacity: .55; }
@media (prefers-reduced-motion: reduce) { .cds-switch-track, .cds-switch-thumb { transition: none; } }
`

    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="coding-doc-standard/settings"]') === null) {
      const style = document.createElement('style')
      style.dataset.plugin = NS
      style.dataset.pluginCss = 'coding-doc-standard/settings'
      style.textContent = settingsCss
      document.head.appendChild(style)
    }

    function Switch({ checked, disabled, label, onChange }) {
      return React.createElement('label', { className: 'cds-switch' },
        React.createElement('input', {
          className: 'cds-switch-input', type: 'checkbox', checked, disabled,
          'aria-label': label,
          onChange: (event) => { onChange(event.target.checked) },
        }),
        React.createElement('span', { className: 'cds-switch-track', 'aria-hidden': 'true' },
          React.createElement('span', { className: 'cds-switch-thumb' }),
        ),
      )
    }

    function SettingsRow({ checked, description, disabled, label, onChange }) {
      return React.createElement('div', { className: 'cds-settings-row' },
        React.createElement('span', { className: 'cds-settings-row-text' },
          React.createElement('span', { className: 'cds-settings-title' }, label),
          React.createElement('span', { className: 'cds-settings-description' }, description),
        ),
        React.createElement(Switch, { checked, disabled, label, onChange }),
      )
    }

    function DocumentationStandardSettings({ scope }) {
      const snapshot = React.useSyncExternalStore(
        (listener) => scope.subscribe(listener), () => scope.getSnapshot(), () => scope.getSnapshot(),
      )
      if (snapshot.status !== 'ready') return null
      const value = snapshot.value || {}
      const [enforcement] = fields
      const languageFields = fields.slice(1)
      const languageCount = languageFields.filter(([field]) => value[field] === true).length
      const update = (field, next) => { void scope.set(field, next) }

      return React.createElement('section', { className: 'cds-settings-section' },
        React.createElement('header', { className: 'cds-settings-header' },
          React.createElement('h1', { className: 'cds-settings-heading' }, 'Coding Documentation Standard'),
          React.createElement('p', { className: 'cds-settings-summary' }, 'Enforces documentation requirements before code changes are written.'),
        ),
        React.createElement('div', { className: 'cds-settings-group' },
          React.createElement('div', { className: 'cds-settings-group-heading' }, 'Enforcement'),
          React.createElement(SettingsRow, {
            checked: value[enforcement[0]] === true,
            description: enforcement[2],
            disabled: !snapshot.writable,
            label: enforcement[1],
            onChange: (next) => update(enforcement[0], next),
          }),
        ),
        React.createElement('div', { className: 'cds-settings-group' },
          React.createElement('div', { className: 'cds-settings-group-heading' },
            React.createElement('span', null, 'Languages'),
            React.createElement('span', { className: 'cds-settings-count' }, `${languageCount} of ${languageFields.length} enabled`),
          ),
          ...languageFields.map(([field, label, description]) => React.createElement(SettingsRow, {
            key: field,
            checked: value[field] === true,
            description,
            disabled: !snapshot.writable,
            label,
            onChange: (next) => update(field, next),
          })),
        ),
      )
    }

    exports.name = NS
    exports.inject = ['slots', 'settingsScope']
    exports.apply = (ctx) => {
      const scope = ctx.settingsScope.bind({ namespace: NS })
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: NS,
        order: 24,
        label: () => 'Coding Documentation Standard',
        inject: () => ({ scope }),
      }, DocumentationStandardSettings))
    }
    return module.exports
  },
})
