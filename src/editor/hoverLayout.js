/**
 * Monaco's hover widget measures itself once, then locks width/height with
 * overflow:hidden. Expanding <details> inside that widget does not trigger a
 * relayout, so "See all options" looks like a no-op. After a toggle we resize
 * the widget to the new content (and ask Monaco to scan its scrollbar).
 */

function applyBox(element, height, maxHeight) {
  if (!element) return;
  element.style.maxHeight = `${maxHeight}px`;
  element.style.height = `${height}px`;
}

export function relayoutMonacoHover(fromNode) {
  const hover = fromNode?.closest?.('.monaco-hover');
  if (!hover) return false;

  const resizable = hover.closest('.monaco-resizable-hover');
  const content = hover.querySelector('.monaco-hover-content');
  const scrollable = hover.querySelector('.monaco-scrollable-element');
  const editor = hover.closest('.monaco-editor');
  const maxHeight = Math.max(
    280,
    Math.floor((editor?.clientHeight || 480) * 0.6)
  );

  for (const el of [hover, content, scrollable, resizable]) {
    if (!el) continue;
    el.style.height = 'auto';
    el.style.maxHeight = `${maxHeight}px`;
  }

  const needed = Math.ceil((content || hover).scrollHeight + 8);
  const height = Math.min(needed, maxHeight);
  applyBox(content, height, maxHeight);
  applyBox(scrollable, height, maxHeight);
  applyBox(hover, height, maxHeight);
  applyBox(resizable, height, maxHeight);

  if (content) {
    content.style.overflowY = needed > maxHeight ? 'auto' : 'hidden';
  }
  return true;
}

function askMonacoToRelayout(editor) {
  try {
    const contrib = editor.getContribution?.('editor.contrib.contentHover');
    contrib?._contentWidget?._contentHoverWidget?.handleContentsChanged?.();
  } catch {
    /* Monaco internals — DOM relayout above is the fallback. */
  }
}

function triggerHoverVerbosity(editor, expand) {
  editor.trigger(
    'kids-hover',
    expand
      ? 'editor.action.increaseHoverVerbosityLevel'
      : 'editor.action.decreaseHoverVerbosityLevel',
    { focus: true }
  );
  setTimeout(() => {
    const hover = editor.getContainerDomNode().ownerDocument.querySelector('.monaco-hover');
    if (hover) {
      relayoutMonacoHover(hover);
      askMonacoToRelayout(editor);
    }
  }, 40);
}

/** Keep the hover open and grow it when "See all options" is toggled. */
export function bindHoverDisclosureLayout(editor) {
  const doc = editor.getContainerDomNode().ownerDocument;
  const onToggle = (event) => {
    const details = event.target;
    if (!details || details.tagName !== 'DETAILS') return;
    if (!details.closest('.monaco-hover')) return;
    requestAnimationFrame(() => {
      relayoutMonacoHover(details);
      askMonacoToRelayout(editor);
      triggerHoverVerbosity(editor, details.open);
    });
  };
  const onClick = (event) => {
    const hover = event.target.closest?.('.monaco-hover');
    if (!hover) return;
    const showLess = event.target.closest('a');
    if (showLess && /show less/i.test(showLess.textContent || '')) {
      event.preventDefault();
      triggerHoverVerbosity(editor, false);
    }
  };
  doc.addEventListener('toggle', onToggle, true);
  doc.addEventListener('click', onClick, true);
  editor.onDidDispose(() => {
    doc.removeEventListener('toggle', onToggle, true);
    doc.removeEventListener('click', onClick, true);
  });
}
