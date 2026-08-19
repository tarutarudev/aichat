import { Elysia } from 'elysia';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

const app = new Elysia()
  .post('/api/chat', async ({ body }) => {
    try {
      const { message } = body;

      if (!message) {
        return new Response(JSON.stringify({ error: 'メッセージが必要です。' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await model.generateContent(message);
      const response = await result.response;
      const text = response.text();

      return new Response(JSON.stringify({ reply: text }), {
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
