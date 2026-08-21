import { Elysia } from 'elysia';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  getHomeFeed,
  getRanking,
  getPlotById,
  getPlotPersona,
  recordChatEvent,
  touchHistory,
  getHistory,
} from './db.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const chatSessions = new Map();
const RANKING_PERIODS = ['daily', 'weekly', 'monthly', 'total'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

const app = new Elysia()

  .group('/api/plots', (app) => app

    .get('/', () => json({ plots: getHomeFeed() }))


    .get('/ranking', ({ query }) => {
      const period = RANKING_PERIODS.includes(query.period) ? query.period : 'total';
      return json({ period, plots: getRanking(period) });
    })

    .get('/:id', ({ params, query }) => {
      const plot = getPlotById(params.id);
      if (!plot) {
        return json({ error: 'プロットが見つかりません。' }, 404);
      }
      if (query.userId) {
        touchHistory(query.userId, params.id, null, null);
      }
      return json(plot);
    })
  )


  .get('/api/history', ({ query }) => json({ history: getHistory(query.userId) }))


  .post('/api/chat', async ({ body }) => {
    try {
      const { message, plotId, sessionId, userId } = body;

      if (!message) {
        return json({ error: 'メッセージが必要です。' }, 400);
      }
      if (!plotId) {
        return json({ error: 'plotId が必要です。' }, 400);
      }

      let session = sessionId ? chatSessions.get(sessionId) : null;
      if (session && session.plotId !== plotId) {
        session = null;
      }

      let uid = session ? sessionId : null;
      let chat = session ? session.chat : null;


      if (!chat) {
        const persona = getPlotPersona(plotId);
        if (!persona) {
          return json({ error: 'プロットが見つかりません。' }, 404);
        }

        uid = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const model = genAI.getGenerativeModel({
          model: "gemini-3.6-flash",
          systemInstruction: persona,
        });
        chat = model.startChat({
          history: []
        });
        chatSessions.set(uid, { chat, plotId });
      }

      const result = await chat.sendMessage(message);
      const text = result.response.text();

      recordChatEvent(plotId);
      touchHistory(userId, plotId, uid, text);

      return json({ reply: text, sessionId: uid });
    } catch (error) {
      console.error('Gemini API エラー:', error);
      return json({ error: error }, 500);
    }
  })


  .get('/public/*', ({ params }) => {
    const filePath = `./public/${params['*']}`;
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

  .get('/', () => {
    const file = Bun.file('./public/index.html');
    return new Response(file, {
      headers: { 'Content-Type': 'text/html' }
    });
  })
  .listen(3000);

console.log(`http://localhost:${app.server.port} でサーバー動かしたやでー`);
