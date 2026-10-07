import {
  updateTask,
  changeStatus,
  setCollapsed,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  deleteTask,
  restoreTasks,
} from './store.js';
import { toDateString, isOverdue, formatDue } from './date.js';
import { openMenu } from './menu.js';
import { showToast } from './toast.js';

const svg = (size, paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${size}">${paths}</svg>`;

const ICONS = {
  check: svg('h-3 w-3', '<path stroke-width="3" d="M5 12l5 5L20 7"/>'),
  checkSmall: svg('h-2.5 w-2.5', '<path stroke-width="3.5" d="M5 12l5 5L20 7"/>'),
  calendar: svg('h-3.5 w-3.5', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  calendarAction: svg('h-4 w-4', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  plus: svg('h-4 w-4', '<path d="M12 5v14M5 12h14"/>'),
  more: svg('h-4 w-4', '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  grip: svg('h-4 w-4', '<path d="M4 8h16M4 16h16"/>'),
  close: svg('h-3 w-3', '<path d="M6 6l12 12M18 6L6 18"/>'),
  subtasks: svg('h-3.5 w-3.5', '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
  chevron: svg('h-3 w-3 transition-transform', '<path d="M6 9l6 6 6-6"/>'),
};

const HOVER = '[@media(hover:hover)]';
const TOUCH = '[@media(hover:none)]';

const MOVE_LABELS = { todo: '할 일로 이동', doing: '진행 중으로 이동', done: '완료로 이동' };

// 하위 할일을 추가하는 중인 카드. 저장할 때마다 보드 전체를 다시 그리므로
// 입력창이 사라지지 않도록 상태를 카드 바깥에 둔다
let addingSubtaskTo = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(icon, label, className) {
  const button = el(
    'button',
    'flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition ' +
      'hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 ' +
      (className ?? '')
  );
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = icon;
  return button;
}

export function createTaskItem(task) {
  const item = el(
    'li',
    'task-card group relative flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 ' +
      'shadow-sm transition hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800'
  );
  item.dataset.id = task.id;

  const body = el('div', 'min-w-0 flex-1');
  const dueSlot = el('div');

  const openDueEditor = () => {
    dueSlot.replaceChildren(createDueEditor(task, () => dueSlot.replaceChildren()));
  };
  const openSubtaskInput = () => {
    addingSubtaskTo = task.id;
    setCollapsed(task.id, false);
  };
  const openTaskMenu = (position, returnFocusTo) => {
    const moves = Object.entries(MOVE_LABELS)
      .filter(([status]) => status !== task.status)
      .map(([status, label]) => ({ label, onSelect: () => changeStatus(task.id, status) }));
    openMenu(
      [
        ...moves,
        'separator',
        { label: task.dueDate ? '마감일 변경' : '마감일 설정', onSelect: openDueEditor },
        { label: '하위 할일 추가', onSelect: openSubtaskInput },
        'separator',
        { label: '삭제', danger: true, onSelect: () => removeTask(task) },
      ],
      position,
      returnFocusTo
    );
  };

  body.append(createTitle(task));
  const meta = createMeta(task, openDueEditor);
  if (meta) body.append(meta);
  body.append(dueSlot);
  const subtasks = createSubtaskSection(task);
  if (subtasks) body.append(subtasks);

  item.append(
    createCheckbox(task),
    body,
    createActions({ openDueEditor, openSubtaskInput, openTaskMenu }),
    createDragHandle()
  );
  attachLongPress(item, (x, y) => openTaskMenu({ x, y }));
  return item;
}

function createCheckbox(task) {
  const done = task.status === 'done';
  const button = el(
    'button',
    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ' +
      (done
        ? 'border-orange-500 bg-orange-500 text-white'
        : 'border-neutral-300 hover:border-orange-400 dark:border-neutral-500')
  );
  button.type = 'button';
  button.setAttribute('role', 'checkbox');
  button.setAttribute('aria-checked', String(done));
  button.setAttribute('aria-label', done ? '완료 취소' : '완료로 표시');
  if (done) button.innerHTML = ICONS.check;
  button.addEventListener('click', () => changeStatus(task.id, done ? 'todo' : 'done'));
  return button;
}

function createTitle(task) {
  const done = task.status === 'done';
  const title = el(
    'p',
    'cursor-text break-words text-[15px] leading-snug ' + (done ? 'text-neutral-400 line-through' : ''),
    task.title
  );
  title.addEventListener('click', () =>
    startInlineEdit(title, task.title, 'text-[15px]', (next) => {
      if (!next) return false;
      updateTask(task.id, { title: next });
    })
  );
  return title;
}

// onCommit이 false를 반환하면 변경을 취소하고 원래 요소로 되돌린다
function startInlineEdit(target, value, textClass, onCommit) {
  const input = el(
    'input',
    `w-full rounded-md bg-neutral-100 px-1.5 py-0.5 outline-none ring-2 ring-orange-400 dark:bg-neutral-700 ${textClass}`
  );
  input.value = value;
  target.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    const next = input.value.trim();
    if (save && next !== value && onCommit(next) !== false) return;
    input.replaceWith(target);
  };

  input.addEventListener('keydown', (event) => {
    // 한글 조합 중 Enter는 글자 확정용이므로 무시한다
    if (event.isComposing) return;
    if (event.key === 'Enter') finish(true);
    if (event.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

function createMeta(task, openDueEditor) {
  if (!task.dueDate && task.subtasks.length === 0) return null;
  const row = el('div', 'mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs');

  if (task.dueDate) {
    const due = el(
      'button',
      'flex items-center gap-1 rounded transition hover:underline ' +
        (isOverdue(task) ? 'text-red-500' : 'text-neutral-500')
    );
    due.type = 'button';
    due.innerHTML = ICONS.calendar;
    due.append(formatDue(task.dueDate, task.dueTime));
    due.addEventListener('click', openDueEditor);
    row.append(due);
  }

  if (task.subtasks.length > 0) {
    const doneCount = task.subtasks.filter((s) => s.done).length;
    const toggle = el('button', 'flex items-center gap-1 rounded text-neutral-500 transition hover:text-neutral-800 dark:hover:text-neutral-200');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', String(!task.collapsed));
    toggle.setAttribute('aria-label', task.collapsed ? '하위 할일 펼치기' : '하위 할일 접기');
    toggle.innerHTML = ICONS.subtasks;
    toggle.append(`${doneCount}/${task.subtasks.length}`);
    toggle.insertAdjacentHTML('beforeend', ICONS.chevron);
    if (task.collapsed) toggle.lastElementChild.classList.add('-rotate-90');
    toggle.addEventListener('click', () => setCollapsed(task.id, !task.collapsed));
    row.append(toggle);
  }

  return row;
}

function createDueEditor(task, close) {
  const editor = el('div', 'mt-2 flex flex-wrap items-center gap-2 text-xs');
  const inputClass =
    'rounded-md border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-600 dark:bg-neutral-700';

  const dateInput = el('input', inputClass);
  dateInput.type = 'date';
  dateInput.value = task.dueDate ?? toDateString(new Date());

  const timeInput = el('input', inputClass);
  timeInput.type = 'time';
  timeInput.value = task.dueTime ?? '';

  const clearButton = el('button', 'px-1 text-neutral-500 hover:text-red-500', '지우기');
  clearButton.type = 'button';
  clearButton.addEventListener('click', () => updateTask(task.id, { dueDate: null, dueTime: null }));

  const saveButton = el(
    'button',
    'rounded-md bg-orange-500 px-2.5 py-1 font-medium text-white hover:bg-orange-600',
    '완료'
  );
  saveButton.type = 'button';

  const save = () => {
    const dueDate = dateInput.value || null;
    updateTask(task.id, { dueDate, dueTime: dueDate ? timeInput.value || null : null });
  };
  saveButton.addEventListener('click', save);

  editor.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') save();
    if (event.key === 'Escape') close();
  });

  editor.append(dateInput, timeInput, clearButton, saveButton);
  requestAnimationFrame(() => dateInput.focus());
  return editor;
}

function createSubtaskSection(task) {
  const adding = addingSubtaskTo === task.id;
  const showList = task.subtasks.length > 0 && !task.collapsed;
  if (!showList && !adding) return null;

  const list = el('ul', 'mt-2 flex flex-col gap-0.5');
  if (showList) task.subtasks.forEach((subtask) => list.append(createSubtaskRow(task, subtask)));
  if (adding) list.append(createSubtaskInput(task));
  return list;
}

function createSubtaskRow(task, subtask) {
  const row = el('li', 'group/sub flex items-center gap-2 py-0.5');

  const checkbox = el(
    'button',
    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition ' +
      (subtask.done
        ? 'border-orange-500 bg-orange-500 text-white'
        : 'border-neutral-300 hover:border-orange-400 dark:border-neutral-500')
  );
  checkbox.type = 'button';
  checkbox.setAttribute('role', 'checkbox');
  checkbox.setAttribute('aria-checked', String(subtask.done));
  checkbox.setAttribute('aria-label', subtask.title);
  if (subtask.done) checkbox.innerHTML = ICONS.checkSmall;
  checkbox.addEventListener('click', () => updateSubtask(task.id, subtask.id, { done: !subtask.done }));

  const title = el(
    'span',
    'min-w-0 flex-1 cursor-text break-words text-sm ' +
      (subtask.done ? 'text-neutral-400 line-through' : 'text-neutral-700 dark:text-neutral-300'),
    subtask.title
  );
  // 제목을 비우고 저장하면 하위 할일을 삭제한다
  title.addEventListener('click', () =>
    startInlineEdit(title, subtask.title, 'text-sm', (next) => {
      if (next) updateSubtask(task.id, subtask.id, { title: next });
      else deleteSubtask(task.id, subtask.id);
    })
  );

  const remove = iconButton(
    ICONS.close,
    '하위 할일 삭제',
    `!h-5 !w-5 opacity-0 group-hover/sub:opacity-100 focus:opacity-100 ${TOUCH}:hidden`
  );
  remove.addEventListener('click', () => deleteSubtask(task.id, subtask.id));

  row.append(checkbox, title, remove);
  return row;
}

function createSubtaskInput(task) {
  const row = el('li', 'flex items-center gap-2 py-0.5');
  const dot = el('span', 'h-4 w-4 shrink-0 rounded-full border-[1.5px] border-dashed border-neutral-300 dark:border-neutral-500');
  const input = el(
    'input',
    'min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400'
  );
  input.placeholder = '하위 할일 입력 후 Enter';

  // Enter로 추가하면 보드가 다시 그려지면서 이 입력창이 제거되는데,
  // 그때 발생할 수 있는 blur 이벤트를 무시하기 위한 플래그
  let submitting = false;

  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Enter') {
      const title = input.value.trim();
      if (!title) return close();
      submitting = true;
      addSubtask(task.id, title);
      submitting = false;
    }
    if (event.key === 'Escape') {
      input.value = '';
      close();
    }
  });

  input.addEventListener('blur', () => {
    if (submitting) return;
    const title = input.value.trim();
    addingSubtaskTo = null;
    if (title) addSubtask(task.id, title);
    else removeRow();
  });

  function close() {
    addingSubtaskTo = null;
    removeRow();
  }

  function removeRow() {
    const list = row.parentElement;
    row.remove();
    if (list && list.children.length === 0) list.remove();
  }

  row.append(dot, input);
  requestAnimationFrame(() => input.focus());
  return row;
}

function createActions({ openDueEditor, openSubtaskInput, openTaskMenu }) {
  // 데스크톱: 마우스를 올리면 오른쪽 위에 떠오르는 도구 모음
  // 터치 기기: 카드 안에 + 버튼만 항상 표시 (나머지는 길게 누르기 메뉴로)
  const actions = el(
    'div',
    'flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 ' +
      `${TOUCH}:opacity-100 ` +
      `${HOVER}:absolute ${HOVER}:right-2 ${HOVER}:top-2 ${HOVER}:rounded-lg ${HOVER}:bg-white ${HOVER}:p-0.5 ` +
      `${HOVER}:shadow-sm ${HOVER}:ring-1 ${HOVER}:ring-neutral-200 ` +
      `dark:${HOVER}:bg-neutral-800 dark:${HOVER}:ring-neutral-700`
  );

  const due = iconButton(ICONS.calendarAction, '마감일', `${TOUCH}:hidden`);
  due.addEventListener('click', openDueEditor);

  const add = iconButton(ICONS.plus, '하위 할일 추가');
  add.addEventListener('click', openSubtaskInput);

  const more = iconButton(ICONS.more, '더 보기', `${TOUCH}:hidden`);
  more.setAttribute('aria-haspopup', 'menu');
  more.addEventListener('click', () => {
    const rect = more.getBoundingClientRect();
    openTaskMenu({ x: rect.left, y: rect.bottom + 4 }, more);
  });

  actions.append(due, add, more);
  return actions;
}

function createDragHandle() {
  const handle = el(
    'span',
    `hidden h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center text-neutral-300 ${TOUCH}:flex`
  );
  handle.dataset.dragHandle = '';
  handle.setAttribute('aria-hidden', 'true');
  handle.innerHTML = ICONS.grip;
  return handle;
}

// 터치: 0.5초 길게 누르면 메뉴 / 데스크톱: 우클릭하면 메뉴
function attachLongPress(item, openAt) {
  const LONG_PRESS_MS = 500;
  const MOVE_TOLERANCE_PX = 10;
  let timer = null;
  let start = null;
  let opened = false;

  const cancel = () => {
    clearTimeout(timer);
    start = null;
  };

  item.addEventListener('pointerdown', (event) => {
    opened = false;
    if (event.pointerType !== 'touch' || event.target.closest('input, button, [data-drag-handle]')) return;
    start = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      opened = true;
      navigator.vibrate?.(10);
      openAt(start.x, start.y + 8);
    }, LONG_PRESS_MS);
  });

  item.addEventListener('pointermove', (event) => {
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
  });
  item.addEventListener('pointerup', cancel);
  item.addEventListener('pointercancel', cancel);

  // 안드로이드는 길게 누르면 contextmenu도 발생하므로 메뉴가 두 번 열리지 않게 한다
  item.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (start) {
      clearTimeout(timer);
      if (!opened) openAt(start.x, start.y + 8);
      opened = true;
      return;
    }
    openAt(event.clientX, event.clientY);
  });

  // 길게 눌러 메뉴를 연 뒤 손을 뗄 때 발생하는 클릭이 제목 편집을 시작하지 않게 막는다
  item.addEventListener(
    'click',
    (event) => {
      if (!opened) return;
      opened = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );
}

function removeTask(task) {
  const removed = deleteTask(task.id);
  if (!removed) return;
  showToast('할일을 삭제했습니다', {
    actionLabel: '되돌리기',
    onAction: () => restoreTasks([removed]),
  });
}
