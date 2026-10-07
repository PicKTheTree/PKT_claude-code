const STORAGE_KEY = 'pomodoro-kanban';
const SCHEMA_VERSION = 1;

function createDefaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    tasks: [],
    sessions: [],
    settings: { workMin: 25, breakMin: 5, theme: 'system' },
  };
}

function load() {
  const defaults = createDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    return {
      ...defaults,
      ...saved,
      settings: { ...defaults.settings, ...saved.settings },
    };
  } catch (error) {
    console.error('저장된 데이터를 불러오지 못했습니다.', error);
    return defaults;
  }
}

let state = load();
const listeners = new Set();

function commit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('데이터를 저장하지 못했습니다.', error);
  }
  listeners.forEach((listener) => listener());
}

const now = () => new Date().toISOString();

function findTask(id) {
  return state.tasks.find((t) => t.id === id);
}

function columnOrders(status) {
  return state.tasks.filter((t) => t.status === status).map((t) => t.order);
}

function nextOrder(status) {
  const orders = columnOrders(status);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

function topOrder(status) {
  const orders = columnOrders(status);
  return orders.length ? Math.min(...orders) - 1 : 0;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTasksByStatus(status) {
  return state.tasks
    .filter((t) => t.status === status)
    .sort((a, b) => a.order - b.order);
}

export function addTask(title, status = 'todo') {
  const timestamp = now();
  state.tasks.push({
    id: crypto.randomUUID(),
    title,
    status,
    order: nextOrder(status),
    dueDate: null,
    dueTime: null,
    alarmAt: null,
    alarmFired: false,
    subtasks: [],
    collapsed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: status === 'done' ? timestamp : null,
  });
  commit();
}

export function updateTask(id, patch) {
  const task = findTask(id);
  if (!task) return;
  Object.assign(task, patch, { updatedAt: now() });
  commit();
}

// 완료로 보낼 때는 맨 위(최근 완료 순), 나머지는 맨 아래에 놓는다
export function changeStatus(id, status) {
  const task = findTask(id);
  if (!task || task.status === status) return;
  updateTask(id, {
    status,
    order: status === 'done' ? topOrder('done') : nextOrder(status),
    completedAt: status === 'done' ? now() : null,
  });
}

// 접기/펼치기는 화면 설정이라 updatedAt을 바꾸지 않는다
export function setCollapsed(id, collapsed) {
  const task = findTask(id);
  if (!task) return;
  task.collapsed = collapsed;
  commit();
}

export function addSubtask(taskId, title) {
  const task = findTask(taskId);
  if (!task) return;
  task.subtasks.push({ id: crypto.randomUUID(), title, done: false });
  task.collapsed = false;
  task.updatedAt = now();
  commit();
}

export function updateSubtask(taskId, subtaskId, patch) {
  const subtask = findTask(taskId)?.subtasks.find((s) => s.id === subtaskId);
  if (!subtask) return;
  Object.assign(subtask, patch);
  findTask(taskId).updatedAt = now();
  commit();
}

export function deleteSubtask(taskId, subtaskId) {
  const task = findTask(taskId);
  if (!task) return;
  task.subtasks = task.subtasks.filter((s) => s.id !== subtaskId);
  task.updatedAt = now();
  commit();
}

export function moveTask(id, toStatus, toIndex) {
  const task = findTask(id);
  if (!task) return;

  if (task.status !== toStatus) {
    task.completedAt = toStatus === 'done' ? now() : null;
    task.status = toStatus;
    task.updatedAt = now();
  }

  const column = getTasksByStatus(toStatus).filter((t) => t.id !== id);
  column.splice(toIndex, 0, task);
  column.forEach((t, index) => {
    t.order = index;
  });
  commit();
}

export function deleteTask(id) {
  const task = findTask(id);
  if (!task) return null;
  state.tasks = state.tasks.filter((t) => t.id !== id);
  commit();
  return task;
}

export function clearDoneTasks() {
  const removed = state.tasks.filter((t) => t.status === 'done');
  state.tasks = state.tasks.filter((t) => t.status !== 'done');
  commit();
  return removed;
}

export function restoreTasks(tasks) {
  state.tasks.push(...tasks);
  commit();
}
