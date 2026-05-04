# TC-04: 설정 / 히스토리 / 고객지원

> 마지막 업데이트: 2026-05-03  
> 테스터: ___  
> 테스트 환경: Staging — https://mamiscan-1w0sqc89l-unih206-3834s-projects.vercel.app

---

## 4-1. 설정 페이지

| ID | 시나리오 | 전제조건 | 테스트 단계 | 기대결과 | 결과 | 비고 |
|----|---------|---------|-----------|---------|------|-----|
| TC-04-01 | 닉네임 변경 | 로그인, /settings | 1. 닉네임 영역 탭 (또는 수정 버튼)<br>2. Bottom Sheet에서 새 닉네임 입력<br>3. 저장 탭 | 저장 성공 토스트, users.name 업데이트, 화면에 즉시 반영 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-02 | 닉네임 20자 초과 입력 | /settings Bottom Sheet | 1. 21자 이상 닉네임 입력 시도 | 입력 제한(20자 max) 또는 저장 시 에러 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-03 | 임신 주차 변경 — 주차 직접 입력 | 로그인, /settings | 1. 임신 정보 영역 탭<br>2. 주차 숫자 입력 (예: 20)<br>3. 저장 | users.pregnancy_weeks=20 저장, 다음 스캔 시 적용 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-04 | 임신 주차 변경 — LMP 입력 | 로그인, /settings | 1. 임신 정보 영역 탭<br>2. "마지막 생리일" 날짜 선택<br>3. 저장 | pregnancy_start_date 저장, 주차 자동 계산 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | calcPregnancyWeek |
| TC-04-05 | 임신 주차 범위 외 입력 (0, 43) | /settings Bottom Sheet | 1. 0 또는 43 입력 후 저장 시도 | 저장 실패 + 에러 안내 (1~42 범위만 허용) | ⬜ Pass ⬜ Fail ⬜ Skip | API 검증 |
| TC-04-06 | 스캔권 정보 — monthly 활성 표시 | monthly active | 1. /settings 접속 | "무제한 스캔권 사용 중", 만료일, 남은 일수 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-07 | 스캔권 정보 — 횟수권 표시 | scan5 active | 1. /settings 접속 | 잔여 횟수 표시, "충전하기" 버튼 노출 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-08 | 스캔권 정보 — 이용권 없음 | 이용권 만료/없음 | 1. /settings 접속 | "스캔권 없음" + "충전하기" 버튼 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-09 | 로그아웃 | 로그인 상태 | 1. /settings에서 "로그아웃" 탭<br>2. 확인 | 세션 종료 → /login 이동 | ⬜ Pass ⬜ Fail ⬜ Skip | 모든 sb-* 쿠키 만료 |
| TC-04-10 | 회원 탈퇴 — 확인 Bottom Sheet 표시 | 로그인 상태 | 1. /settings에서 "회원 탈퇴" 탭 | 경고 Bottom Sheet 표시 ("데이터 즉시 삭제, 복구 불가" 안내) | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-11 | 회원 탈퇴 — 최종 확인 | /settings 탈퇴 Bottom Sheet | 1. 탈퇴 Bottom Sheet에서 최종 확인 탭 | 모든 데이터 삭제 → /login 이동 (재로그인 불가) | ⬜ Pass ⬜ Fail ⬜ Skip | scan-images 버킷, auth.users 삭제 |
| TC-04-12 | 탈퇴 후 같은 계정으로 재로그인 | 탈퇴한 계정 | 1. 탈퇴한 Google/Kakao 계정으로 로그인 시도 | 신규 유저로 처리 (trial 재지급) | ⬜ Pass ⬜ Fail ⬜ Skip | 이전 데이터 없음 확인 |
| TC-04-13 | 이메일 표시 (읽기 전용) | 로그인 상태 | 1. /settings 접속 | 이메일 표시됨, 수정 불가 | ⬜ Pass ⬜ Fail ⬜ Skip | |

---

## 4-2. 히스토리 페이지

| ID | 시나리오 | 전제조건 | 테스트 단계 | 기대결과 | 결과 | 비고 |
|----|---------|---------|-----------|---------|------|-----|
| TC-04-14 | 히스토리 접근 — 이용권 있음 | monthly 또는 구매 이력 보유 | 1. /history 접근 | 스캔 목록 날짜별 그룹(오늘/어제/이번 주/월별) 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-15 | 히스토리 접근 — 이용권/구매 이력 없음 | 구매 이력 없는 trial 유저 | 1. /history 접근 | 프리뷰 더미 카드 + "스캔권 알아보기" CTA | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-16 | 제품명 검색 필터 | 히스토리 목록 | 1. 검색창에 제품명 일부 입력 | 실시간 필터링 결과 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-17 | 검색 결과 없음 | 존재하지 않는 제품명 검색 | 1. 없는 제품명 입력 | "검색 결과 없음" 안내 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-18 | 히스토리 항목 클릭 → 이전 결과 재표시 | 히스토리 목록 | 1. 항목 탭 | /result 이동, 기존 result_json 기반 결과 표시 (분석 API 미호출) | ⬜ Pass ⬜ Fail ⬜ Skip | sessionStorage resultData |
| TC-04-19 | 히스토리 이미지 썸네일 표시 | 스캔 이미지 있는 항목 | 1. 히스토리 목록 확인 | 썸네일 이미지 정상 로딩 (Supabase Storage 서명된 URL) | ⬜ Pass ⬜ Fail ⬜ Skip | |

---

## 4-3. 고객지원 페이지

| ID | 시나리오 | 전제조건 | 테스트 단계 | 기대결과 | 결과 | 비고 |
|----|---------|---------|-----------|---------|------|-----|
| TC-04-20 | FAQ 목록 조회 | /support 접속 | 1. /support 접속 | FAQ 항목 표시 (DB faq_items 또는 하드코딩 fallback) | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-21 | 문의 작성 — 필수 항목(카테고리, 내용) 미입력 시 | /support 문의 폼 | 1. 카테고리/내용 비워두고 제출 탭 | 제출 버튼 비활성 또는 에러 메시지 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-22 | 문의 작성 성공 | 카테고리 + 내용 입력 | 1. 카테고리 선택<br>2. 내용 입력 (최대 2000자)<br>3. 제출 | 제출 성공, 문의 내역에 status=open 항목 추가 | ⬜ Pass ⬜ Fail ⬜ Skip | customer_inquiries 저장 |
| TC-04-23 | 문의 내용 2000자 초과 | 문의 폼 | 1. 내용에 2001자 이상 입력 | 입력 제한 또는 저장 시 에러 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-24 | 이미지 첨부 — 3장 이내 | 문의 폼 | 1. 이미지 3장 첨부<br>2. 제출 | 3장 모두 업로드 성공, 문의에 첨부됨 | ⬜ Pass ⬜ Fail ⬜ Skip | /api/support/upload |
| TC-04-25 | 이미지 첨부 — 4장 초과 시도 | 문의 폼 | 1. 4번째 이미지 추가 시도 | 초과 안내 또는 추가 불가 처리 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-26 | 문의 내역 상태 배지 표시 | 문의 이력 있는 유저 | 1. /support → 내 문의 내역 탭 | open/in_progress/resolved 상태별 배지 색상 정확 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-27 | 문의 상세 — 답변 표시 | admin_note 있는 문의 | 1. 답변 완료된 문의 탭 | 관리자 답변 텍스트 표시, resolved 배지 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-28 | 문의 상세 — 처리 중 안내 | status=in_progress | 1. 처리 중 문의 탭 | 처리 중 안내 텍스트 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |

---

## 4-4. 기타 / 공지사항

| ID | 시나리오 | 전제조건 | 테스트 단계 | 기대결과 | 결과 | 비고 |
|----|---------|---------|-----------|---------|------|-----|
| TC-04-29 | 공지사항 목록 조회 | 로그인 상태 | 1. /notices 접속 | 공지사항 목록 표시, 읽음/안읽음 구분 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-30 | 약관 페이지 접근 | 전체 | 1. /terms, /privacy, /policies 접속 | 정적 약관 내용 정상 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-31 | 하단 네비게이션 탭 전환 | 전체 페이지 | 1. 홈/스캔/히스토리/설정 탭 순서대로 탭 | 각 페이지 정상 이동, 활성 탭 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-04-32 | PWA 설치 배너 표시 | 미설치 PWA, 지원 브라우저 | 1. 앱 첫 접속 (Safari/Chrome) | PWA 설치 배너 상단 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | PwaInstallBanner |

---

## 체크포인트

- [ ] 탈퇴 시 `scan-images/{user_id}/` 버킷 폴더 전체 삭제 확인
- [ ] 탈퇴 후 `transactions` 테이블은 user_id=NULL로 보존 확인 (결제 기록 보존)
- [ ] 히스토리 90일 초과 데이터 자동 삭제 정책 확인 (실제 삭제는 백그라운드 작업)
- [ ] iOS Safari PWA 설치 후 safe-area 적용 여부 (sticky 헤더, 하단 네비)
- [ ] 문의 첨부 이미지 URL이 공개 접근 가능한지 또는 인증 필요한지 확인
