/* ==========================================
   강의일정 비서 앱 - 자연어 처리 파서 엔진 (parser.js)
   역할: 텍스트 문장에서 날짜, 시간, 강의명, 장소 및 반복 주기를 정교하게 추출
   ========================================== */

const NLPParser = {
    // 요일 한글 매칭 맵
    dayOfWeekMap: {
        '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6,
        '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5, '토요일': 6
    },

    /**
     * 날짜 파싱 도우미
     * "7월 15일", "2026-07-22", "오늘", "내일" 등의 형태 해석
     */
    parseDate: function(text) {
        const today = new Date();
        const currentYear = today.getFullYear(); // 2026년 기준

        // 1. "오늘", "내일" 등 상대 날짜 매칭
        if (/\b오늘\b/.test(text)) {
            return this.formatDate(today);
        }
        if (/\b내일\b/.test(text)) {
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            return this.formatDate(tomorrow);
        }

        // 2. YYYY-MM-DD 형태 매칭
        const isoMatch = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        if (isoMatch) {
            return `${isoMatch[1]}-${this.pad(isoMatch[2])}-${this.pad(isoMatch[3])}`;
        }

        // 3. "M월 D일" 형태 매칭
        const korMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
        if (korMatch) {
            return `${currentYear}-${this.pad(korMatch[1])}-${this.pad(korMatch[2])}`;
        }

        return this.formatDate(today); // 기본값은 오늘
    },

    /**
     * 시간 범위 파싱 도우미
     * "오전 10시부터 12시까지", "14:00~16:00", "오후 3시부터 5시" 등 매칭
     */
    parseTime: function(text) {
        let startTime = "10:00";
        let endTime = "12:00";

        // 1. "HH:MM~HH:MM" 또는 "HH:MM-HH:MM" 매칭
        const timeRangeMatch = text.match(/(\d{1,2}):(\d{2})\s*[~-]\s*(\d{1,2}):(\d{2})/);
        if (timeRangeMatch) {
            startTime = `${this.pad(timeRangeMatch[1])}:${timeRangeMatch[2]}`;
            endTime = `${this.pad(timeRangeMatch[3])}:${timeRangeMatch[4]}`;
            return { startTime, endTime };
        }

        // 2. 한글 기반 시간 범위 파싱 ("오후 3시부터 5시까지" 등)
        // 오전/오후 정보 파악
        let globalAmPm = null; 
        if (text.includes("오후")) {
            globalAmPm = "오후";
        } else if (text.includes("오전")) {
            globalAmPm = "오전";
        }

        // 시간 매칭용 정규식 (예: "오전 10시", "오후 3시", "5시")
        // "(\d{1,2})\s*시" 매턴을 모두 찾음
        const timeMatches = [];
        const regex = /(오전|오후)?\s*(\d{1,2})\s*(?:시|분)?/g;
        let match;
        
        // 특정 단어 제거하여 오차 방지
        const cleanedText = text.replace(/(봉래센터|학습관|복지관|사상구청|디지털배움터)/g, '');

        // 단순 숫자+시 위주로 매칭
        const simpleHourRegex = /(오전|오후)?\s*(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분)?/g;
        while ((match = simpleHourRegex.exec(cleanedText)) !== null) {
            let ampm = match[1] || globalAmPm;
            let hour = parseInt(match[2], 10);
            let minute = match[3] ? parseInt(match[3], 10) : 0;

            if (ampm === "오후" && hour < 12) {
                hour += 12;
            } else if (ampm === "오전" && hour === 12) {
                hour = 0;
            }
            timeMatches.push(`${this.pad(hour)}:${this.pad(minute)}`);
        }

        if (timeMatches.length >= 2) {
            startTime = timeMatches[0];
            endTime = timeMatches[1];
        } else if (timeMatches.length === 1) {
            startTime = timeMatches[0];
            // 1시간 추가한 시간을 기본 종료시간으로 설정
            const parts = startTime.split(':');
            let endH = parseInt(parts[0], 10) + 2;
            if (endH > 23) endH = 23;
            endTime = `${this.pad(endH)}:${parts[1]}`;
        }

        return { startTime, endTime };
    },

    /**
     * 장소 파싱 도우미
     * "...에서", "...어디서" 및 널리 쓰이는 명사구 매칭
     */
    parseLocation: function(text) {
        // "OOO에서", "OOO 4층 전산교육장", "OOO 복지관", "OOO 센터" 형태 추출
        const patterns = [
            /([가-힣\w\s]+(?:센터|복지관|학습관|구청|배움터|교실|체육관|학교|대학|도서관|지사|본부|강당|회의실|교육장)(?:\s+\d+층\s+[가-힣\w\s]+)?)(?=\s*에서|\s*강의|\s*수업|\s*교육|\s*특강|\s*일정)/,
            /([가-힣\w\s]+(?:센터|복지관|학습관|구청|배움터|교실|체육관|학교|대학|도서관|지사|본부|강당|회의실|교육장)(?:\s+\d+층\s+[가-힣\w\s]+)?)/,
            /([가-힣\w]+(?:구청|복지관|학습관|센터|배움터))/
        ];

        for (let regex of patterns) {
            const match = text.match(regex);
            if (match && match[1].trim().length > 1) {
                return match[1].trim();
            }
        }

        return ""; // 기본값 없음
    },

    /**
     * 강의명 파싱 도우미
     */
    parseTitle: function(text) {
        // 1. "OOO 강의", "OOO 수업", "OOO 교육", "OOO 특강" 형태 추출
        const patterns = [
            /([가-힣\w\s·]+)(?:강의|교육|수업|특강|배움터|클래스)/,
            /([가-힣\w\s·]+)(?:등록해줘|있어|입력해줘|추가해줘)/
        ];

        for (let regex of patterns) {
            const match = text.match(regex);
            if (match && match[1].trim().length > 1) {
                let title = match[1].trim();
                // 요일, 시간, 날짜 정보나 조사 제거
                title = title.replace(/(오전|오후|\d+월|\d+일|월요일|화요일|수요일|목요일|금요일|토요일|일요일|매주|격주|매월|\d+시|\d+회|\d+회차)/g, "").trim();
                title = title.replace(/(에서|부터|까지|하고|하고있어)$/, "").trim();
                if (title.length > 1) return title;
            }
        }

        // 키워드 기반 폴백
        const keywords = ["스마트폰 활용", "AI 디지털배움터", "AI 이미지 만들기", "인터넷 활용"];
        for (let kw of keywords) {
            if (text.includes(kw)) return kw;
        }

        return "새로운 강의 일정"; // 기본 제목
    },

    /**
     * 반복 일정 정보 파싱
     * 예: "매주 월요일", "격주", "15회" 등
     */
    parseRecurrence: function(text) {
        let isRecurrence = false;
        let type = 'weekly'; // weekly, biweekly, monthly, custom
        let rounds = 15; // 기본 회차
        let dayOfWeek = null; // 요일 번호 (0 ~ 6)

        // 1. 반복 여부 감지
        if (text.includes("매주") || text.includes("격주") || text.includes("매월") || text.includes("반복") || text.includes("회")) {
            isRecurrence = true;
        }

        // 2. 주기 타입 판별
        if (text.includes("격주")) {
            type = 'biweekly';
        } else if (text.includes("매월") || text.includes("매달")) {
            type = 'monthly';
        } else if (text.includes("매주")) {
            type = 'weekly';
        }

        // 3. 총 회차 수 파싱 (예: "15회", "15회차", "10번")
        const roundMatch = text.match(/(\d{1,2})\s*(?:회|번)/);
        if (roundMatch) {
            rounds = parseInt(roundMatch[1], 10);
        }

        // 4. 요일 추출
        const weekdayMatch = text.match(/([월화수목금토일])요일/);
        if (weekdayMatch) {
            dayOfWeek = this.dayOfWeekMap[weekdayMatch[1]];
        } else {
            // "월요일" 형태가 아닐 경우 그냥 날짜에서 요일을 유추할 수 있도록 설정
            const extractedDate = this.parseDate(text);
            const d = new Date(extractedDate);
            dayOfWeek = d.getDay();
        }

        return {
            isRecurrence,
            type,
            rounds,
            dayOfWeek
        };
    },

    /**
     * 일정 검색어 및 질문 분석
     * 예: "7월 15일 강의 있어?" -> 7월 15일 날짜 추출
     * 예: "이번 주 강의 알려줘" -> week 범위
     */
    parseSearchQuery: function(text) {
        let dateQuery = null;
        let searchRange = 'day'; // day, week, month

        if (text.includes("이번 주") || text.includes("이번주") || text.includes("주간")) {
            searchRange = 'week';
        } else if (text.includes("이번 달") || text.includes("이번달")) {
            searchRange = 'month';
        } else if (text.includes("오늘")) {
            dateQuery = this.formatDate(new Date());
            searchRange = 'day';
        } else if (text.includes("내일")) {
            const tom = new Date();
            tom.setDate(tom.getDate() + 1);
            dateQuery = this.formatDate(tom);
            searchRange = 'day';
        } else {
            // 7월 15일 등 날짜 매칭 시도
            const parsed = this.parseDate(text);
            if (parsed) {
                dateQuery = parsed;
                searchRange = 'day';
            }
        }

        return {
            dateQuery,
            searchRange
        };
    },

    /**
     * 문장 통합 분석기
     */
    parseFullSentence: function(text) {
        const parsedDate = this.parseDate(text);
        const parsedTimes = this.parseTime(text);
        const parsedLocation = this.parseLocation(text);
        const parsedTitle = this.parseTitle(text);
        const parsedRecur = this.parseRecurrence(text);

        return {
            date: parsedDate,
            startTime: parsedTimes.startTime,
            endTime: parsedTimes.endTime,
            location: parsedLocation,
            title: parsedTitle,
            recurrence: parsedRecur
        };
    },

    // 유틸리티
    pad: function(n) {
        return parseInt(n, 10) < 10 ? '0' + parseInt(n, 10) : n;
    },
    formatDate: function(date) {
        const y = date.getFullYear();
        const m = this.pad(date.getMonth() + 1);
        const d = this.pad(date.getDate());
        return `${y}-${m}-${d}`;
    }
};
