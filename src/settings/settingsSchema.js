/**
 * App-level preference schema. Add a new entry here to grow Settings
 * without wiring one-off toolbar flags.
 */
import { GRAPHICS_PROFILES, RENDER_RESOLUTION_OPTIONS } from './graphicsProfiles.js';

export const CODE_COACH_LEVELS = ['off', 'basic', 'guided', 'high'];

export const SETTINGS_DEFAULTS = {
  codeCoach: 'high',
  controlStyle: 'experienced',
  graphicsProfile: 'medium',
  renderResolutionOverride: 'profile',
};

export const SETTINGS_SCHEMA = [
  {
    key: 'codeCoach',
    type: 'choice',
    label: 'Code Coach',
    summary: 'Editor help and autocomplete settings',
    description: 'How much help should the editor give you when you choose a code suggestion?',
    hint: '💡 You can change this anytime. As you get better at coding, try turning the help down!',
    default: 'high',
    options: [
      { value: 'off', label: 'Off', hint: 'You write the syntax yourself.' },
      { value: 'basic', label: 'Basic', hint: 'Adds the basic function structure.' },
      { value: 'guided', label: 'Guided', hint: 'Shows you the parameters and code structure.' },
      { value: 'high', label: 'High', hint: 'Gives you a complete code template to get started.' },
    ],
  },
  {
    key: 'controlStyle',
    type: 'choice',
    label: 'Controls',
    summary: 'Choose how you move around the game world',
    description: 'Choose the controls that feel easiest for you.',
    default: 'experienced',
    options: [
      { value: 'experienced', label: 'Experienced', hint: 'For players familiar with 3D games.\nW A S D: Move | Mouse: Look | Space: Jump' },
      { value: 'simple', label: 'Simple', hint: 'Easy keyboard controls. No mouse looking.\nUp/Down arrows: Move | Left/Right arrows: Turn | Space: Jump' },
    ],
  },
  {
    label: 'Graphics',
    summary: 'Choose the 3D game rendering resolution',
    fields: [
      {
        key: 'graphicsProfile',
        type: 'choice',
        label: 'Graphics Profile',
        description: 'Choose the base graphics profile. For now, this controls game render resolution.',
        default: 'medium',
        options: Object.entries(GRAPHICS_PROFILES).map(([value, profile]) => ({
          value,
          label: profile.label,
        })),
      },
      {
        key: 'renderResolutionOverride',
        type: 'choice',
        label: 'Render Resolution',
        description: 'Override only the 3D game resolution, or use the selected profile default.',
        default: 'profile',
        options: RENDER_RESOLUTION_OPTIONS,
      },
    ],
  },
];

export function isValidSettingValue(key, value) {
  const field = SETTINGS_SCHEMA
    .flatMap((item) => item.fields || [item])
    .find((item) => item.key === key);
  if (!field) return false;
  if (field.type === 'choice') {
    return field.options.some((opt) => opt.value === value);
  }
  return false;
}
