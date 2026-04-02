import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "./server/db";

const JWT_SECRET = process.env.JWT_SECRET || "momsafe_secret_key_123";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON 바디 파싱 미들웨어 (이미지 Base64 처리를 위해 용량 제한 증가)
  app.use(express.json({ limit: '10mb' }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- Authentication Routes ---
  app.get("/api/auth/google/url", (req, res) => {
    const redirectUri = req.query.redirectUri as string;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "email profile",
      access_type: "offline",
      prompt: "consent",
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    const redirectUri = `https://${req.get("host")}/api/auth/google/callback`;
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          code: code as string,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error_description || "Failed to get token");
      
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userRes.json();

      let isNewUser = false;
      let user = db.prepare("SELECT * FROM users WHERE email = ?").get(userData.email) as any;
      if (!user) {
        isNewUser = true;
        const stmt = db.prepare("INSERT INTO users (email, name, provider, provider_id, remaining_scans) VALUES (?, ?, ?, ?, 3)");
        const info = stmt.run(userData.email, userData.name, "google", userData.id);
        user = { id: info.lastInsertRowid, email: userData.email, name: userData.name, subscription_status: 'free', remaining_scans: 3 };
        
        db.prepare("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)").run(user.id, 'bonus', 3, '회원가입 무료 스캔 지급');
      }

      const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });

      res.send(`
        <html><body><script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${token}', user: ${JSON.stringify(user)}, isNewUser: ${isNewUser} }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script></body></html>
      `);
    } catch (error) {
      console.error("Google OAuth Error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/auth/kakao/url", (req, res) => {
    const redirectUri = req.query.redirectUri as string;
    const params = new URLSearchParams({
      client_id: process.env.KAKAO_CLIENT_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
    });
    res.json({ url: `https://kauth.kakao.com/oauth/authorize?${params}` });
  });

  app.get("/api/auth/kakao/callback", async (req, res) => {
    const { code } = req.query;
    const redirectUri = `https://${req.get("host")}/api/auth/kakao/callback`;
    try {
      const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.KAKAO_CLIENT_ID || "",
          client_secret: process.env.KAKAO_CLIENT_SECRET || "",
          redirect_uri: redirectUri,
          code: code as string,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error_description || "Failed to get token");

      const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userRes.json();
      
      const email = userData.kakao_account?.email || `kakao_${userData.id}@example.com`;
      const name = userData.kakao_account?.profile?.nickname || "카카오 유저";

      let isNewUser = false;
      let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      if (!user) {
        isNewUser = true;
        const stmt = db.prepare("INSERT INTO users (email, name, provider, provider_id, remaining_scans) VALUES (?, ?, ?, ?, 3)");
        const info = stmt.run(email, name, "kakao", String(userData.id));
        user = { id: info.lastInsertRowid, email, name, subscription_status: 'free', remaining_scans: 3 };
        
        db.prepare("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)").run(user.id, 'bonus', 3, '회원가입 무료 스캔 지급');
      }

      const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });

      res.send(`
        <html><body><script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${token}', user: ${JSON.stringify(user)}, isNewUser: ${isNewUser} }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script></body></html>
      `);
    } catch (error) {
      console.error("Kakao OAuth Error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.post("/api/auth/test", (req, res) => {
    try {
      const email = "test@momscan.com";
      const name = "테스트 유저";
      let isNewUser = false;
      let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      
      if (!user) {
        isNewUser = true;
        const stmt = db.prepare("INSERT INTO users (email, name, provider, provider_id, remaining_scans) VALUES (?, ?, ?, ?, 3)");
        const info = stmt.run(email, name, "test", "test_123");
        user = { id: info.lastInsertRowid, email, name, subscription_status: 'free', remaining_scans: 3 };
        
        db.prepare("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)").run(user.id, 'bonus', 3, '회원가입 무료 스캔 지급');
      }

      const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ success: true, token, user, isNewUser });
    } catch (error) {
      console.error("Test Login Error:", error);
      res.status(500).json({ success: false, message: "Test login failed" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "인증 토큰이 없습니다." });
      }

      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      const user: any = db.prepare("SELECT id, email, name, subscription_status, remaining_scans FROM users WHERE id = ?").get(decoded.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
      }

      res.json({ success: true, user });
    } catch (error) {
      res.status(401).json({ success: false, message: "유효하지 않은 토큰입니다." });
    }
  });

  app.get("/api/user/transactions", (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "인증 토큰이 없습니다." });
      }

      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      const transactions = db.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC").all(decoded.userId);
      
      res.json({ success: true, transactions });
    } catch (error) {
      res.status(401).json({ success: false, message: "유효하지 않은 토큰입니다." });
    }
  });

  app.post("/api/user/deduct-scan", (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "인증 토큰이 없습니다." });
      }

      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      const user: any = db.prepare("SELECT id, subscription_status, remaining_scans FROM users WHERE id = ?").get(decoded.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
      }

      if (user.subscription_status === 'premium') {
        // 프리미엄 유저는 횟수 차감 없음, 내역만 기록
        db.prepare("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)").run(user.id, 'usage', 0, '스캔 1회 사용 (무제한)');
        return res.json({ success: true, remaining_scans: user.remaining_scans });
      }

      if (user.remaining_scans <= 0) {
        return res.status(403).json({ success: false, message: "남은 스캔 횟수가 없습니다." });
      }

      // 횟수 차감 및 내역 기록
      db.prepare("UPDATE users SET remaining_scans = remaining_scans - 1 WHERE id = ?").run(user.id);
      db.prepare("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)").run(user.id, 'usage', -1, '스캔 1회 사용');
      
      res.json({ success: true, remaining_scans: user.remaining_scans - 1 });
    } catch (error) {
      res.status(401).json({ success: false, message: "유효하지 않은 토큰입니다." });
    }
  });

  // 네이버 클로바 OCR 연동 API
  app.post("/api/ocr", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      const apiUrl = process.env.NAVER_CLOVA_OCR_API_URL;
      const secretKey = process.env.NAVER_CLOVA_OCR_SECRET_KEY;

      if (!apiUrl || !secretKey || apiUrl === "https://...") {
        // 환경변수가 설정되지 않은 경우 개발용 모의(Mock) 데이터 반환
        console.log("Naver Clova OCR keys not set. Returning mock data.");
        // 지연 시간 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 1500));
        return res.json({
          success: true,
          text: "밀가루, 정제염, L-글루탐산나트륨, 합성착향료",
          isMock: true
        });
      }

      // 실제 네이버 클로바 OCR API 호출 로직
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OCR-SECRET': secretKey
        },
        body: JSON.stringify({
          version: 'V2',
          requestId: 'req-' + Date.now(),
          timestamp: Date.now(),
          images: [
            {
              format: 'jpeg',
              data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
              name: 'ingredient_list'
            }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'OCR API Error');

      // Clova OCR 응답에서 텍스트 추출 (inferText 결합)
      let extractedText = "";
      if (data.images && data.images[0] && data.images[0].fields) {
        extractedText = data.images[0].fields.map((field: any) => field.inferText).join(" ");
      }

      res.json({ success: true, text: extractedText });
    } catch (error: any) {
      console.error("OCR failed:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 결제 승인 API (Toss Payments 예시)
  // 프론트엔드에서 결제창 호출 후 성공 시 이 엔드포인트로 요청을 보냅니다.
  app.post("/api/payments/confirm", async (req, res) => {
    try {
      const { paymentKey, orderId, amount } = req.body;
      
      // 임시 성공 응답
      res.json({ 
        success: true, 
        message: "결제 승인 API가 정상적으로 호출되었습니다. (서버 사이드 처리 완료)",
        data: { paymentKey, orderId, amount }
      });
    } catch (error: any) {
      console.error("Payment confirmation failed:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post("/api/payments/mock-purchase", (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "인증 토큰이 없습니다." });
      }

      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      const { passType } = req.body; // 'premium' or '5scans'
      
      const user: any = db.prepare("SELECT id, subscription_status, remaining_scans FROM users WHERE id = ?").get(decoded.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
      }

      if (passType === 'premium') {
        db.prepare("UPDATE users SET subscription_status = 'premium' WHERE id = ?").run(user.id);
        db.prepare("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)").run(user.id, 'purchase', 0, '1개월 무제한 이용권 구매');
      } else if (passType === '5scans') {
        db.prepare("UPDATE users SET remaining_scans = remaining_scans + 5 WHERE id = ?").run(user.id);
        db.prepare("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)").run(user.id, 'purchase', 5, '5회 추가권 구매');
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(401).json({ success: false, message: "유효하지 않은 토큰입니다." });
    }
  });

  // 결제 웹훅 API (Toss Payments 예시)
  app.post("/api/payments/webhook", async (req, res) => {
    const webhookData = req.body;
    console.log("Received payment webhook:", webhookData);
    // TODO: 결제 상태 변경 (가상계좌 입금 등) DB 업데이트 로직 추가
    res.status(200).send("OK");
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
