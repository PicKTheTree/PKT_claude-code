// 타이머의 시간 계산과 상태 전환만 담당한다 (DOM 없음)
// 남은 시간은 1초씩 빼지 않고 "종료 시각(endAt)"에서 계산한다.
// 브라우저는 백그라운드 탭의 setInterval을 느리게 돌리기 때문에, 빼기 방식은 시간이 밀린다.
import { getSettings, getTimerState, setTimerState, addSession } from './store.js';
import { toDateString } from './date.js';

const MIN_SEC = 60;

function modeDurationSec(mode) {
  const { workMin, breakMin } = getSettings();
  return (mode === 'work' ? workMin : breakMin) * 60;
}

function idleState(mode) {
  const durationSec = modeDurationSec(mode);
  return {
    mode,
    status: 'idle',
    durationSec,
    remainingSec: durationSec,
    endAt: null,
    startedAt: null,
    runStartedAt: null,
    accumulatedSec: 0,
  };
}

// 일시정지 시간을 뺀, 실제로 타이머가 돌아간 시간
function runSeconds(timer, untilMs) {
  const current = timer.status === 'running' ? (untilMs - timer.runStartedAt) / 1000 : 0;
  return timer.accumulatedSec + current;
}

function recordSession(completed, untilMs = Date.now()) {
  const timer = getTimerState();
  if (!timer.startedAt) return;
  addSession({
    type: timer.mode,
    startedAt: timer.startedAt,
    durationSec: Math.round(runSeconds(timer, untilMs)),
    completed,
  });
}

export function getRemainingSec(atMs = Date.now()) {
  const timer = getTimerState();
  if (timer.status !== 'running') return timer.remainingSec;
  return Math.max(0, (timer.endAt - atMs) / 1000);
}

export function start() {
  const timer = getTimerState();
  if (timer.status === 'running') return;
  const at = Date.now();
  setTimerState({
    status: 'running',
    endAt: at + timer.remainingSec * 1000,
    runStartedAt: at,
    startedAt: timer.startedAt ?? new Date(at).toISOString(),
  });
}

export function pause() {
  const timer = getTimerState();
  if (timer.status !== 'running') return;
  const at = Date.now();
  setTimerState({
    status: 'paused',
    remainingSec: getRemainingSec(at),
    accumulatedSec: runSeconds(timer, at),
    endAt: null,
    runStartedAt: null,
  });
}

export function toggle() {
  if (getTimerState().status === 'running') pause();
  else start();
}

export function reset() {
  recordSession(false);
  setTimerState(idleState(getTimerState().mode));
}

export function switchMode(mode) {
  if (mode === getTimerState().mode) return;
  recordSession(false);
  setTimerState(idleState(mode));
}

export function skip() {
  const { mode } = getTimerState();
  recordSession(false);
  setTimerState(idleState(mode === 'work' ? 'break' : 'work'));
}

// 원 한 바퀴 = 이번 세션 길이이므로, 1분 ~ 세션 길이 사이에서만 조절된다
export function setRemaining(seconds) {
  const timer = getTimerState();
  const clamped = Math.min(timer.durationSec, Math.max(MIN_SEC, seconds));
  if (timer.status === 'running') setTimerState({ endAt: Date.now() + clamped * 1000 });
  else setTimerState({ remainingSec: clamped });
}

// 시작 전이면 바뀐 설정을 지금 세션에 바로 반영하고, 진행 중이면 다음 세션부터 반영한다
export function applySettings() {
  const timer = getTimerState();
  if (!timer.startedAt) setTimerState(idleState(timer.mode));
}

function complete({ allowAutoStart }) {
  const timer = getTimerState();
  const finishedMode = timer.mode;
  recordSession(true, timer.endAt);
  setTimerState(idleState(finishedMode === 'work' ? 'break' : 'work'));
  if (allowAutoStart && finishedMode === 'work' && getSettings().autoStart) start();
}

// 화면이 주기적으로 호출한다. 이번 호출에서 세션이 끝났으면 true
export function tick() {
  const timer = getTimerState();
  if (timer.status !== 'running' || getRemainingSec() > 0) return false;
  complete({ allowAutoStart: true });
  return true;
}

// 탭을 닫아 둔 사이에 끝난 세션은 기록만 하고, 다음 세션을 자동으로 시작하지 않는다
export function catchUpAfterLoad() {
  const timer = getTimerState();
  if (timer.status === 'running' && getRemainingSec() <= 0) complete({ allowAutoStart: false });
}

export function getTodayFocusSec(sessions) {
  const today = toDateString(new Date());
  const isToday = (iso) => toDateString(new Date(iso)) === today;

  const recorded = sessions
    .filter((s) => s.type === 'work' && isToday(s.startedAt))
    .reduce((sum, s) => sum + s.durationSec, 0);

  const timer = getTimerState();
  const current =
    timer.mode === 'work' && timer.startedAt && isToday(timer.startedAt) ? runSeconds(timer, Date.now()) : 0;

  return recorded + current;
}
