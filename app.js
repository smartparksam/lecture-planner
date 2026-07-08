/* ==========================================
   강의일정 비서 앱 - 핵심 애플리케이션 코어 (app.js)
   역할: 탭 전환, 데이터 모델(localStorage), 달력 렌더링,
         STT(음성인식), 반복 일정 생성/수정/삭제 비즈니스 로직 및 백업 관리
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // 1. 상태 객체 (State)
    // ----------------------------------------------------
    const state = {
        currentTab: 'tab-today',
        currentDate: new Date(2026, 6, 8), // 2026년 7월 8일 기준 (월 인덱스는 0부터 시작하므로 6 = 7월)
        selectedDateStr: '2026-07-08',     // 선택된 날짜 문자열
        lectures: [],                      // 전체 강의 일정 배열
        activeLecture: null,               // 상세 수정용 강의 객체
        tempParsedEvents: []               // 반복 일정 등 저장 직전의 대기 일정 목록
    };

    // ----------------------------------------------------
    // 2. DOM 요소 선택
    // ----------------------------------------------------
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const headerDateText = document.getElementById('current-header-date');

    // 대시보드 리스트 요소들
    const todayLectures = document.getElementById('today-lectures');
    const tomorrowLectures = document.getElementById('tomorrow-lectures');
    const weekLectures = document.getElementById('week-lectures');
    const todayCount = document.getElementById('today-count');
    const tomorrowCount = document.getElementById('tomorrow-count');
    const weekCount = document.getElementById('week-count');

    // 메인화면의 간편 실행 버튼들
    const btnQuickVoice = document.getElementById('btn-quick-voice');
    const btnQuickText = document.getElementById('btn-quick-text');

    // 캘린더 요소들
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const calendarDaysGrid = document.getElementById('calendar-days-grid');
    const btnPrevMonth = document.getElementById('btn-prev-month');
    const btnNextMonth = document.getElementById('btn-next-month');
    const selectedDateTitle = document.getElementById('selected-date-title');
    const selectedDayLectures = document.getElementById('selected-day-lectures');
    const btnAddForSelectedDate = document.getElementById('btn-add-for-selected-date');

    // 입력 화면 폼 요소들
    const nlpTextInput = document.getElementById('nlp-text-input');
    const btnNlpMic = document.getElementById('btn-nlp-mic');
    const btnNlpClear = document.getElementById('btn-nlp-clear');
    const btnNlpParse = document.getElementById('btn-nlp-parse');
    const sttStatusMsg = document.getElementById('stt-status-msg');
    
    const parsedResultCard = document.getElementById('parsed-result-card');
    const eventTitleInput = document.getElementById('event-title');
    const eventLocationInput = document.getElementById('event-location');
    const eventDateInput = document.getElementById('event-date');
    const eventStartTimeInput = document.getElementById('event-start-time');
    const eventEndTimeInput = document.getElementById('event-end-time');
    const enableRecurrenceCheck = document.getElementById('enable-recurrence');
    const recurrenceSettingsPanel = document.getElementById('recurrence-settings-panel');
    const recurrenceTypeSelect = document.getElementById('recurrence-type');
    const recurrenceRoundsInput = document.getElementById('recurrence-rounds');
    const btnCancelSave = document.getElementById('btn-cancel-save');
    const btnConfirmSave = document.getElementById('btn-confirm-save');

    // 메모 화면
    const memoSearchInput = document.getElementById('memo-search-input');
    const memoCardsList = document.getElementById('memo-cards-list');

    // 설정 화면
    const btnBackupJson = document.getElementById('btn-backup-json');
    const btnExportCsv = document.getElementById('btn-export-csv');
    const restoreFileInput = document.getElementById('restore-file-input');
    const btnLoadSample = document.getElementById('btn-load-sample');
    const btnClearAll = document.getElementById('btn-clear-all');

    // 모달 다이얼로그들
    const memoDetailModal = document.getElementById('memo-detail-modal');
    const recurrencePreviewModal = document.getElementById('recurrence-preview-modal');
    const recurrenceEditModal = document.getElementById('recurrence-edit-modal');
    const recurrenceDeleteModal = document.getElementById('recurrence-delete-modal');
    const nlpSearchModal = document.getElementById('nlp-search-modal');

    // 모달 닫기 버튼들
    const btnCloseMemoModal = document.getElementById('btn-close-memo-modal');
    const btnCloseRecurrenceModal = document.getElementById('btn-close-recurrence-modal');
    const btnCloseRecurrenceEditModal = document.getElementById('btn-close-recurrence-edit-modal');
    const btnCloseRecurrenceDeleteModal = document.getElementById('btn-close-recurrence-delete-modal');
    const btnCloseNlpSearchModal = document.getElementById('btn-close-nlp-search-modal');
    
    // 모달 기타 액션 버튼
    const btnCancelRecurrenceSave = document.getElementById('btn-cancel-recurrence-save');
    const btnConfirmRecurrenceSave = document.getElementById('btn-confirm-recurrence-save');
    const btnModalSaveMemo = document.getElementById('btn-modal-save-memo');
    const btnModalDeleteEvent = document.getElementById('btn-modal-delete-event');
    const btnCloseNlpSearchOk = document.getElementById('btn-close-nlp-search-ok');

    // 메모 에디터 폼 필드
    const memoAgency = document.getElementById('memo-agency');
    const memoManager = document.getElementById('memo-manager');
    const memoContact = document.getElementById('memo-contact');
    const memoLocationDetail = document.getElementById('memo-location-detail');
    const memoStudentCount = document.getElementById('memo-student-count');
    const memoFee = document.getElementById('memo-fee');
    const btnPayUnpaid = document.getElementById('btn-pay-unpaid');
    const btnPayPaid = document.getElementById('btn-pay-paid');
    const memoSuppliesExtra = document.getElementById('memo-supplies-extra');
    const memoNote = document.getElementById('memo-note');

    // ----------------------------------------------------
    // 3. 음성 인식 기능 초기화 (Speech Recognition)
    // ----------------------------------------------------
    let recognition = null;
    let isListening = false;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRec();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'ko-KR';

        recognition.onstart = () => {
            isListening = true;
            btnNlpMic.classList.add('listening');
            sttStatusMsg.innerText = '음성을 듣고 있습니다... 말씀해 주세요.';
        };

        recognition.onerror = (e) => {
            console.error('Speech error: ', e);
            sttStatusMsg.innerText = '음성 인식 중 오류가 발생했습니다.';
            stopListening();
        };

        recognition.onend = () => {
            stopListening();
        };

        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            nlpTextInput.value = transcript;
            sttStatusMsg.innerText = '음성이 인식되었습니다. [일정 분석] 버튼을 눌러주세요.';
            // 자동으로 분석 실행
            parseAndPrepareForm(transcript);
        };
    } else {
        sttStatusMsg.innerText = '이 브라우저는 음성 인식을 지원하지 않습니다. 키보드로 입력해 주세요.';
        btnNlpMic.style.opacity = '0.5';
    }

    function startListening() {
        if (!recognition) return;
        try {
            recognition.start();
        } catch (e) {
            console.error(e);
        }
    }

    function stopListening() {
        isListening = false;
        btnNlpMic.classList.remove('listening');
        if (recognition) {
            try { recognition.stop(); } catch(e){}
        }
    }

    // ----------------------------------------------------
    // 4. 로컬 스토리지 데이터 제어 (Data Layer)
    // ----------------------------------------------------
    function initData() {
        const saved = localStorage.getItem('lecture_assistant_events');
        if (saved) {
            state.lectures = JSON.parse(saved);
        } else {
            // 초기 접속 시 샘플 데이터 적재
            loadSampleData();
        }
        updateHeaderDate();
        renderAll();
    }

    function saveEvents() {
        localStorage.setItem('lecture_assistant_events', JSON.stringify(state.lectures));
        renderAll();
    }

    function updateHeaderDate() {
        headerDateText.innerText = NLPParser.formatDate(state.currentDate);
    }

    // ----------------------------------------------------
    // 5. 샘플 일정 데이터
    // ----------------------------------------------------
    function loadSampleData() {
        state.lectures = [
            {
                id: "sample-1",
                date: "2026-07-10",
                startTime: "10:00",
                endTime: "12:00",
                title: "부산AI디지털배움터",
                location: "사상구청 4층 전산교육장",
                memo: {
                    agency: "사상구청",
                    manager: "김대리 팀장",
                    contact: "051-123-4567",
                    locationDetail: "4층 전산교육장",
                    supplies: ["출석부", "교재"],
                    studentCount: "12명",
                    fee: "150,000원",
                    isPaid: "unpaid",
                    note: "인터넷 활용 수업"
                }
            },
            {
                id: "sample-2",
                date: "2026-07-15",
                startTime: "14:00",
                endTime: "16:00",
                title: "스마트폰 활용 교육",
                location: "복지관",
                memo: {
                    agency: "영도종합사회복지관",
                    manager: "이주임",
                    contact: "010-8765-4321",
                    locationDetail: "2층 다목적실",
                    supplies: ["노트북", "충전기", "마이크"],
                    studentCount: "15명",
                    fee: "200,000원",
                    isPaid: "paid",
                    note: "교육생 15명 대상 스마트폰 기초 활용 교수"
                }
            },
            {
                id: "sample-3",
                date: "2026-07-22",
                startTime: "10:00",
                endTime: "12:00",
                title: "AI 이미지 만들기 특강",
                location: "평생학습관",
                memo: {
                    agency: "동구 평생학습관",
                    manager: "박과장",
                    contact: "010-3333-5555",
                    locationDetail: "302호 강의실",
                    supplies: ["노트북", "HDMI 젠더"],
                    studentCount: "20명",
                    fee: "250,000원",
                    isPaid: "unpaid",
                    note: "노트북과 HDMI 젠더 준비 필수"
                }
            }
        ];
        saveEvents();
    }

    // ----------------------------------------------------
    // 6. UI 렌더러 컨트롤러 (Renderer)
    // ----------------------------------------------------
    function renderAll() {
        renderTodayDashboard();
        renderCalendar();
        renderSelectedDayList();
        renderMemoTabList();
    }

    // A. 탭 전환 제어
    function switchTab(tabId) {
        state.currentTab = tabId;
        navItems.forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        tabPanes.forEach(pane => {
            if (pane.id === tabId) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });

        // 탭별 추가 처리
        if (tabId === 'tab-calendar') {
            renderCalendar();
            renderSelectedDayList();
        } else if (tabId === 'tab-memo') {
            renderMemoTabList();
        } else if (tabId === 'tab-today') {
            renderTodayDashboard();
        }
    }

    // B. 메인 대시보드 렌더링
    function renderTodayDashboard() {
        const todayStr = NLPParser.formatDate(state.currentDate);
        
        // 내일 날짜 계산
        const tomDate = new Date(state.currentDate);
        tomDate.setDate(state.currentDate.getDate() + 1);
        const tomorrowStr = NLPParser.formatDate(tomDate);

        // 이번 주 구하기 (월요일 ~ 일요일 기준)
        const weekDates = getWeekDates(new Date(state.currentDate));
        
        const todayList = state.lectures.filter(l => l.date === todayStr).sort((a,b) => a.startTime.localeCompare(b.startTime));
        const tomorrowList = state.lectures.filter(l => l.date === tomorrowStr).sort((a,b) => a.startTime.localeCompare(b.startTime));
        const weekList = state.lectures.filter(l => weekDates.includes(l.date)).sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

        // UI 그리기
        todayCount.innerText = todayList.length;
        tomorrowCount.innerText = tomorrowList.length;
        weekCount.innerText = weekList.length;

        renderLectureSublist(todayLectures, todayList, "오늘의 강의 일정이 없습니다.");
        renderLectureSublist(tomorrowLectures, tomorrowList, "내일의 강의 일정이 없습니다.");
        renderLectureSublist(weekLectures, weekList, "이번 주의 강의 일정이 없습니다.");
    }

    function renderLectureSublist(container, list, emptyMsg) {
        container.innerHTML = '';
        if (list.length === 0) {
            container.innerHTML = `<div class="empty-list-msg">${emptyMsg}</div>`;
            return;
        }
        list.forEach(lecture => {
            const card = createLectureCard(lecture);
            container.appendChild(card);
        });
    }

    // C. 공통 일정 카드 생성자
    function createLectureCard(lecture) {
        const item = document.createElement('div');
        item.className = 'lecture-list-item';
        
        const isPaidText = lecture.memo.isPaid === 'paid' ? '입금완료' : '입금전';
        const isPaidClass = lecture.memo.isPaid === 'paid' ? 'paid' : 'unpaid';
        
        const memoBadge = (lecture.memo.note || lecture.memo.manager || lecture.memo.contact || lecture.memo.supplies.length > 0) 
            ? '<span class="item-badge memo-exist">메모있음</span>' : '';

        const roundText = lecture.round ? `<span class="item-round-tag">${lecture.round}회차</span>` : '';

        item.innerHTML = `
            <div class="item-time-row">
                <span>🕒 ${lecture.date} (${lecture.startTime} ~ ${lecture.endTime})</span>
                ${roundText}
            </div>
            <div class="item-title">${lecture.title}</div>
            <div class="item-location">📍 ${lecture.location}</div>
            <div class="item-meta-row">
                <span class="item-badge ${isPaidClass}">${isPaidText}</span>
                ${memoBadge}
            </div>
        `;

        item.addEventListener('click', () => {
            openMemoModal(lecture);
        });

        return item;
    }

    // 이번 주 날짜들 반환 유틸 (월요일부터 시작 7일)
    function getWeekDates(current) {
        const week = [];
        const day = current.getDay();
        const diff = current.getDate() - day + (day === 0 ? -6 : 1); // 월요일 기준 계산
        
        const startOfWeek = new Date(current);
        startOfWeek.setDate(diff);

        for (let i = 0; i < 7; i++) {
            const next = new Date(startOfWeek);
            next.setDate(startOfWeek.getDate() + i);
            week.push(NLPParser.formatDate(next));
        }
        return week;
    }

    // D. 캘린더 그리드 렌더링
    function renderCalendar() {
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();

        calendarMonthYear.innerText = `${year}년 ${month + 1}월`;

        // 이전 월 마지막 일, 현재 월 첫 날 요일, 현재 월 마지막 일 구하기
        const firstDayIndex = new Date(year, month, 1).getDay();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const prevLastDay = new Date(year, month, 0).getDate();

        calendarDaysGrid.innerHTML = '';

        // 1. 이전 달 날짜 채우기 (연하게 표시)
        for (let x = firstDayIndex; x > 0; x--) {
            const dayNum = prevLastDay - x + 1;
            const cell = document.createElement('div');
            cell.className = 'calendar-day-cell other-month';
            cell.innerText = dayNum;
            calendarDaysGrid.appendChild(cell);
        }

        // 오늘 날짜 정보 구하기
        const todayObj = new Date();
        const todayStr = NLPParser.formatDate(todayObj);

        // 2. 이번 달 날짜 채우기
        for (let i = 1; i <= lastDay; i++) {
            const dateStr = `${year}-${NLPParser.pad(month + 1)}-${NLPParser.pad(i)}`;
            const cell = document.createElement('div');
            cell.className = 'calendar-day-cell';
            cell.innerText = i;

            // 요일 표시 색상
            const currentDayOfWeek = new Date(year, month, i).getDay();
            if (currentDayOfWeek === 0) cell.classList.add('sun-day');
            if (currentDayOfWeek === 6) cell.classList.add('sat-day');

            // 오늘 날짜 하이라이트
            if (dateStr === todayStr) {
                cell.classList.add('today');
            }

            // 선택한 날짜 하이라이트
            if (dateStr === state.selectedDateStr) {
                cell.classList.add('active-select');
            }

            // 일정이 있는 날짜인지 검사 -> 도트 띄우기
            const hasLecture = state.lectures.some(l => l.date === dateStr);
            if (hasLecture) {
                const dot = document.createElement('span');
                dot.className = 'calendar-event-dot';
                cell.appendChild(dot);
            }

            // 클릭 이벤트 바인딩
            cell.addEventListener('click', () => {
                state.selectedDateStr = dateStr;
                renderCalendar(); // 리렌더링하여 선택 표시 변경
                renderSelectedDayList();
            });

            calendarDaysGrid.appendChild(cell);
        }
    }

    // E. 캘린더 하단 특정 날짜 리스트 출력
    function renderSelectedDayList() {
        const parts = state.selectedDateStr.split('-');
        selectedDateTitle.innerText = `${parts[0]}년 ${parseInt(parts[1], 10)}월 ${parseInt(parts[2], 10)}일 강의 일정`;

        const dayLectures = state.lectures.filter(l => l.date === state.selectedDateStr).sort((a,b) => a.startTime.localeCompare(b.startTime));
        
        selectedDayLectures.innerHTML = '';
        if (dayLectures.length === 0) {
            selectedDayLectures.innerHTML = `<div class="empty-list-msg">등록된 강의 일정이 없습니다.</div>`;
            return;
        }

        dayLectures.forEach(l => {
            const card = createLectureCard(l);
            selectedDayLectures.appendChild(card);
        });
    }

    // F. 메모 관리 탭 렌더링
    function renderMemoTabList() {
        const query = memoSearchInput.value.toLowerCase().trim();
        
        // 날짜 역순 및 시간 역순 배치
        const sortedList = [...state.lectures].sort((a,b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
        
        const filtered = sortedList.filter(l => {
            return l.title.toLowerCase().includes(query) || 
                   l.location.toLowerCase().includes(query) ||
                   l.memo.agency.toLowerCase().includes(query);
        });

        memoCardsList.innerHTML = '';

        if (filtered.length === 0) {
            memoCardsList.innerHTML = '<div class="empty-list-msg">검색된 메모 또는 일정이 없습니다.</div>';
            return;
        }

        filtered.forEach(lecture => {
            const item = document.createElement('div');
            item.className = 'memo-card-item';
            
            const roundText = lecture.round ? ` [${lecture.round}회차]` : '';
            const statusLabel = lecture.memo.isPaid === 'paid' ? '✅ 입금 완료' : '⏳ 입금 전';
            const suppliesText = lecture.memo.supplies.join(', ') || '없음';

            item.innerHTML = `
                <div class="memo-card-meta">📅 ${lecture.date} (${lecture.startTime}~${lecture.endTime})</div>
                <h3>${lecture.title}${roundText}</h3>
                <div class="memo-card-preview-fields">
                    <div class="memo-preview-row">📍 <strong>장소:</strong> ${lecture.location}</div>
                    <div class="memo-preview-row">🏢 <strong>기관:</strong> ${lecture.memo.agency || '-'} | <strong>담당:</strong> ${lecture.memo.manager || '-'}</div>
                    <div class="memo-preview-row">📞 <strong>연락처:</strong> ${lecture.memo.contact || '-'}</div>
                    <div class="memo-preview-row">📦 <strong>준비물:</strong> ${suppliesText}</div>
                    <div class="memo-preview-row">💰 <strong>강의료:</strong> ${lecture.memo.fee || '-'} (${statusLabel})</div>
                    ${lecture.memo.note ? `<div class="memo-preview-row" style="margin-top:4px; font-style:italic;">💬 ${lecture.memo.note}</div>` : ''}
                </div>
            `;

            item.addEventListener('click', () => {
                openMemoModal(lecture);
            });

            memoCardsList.appendChild(item);
        });
    }

    // ----------------------------------------------------
    // 7. NLP 분석 모듈 연동
    // ----------------------------------------------------
    function parseAndPrepareForm(text) {
        // 일시적인 질의 검색("7월 15일 강의 있어?")인지 우선 판별
        const isSearch = text.includes("있어?") || text.includes("알려줘") || text.includes("뭐 있어");
        
        if (isSearch) {
            const searchObj = NLPParser.parseSearchQuery(text);
            executeSearchDialog(searchObj, text);
            return;
        }

        // 일반 일정 등록 문장 분석
        const parsed = NLPParser.parseFullSentence(text);
        
        // 폼 갱신 및 표시
        eventTitleInput.value = parsed.title;
        eventLocationInput.value = parsed.location;
        eventDateInput.value = parsed.date;
        eventStartTimeInput.value = parsed.startTime;
        eventEndTimeInput.value = parsed.endTime;

        // 반복 조건 설정
        if (parsed.recurrence.isRecurrence) {
            enableRecurrenceCheck.checked = true;
            recurrenceSettingsPanel.classList.remove('hidden');
            recurrenceTypeSelect.value = parsed.recurrence.type;
            recurrenceRoundsInput.value = parsed.recurrence.rounds;
        } else {
            enableRecurrenceCheck.checked = false;
            recurrenceSettingsPanel.classList.add('hidden');
            recurrenceRoundsInput.value = 15; // 초기값
        }

        parsedResultCard.classList.remove('hidden');
        parsedResultCard.scrollIntoView({ behavior: 'smooth' });
    }

    // ----------------------------------------------------
    // 8. 자연어 질의 대화창 모달 실행
    // ----------------------------------------------------
    function executeSearchDialog(searchObj, originalQuery) {
        const queryTitle = document.getElementById('nlp-search-query-title');
        const searchResultsContainer = document.getElementById('nlp-search-results');
        
        queryTitle.innerText = `질의: "${originalQuery}"`;
        searchResultsContainer.innerHTML = '';
        
        let matched = [];

        if (searchObj.searchRange === 'day' && searchObj.dateQuery) {
            matched = state.lectures.filter(l => l.date === searchObj.dateQuery);
        } else if (searchObj.searchRange === 'week') {
            const weekDates = getWeekDates(new Date(state.currentDate));
            matched = state.lectures.filter(l => weekDates.includes(l.date));
        } else if (searchObj.searchRange === 'month') {
            const currentMonth = state.currentDate.getMonth() + 1;
            const currentYear = state.currentDate.getFullYear();
            matched = state.lectures.filter(l => {
                const parts = l.date.split('-');
                return parseInt(parts[0], 10) === currentYear && parseInt(parts[1], 10) === currentMonth;
            });
        }

        // 날짜, 시간 정렬
        matched.sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

        if (matched.length === 0) {
            searchResultsContainer.innerHTML = '<div class="empty-list-msg">등록된 강의 일정이 없습니다.</div>';
        } else {
            matched.forEach(l => {
                const card = createLectureCard(l);
                searchResultsContainer.appendChild(card);
            });
        }

        nlpSearchModal.classList.add('active');
    }

    // ----------------------------------------------------
    // 9. 반복 일정 생성 알고리즘
    // ----------------------------------------------------
    function generateRecurrenceEvents(baseEvent, type, rounds) {
        const events = [];
        const baseDate = new Date(baseEvent.date);
        
        for (let i = 0; i < rounds; i++) {
            const currentTargetDate = new Date(baseDate);
            
            if (type === 'weekly') {
                currentTargetDate.setDate(baseDate.getDate() + (i * 7));
            } else if (type === 'biweekly') {
                currentTargetDate.setDate(baseDate.getDate() + (i * 14));
            } else if (type === 'monthly') {
                currentTargetDate.setMonth(baseDate.getMonth() + i);
            } else if (type === 'custom') { // 직접 선택
                currentTargetDate.setDate(baseDate.getDate() + (i * 7));
            }

            const formattedDate = NLPParser.formatDate(currentTargetDate);
            
            events.push({
                id: `${baseEvent.recurrenceGroupId}-round-${i+1}`,
                date: formattedDate,
                startTime: baseEvent.startTime,
                endTime: baseEvent.endTime,
                title: baseEvent.title,
                location: baseEvent.location,
                recurrenceGroupId: baseEvent.recurrenceGroupId,
                round: i + 1,
                totalRounds: rounds,
                memo: {
                    agency: baseEvent.memo.agency,
                    manager: '',
                    contact: '',
                    locationDetail: baseEvent.location,
                    supplies: [],
                    studentCount: '',
                    fee: '',
                    isPaid: 'unpaid',
                    note: ''
                }
            });
        }
        return events;
    }

    // ----------------------------------------------------
    // 10. 일정 상세 메모 모달 처리 (CRUD & Multi-type updates)
    // ----------------------------------------------------
    function openMemoModal(lecture) {
        state.activeLecture = lecture;
        
        document.getElementById('modal-memo-title').innerText = lecture.title;
        document.getElementById('modal-memo-datetime').innerText = `🕒 ${lecture.date} ${lecture.startTime} ~ ${lecture.endTime}`;
        document.getElementById('modal-memo-location').innerText = `📍 ${lecture.location}`;
        
        const roundInd = document.getElementById('modal-memo-round');
        if (lecture.round) {
            roundInd.innerText = `${lecture.round}회차 / 전체 ${lecture.totalRounds || '?'}회`;
            roundInd.classList.remove('hidden');
        } else {
            roundInd.classList.add('hidden');
        }

        // 입력 폼 바인딩
        memoAgency.value = lecture.memo.agency || '';
        memoManager.value = lecture.memo.manager || '';
        memoContact.value = lecture.memo.contact || '';
        memoLocationDetail.value = lecture.memo.locationDetail || '';
        memoStudentCount.value = lecture.memo.studentCount || '';
        memoFee.value = lecture.memo.fee || '';
        memoNote.value = lecture.memo.note || '';

        // 강의료 입금 상태
        setPayToggleState(lecture.memo.isPaid || 'unpaid');

        // 준비물 체크박스 초기화
        const checks = document.querySelectorAll('.supply-check');
        const customSupplies = [];
        
        checks.forEach(chk => {
            if (lecture.memo.supplies.includes(chk.value)) {
                chk.checked = true;
            } else {
                chk.checked = false;
            }
        });

        // 사용자 임의 입력 준비물
        const defaultSupplies = ["노트북", "충전기", "HDMI 젠더", "마이크", "출석부", "교재"];
        lecture.memo.supplies.forEach(item => {
            if (!defaultSupplies.includes(item)) {
                customSupplies.push(item);
            }
        });
        memoSuppliesExtra.value = customSupplies.join(', ');

        memoDetailModal.classList.add('active');
    }

    function setPayToggleState(status) {
        if (status === 'paid') {
            btnPayPaid.classList.add('active');
            btnPayUnpaid.classList.remove('active');
        } else {
            btnPayUnpaid.classList.add('active');
            btnPayPaid.classList.remove('active');
        }
    }

    // A. 메모 세이브 로직 (반복 일정 정책 제어)
    function saveActiveMemo(scope = 'single') {
        const isPaid = btnPayPaid.classList.contains('active') ? 'paid' : 'unpaid';
        
        // 체크박스 수집
        const supplies = [];
        document.querySelectorAll('.supply-check').forEach(chk => {
            if (chk.checked) supplies.push(chk.value);
        });

        // 추가 텍스트 콤마 분리
        const extraText = memoSuppliesExtra.value.trim();
        if (extraText) {
            extraText.split(',').forEach(item => {
                const cleaned = item.trim();
                if (cleaned && !supplies.includes(cleaned)) supplies.push(cleaned);
            });
        }

        const memoData = {
            agency: memoAgency.value.trim(),
            manager: memoManager.value.trim(),
            contact: memoContact.value.trim(),
            locationDetail: memoLocationDetail.value.trim(),
            studentCount: memoStudentCount.value.trim(),
            fee: memoFee.value.trim(),
            isPaid: isPaid,
            supplies: supplies,
            note: memoNote.value.trim()
        };

        const targetId = state.activeLecture.id;
        const targetGroup = state.activeLecture.recurrenceGroupId;
        const targetRound = state.activeLecture.round;

        if (!targetGroup || scope === 'single') {
            // 이 일정만 수정
            const idx = state.lectures.findIndex(l => l.id === targetId);
            if (idx !== -1) {
                state.lectures[idx].memo = memoData;
                // 독립 일정으로 변환(반복을 한 번 깨뜨렸으므로, 추후 전체 변경에 휩쓸리지 않도록 필요시 그룹 ID 삭제 혹은 단독 유지)
            }
        } else if (scope === 'future') {
            // 이 회차 이후 모두 수정
            state.lectures.forEach(l => {
                if (l.recurrenceGroupId === targetGroup && l.round >= targetRound) {
                    l.memo = { ...memoData };
                }
            });
        } else if (scope === 'all') {
            // 전체 반복일정 수정
            state.lectures.forEach(l => {
                if (l.recurrenceGroupId === targetGroup) {
                    l.memo = { ...memoData };
                }
            });
        }

        saveEvents();
        memoDetailModal.classList.remove('active');
    }

    // B. 일정 삭제 로직 (반복 일정 정책 제어)
    function deleteActiveLecture(scope = 'single') {
        const targetId = state.activeLecture.id;
        const targetGroup = state.activeLecture.recurrenceGroupId;

        if (!targetGroup || scope === 'single') {
            state.lectures = state.lectures.filter(l => l.id !== targetId);
        } else if (scope === 'all') {
            state.lectures = state.lectures.filter(l => l.recurrenceGroupId !== targetGroup);
        }

        saveEvents();
        memoDetailModal.classList.remove('active');
    }

    // ----------------------------------------------------
    // 11. 백업, CSV, 복원 제어 (Import/Export)
    // ----------------------------------------------------
    // JSON 백업 다운로드
    function backupEventsJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.lectures, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `강의일정_비서_백업_${NLPParser.formatDate(new Date())}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }

    // CSV 파일 생성 다운로드
    function exportEventsCSV() {
        // UTF-8 BOM 필수 (Excel 한국어 깨짐 방지)
        let csvContent = "\uFEFF";
        csvContent += "날짜,시간,강의명,장소,회차,기관명,담당자,연락처,상세장소,준비물,교육생수,강의료,입금상태,메모\n";

        state.lectures.forEach(l => {
            const suppliesStr = l.memo.supplies.join('; ');
            const paidStr = l.memo.isPaid === 'paid' ? '입금완료' : '입금전';
            
            const row = [
                l.date,
                `${l.startTime}~${l.endTime}`,
                `"${l.title.replace(/"/g, '""')}"`,
                `"${l.location.replace(/"/g, '""')}"`,
                l.round || '',
                `"${(l.memo.agency || '').replace(/"/g, '""')}"`,
                `"${(l.memo.manager || '').replace(/"/g, '""')}"`,
                `"${(l.memo.contact || '').replace(/"/g, '""')}"`,
                `"${(l.memo.locationDetail || '').replace(/"/g, '""')}"`,
                `"${suppliesStr.replace(/"/g, '""')}"`,
                `"${(l.memo.studentCount || '').replace(/"/g, '""')}"`,
                `"${(l.memo.fee || '').replace(/"/g, '""')}"`,
                paidStr,
                `"${(l.memo.note || '').replace(/"/g, '""')}"`
            ].join(',');
            
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `강의일정_목록_${NLPParser.formatDate(new Date())}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    // 파일 로딩을 통한 데이터 복원
    function restoreEventsJSON(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const parsed = JSON.parse(evt.target.result);
                if (Array.isArray(parsed)) {
                    state.lectures = parsed;
                    saveEvents();
                    alert("데이터 복원이 성공적으로 완료되었습니다!");
                } else {
                    alert("올바르지 않은 백업 파일 형식입니다.");
                }
            } catch (err) {
                alert("파일 읽기 도중 오류가 발생했습니다.");
            }
        };
        reader.readAsText(file);
    }

    // ----------------------------------------------------
    // 12. 이벤트 바인딩 (Event Listeners)
    // ----------------------------------------------------
    
    // 네비게이션 탭 스위치
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.dataset.tab);
        });
    });

    // 메인 홈 화면 퀵 버튼들
    btnQuickVoice.addEventListener('click', () => {
        switchTab('tab-input');
        startListening();
    });
    btnQuickText.addEventListener('click', () => {
        switchTab('tab-input');
        nlpTextInput.focus();
    });

    // 캘린더 앞/뒤 월 이동
    btnPrevMonth.addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        updateHeaderDate();
        renderCalendar();
    });
    btnNextMonth.addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        updateHeaderDate();
        renderCalendar();
    });

    // 특정 날짜에 즉시 일정 등록 버튼
    btnAddForSelectedDate.addEventListener('click', () => {
        switchTab('tab-input');
        nlpTextInput.value = `${state.selectedDateStr} 오전 10시 새로운 강의 등록`;
        parseAndPrepareForm(nlpTextInput.value);
    });

    // NLP 텍스트 영역 제어
    btnNlpMic.addEventListener('click', () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    });

    btnNlpClear.addEventListener('click', () => {
        nlpTextInput.value = '';
        parsedResultCard.classList.add('hidden');
        stopListening();
        sttStatusMsg.innerText = '';
    });

    btnNlpParse.addEventListener('click', () => {
        const text = nlpTextInput.value.trim();
        if (!text) {
            alert('먼저 텍스트를 입력하거나 음성으로 말해 주세요.');
            return;
        }
        parseAndPrepareForm(text);
    });

    // 반복 설정 체크박스 토글
    enableRecurrenceCheck.addEventListener('change', (e) => {
        if (e.target.checked) {
            recurrenceSettingsPanel.classList.remove('hidden');
        } else {
            recurrenceSettingsPanel.classList.add('hidden');
        }
    });

    // 분석 결과 폼 취소
    btnCancelSave.addEventListener('click', () => {
        parsedResultCard.classList.add('hidden');
    });

    // 분석 결과 폼 최종 저장
    btnConfirmSave.addEventListener('click', () => {
        const title = eventTitleInput.value.trim();
        const location = eventLocationInput.value.trim();
        const date = eventDateInput.value;
        const startTime = eventStartTimeInput.value;
        const endTime = eventEndTimeInput.value;

        if (!title || !date || !startTime || !endTime) {
            alert('강의명, 날짜, 시작 및 종료 시간은 반드시 기입해야 합니다.');
            return;
        }

        const isRecur = enableRecurrenceCheck.checked;

        if (isRecur) {
            // 반복일정 생성 및 미리보기 실행
            const recurrenceType = recurrenceTypeSelect.value;
            const rounds = parseInt(recurrenceRoundsInput.value, 10) || 15;
            const groupId = `group-${Date.now()}`;

            const baseEvent = {
                date,
                startTime,
                endTime,
                title,
                location,
                recurrenceGroupId: groupId,
                memo: { agency: location, supplies: [] }
            };

            state.tempParsedEvents = generateRecurrenceEvents(baseEvent, recurrenceType, rounds);
            
            // 미리보기 모달 바인딩 및 표시
            document.getElementById('preview-total-count').innerText = state.tempParsedEvents.length;
            const previewContainer = document.getElementById('recurrence-preview-list');
            previewContainer.innerHTML = '';
            
            state.tempParsedEvents.forEach(evt => {
                const item = document.createElement('div');
                item.className = 'recurrence-preview-item';
                item.innerHTML = `
                    <span class="preview-date">📅 ${evt.date} (${evt.startTime}~${evt.endTime})</span>
                    <span class="preview-round">${evt.title} ${evt.round}회차</span>
                `;
                previewContainer.appendChild(item);
            });

            recurrencePreviewModal.classList.add('active');
        } else {
            // 단건 일반 일정 저장
            const newEvent = {
                id: `evt-${Date.now()}`,
                date,
                startTime,
                endTime,
                title,
                location,
                memo: {
                    agency: location,
                    manager: '',
                    contact: '',
                    locationDetail: location,
                    supplies: [],
                    studentCount: '',
                    fee: '',
                    isPaid: 'unpaid',
                    note: ''
                }
            };
            state.lectures.push(newEvent);
            saveEvents();
            alert('일정이 성공적으로 저장되었습니다.');
            parsedResultCard.classList.add('hidden');
            nlpTextInput.value = '';
            switchTab('tab-calendar');
        }
    });

    // 반복 미리보기 모달 저장 컨펌
    btnConfirmRecurrenceSave.addEventListener('click', () => {
        state.lectures.push(...state.tempParsedEvents);
        saveEvents();
        recurrencePreviewModal.classList.remove('active');
        parsedResultCard.classList.add('hidden');
        nlpTextInput.value = '';
        alert('모든 회차 반복일정이 저장되었습니다!');
        switchTab('tab-calendar');
    });

    btnCancelRecurrenceSave.addEventListener('click', () => {
        recurrencePreviewModal.classList.remove('active');
    });

    // 입금 토글 스위치 이벤트
    btnPayUnpaid.addEventListener('click', () => {
        btnPayUnpaid.classList.add('active');
        btnPayPaid.classList.remove('active');
    });
    btnPayPaid.addEventListener('click', () => {
        btnPayPaid.classList.add('active');
        btnPayUnpaid.classList.remove('active');
    });

    // 메모 상세 모달 [저장 완료] 버튼 누를 시 (반복 그룹인 경우 분기 모달 활성화)
    btnModalSaveMemo.addEventListener('click', () => {
        if (state.activeLecture.recurrenceGroupId) {
            recurrenceEditModal.classList.add('active');
        } else {
            saveActiveMemo('single');
        }
    });

    // 메모 상세 모달 [일정 삭제] 버튼 누를 시 (반복 그룹인 경우 분기 모달 활성화)
    btnModalDeleteEvent.addEventListener('click', () => {
        if (state.activeLecture.recurrenceGroupId) {
            recurrenceDeleteModal.classList.add('active');
        } else {
            if (confirm("이 일정을 정말 삭제하시겠습니까?")) {
                deleteActiveLecture('single');
            }
        }
    });

    // 반복 일정 수정 유형 분기 제어
    document.querySelectorAll('#recurrence-edit-modal .btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                saveActiveMemo(action);
                recurrenceEditModal.classList.remove('active');
            }
        });
    });

    // 반복 일정 삭제 유형 분기 제어
    document.querySelectorAll('#recurrence-delete-modal .btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                deleteActiveLecture(action);
                recurrenceDeleteModal.classList.remove('active');
            }
        });
    });

    // 검색창 입력 이벤트 실시간 반영
    memoSearchInput.addEventListener('input', () => {
        renderMemoTabList();
    });

    // 설정 데이터 제어 이벤트들
    btnBackupJson.addEventListener('click', backupEventsJSON);
    btnExportCsv.addEventListener('click', exportEventsCSV);
    restoreFileInput.addEventListener('change', restoreEventsJSON);
    
    btnLoadSample.addEventListener('click', () => {
        if (confirm("샘플 일정을 다시 불러오시겠습니까? 기존 수동 일정들은 보존됩니다.")) {
            loadSampleData();
            alert("샘플 일정이 추가로 등록되었습니다.");
        }
    });

    btnClearAll.addEventListener('click', () => {
        if (confirm("⚠️ 정말 모든 데이터를 삭제하시겠습니까? 복구할 수 없습니다.")) {
            state.lectures = [];
            saveEvents();
            alert("모든 데이터가 초기화되었습니다.");
        }
    });

    // 모달 닫기 버튼 공통 처리
    btnCloseMemoModal.addEventListener('click', () => memoDetailModal.classList.remove('active'));
    btnCloseRecurrenceModal.addEventListener('click', () => recurrencePreviewModal.classList.remove('active'));
    btnCloseRecurrenceEditModal.addEventListener('click', () => recurrenceEditModal.classList.remove('active'));
    btnCloseRecurrenceDeleteModal.addEventListener('click', () => recurrenceDeleteModal.classList.remove('active'));
    btnCloseNlpSearchModal.addEventListener('click', () => nlpSearchModal.classList.remove('active'));
    btnCloseNlpSearchOk.addEventListener('click', () => nlpSearchModal.classList.remove('active'));

    // 모달 외부 영역 클릭 시 닫기
    window.addEventListener('click', (e) => {
        if (e.target === memoDetailModal) memoDetailModal.classList.remove('active');
        if (e.target === recurrencePreviewModal) recurrencePreviewModal.classList.remove('active');
        if (e.target === recurrenceEditModal) recurrenceEditModal.classList.remove('active');
        if (e.target === recurrenceDeleteModal) recurrenceDeleteModal.classList.remove('active');
        if (e.target === nlpSearchModal) nlpSearchModal.classList.remove('active');
    });

    // ----------------------------------------------------
    // 13. 앱 실행 시작
    // ----------------------------------------------------
    initData();
});
