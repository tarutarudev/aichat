import { Elysia } from 'elysia';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// セッションを簡易的に実装してみた！
const chatSessions = new Map();

const app = new Elysia()
  .post('/api/chat', async ({ body }) => {
    try {
      const { message, sessionId } = body;

      if (!message) {
        return new Response(JSON.stringify({ error: 'メッセージが必要です。' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // セッションIDがなければ新規作成
      const uid = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // セッションを取得 or 作成
      let chat = chatSessions.get(uid);
      if (!chat) {
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
        chat = model.startChat({
          history: []
        });
        chatSessions.set(uid, chat);
      }

      // メッセージを送信して応答を取得
      const result = await chat.sendMessage(message);
      const text = result.response.text();

      return new Response(JSON.stringify({ reply: text, sessionId: uid }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Gemini API エラー:', error);
      return new Response(JSON.stringify({ error: 'エラーが発生しました。\nリクエスト過多か開発者の金がなくなりました。' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  })

  // 静的ファイルの提供
  .get('/public/*', ({ path }) => {
    const filePath = `./public${path}`;
    try {
      const file = Bun.file(filePath);
      const contentType = file.type || 'text/html';
      return new Response(file, {
        headers: { 'Content-Type': contentType }
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  })

  // メインページ
  .get('/', () => {
    const file = Bun.file('./public/index.html');
    return new Response(file, {
      headers: { 'Content-Type': 'text/html' }
    });
  })
  .listen(3000);

console.log(`http://localhost:${app.server.port} でサーバー動かしたやでー`);
