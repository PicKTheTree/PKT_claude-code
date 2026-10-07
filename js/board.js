import {
  addTask,
  getTasksByStatus,
  moveTask,
  subscribe,
  clearDoneTasks,
  restoreTasks,
} from './store.js';
import { createTaskItem } from './taskItem.js';
import { isOverdue } from './date.js';
import { showToast } from './toast.js';

const STATUSES = ['todo', 'doing', 'done'];

function render() {
  for (const status of STATUSES) {
    const tasks = getTasksByStatus(status);
    document.querySelector(`[data-list="${status}"]`).replaceChildren(...tasks.map(createTaskItem));
    document.querySelector(`[data-count="${status}"]`).textContent = tasks.length;

    const overdueBadge = document.querySelector(`[data-overdue="${status}"]`);
    if (overdueBadge) {
      const overdueCount = tasks.filter(isOverdue).length;
      overdueBadge.textContent = `⚠ ${overdueCount}`;
      overdueBadge.title = `마감일이 지난 할일 ${overdueCount}개`;
      overdueBadge.hidden = overdueCount === 0;
    }
  }
  document.querySelector('[data-clear-done]').hidden = getTasksByStatus('done').length === 0;
}

function setupClearDone() {
  document.querySelector('[data-clear-done]').addEventListener('click', () => {
    const removed = clearDoneTasks();
    showToast(`완료된 할일 ${removed.length}개를 지웠습니다`, {
      actionLabel: '되돌리기',
      onAction: () => restoreTasks(removed),
    });
  });
}

function setupAddForm(wrapper) {
  const status = wrapper.dataset.add;
  const openButton = wrapper.querySelector('[data-add-open]');
  const input = wrapper.querySelector('[data-add-input]');

  const open = () => {
    openButton.hidden = true;
    input.hidden = false;
    input.focus();
  };

  const close = () => {
    input.value = '';
    input.hidden = true;
    openButton.hidden = false;
  };

  const submit = () => {
    const title = input.value.trim();
    if (title) addTask(title, status);
    input.value = '';
  };

  openButton.addEventListener('click', open);

  input.addEventListener('keydown', (event) => {
    // 한글 조합 중 Enter는 글자 확정용이므로 무시한다
    if (event.isComposing) return;
    if (event.key === 'Enter') submit();
    if (event.key === 'Escape') close();
  });

  input.addEventListener('blur', () => {
    submit();
    close();
  });
}

function setupDragAndDrop() {
  // 터치 기기에서는 카드 길게 누르기를 메뉴에 쓰므로, 드래그는 손잡이(≡)로만 시작한다
  const isTouch = matchMedia('(hover: none)').matches;

  for (const status of STATUSES) {
    // Sortable은 index.html에서 CDN으로 불러온 전역 객체다
    Sortable.create(document.querySelector(`[data-list="${status}"]`), {
      group: 'tasks',
      animation: 150,
      ...(isTouch && { handle: '[data-drag-handle]' }),
      // 제목을 편집 중인 입력창에서는 드래그가 시작되지 않게 한다
      filter: 'input',
      preventOnFilter: false,
      onEnd: (event) => {
        moveTask(event.item.dataset.id, event.to.dataset.list, event.newIndex);
      },
    });
  }
}

export function initBoard() {
  document.querySelectorAll('[data-add]').forEach(setupAddForm);
  setupDragAndDrop();
  setupClearDone();
  subscribe(render);
  render();
}
