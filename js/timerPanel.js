import { getSettings, updateSettings, getTimerState, getSessions, subscribe } from './store.js';
import * as timer from './timer.js';
import { createDial } from './timerDial.js';
import { unlockAudio, playChime } from './sound.js';

const MODE_COLORS = { work: '#ef4444', break: '#10b981' };
const MODE_LABELS = { work: '작업', break: '휴식' };
const STATUS_TEXT = {
  idle: () => '준비',
  paused: () => '일시정지',
  running: (mode) => (mode === 'work' ? '집중하는 중' : '쉬는 중'),
};
const TOGGLE_TEXT = { idle: '시작', running: '일시정지', paused: '계속' };
const ORIGINAL_TITLE = document.title;
const RENDER_INTERVAL_MS = 250;

const ICONS = {
  soundOn:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>',
  soundOff:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
};

function formatTime(seconds) {
  const whole = Math.ceil(seconds);
  const minutes = String(Math.floor(whole / 60)).padStart(2, '0');
  const rest = String(whole % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

export function initTimerPanel() {
  const panel = document.querySelector('[data-timer]');
  const $ = (selector) => panel.querySelector(selector);

  const timeEl = $('[data-time]');
  const statusEl = $('[data-status]');
  const toggleButton = $('[data-toggle]');
  const muteButton = $('[data-mute]');
  const focusEl = $('[data-focus]');
  const settingsSummary = $('[data-settings-summary]');
  const dialSvg = $('[data-dial]');
  const modeTabs = panel.querySelectorAll('[data-mode]');
  const settingInputs = panel.querySelectorAll('[data-setting]');

  const currentFraction = () => {
    const { durationSec } = getTimerState();
    return Math.min(1, timer.getRemainingSec() / durationSec);
  };

  let resumeAfterDrag = false;
  const dial = createDial(dialSvg, {
    getFraction: currentFraction,
    onDragStart: () => {
      // 드래그하는 동안에는 잠시 멈추고, 손을 떼면 이어서 간다
      resumeAfterDrag = getTimerState().status === 'running';
      if (resumeAfterDrag) timer.pause();
    },
    onDrag: (fraction) => {
      const { durationSec } = getTimerState();
      timer.setRemaining(Math.round((fraction * durationSec) / 60) * 60);
      render();
    },
    onDragEnd: () => {
      if (resumeAfterDrag) timer.start();
    },
    onStep: (step) => {
      const minutes = Math.ceil(timer.getRemainingSec() / 60);
      timer.setRemaining((minutes + step) * 60);
      render();
    },
  });

  function render() {
    const { mode, status, durationSec } = getTimerState();
    const remaining = timer.getRemainingSec();
    const color = MODE_COLORS[mode];
    const time = formatTime(remaining);

    timeEl.textContent = time;
    statusEl.textContent = STATUS_TEXT[status](mode);
    toggleButton.textContent = TOGGLE_TEXT[status];
    toggleButton.style.backgroundColor = color;
    dial.update({ fraction: Math.min(1, remaining / durationSec), color });

    dialSvg.setAttribute('aria-valuemax', durationSec / 60);
    dialSvg.setAttribute('aria-valuenow', Math.ceil(remaining / 60));
    dialSvg.setAttribute('aria-valuetext', `${MODE_LABELS[mode]} ${Math.ceil(remaining / 60)}분 남음`);

    modeTabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.mode === mode)));

    const focusMin = Math.floor(timer.getTodayFocusSec(getSessions()) / 60);
    focusEl.textContent = `오늘 집중 ${focusMin}분`;

    document.title = status === 'idle' ? ORIGINAL_TITLE : `${time} · ${MODE_LABELS[mode]}`;
  }

  function renderSettings() {
    const settings = getSettings();
    settingInputs.forEach((input) => {
      const key = input.dataset.setting;
      if (input.type === 'checkbox') input.checked = settings[key];
      else input.value = settings[key];
    });
    settingsSummary.textContent = `⚙ 작업 ${settings.workMin}분 · 휴식 ${settings.breakMin}분`;
    muteButton.innerHTML = settings.muted ? ICONS.soundOff : ICONS.soundOn;
    muteButton.setAttribute('aria-pressed', String(settings.muted));
    muteButton.setAttribute('aria-label', settings.muted ? '소리 켜기' : '소리 끄기');
    muteButton.title = muteButton.getAttribute('aria-label');
  }

  toggleButton.addEventListener('click', () => {
    unlockAudio();
    timer.toggle();
  });
  $('[data-reset]').addEventListener('click', timer.reset);
  $('[data-skip]').addEventListener('click', timer.skip);
  modeTabs.forEach((tab) => tab.addEventListener('click', () => timer.switchMode(tab.dataset.mode)));
  muteButton.addEventListener('click', () => updateSettings({ muted: !getSettings().muted }));

  settingInputs.forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.setting;
      if (input.type === 'checkbox') {
        updateSettings({ [key]: input.checked });
        return;
      }
      const minutes = Math.min(60, Math.max(1, Math.round(Number(input.value) || 1)));
      updateSettings({ [key]: minutes });
      timer.applySettings();
    });
  });

  // 스페이스바: 아무것도 선택(포커스)하지 않은 상태에서만 시작/일시정지
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.target !== document.body) return;
    event.preventDefault();
    unlockAudio();
    timer.toggle();
  });

  // 새로고침 후 이어지는 타이머도 종료음을 낼 수 있도록, 첫 클릭/터치 때 오디오를 깨운다
  document.addEventListener('pointerdown', unlockAudio, { once: true });

  timer.catchUpAfterLoad();
  subscribe(['timer', 'sessions'], render);
  subscribe(['settings'], renderSettings);
  renderSettings();
  render();

  setInterval(() => {
    if (timer.tick() && !getSettings().muted) playChime();
    if (!dial.isDragging()) render();
  }, RENDER_INTERVAL_MS);
}
