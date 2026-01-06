import { serve } from "./deps.ts";
import { handleWebSocket } from "./wsHandler.ts";

export async function handleAdminRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  if (url.pathname === '/admin/ws') {
    const { socket, response } = Deno.upgradeWebSocket(request);
    await handleWebSocket(socket, request);
    return response;
  }
  
  if (url.pathname === '/admin/stats') {
    return new Response(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Admin endpoint not found', { status: 404 });
}