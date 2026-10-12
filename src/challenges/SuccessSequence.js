/** One cancellable collection sequence per application, including its success screen. */
export function createSuccessSequence({ play, flash, stop, show, clear, wait = delay }) {
  let current = null;
  function cancel() {
    current?.abort();
    current = null;
    clear();
  }
  return {
    cancel,
    async collect() {
      if (current) return;
      const controller = new AbortController();
      current = controller;
      const { signal } = controller;
      try {
        play('collect');
        // GoldStar's synchronous collision handler destroys the item first.
        await Promise.resolve();
        if (signal.aborted) return;
        await flash(signal);
        if (signal.aborted) return;
        await wait(1000, signal);
        if (signal.aborted) return;
        play('success');
        await wait(4000, signal);
        if (signal.aborted) return;
        stop();
        show();
      } catch (error) {
        if (!signal.aborted) {
          cancel();
          console.error('Could not show collection success:', error);
        }
      }
    },
  };
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}
