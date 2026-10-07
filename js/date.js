// toISOString()은 UTC 기준이라 한국 시간 오전 9시 전에는 날짜가 하루 밀린다
export function toDateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isOverdue(task) {
  if (!task.dueDate || task.status === 'done') return false;
  return new Date(`${task.dueDate}T${task.dueTime ?? '23:59:59'}`) < new Date();
}

export function formatDue(dueDate, dueTime) {
  const target = new Date(`${dueDate}T00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((target - today) / 86_400_000);

  let label;
  if (dayDiff === 0) label = '오늘';
  else if (dayDiff === 1) label = '내일';
  else if (dayDiff === -1) label = '어제';
  else if (target.getFullYear() === today.getFullYear())
    label = `${target.getMonth() + 1}월 ${target.getDate()}일`;
  else label = `${target.getFullYear()}년 ${target.getMonth() + 1}월 ${target.getDate()}일`;

  return dueTime ? `${label} ${dueTime}` : label;
}
