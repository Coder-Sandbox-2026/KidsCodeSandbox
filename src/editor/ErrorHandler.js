/**
 * ErrorHandler.js – Parses errors from user code execution and produces
 * child-friendly error messages with line numbers and suggestions.
 */

const TYPO_SUGGESTIONS = {
  'posishun': 'position',
  'positon': 'position',
  'postion': 'position',
  'roation': 'rotation',
  'rotatoin': 'rotation',
  'colr': 'color',
  'collor': 'color',
  'destory': 'destroy',
  'creatCube': 'createCube',
  'creatSphere': 'createSphere',
  'createGoldcoin': 'createGoldCoin',
  'createCoin': 'createGoldCoin',
  'createcake': 'createCake',
};

export function formatFriendlyError(error, userCode) {
  let message = error.message || String(error);
  let line = null;

  // Try to extract line number from stack
  const stackMatch = error.stack?.match(/<anonymous>:(\d+):(\d+)/);
  if (stackMatch) {
    line = parseInt(stackMatch[1], 10);
    // Adjust for wrapper offset (the async wrapper adds lines)
    line = Math.max(1, line - 2);
  }

  // Check for typo suggestions
  let suggestion = '';
  for (const [typo, fix] of Object.entries(TYPO_SUGGESTIONS)) {
    if (message.toLowerCase().includes(typo.toLowerCase())) {
      suggestion = `\nDid you mean "${fix}"?`;
      break;
    }
  }

  // Check for common "is not a function" pattern
  const notFuncMatch = message.match(/(\w+) is not a function/);
  if (notFuncMatch) {
    const word = notFuncMatch[1];
    if (TYPO_SUGGESTIONS[word]) {
      suggestion = `\nDid you mean "${TYPO_SUGGESTIONS[word]}"?`;
    }
  }

  // Check for "is not defined"
  if (message.includes('is not defined')) {
    const varMatch = message.match(/(\w+) is not defined/);
    if (varMatch) {
      suggestion = `\nMake sure you created "${varMatch[1]}" first, or check your spelling.`;
    }
  }

  let friendly = '⚠️ Oops! Something went wrong.\n';
  if (line) friendly += `\nLine ${line}:\n`;
  friendly += message;
  friendly += suggestion;

  return { friendly, line };
}
