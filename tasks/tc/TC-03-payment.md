# TC-03: 결제 / 이용권

> 마지막 업데이트: 2026-05-03  
> 테스터: ___  
> 테스트 환경: Staging — https://mamiscan-1w0sqc89l-unih206-3834s-projects.vercel.app  
> ⚠️ Toss 결제 테스트는 Toss 테스트 카드 사용 (실결제 아님)

---

## 3-1. 결제 플로우

| ID | 시나리오 | 전제조건 | 테스트 단계 | 기대결과 | 결과 | 비고 |
|----|---------|---------|-----------|---------|------|-----|
| TC-03-01 | /pricing 페이지 접근 (로그인) | 로그인 상태 | 1. 하단 네비 "스캔" → "충전하기" 또는 /pricing 직접 접근 | 두 요금제(scan5 1,800원 / monthly 5,800원) 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-02 | scan5 구매 (이용권 없는 상태) | 로그인, 이용권 없음 | 1. /pricing에서 "5회 스캔권" 선택<br>2. Toss 결제 완료 (테스트 카드) | /payment/success 이동, scan5 즉시 active, 잔여 5회 | ⬜ Pass ⬜ Fail ⬜ Skip | user_entitlements 확인 |
| TC-03-03 | scan5 구매 (monthly 활성 중) | 로그인, monthly active | 1. scan5 구매 완료 | scan5가 pending 상태로 생성, 무제한 만료 후 자동 활성 예약 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-04 | monthly 구매 (이용권 없는 상태, 처음) | 로그인, 이용권 없음 | 1. /pricing에서 "1개월 무제한" 선택<br>2. 결제 완료 | /payment/success 이동, monthly pending 상태 (첫 스캔 시 active) | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-05 | monthly 구매 (monthly 이미 활성 중) | 로그인, monthly active | 1. monthly 추가 구매 완료 | 기존 만료일에 +30일 연장 (stack) | ⬜ Pass ⬜ Fail ⬜ Skip | expires_at 확인 |
| TC-03-06 | monthly 구매 (scan5 보유 중) | 로그인, scan5 active | 1. monthly 구매 완료 | /payment/success에서 대기 모달 표시 ("scan5 소진 후 무제한 시작") | ⬜ Pass ⬜ Fail ⬜ Skip | isPending:true |
| TC-03-07 | 결제 성공 페이지 정보 표시 | 결제 완료 직후 | 1. /payment/success 확인 | 구매한 이용권 정보(종류, 유효기간) 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-08 | 결제 취소 → /payment/fail | Toss 결제 창에서 취소 | 1. 결제 위젯에서 "취소" 탭 | /payment/fail 이동, "결제를 취소하셨습니다" 안내 | ⬜ Pass ⬜ Fail ⬜ Skip | PAY_PROCESS_CANCELED |
| TC-03-09 | 결제 실패 → /payment/fail | 카드 오류 등 실패 | 1. 오류 유발 테스트 카드로 결제 시도 | /payment/fail 이동, 실패 안내 + 재시도 버튼 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-10 | 중복 결제 방지 (orderId 재사용) | 동일 orderId로 재요청 | — (API 레벨 테스트) | 409 응답, 이중 결제 없이 기존 건으로 처리 | ⬜ Pass ⬜ Fail ⬜ Skip | |

---

## 3-2. 이용권 차감 (스캔 시)

| ID | 시나리오 | 전제조건 | 테스트 단계 | 기대결과 | 결과 | 비고 |
|----|---------|---------|-----------|---------|------|-----|
| TC-03-11 | monthly 활성 시 스캔 → 차감 없음 | monthly active | 1. 스캔 후 결과 확인<br>2. 이용권 잔여 확인 | scan_count 변동 없음, scan_usage_logs에 로그만 기록 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-12 | scan5 활성 시 스캔 → 1회 차감 | scan5 active, count=5 | 1. 스캔 후 결과 확인<br>2. 설정 또는 청구내역에서 잔여 확인 | count=4로 감소 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-13 | scan5 마지막 1회 소진 | scan5 count=1, monthly pending | 1. 마지막 1회 스캔 | scan5 expired, monthly pending → active 자동 전환 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-14 | 이용권 없는 상태에서 스캔 시도 | 모든 이용권 없음 또는 만료 | 1. 스캔 시도 | 403 no_scans → /pricing 리다이렉트 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-15 | monthly pending → 첫 스캔으로 active 전환 | monthly pending, scan5 없음 | 1. 첫 스캔 시도 | monthly active 전환, 30일 타이머 시작 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-16 | monthly 활성 + scan5 보유 시 monthly 우선 차감 | monthly active, scan5 active | 1. 스캔 | monthly 우선 사용, scan5 count 그대로 | ⬜ Pass ⬜ Fail ⬜ Skip | scan5는 pause 상태 |

---

## 3-3. 청구내역 (Billing History)

| ID | 시나리오 | 전제조건 | 테스트 단계 | 기대결과 | 결과 | 비고 |
|----|---------|---------|-----------|---------|------|-----|
| TC-03-17 | 청구내역 목록 조회 | 결제 이력 있는 로그인 유저 | 1. /billing-history 접근 | 결제 목록 날짜 역순 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-18 | scan5 사용 현황 시각화 | scan5 거래 보유 | 1. 청구내역에서 scan5 카드 확인 | 닷(dot) 시각화로 사용/잔여 횟수 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-19 | monthly 카드 상태 표시 | monthly 거래 보유 | 1. 청구내역에서 monthly 카드 확인 | 이용 기간 표시, 미사용 시 "첫 스캔 시 30일" | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-20 | 거래 상태 배지 표시 | 다양한 상태 거래 | 1. 청구내역 확인 | 완료/환불완료/환불검토중/환불거절 배지 정확 표시 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-21 | 환불 요청 (미사용, completed) | 사용 0회, status=completed | 1. 청구내역에서 거래 탭<br>2. "환불 신청" 버튼 탭<br>3. 사유 선택 후 제출 | 환불 모달 → Toss 취소 성공 → status=refunded | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-22 | 환불 사유 선택 필수 | 환불 모달 | 1. 사유 선택 없이 제출 시도 | 제출 버튼 비활성 또는 에러 | ⬜ Pass ⬜ Fail ⬜ Skip | |
| TC-03-23 | 환불 불가 — 1회 이상 사용 | scan5, 1회 이상 사용 | 1. 청구내역에서 해당 거래 확인 | 환불 버튼 없음 또는 불가 안내 | ⬜ Pass ⬜ Fail ⬜ Skip | usedCount ≥ 1 |
| TC-03-24 | 환불 불가 — trial 거래 | type=trial | 1. trial 거래 확인 | 환불 버튼 없음 | ⬜ Pass ⬜ Fail ⬜ Skip | 무료권 환불 불가 |
| TC-03-25 | 환불 완료 후 이용권 회수 확인 | 환불 완료 | 1. 환불 완료 후 설정 페이지 확인 | 이용권 revoke, 잔여 횟수 0 | ⬜ Pass ⬜ Fail ⬜ Skip | process_refund RPC |

---

## 체크포인트

- [ ] 결제 완료 후 `user_entitlements` 레코드 type/status/scan_count/expires_at 정확 여부
- [ ] `transactions` 테이블에 order_id, price_krw, status=completed 기록 여부
- [ ] scan5+monthly 동시 보유 시 차감 우선순위 (monthly 우선) 동작 확인
- [ ] Optimistic Locking 동작: 동시에 2번 탭했을 때 이중 차감 안 되는지 확인
- [ ] 환불 후 Supabase `user_entitlements.status` = revoked 확인
