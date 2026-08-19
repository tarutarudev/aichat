import { Elysia } from 'elysia';

const app = new Elysia()
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
