import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "./server/db";
import { config } from "dotenv";
config({ path: ".env.local" });

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
      
      const user: any = db.prepare("SELECT id, email, name, subscription_status, subscription_expires_at, remaining_scans, pregnancy_weeks FROM users WHERE id = ?").get(decoded.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
      }

      res.json({ success: true, user });
    } catch (error) {
      res.status(401).json({ success: false, message: "유효하지 않은 토큰입니다." });
    }
  });

  app.post("/api/user/pregnancy-weeks", (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "인증 토큰이 없습니다." });
      }

      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      const { weeks } = req.body;
      
      if (typeof weeks !== 'number' || weeks < 1 || weeks > 42) {
        return res.status(400).json({ success: false, message: "유효한 임신 주차를 입력해주세요 (1~42)." });
      }

      db.prepare("UPDATE users SET pregnancy_weeks = ? WHERE id = ?").run(weeks, decoded.userId);
      
      const user: any = db.prepare("SELECT id, email, name, subscription_status, subscription_expires_at, remaining_scans, pregnancy_weeks FROM users WHERE id = ?").get(decoded.userId);
      
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
      
      const enrichedTransactions = transactions.map((tx: any) => {
        if (tx.type === 'purchase') {
          const usageCount: any = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND type = 'usage' AND created_at > ?").get(decoded.userId, tx.created_at);
          return { ...tx, hasUsage: usageCount.count > 0 };
        }
        return tx;
      });
      
      res.json({ success: true, transactions: enrichedTransactions });
    } catch (error) {
      res.status(401).json({ success: false, message: "유효하지 않은 토큰입니다." });
    }
  });

  app.post("/api/user/refund", (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "인증 토큰이 없습니다." });
      }

      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      const { transactionId, reason } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({ success: false, message: "결제 내역 ID가 필요합니다." });
      }

      const transaction: any = db.prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ?").get(transactionId, decoded.userId);
      
      if (!transaction) {
        return res.status(404).json({ success: false, message: "결제 내역을 찾을 수 없습니다." });
      }

      if (transaction.type !== 'purchase') {
        return res.status(400).json({ success: false, message: "환불 가능한 결제 내역이 아닙니다." });
      }

      if (transaction.status === 'refunded' || transaction.status === 'refund_pending') {
        return res.status(400).json({ success: false, message: "이미 환불 처리되었거나 대기 중인 결제입니다." });
      }

      // Check for usage after purchase
      const usageAfterPurchase: any = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND type = 'usage' AND created_at > ?").get(decoded.userId, transaction.created_at);
      
      const hasUsage = usageAfterPurchase.count > 0;
      const isDuplicateOrError = reason === 'duplicate' || reason === 'error';

      if (hasUsage && !isDuplicateOrError) {
        return res.status(400).json({ success: false, message: "이미 사용 이력이 있어 직접 환불이 불가능합니다. 고객센터로 문의해주세요." });
      }

      if (isDuplicateOrError || hasUsage) {
        // Operator review required
        db.prepare("UPDATE transactions SET status = 'refund_pending' WHERE id = ?").run(transactionId);
        return res.json({ success: true, status: 'refund_pending', message: "환불 검토가 접수되었습니다. 운영자 확인 후 처리됩니다." });
      } else {
        // Direct refund possible
        db.prepare("UPDATE transactions SET status = 'refunded' WHERE id = ?").run(transactionId);
        // Also update user subscription status to free
        db.prepare("UPDATE users SET subscription_status = 'free' WHERE id = ?").run(decoded.userId);
        
        const user: any = db.prepare("SELECT id, email, name, subscription_status, subscription_expires_at, remaining_scans, pregnancy_weeks FROM users WHERE id = ?").get(decoded.userId);
        
        return res.json({ success: true, status: 'refunded', message: "전액 환불이 완료되었습니다.", user });
      }
      
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

  // 스캔 히스토리 저장
  app.post("/api/scan/history", (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "인증 토큰이 없습니다." });
      }
      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, JWT_SECRET);

      const { productName, status, resultJson } = req.body;
      if (!productName || !status || !resultJson) {
        return res.status(400).json({ success: false, message: "필수 데이터가 없습니다." });
      }

      db.prepare("INSERT INTO scan_history (user_id, product_name, status, result_json) VALUES (?, ?, ?, ?)").run(decoded.userId, productName, status, JSON.stringify(resultJson));
      res.json({ success: true });
    } catch (error) {
      res.status(401).json({ success: false, message: "유효하지 않은 토큰입니다." });
    }
  });

  // 스캔 히스토리 조회 (유료 이용권만)
  app.get("/api/scan/history", (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "인증 토큰이 없습니다." });
      }
      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, JWT_SECRET);

      const user: any = db.prepare("SELECT subscription_status, subscription_expires_at FROM users WHERE id = ?").get(decoded.userId);
      if (!user) return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });

      const isPremium = user.subscription_status === 'premium' && user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
      if (!isPremium) {
        return res.status(403).json({ success: false, message: "유료 이용권이 필요합니다." });
      }

      const rows = db.prepare("SELECT id, product_name, status, result_json, created_at FROM scan_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(decoded.userId);
      res.json({ success: true, history: rows });
    } catch (error) {
      res.status(401).json({ success: false, message: "유효하지 않은 토큰입니다." });
    }
  });

  // 캐시 헬퍼
  const getCached = (cacheKey: string) => {
    const row = db.prepare("SELECT result_json FROM product_cache WHERE cache_key = ?").get(cacheKey) as any;
    if (row) {
      db.prepare("UPDATE product_cache SET hit_count = hit_count + 1 WHERE cache_key = ?").run(cacheKey);
      return JSON.parse(row.result_json);
    }
    return null;
  };

  const saveCache = (cacheKey: string, productName: string, result: any) => {
    const base = { ...result, weekAnalysis: "" };
    db.prepare("INSERT OR REPLACE INTO product_cache (cache_key, product_name, result_json) VALUES (?, ?, ?)")
      .run(cacheKey, productName, JSON.stringify(base));
  };

  const getWeekAnalysis = async (productName: string, ingredients: any[], pregnancyWeeks: number) => {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const ingredientList = ingredients.map((i: any) => i.name).join(", ");
      const r = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: `제품명: ${productName}\n주요 성분: ${ingredientList}\n\n임신 ${pregnancyWeeks}주차 임산부에게 맞는 맞춤형 섭취 조언을 2~3문장으로 작성해줘. JSON 없이 텍스트만 반환.` }] }
      });
      return r.text?.trim() || "";
    } catch { return ""; }
  };

  // AI 분석 API — Gemini 호출을 서버에서 처리 (API key 보호)
  app.post("/api/analyze", async (req, res) => {
    const { imageBase64, barcode, pregnancyWeeks } = req.body;
    const hasWeekInfo = pregnancyWeeks !== undefined && pregnancyWeeks !== null;

    // 바코드 전용 스캔: 캐시 확인 → 식품안전나라 API → Gemini 텍스트 분석
    if (!imageBase64 && barcode) {
      // 1. 캐시 히트 확인
      const cacheKey = `barcode:${barcode}`;
      const cached = getCached(cacheKey);
      if (cached) {
        console.log(`[Cache HIT] ${cacheKey}`);
        if (hasWeekInfo) {
          cached.weekAnalysis = await getWeekAnalysis(cached.productName, cached.ingredients, pregnancyWeeks);
        }
        return res.json({ success: true, result: cached, fromCache: true });
      }

      const foodSafetyKey = process.env.FOOD_SAFETY_API_KEY;
      if (!foodSafetyKey) {
        return res.status(500).json({ success: false, message: "식품안전나라 API 키가 설정되지 않았습니다." });
      }

      let productName = "";
      let rawIngredients = "";
      let brand = "";
      let imageUrl = "";

      // 식품안전나라 + Open Food Facts 이미지 병렬 조회
      try {
        const [fsRes, offRes] = await Promise.allSettled([
          fetch(`https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02?serviceKey=${foodSafetyKey}&pageNo=1&numOfRows=3&type=json&BAR_CD=${barcode}`),
          fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=image_front_small_url`)
        ]);

        if (offRes.status === 'fulfilled' && offRes.value.ok) {
          const offData = await offRes.value.json();
          imageUrl = offData?.product?.image_front_small_url || "";
        }

        const fsData = fsRes.status === 'fulfilled' ? await fsRes.value.json() : null;
        const rows = fsData?.body?.items;

        if (!rows || rows.length === 0) {
          return res.json({
            success: true,
            result: {
              status: "error_db_mismatch",
              productName: "알 수 없는 제품",
              headline: "데이터베이스에 없는 제품이에요",
              description: "바코드가 인식되었지만 식품안전나라 DB에 등록되지 않은 제품입니다. 사진 촬영으로 다시 시도해보세요.",
              ingredients: [],
              alternatives: [],
              weekAnalysis: ""
            }
          });
        }

        productName = rows[0].FOOD_NM_KR || "알 수 없는 제품";
        rawIngredients = rows[0].RAWMTRL_NM || "";
        brand = rows[0].MAKER_NM || "";
      } catch (err) {
        console.error("식품안전나라 API 오류:", err);
        return res.status(500).json({ success: false, message: "식품 정보 조회 중 오류가 발생했습니다." });
      }

      // 제품 정보로 Gemini 텍스트 분석
      try {
        const { GoogleGenAI, Type } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
        const hasWeekInfo = pregnancyWeeks !== undefined && pregnancyWeeks !== null;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: {
            parts: [{
              text: `다음 식품 정보를 바탕으로 임산부가 섭취해도 안전한지 분석해줘.

제품명: ${productName}
제조사: ${brand}
원재료명: ${rawIngredients || "정보 없음"}

status는 "success", "caution", "danger" 중 하나로 설정해줘.
${hasWeekInfo ? `현재 사용자는 임신 ${pregnancyWeeks}주차입니다. description은 일반적인 설명으로 작성하고, weekAnalysis 필드에 이 주차의 임산부에게 맞는 맞춤형 섭취 조언을 작성해줘.` : `일반적인 임산부 기준으로 섭취 조언을 weekAnalysis에 작성해줘.`}
다음 JSON 형식으로 응답해줘:
{
  "status": "success" | "caution" | "danger",
  "productName": "${productName}",
  "headline": "요약 헤드라인 (주의/위험 성분명 직접 언급 절대 금지)",
  "description": "임산부 섭취와 관련된 전반적인 설명",
  "ingredients": [{ "name": "주요 성분/특징", "status": "success" | "caution" | "danger", "reason": "이유" }],
  "alternatives": [{ "name": "대체 식품 이름", "brand": "브랜드명", "price": "예상 가격대" }],
  "weekAnalysis": "임신 주차에 따른 섭취 조언"
}`
            }]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                productName: { type: Type.STRING },
                headline: { type: Type.STRING },
                description: { type: Type.STRING },
                ingredients: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, status: { type: Type.STRING }, reason: { type: Type.STRING } }, required: ["name", "status", "reason"] } },
                alternatives: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, brand: { type: Type.STRING }, price: { type: Type.STRING } }, required: ["name", "brand", "price"] } },
                weekAnalysis: { type: Type.STRING }
              },
              required: ["status", "productName", "headline", "description", "ingredients", "alternatives", "weekAnalysis"]
            }
          }
        });

        const result = JSON.parse(response.text?.trim() || "{}");
        if (imageUrl) result.imageUrl = imageUrl;
        // 캐시 저장 (weekAnalysis 제외한 기본 결과)
        saveCache(cacheKey, productName, result);
        return res.json({ success: true, result });
      } catch (err) {
        console.error("Gemini 바코드 분석 오류:", err);
        return res.status(500).json({ success: false, message: "분석 중 오류가 발생했습니다." });
      }
    }

    try {
      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

      const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      const mimeTypeMatch = imageBase64.match(/data:([^;]+);/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            {
              text: `이 사진에 있는 제품이 무엇인지 식별하고, 임산부가 섭취해도 안전한지 분석해줘.
만약 사진이 식료품이 아니거나 식별이 불가능하다면, 다음 중 가장 적절한 status를 선택해줘:
- "error_future_category": 일반 화장품, 일반의약품 등 마미스캔이 추후 지원할 예정인 카테고리인 경우
- "error_unsupported_category": 전문의약품, 식당 조리 음식 등 성분 판정 기준이 달라 지원하지 않는 카테고리인 경우
- "error_image_quality": 사진이 너무 흐리거나, 너무 어둡거나, 여러 제품이 찍혔거나, 제품이 없는 경우
- "error_db_mismatch": 바코드는 인식되나 제품을 도저히 알 수 없는 경우

정상적으로 식별된 식료품인 경우 status를 "success", "caution", "danger" 중 하나로 설정해줘.

★중요★: 만약 위의 error_* status를 선택하더라도, 이미지 속 제품/음식이 무엇인지 대략적으로라도 식별할 수 있다면, productName, headline, description, ingredients, weekAnalysis에 정상적인 분석 정보를 최대한 작성해줘. 완전히 식별 불가능한 경우에만 description에 그 이유를 적어줘.

${hasWeekInfo ? `현재 사용자는 임신 ${pregnancyWeeks}주차입니다. description은 일반적인 임산부 기준으로 작성하고, weekAnalysis 필드에는 임신 ${pregnancyWeeks}주차에 맞는 맞춤형 섭취 조언을 별도로 작성해줘.` : `일반적인 임산부 기준으로 섭취 조언을 weekAnalysis에 작성해줘.`}
다음 JSON 형식으로 응답해줘:
{
  "status": "success" | "caution" | "danger" | "error_future_category" | "error_unsupported_category" | "error_image_quality" | "error_db_mismatch",
  "productName": "식별된 식료품 이름 (식별 불가시 '알 수 없음')",
  "headline": "요약 헤드라인 (주의/위험 성분명 직접 언급 절대 금지. 예: 안심하고 드셔도 좋아요, 주의가 필요한 성분이 있어요 등)",
  "description": "임산부 섭취와 관련된 전반적인 설명 (주의/위험 성분명 직접 언급 절대 금지. 식별 불가시 그 이유를 짧게 작성. 예: '너무 어두워요', '여러 제품이 찍혔어요')",
  "ingredients": [{ "name": "주요 성분/특징 1", "status": "success" | "caution" | "danger", "reason": "이유" }],
  "alternatives": [{ "name": "대체 식품 이름", "brand": "브랜드명 (없으면 일반명칭)", "price": "예상 가격대" }],
  "weekAnalysis": "임신 주차에 따른 섭취 조언"
}`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING },
              productName: { type: Type.STRING },
              headline: { type: Type.STRING },
              description: { type: Type.STRING },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    status: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  },
                  required: ["name", "status", "reason"]
                }
              },
              alternatives: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    brand: { type: Type.STRING },
                    price: { type: Type.STRING }
                  },
                  required: ["name", "brand", "price"]
                }
              },
              weekAnalysis: { type: Type.STRING }
            },
            required: ["status", "productName", "headline", "description", "ingredients", "alternatives", "weekAnalysis"]
          }
        }
      });

      const jsonStr = response.text?.trim();
      if (!jsonStr) throw new Error("No response from AI");

      const result = JSON.parse(jsonStr);

      // 정상 식별된 식품만 캐시 저장
      if (!result.status?.startsWith("error_") && result.productName && result.productName !== "알 수 없음") {
        const imageCacheKey = `product:${result.productName.trim().toLowerCase()}`;
        const existingCache = getCached(imageCacheKey);
        if (!existingCache) {
          saveCache(imageCacheKey, result.productName, result);
        }
      }

      res.json({ success: true, result });
    } catch (err: any) {
      console.error("Analysis failed:", err);
      res.status(500).json({ success: false, message: "분석 중 오류가 발생했습니다." });
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
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        db.prepare("UPDATE users SET subscription_status = 'premium', subscription_expires_at = ? WHERE id = ?").run(expiresAt.toISOString(), user.id);
        db.prepare("INSERT INTO transactions (user_id, type, amount, description, price_krw) VALUES (?, ?, ?, ?, ?)").run(user.id, 'purchase', 0, '1개월 무제한 이용권 구매', 5800);
      } else if (passType === '5scans') {
        db.prepare("UPDATE users SET remaining_scans = remaining_scans + 5 WHERE id = ?").run(user.id);
        db.prepare("INSERT INTO transactions (user_id, type, amount, description, price_krw) VALUES (?, ?, ?, ?, ?)").run(user.id, 'purchase', 5, '5회 추가권 구매', 1800);
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
