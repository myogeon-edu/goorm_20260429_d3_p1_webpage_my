const http = require("http");
const fs = require("fs");
const path = require("path");

loadEnv();

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const PLAN_SYSTEM = `사용자의 목표를 실행 가능한 Task 리스트로 쪼개주세요.

조건:
- 5~10개의 단계
- 각 단계는 구체적
- 순서 포함
- 각 작업에 예상 시간(시간 단위, 숫자) 포함

반드시 아래 JSON 형식만 출력하세요. 다른 설명이나 마크다운은 넣지 마세요.
{"tasks":[{"task":"작업 제목","duration":2}]}`;

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/plan") {
      await handlePlan(req, res);
      return;
    }

    if (req.method === "OPTIONS" && req.url === "/api/plan") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method Not Allowed" });
  } catch (error) {
    sendJson(res, 500, { error: "Internal Server Error", detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
  if (!OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY is missing. Create .env based on .env.example");
  }
});

async function handlePlan(req, res) {
  if (!OPENAI_API_KEY) {
    sendJson(res, 500, { error: "OPENAI_API_KEY is not configured in .env" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const goal = String(body?.goal || "").trim();
  if (!goal) {
    sendJson(res, 400, { error: "goal is required" });
    return;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PLAN_SYSTEM },
        { role: "user", content: `목표: ${goal}` },
      ],
    }),
  });

  const rawText = await response.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  if (!response.ok) {
    const errMsg = data?.error?.message || data?.message || "OpenAI API request failed";
    sendJson(res, response.status, { error: errMsg, detail: data });
    return;
  }

  const content = data?.choices?.[0]?.message?.content;
  let parsed;
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : null;
  } catch {
    sendJson(res, 502, { error: "AI 응답 JSON을 파싱할 수 없습니다." });
    return;
  }

  const tasks = parsed?.tasks;
  if (!Array.isArray(tasks)) {
    sendJson(res, 502, { error: "AI 응답에 tasks 배열이 없습니다." });
    return;
  }

  sendJson(res, 200, { tasks });
}

function serveStatic(req, res) {
  const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT_DIR, safePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendJson(res, 404, { error: "Not Found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(content);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", (error) => reject(error));
  });
}

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
