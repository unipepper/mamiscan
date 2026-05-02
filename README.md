# 마미스캔 (mamiscan)

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the following keys in [.env.local](.env.local):
   - `GEMINI_API_KEY` — Google AI Studio에서 발급 (`AIzaSy...`)
   - `FOOD_SAFETY_API_KEY` — 공공데이터포털(data.go.kr) 식품의약품안전처_식품영양성분DB 활용신청
   - `NEXT_PUBLIC_TOSS_CLIENT_KEY` — Toss Payments 테스트 클라이언트 키 (`test_ck_...`)
   - `TOSS_SECRET_KEY` — Toss Payments 테스트 시크릿 키 (`test_sk_...`)
3. Run the app:
   `npm run dev`
