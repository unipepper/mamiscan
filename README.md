<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/93d3531c-4174-4234-b37d-d9b3d2eec0d1

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
