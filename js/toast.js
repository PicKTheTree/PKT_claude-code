const DURATION_MS = 5000;

let container = null;
let hideTimer = null;

export function showToast(message, { actionLabel, onAction } = {}) {
  if (!container) {
    container = document.createElement('div');
    container.className =
      'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-full ' +
      'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-5 py-3 text-sm shadow-lg';
    container.setAttribute('role', 'status');
    document.body.appendChild(container);
  }

  container.replaceChildren();
  const text = document.createElement('span');
  text.textContent = message;
  container.appendChild(text);

  if (actionLabel && onAction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = actionLabel;
    button.className = 'font-semibold text-orange-400 dark:text-orange-600 hover:underline';
    button.addEventListener('click', () => {
      onAction();
      hide();
    });
    container.appendChild(button);
  }

  container.hidden = false;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, DURATION_MS);
}

function hide() {
  if (container) container.hidden = true;
}
