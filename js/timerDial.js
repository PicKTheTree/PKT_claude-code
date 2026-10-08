// 원형 다이얼: 그리기와 드래그 입력만 담당한다.
// 값은 0~1 사이 비율(fraction)로 주고받고, 몇 분인지는 사용하는 쪽이 계산한다.
const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 86;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

export function createDial(svg, { getFraction, onDragStart, onDrag, onDragEnd, onStep }) {
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);

  const track = svgEl('circle', { cx: CENTER, cy: CENTER, r: RADIUS, fill: 'none', 'stroke-width': 14 });
  track.setAttribute('class', 'stroke-neutral-100 dark:stroke-neutral-800');

  const arc = svgEl('circle', {
    cx: CENTER,
    cy: CENTER,
    r: RADIUS,
    fill: 'none',
    'stroke-width': 14,
    'stroke-linecap': 'round',
    'stroke-dasharray': CIRCUMFERENCE,
    transform: `rotate(-90 ${CENTER} ${CENTER})`,
  });

  const knob = svgEl('circle', { r: 11, fill: 'white', 'stroke-width': 4 });
  knob.setAttribute('class', 'cursor-grab drop-shadow');

  svg.append(track, arc, knob);

  function update({ fraction, color }) {
    arc.setAttribute('stroke-dashoffset', CIRCUMFERENCE * (1 - fraction));
    arc.style.stroke = color;
    knob.style.stroke = color;
    const angle = fraction * 2 * Math.PI;
    knob.setAttribute('cx', CENTER + RADIUS * Math.sin(angle));
    knob.setAttribute('cy', CENTER - RADIUS * Math.cos(angle));
  }

  // 화면 좌표 → 12시 방향부터 시계 방향으로 잰 비율(0~1)과 중심에서의 거리
  function readPointer(event) {
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * SIZE) / rect.width - CENTER;
    const y = ((event.clientY - rect.top) * SIZE) / rect.height - CENTER;
    let angle = Math.atan2(x, -y);
    if (angle < 0) angle += 2 * Math.PI;
    return { fraction: angle / (2 * Math.PI), distance: Math.hypot(x, y) };
  }

  let dragging = false;
  let lastFraction = 0;

  svg.addEventListener('pointerdown', (event) => {
    const { distance } = readPointer(event);
    // 가운데 숫자 부분이 아니라 원 테두리 근처를 잡았을 때만 드래그한다
    if (distance < RADIUS - 30 || distance > RADIUS + 20) return;
    event.preventDefault();
    svg.setPointerCapture(event.pointerId);
    dragging = true;
    lastFraction = getFraction();
    onDragStart();
    handleMove(event);
  });

  function handleMove(event) {
    if (!dragging) return;
    let { fraction } = readPointer(event);
    // 12시 지점을 넘어가며 0 ↔ 1로 튀지 않도록 끝에서 멈춘다
    if (lastFraction > 0.75 && fraction < 0.25) fraction = 1;
    else if (lastFraction < 0.25 && fraction > 0.75) fraction = 0;
    lastFraction = fraction;
    onDrag(fraction);
  }

  svg.addEventListener('pointermove', handleMove);

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    onDragEnd();
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  // 키보드: 방향키로 1분씩 조절
  svg.addEventListener('keydown', (event) => {
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    onStep(step);
  });

  return { update, isDragging: () => dragging };
}
