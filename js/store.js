import { getSampleTasks } from './sampleData.js';

const STORAGE_KEY = 'pomodoro-kanban';
const SCHEMA_VERSION = 1;
const STATUSES = ['todo', 'doing', 'done'];

const now = () => new Date().toISOString();

const DEFAULT_SETTINGS = { workMin: 25, breakMin: 5, autoStart: true, muted: false, theme: 'system' };

function createDefaultState() {
  const durationSec = DEFAULT_SETTINGS.workMin * 60;
  return {
    schemaVersion: SCHEMA_VERSION,
    tasks: [],
    sessions: [],
    settings: { ...DEFAULT_SETTINGS },
    timer: {
      mode: 'work',
      status: 'idle',
      durationSec,
      remainingSec: durationSec,
      endAt: null,
      startedAt: null,
      runStartedAt: null,
      accumulatedSec: 0,
    },
  };
}

function createTask({ title, status = 'todo', order = 0, dueDate = null, dueTime = null, subtasks = [] }) {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    title,
    status,
    order,
    dueDate,
    dueTime,
    alarmAt: null,
    alarmFired: false,
    subtasks,
    collapsed: false,
    // 완료 직전의 하위 할일 체크 상태 { [subtaskId]: boolean }. 완료 해제 시 복원에 쓴다
    subtaskStateBeforeDone: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: status === 'done' ? timestamp : null,
  };
}

function createSampleState() {
  const columnCounts = { todo: 0, doing: 0, done: 0 };
  const tasks = getSampleTasks().map((sample) =>
    createTask({
      ...sample,
      order: columnCounts[sample.status]++,
      subtasks: (sample.subtasks ?? []).map(([title, done]) => ({ id: crypto.randomUUID(), title, done })),
    })
  );
  return { ...createDefaultState(), tasks };
}

function normalize(saved) {
  const defaults = createDefaultState();
  return {
    ...defaults,
    ...saved,
    settings: { ...defaults.settings, ...saved.settings },
    timer: { ...defaults.timer, ...saved.timer },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : createSampleState();
  } catch (error) {
    console.error('저장된 데이터를 불러오지 못했습니다.', error);
    return createDefaultState();
  }
}

let state = load();

// 영역(scope)별로 알림을 나눠, 타이머가 바뀔 때 보드가 다시 그려지지 않게 한다
// scope: 'tasks' | 'timer' | 'settings' | 'sessions' | '*'(전체)
const listeners = new Map();

function commit(scope = 'tasks') {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('데이터를 저장하지 못했습니다.', error);
  }
  for (const [listener, scopes] of listeners) {
    if (scope === '*' || scopes.includes(scope)) listener();
  }
}

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

export function subscribe(scopes, listener) {
  listeners.set(listener, scopes);
  return () => listeners.delete(listener);
}

export function getTasksByStatus(status) {
  return state.tasks
    .filter((t) => t.status === status)
    .sort((a, b) => a.order - b.order);
}

export function addTask(title, status = 'todo') {
  state.tasks.push(createTask({ title, status, order: nextOrder(status) }));
  commit();
}

export function updateTask(id, patch) {
  const task = findTask(id);
  if (!task) return;
  Object.assign(task, patch, { updatedAt: now() });
  commit();
}

// 체크박스 · 메뉴 · 드래그 모두 이 함수를 거쳐 상태가 바뀐다
function applyStatus(task, status) {
  const done = status === 'done';

  if (done) {
    task.subtaskStateBeforeDone = Object.fromEntries(task.subtasks.map((s) => [s.id, s.done]));
    task.subtasks.forEach((s) => (s.done = true));
  } else if (task.subtaskStateBeforeDone) {
    // 기록에 없는 항목(완료 중에 추가했거나 직접 체크를 바꾼 것)은 현재 상태를 유지한다
    const before = task.subtaskStateBeforeDone;
    task.subtasks.forEach((s) => {
      if (s.id in before) s.done = before[s.id];
    });
    task.subtaskStateBeforeDone = null;
  }

  task.status = status;
  task.completedAt = done ? now() : null;
  task.updatedAt = now();
}

// 완료로 보낼 때는 맨 위(최근 완료 순), 나머지는 맨 아래에 놓는다
export function changeStatus(id, status) {
  const task = findTask(id);
  if (!task || task.status === status) return;
  task.order = status === 'done' ? topOrder('done') : nextOrder(status);
  applyStatus(task, status);
  commit();
}

export function moveTask(id, toStatus, toIndex) {
  const task = findTask(id);
  if (!task) return;

  if (task.status !== toStatus) applyStatus(task, toStatus);

  const column = getTasksByStatus(toStatus).filter((t) => t.id !== id);
  column.splice(toIndex, 0, task);
  column.forEach((t, index) => {
    t.order = index;
  });
  commit();
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
  const task = findTask(taskId);
  const subtask = task?.subtasks.find((s) => s.id === subtaskId);
  if (!subtask) return;
  Object.assign(subtask, patch);
  // 완료 상태에서 사용자가 직접 체크를 바꾸면, 완료 해제 시 그 선택을 존중한다
  if ('done' in patch && task.subtaskStateBeforeDone) delete task.subtaskStateBeforeDone[subtaskId];
  task.updatedAt = now();
  commit();
}

export function deleteSubtask(taskId, subtaskId) {
  const task = findTask(taskId);
  if (!task) return;
  task.subtasks = task.subtasks.filter((s) => s.id !== subtaskId);
  task.updatedAt = now();
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

export function exportState() {
  return structuredClone(state);
}

function validateBackup(data) {
  if (!data || !Array.isArray(data.tasks)) throw new Error('할일 목록(tasks)이 없습니다.');
  if (data.schemaVersion > SCHEMA_VERSION) throw new Error('더 최신 버전에서 만든 백업입니다.');
  const valid = data.tasks.every(
    (t) =>
      typeof t?.id === 'string' &&
      typeof t.title === 'string' &&
      STATUSES.includes(t.status) &&
      typeof t.order === 'number' &&
      Array.isArray(t.subtasks)
  );
  if (!valid) throw new Error('할일 데이터 형식이 올바르지 않습니다.');
}

// 전체 데이터를 교체하고, 되돌리기용으로 이전 데이터를 반환한다
export function importState(data) {
  validateBackup(data);
  const previous = state;
  state = normalize(structuredClone(data));
  commit('*');
  return previous;
}

export function getSettings() {
  return state.settings;
}

export function updateSettings(patch) {
  Object.assign(state.settings, patch);
  commit('settings');
}

export function getTimerState() {
  return state.timer;
}

export function setTimerState(patch) {
  Object.assign(state.timer, patch);
  commit('timer');
}

export function getSessions() {
  return state.sessions;
}

export function addSession(session) {
  state.sessions.push({ id: crypto.randomUUID(), ...session });
  commit('sessions');
}
