import { serve, serveDir } from "./deps.ts";
import { handleWebSocket } from "./wsHandler.ts";

const PORT = parseInt(Deno.env.get("PORT") || "8000");

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // WebSocket endpoint for game
  if (url.pathname === '/ws') {
    if (request.headers.get("upgrade") === "websocket") {
      const { socket, response } = Deno.upgradeWebSocket(request);
      handleWebSocket(socket, request);
      return response;
    }
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }
  
  // WebSocket endpoint for admin
  if (url.pathname === '/admin/ws') {
    if (request.headers.get("upgrade") === "websocket") {
      const { socket, response } = Deno.upgradeWebSocket(request);
      handleWebSocket(socket, request);
      return response;
    }
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }
  
  // Admin API endpoints
  if (url.pathname === '/admin/stats') {
    return new Response(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(performance.now() / 1000)
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      }
    });
  }
  
  // Admin HTML page - secured by query parameter
  if (url.pathname === '/admin.html') {
    const isAdmin = url.searchParams.get('admin') === 'true';
    if (!isAdmin) {
      return new Response('Access denied. Use ?admin=true parameter', { 
        status: 403,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    try {
      const file = await Deno.readFile('./public/admin.html');
      return new Response(file, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    } catch {
      return new Response('Admin page not found', { status: 404 });
    }
  }
  
  // Serve static files from public directory
  try {
    return await serveDir(request, {
      fsRoot: 'public',
      urlRoot: '',
      showDirListing: false,
      enableCors: true
    });
  } catch (error) {
    console.error('Error serving static file:', error);
    
    // If file not found, serve index.html for SPA routing
    if (error instanceof Deno.errors.NotFound) {
      try {
        const file = await Deno.readFile('./public/index.html');
        return new Response(file, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }
    
    return new Response('Internal server error', { status: 500 });
  }
}

// Start server
console.log(`Server running on http://localhost:${PORT}`);
console.log(`Game: http://localhost:${PORT}/`);
console.log(`Admin: http://localhost:${PORT}/admin.html?admin=true`);

await serve(handler, { 
  port: PORT,
  onListen: ({ hostname, port }) => {
    console.log(`Listening on ${hostname}:${port}`);
  }
});
