import { exportState, importState } from './store.js';
import { toDateString } from './date.js';
import { openMenu } from './menu.js';
import { showToast } from './toast.js';

function downloadBackup() {
  const json = JSON.stringify(exportState(), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `pomodoro-kanban-backup-${toDateString(new Date())}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function restoreFromFile(file) {
  try {
    const data = JSON.parse(await file.text());
    const previous = importState(data);
    showToast(`할일 ${data.tasks.length}개를 가져왔습니다`, {
      actionLabel: '되돌리기',
      onAction: () => importState(previous),
    });
  } catch (error) {
    console.error(error);
    showToast(`백업을 가져오지 못했습니다: ${error.message}`);
  }
}

export function initBackup() {
  const button = document.querySelector('[data-app-menu]');

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;
  document.body.append(fileInput);

  fileInput.addEventListener('change', () => {
    const [file] = fileInput.files;
    fileInput.value = '';
    if (file) restoreFromFile(file);
  });

  button.addEventListener('click', () => {
    const rect = button.getBoundingClientRect();
    openMenu(
      [
        { label: '백업 내보내기 (JSON)', onSelect: downloadBackup },
        { label: '백업 가져오기', onSelect: () => fileInput.click() },
      ],
      { x: rect.right, y: rect.bottom + 4 },
      button
    );
  });
}
