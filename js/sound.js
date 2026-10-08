// 브라우저는 사용자 동작(클릭 등) 없이 소리를 재생하지 못하게 막는다.
// 그래서 시작 버튼을 누를 때 unlockAudio()로 미리 오디오를 깨워 두고,
// 세션이 끝났을 때 그 오디오로 종료음을 낸다.
let context = null;

export function unlockAudio() {
  context ??= new AudioContext();
  if (context.state === 'suspended') context.resume();
}

export function playChime() {
  if (!context) return;
  const startAt = context.currentTime;
  [880, 660, 880].forEach((frequency, index) => {
    const at = startAt + index * 0.25;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.25);
  });
}
