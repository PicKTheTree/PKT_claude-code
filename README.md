# 🍅 뽀모도로 칸반보드 (Pomodoro Kanban Board)

순수 웹 기반의 작업 관리 시스템으로, 할일 목록과 뽀모도로 타이머, 알람 기능을 통해 생산성을 향상시키는 도구입니다.

## 📋 주요 기능

### 핵심 요구사항
1. **할일 관리**
   - 할일 추가/수정/삭제
   - 하위 할일(Sub-task) 추가 및 관리
   - 우선순위 설정
   - 상태 관리 (TODO, 진행 중, 완료)

2. **뽀모도로 타이머**
   - 기본 설정: 25분 작업 / 5분 휴식
   - 사용자 정의 시간 설정 가능
   - 타이머 일시정지/재개/초기화 기능
   - 세션별 시간 기록

3. **알람 기능**
   - 특정 시간 알람 설정
   - 타이머 종료 알람
   - 브라우저 알림

4. **데이터 저장**
   - LocalStorage를 통한 로컬 저장
   - 페이지 새로고침 후에도 데이터 유지

### 향후 확장 계획
- Notion API 연동
- Google Calendar 연동
- 통계 및 분석 대시보드
- 협업 기능

## 🛠️ 기술 스택

- **Frontend**: HTML5, CSS3 (Tailwind CSS), Vanilla JavaScript
- **Storage**: Browser LocalStorage
- **Design**: 반응형 디자인 (모바일 / 태블릿 / 데스크톱)

## 🚀 시작하기

### 설치
```bash
git clone <repository-url>
cd pomodoro-kanban-board
```

### 실행
브라우저에서 `index.html` 파일을 열면 됩니다.

```bash
# 간단한 로컬 서버로 실행 (선택사항)
python -m http.server 8000
# 또는
npx http-server
```

## 📁 프로젝트 구조

```
pomodoro-kanban-board/
├── index.html          # 메인 HTML 파일
├── css/
│   └── styles.css      # 스타일시트 (Tailwind CSS)
├── js/
│   ├── app.js          # 메인 애플리케이션 로직
│   ├── storage.js      # LocalStorage 관리
│   ├── timer.js        # 뽀모도로 타이머 로직
│   ├── tasks.js        # 할일 관리 로직
│   └── ui.js           # UI 업데이트 로직
├── README.md           # 프로젝트 문서
└── package.json        # 프로젝트 메타데이터 (선택사항)
```

## 🎨 디자인 철학

- **미니멀함**: 불필요한 요소를 제거하고 핵심만 표현
- **모던함**: 토스, 노션 스타일의 세련된 UI
- **직관성**: 사용자가 쉽게 이해하고 사용할 수 있는 인터페이스
- **반응형**: 모든 기기에서 최적의 경험 제공

## ⌨️ 주요 단축키 (계획)

- `Ctrl + N`: 새 할일 추가
- `Ctrl + S`: 저장
- `Spacebar`: 타이머 시작/일시정지

## 📊 데이터 구조

### Task Object
```javascript
{
  id: string,
  title: string,
  description: string,
  priority: 'high' | 'medium' | 'low',
  status: 'todo' | 'in-progress' | 'completed',
  dueDate: string (ISO 8601),
  timeSpent: number (분 단위),
  subtasks: Task[],
  alarmTime: string (HH:mm),
  createdAt: string (ISO 8601),
  updatedAt: string (ISO 8601)
}
```

## 🔒 보안 및 개인정보

- 모든 데이터는 로컬 저장소에만 저장됩니다.
- 서버로 전송되는 데이터가 없습니다.
- 사용자의 모든 정보는 개인용 컴퓨터에만 저장됩니다.

## 📝 라이센스

MIT License

## 👤 기여

이슈 및 풀 리퀘스트는 언제든 환영합니다!

---

**마지막 업데이트**: 2026-10-06
