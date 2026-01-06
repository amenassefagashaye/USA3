import { serve, serveDir } from "./deps.ts";
import { handleWebSocket } from "./wsHandler.ts";
import { handleAdminRequest } from "./admin.ts";

const PORT = 8000;

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // WebSocket endpoint for game
  if (url.pathname === '/ws') {
    const { socket, response } = Deno.upgradeWebSocket(request);
    await handleWebSocket(socket, request);
    return response;
  }
  
  // Admin endpoints
  if (url.pathname.startsWith('/admin')) {
    return await handleAdminRequest(request);
  }
  
  // Serve static files
  if (url.pathname === '/') {
    const file = await Deno.readFile('./public/index.html');
    return new Response(file, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  
  if (url.pathname === '/admin.html') {
    // Check for admin query parameter
    const isAdmin = url.searchParams.get('admin') === 'true';
    if (!isAdmin) {
      return new Response('Access denied', { status: 403 });
    }
    
    const file = await Deno.readFile('./public/admin.html');
    return new Response(file, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  
  // Serve other static files
  try {
    return await serveDir(request, {
      fsRoot: 'public',
      urlRoot: ''
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

console.log(`Server running on http://localhost:${PORT}`);
await serve(handler, { port: PORT });