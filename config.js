/* =========================================================
   설정 파일 (config.js)
   -------------------------------------------------------
   1) 아래 GAS_API_URL 에 "Google Apps Script 웹앱 배포 URL"을
      붙여넣으세요. (설치가이드.md 3단계 참고)
      예) const GAS_API_URL = "https://script.google.com/macros/s/AKfycb.../exec";
   2) 방문 가능 일자 / 시간대 / 슬롯당 정원은 Apps Script(Code.gs)
      쪽 설정과 반드시 동일하게 맞춰주세요. (여기 값은 화면 표시용)
   3) 안내문 PDF 파일명이 다르면 NOTICE_PDF_URL 값을 바꿔주세요.
      (index.html과 같은 폴더에 PDF 파일을 함께 올려야 합니다)
   ========================================================= */

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbywgNLo67sL2hATIbySiI5Pm03XtdkqJ7d81J_L1np2JE7d_lDxbo7Ap7cyIe_w57RC_w/exec
";

// 안내문 PDF 파일 경로 (같은 폴더에 이 이름으로 PDF를 올려주세요)
const NOTICE_PDF_URL = "안내문.pdf";

// 단지 정보 (안내문 탭 및 화면 타이틀에 사용)
const SITE_INFO = {
  pageTitle: "포항초곡 호반써밋 방문예약",
  target: "포항초곡 호반써밋 매매예약 계약체결",
  resMethod: "홈페이지 온라인 예약 (동일 세대 중복예약 불가)",
  contractPeriod: "2026. 9. 7.(월) ~ 9. 18.(금) (9.12 제외)",
  contractTime: "09:30 ~ 16:00 (점심시간 12:00~13:00 제외)",
  contractPlace: "단지내 커뮤니티 임대사업소 (지하1층)",
  reservationPeriod: "2026. 8. 25.(화) ~ 9. 18.(금)",
  officeTel: "054-612-3832",
  companyName: "㈜호반건설",
  noticeDate: "2026년 8월 25일"
};

// 방문 예약 가능 일자 (YYYY-MM-DD), 안내문의 9.12(토) 제외 반영
const VISIT_DATES = [
  "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11",
  "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"
];

// 30분 단위 시간대 (09:30~16:00, 점심 12:00~13:00 제외) - Code.gs와 동일해야 함
const TIME_SLOTS = [
  "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"
];

// 시간대(슬롯)당 최대 예약 인원(팀 수)
const CAPACITY_PER_SLOT = 2;
