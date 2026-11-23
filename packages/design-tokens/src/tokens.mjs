/**
 * Semantic design tokens: named for what they do, never for how they look.
 *
 * This file is the single source for every platform. Desktop reads it through
 * `./tailwind.mjs`; web and mobile generators can read the same object later.
 *
 * Opaque colors are hex. A translucent state is `{ color, alpha }`: it tints
 * whatever surface it sits on, so one hover works on canvas, sheet and raised.
 */

/** @typedef {string | { color: string, alpha: number }} TokenValue */
/** @typedef {Record<string, TokenValue>} Theme */

/** @type {{ light: Theme, dark: Theme }} */
export const themes = {
  light: {
    // Cerin paper surfaces: white sheets over a quiet alternate-paper canvas.
    'surface.canvas': '#F7F7F8',
    'surface.sheet': '#FFFFFF',
    'surface.raised': '#FFFFFF',
    'surface.sunken': '#F0F0F2',

    'state.hover': { color: '#0E0E10', alpha: 0.04 },
    'state.selected': { color: '#0E0E10', alpha: 0.07 },

    'text.primary': '#0E0E10',
    'text.secondary': '#4D5564',
    'text.tertiary': '#626773',
    'text.inverse': '#FFFFFF',
    // Cobalt belongs to running links and data, not primary actions.
    'text.link': '#2347E9',

    // Lines belong to controls only; areas are separated by surfaces, not dividers.
    'line.control': '#E3E2E5',
    'line.focus': '#4D5564',

    // The primary action is ink: no separate brand color competes with content.
    'action.primary': '#0E0E10',

    'status.success': '#2B7346',
    'status.warning': '#A04606',
    'status.danger': '#B91C1C',
    // Something needs the person's attention: unread counts, waiting questions.
    'status.attention': '#B83A0A',

    // Data series and heatmaps: Cerin cobalt, intensity by opacity.
    'data.1': '#3157FF',

    // A Bot's character may sit on one of these: light tints behind colourful art.
    'avatar.sand': '#F2E7D3',
    'avatar.peach': '#F8DCCB',
    'avatar.rose': '#F6D5DE',
    'avatar.lilac': '#F4EFFF',
    'avatar.sky': '#D6E6F7',
    'avatar.mint': '#D3EEDF',
    'avatar.sage': '#E1E9D1',
    'avatar.slate': '#E1E4EA',
  },
  dark: {
    // The dark rail is Cerin ink; adjacent sheets lift it in neutral steps.
    'surface.canvas': '#0E0E10',
    'surface.sheet': '#171719',
    'surface.raised': '#201F22',
    'surface.sunken': '#262629',

    'state.hover': { color: '#FFFFFF', alpha: 0.05 },
    'state.selected': { color: '#FFFFFF', alpha: 0.08 },

    'text.primary': '#F7F7F8',
    'text.secondary': '#C5C7CE',
    'text.tertiary': '#A2A5AF',
    'text.inverse': '#0E0E10',
    'text.link': '#9EAEFF',

    'line.control': '#343439',
    'line.focus': '#A2A5AF',

    'action.primary': '#F7F7F8',

    'status.success': '#5FB57E',
    'status.warning': '#F5A623',
    'status.danger': '#EF6252',
    'status.attention': '#F47A3F',

    'data.1': '#9EAEFF',

    // The characters are drawn for light discs, so the tints stay light in the dark.
    'avatar.sand': '#F2E7D3',
    'avatar.peach': '#F8DCCB',
    'avatar.rose': '#F6D5DE',
    'avatar.lilac': '#F4EFFF',
    'avatar.sky': '#D6E6F7',
    'avatar.mint': '#D3EEDF',
    'avatar.sage': '#E1E9D1',
    'avatar.slate': '#E1E4EA',
  },
}

/** `surface.canvas` → `--color-surface-canvas`. */
export function cssVariable(name) {
  return `--color-${name.replaceAll('.', '-')}`
}

/** `#F7F7F8` → `247, 247, 248`, the channel form Tailwind's opacity modifier needs. */
export function hexToChannels(hex) {
  const value = Number.parseInt(hex.slice(1), 16)

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255].join(', ')
}

/** Whether a token carries its own alpha, so opacity modifiers don't apply to it. */
export function isTranslucent(value) {
  return typeof value === 'object'
}

/** The CSS value a token's variable holds. */
export function cssValue(value) {
  return isTranslucent(value)
    ? `rgba(${hexToChannels(value.color)}, ${value.alpha})`
    : hexToChannels(value)
}
