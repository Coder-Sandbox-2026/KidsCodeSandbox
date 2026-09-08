/**
 * App-level preference schema. Add a new entry here to grow Settings
 * without wiring one-off toolbar flags.
 */
export const CODE_COACH_LEVELS = ['off', 'basic', 'guided', 'high'];

export const SETTINGS_DEFAULTS = {
  codeCoach: 'high',
};

export const SETTINGS_SCHEMA = [
  {
    key: 'codeCoach',
    type: 'choice',
    label: 'Code Coach',
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
];

export function isValidSettingValue(key, value) {
  const field = SETTINGS_SCHEMA.find((item) => item.key === key);
  if (!field) return false;
  if (field.type === 'choice') {
    return field.options.some((opt) => opt.value === value);
  }
  return false;
}
