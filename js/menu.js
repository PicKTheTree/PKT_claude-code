let activeMenu = null;

export function closeMenu() {
  if (!activeMenu) return;
  activeMenu.cleanup();
  activeMenu = null;
}

// items: { label, onSelect, danger? } 또는 구분선 'separator'
export function openMenu(items, { x, y }, returnFocusTo) {
  closeMenu();

  const menu = document.createElement('div');
  menu.setAttribute('role', 'menu');
  menu.className =
    'z-50 rounded-xl border border-neutral-200 bg-white py-1 shadow-lg ' +
    'dark:border-neutral-700 dark:bg-neutral-800';
  // 크기를 재기 전에 적용되어야 하므로 Tailwind 클래스(CDN이 늦게 생성)가 아닌 인라인으로 지정한다
  Object.assign(menu.style, { position: 'fixed', width: 'max-content', minWidth: '11rem' });

  const buttons = [];
  for (const item of items) {
    if (item === 'separator') {
      const line = document.createElement('div');
      line.className = 'my-1 h-px bg-neutral-200 dark:bg-neutral-700';
      menu.append(line);
      continue;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.textContent = item.label;
    button.className =
      'block w-full px-3 py-2 text-left text-sm outline-none hover:bg-neutral-100 focus:bg-neutral-100 ' +
      'dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 ' +
      (item.danger ? 'text-red-500' : '');
    button.addEventListener('click', () => {
      closeMenu();
      item.onSelect();
    });
    buttons.push(button);
    menu.append(button);
  }

  document.body.append(menu);

  // 화면 밖으로 나가지 않게 위치를 보정한다
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - width - 8))}px`;
  menu.style.top = `${y + height > innerHeight - 8 ? Math.max(8, y - height) : y}px`;

  const onPointerDown = (event) => {
    if (!menu.contains(event.target)) closeMenu();
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      returnFocusTo?.focus();
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      buttons[(index + step + buttons.length) % buttons.length].focus();
    }
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('scroll', closeMenu, true);
  window.addEventListener('resize', closeMenu);

  activeMenu = {
    cleanup() {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
      menu.remove();
    },
  };

  buttons[0]?.focus({ preventScroll: true });
}
