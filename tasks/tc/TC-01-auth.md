# TC-01: 인증 / 회원가입

> 마지막 업데이트: 2026-05-03  
> 테스터: ___  
> 테스트 환경: Staging — https://mamiscan-1w0sqc89l-unih206-3834s-projects.vercel.app

---

## 테스트 항목

| ID | 시나리오 | 전제조건 | 테스트 단계 | 기대결과 | 결과 | 비고 |
|----|---------|---------|-----------|---------|------|-----|
| TC-01-01 | Google OAuth 로그인 (신규 유저) | 비로그인 상태, 처음 가입하는 Google 계정 | 1. /login 접속<br>2. "Google로 계속하기" 탭<br>3. Google 계정 선택 후 허용 | /signup/terms 이동, Supabase user_entitlements에 trial(3회) 생성 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-02 | Kakao OAuth 로그인 (신규 유저) | 비로그인 상태, 처음 가입하는 Kakao 계정 | 1. /login 접속<br>2. "카카오로 계속하기" 탭<br>3. Kakao 계정 인증 | /signup/terms 이동, trial 3회 지급 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-03 | 기존 유저 재로그인 (Google) | 약관 동의·프로필 설정 완료 유저 | 1. /login 접속<br>2. Google 로그인 | /home 바로 이동 (terms/profile 건너뜀) | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-04 | 로그인 상태에서 /login 직접 접근 | 로그인된 상태 | 1. 주소창에 /login 입력 | /home 자동 리다이렉트 | ⬜ Pass ⬜ Fail ⬜ Skip | middleware 처리 |
| TC-01-05 | 약관 미동의 유저가 /history 접근 | 로그인 완료, terms_agreed=false | 1. 주소창에 /history 입력 | /signup/terms 강제 리다이렉트 | ⬜ Pass ⬜ Fail ⬜ Skip | middleware 처리 |
| TC-01-06 | 약관 미동의 유저가 /settings 접근 | 로그인 완료, terms_agreed=false | 1. 주소창에 /settings 입력 | /signup/terms 강제 리다이렉트 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-07 | 약관 전체 동의 후 다음 | /signup/terms 페이지 | 1. 필수 약관 3개 모두 체크<br>2. "동의하고 계속하기" 탭 | /signup/profile 이동 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-08 | 약관 일부만 체크 후 버튼 상태 | /signup/terms 페이지 | 1. 필수 약관 1~2개만 체크 | "동의하고 계속하기" 버튼 비활성(disabled) | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-09 | 프로필 닉네임 입력 후 완료 | /signup/profile 페이지 | 1. 닉네임 입력<br>2. "완료" 탭 | users.name 저장, /home 이동 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-10 | 프로필 건너뛰기 (입력 없이 완료) | /signup/profile 페이지 | 1. 아무것도 입력하지 않고 "완료" 탭 | /home 이동 (닉네임 null) | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-11 | 임신 주차 직접 입력 (정상값: 1~42) | /signup/profile 페이지 | 1. 주차 입력란에 14 입력<br>2. "완료" 탭 | users.pregnancy_weeks=14 저장, /home 이동 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-12 | 임신 주차 범위 초과 (0 또는 43) | /signup/profile 페이지 | 1. 주차 입력란에 0 입력 or 43 입력<br>2. "완료" 탭 | 입력 막힘 또는 유효성 에러 메시지 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-13 | LMP(마지막 생리일)로 주차 자동계산 | /signup/profile 페이지 | 1. "마지막 생리일" 선택<br>2. 날짜 입력 | 자동 계산된 주차 표시 후 저장 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-14 | 비로그인으로 /settings 접근 | 비로그인 상태 | 1. 주소창에 /settings 입력 | /login 리다이렉트 | ⬜ Pass ⬜ Fail ⬜ Skip | middleware |
| TC-01-15 | 비로그인으로 /payment/checkout 접근 | 비로그인 상태 | 1. 주소창에 /payment/checkout 입력 | /login 리다이렉트 | ⬜ Pass ⬜ Fail ⬜ Skip | middleware |
| TC-01-16 | 비로그인으로 /history 접근 | 비로그인 상태 | 1. 주소창에 /history 입력 | /login 리다이렉트 | ⬜ Pass ⬜ Fail ⬜ Skip | middleware |
| TC-01-17 | 비로그인으로 /billing-history 접근 | 비로그인 상태 | 1. 주소창에 /billing-history 입력 | /login 리다이렉트 | ⬜ Pass ⬜ Fail ⬜ Skip | middleware |

| TC-01-18 | 게스트 2회 사용 후 로그인 → trial 잔여 1회 | 비로그인 guest_scans=2, 신규 가입 | 1. 게스트로 2회 스캔<br>2. 로그인 (신규 가입)<br>3. 홈 또는 스캔 페이지 진입<br>4. 잔여 스캔 확인 | trial scan_count=1 (3-2), localStorage 초기화 | ⬜ Pass ⬜ Fail ⬜ Skip | sync-guest-scans API |
| TC-01-19 | 게스트 0회 사용 후 로그인 → trial 잔여 3회 | 비로그인 guest_scans=0, 신규 가입 | 1. 게스트 스캔 없이 로그인<br>2. 잔여 스캔 확인 | trial scan_count=3 그대로 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-20 | 게스트 3회 모두 사용 후 로그인 → trial 잔여 0회 | 비로그인 guest_scans=3, 신규 가입 | 1. 게스트로 3회 스캔<br>2. 로그인<br>3. 잔여 스캔 확인 | trial scan_count=0, 스캔 시 /pricing 리다이렉트 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-01-21 | 기존 유저 재로그인 시 sync-guest-scans 미호출 | 기존 유저 (trial 이미 일부 사용) | 1. guest_scans 없는 상태로 재로그인 | localStorage 없으므로 API 호출 안 함, trial 변동 없음 | ⬜ Pass ⬜ Fail ⬜ Skip | |

---

## 체크포인트

- [ ] 신규 로그인 시 `user_entitlements`에 trial(type='trial', scan_count=3) 레코드 생성 확인
- [ ] `terms_agreed` 미동의 상태에서 보호 경로 전부 차단되는지 확인
- [ ] 기존 유저 재로그인 시 trial 중복 지급 안 되는지 확인
