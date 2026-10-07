import { toDateString } from './date.js';

function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

// 처음 방문했을 때만 보여 주는 예시. 하위 할일이 사용법 안내를 겸한다
export function getSampleTasks() {
  return [
    {
      title: '👋 환영합니다! 하나씩 해 보세요',
      status: 'todo',
      subtasks: [
        ['제목을 클릭하면 수정돼요', true],
        ['카드를 옆 컬럼으로 끌어 보세요', false],
        ['우클릭 · 길게 누르면 메뉴', false],
        ['1/4를 누르면 접혀요', false],
      ],
    },
    { title: '포트폴리오 README 다듬기', status: 'todo', dueDate: daysFromToday(-1) },
    {
      title: '장보기',
      status: 'todo',
      dueDate: daysFromToday(0),
      dueTime: '18:00',
      subtasks: [
        ['우유', false],
        ['계란', true],
      ],
    },
    { title: '뽀모도로 타이머로 25분 집중하기', status: 'doing', dueDate: daysFromToday(1) },
    { title: '칸반보드 둘러보기', status: 'done' },
  ];
}
