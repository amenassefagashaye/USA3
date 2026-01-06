import { WebSocket } from "./deps.ts";
import { GameMessage, Player, AdminCommand } from "./types.ts";
import { gameLogic } from "./gameLogic.ts";

interface Client {
  socket: WebSocket;
  playerId?: string;
  gameId?: string;
  isAdmin: boolean;
}

const clients = new Set<Client>();
const ADMIN_PASSWORD = "asse2123";

export async function handleWebSocket(socket: WebSocket, request: Request) {
  const client: Client = { socket, isAdmin: false };
  clients.add(client);
  
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);
  
  try {
    for await (const event of socket) {
      if (typeof event === 'string') {
        await handleMessage(client, event, params);
      }
    }
  } catch (error) {
    console.error("WebSocket error:", error);
  } finally {
    cleanupClient(client);
  }
}

async function handleMessage(client: Client, message: string, params: URLSearchParams) {
  try {
    const data = JSON.parse(message);
    
    if (data.type === 'admin') {
      await handleAdminCommand(client, data as AdminCommand);
      return;
    }
    
    const gameMessage = data as GameMessage;
    
    switch (gameMessage.type) {
      case 'register':
        await handleRegistration(client, gameMessage);
        break;
      case 'join':
        await handleJoinGame(client, gameMessage);
        break;
      case 'start':
        await handleStartGame(client, gameMessage);
        break;
      case 'mark':
        await handleMarkNumber(client, gameMessage);
        break;
      case 'claim':
        await handleClaimWin(client, gameMessage);
        break;
      case 'withdraw':
        await handleWithdraw(client, gameMessage);
        break;
      case 'getState':
        await handleGetState(client, gameMessage);
        break;
      default:
        console.warn('Unknown message type:', gameMessage.type);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendError(client.socket, 'Invalid message format');
  }
}

async function handleAdminCommand(client: Client, command: AdminCommand) {
  if (command.password !== ADMIN_PASSWORD) {
    sendError(client.socket, 'Invalid admin password');
    return;
  }
  
  client.isAdmin = true;
  
  switch (command.type) {
    case 'createGame':
      const game = gameLogic.createGame(command.data.gameType);
      client.socket.send(JSON.stringify({
        type: 'gameCreated',
        data: { gameId: game.id }
      }));
      break;
      
    case 'startGame':
      const success = gameLogic.startGame(command.data.gameId);
      client.socket.send(JSON.stringify({
        type: 'gameStarted',
        data: { gameId: command.data.gameId, success }
      }));
      break;
      
    case 'stopGame':
      gameLogic.stopCalling(command.data.gameId);
      client.socket.send(JSON.stringify({
        type: 'gameStopped',
        data: { gameId: command.data.gameId }
      }));
      break;
      
    case 'resetGame':
      const reset = gameLogic.resetGame(command.data.gameId);
      client.socket.send(JSON.stringify({
        type: 'gameReset',
        data: { gameId: command.data.gameId, success: reset }
      }));
      break;
      
    case 'getGames':
      const games = gameLogic.getAllGames();
      client.socket.send(JSON.stringify({
        type: 'gamesList',
        data: { games: games.map(g => ({
          id: g.id,
          type: g.type,
          active: g.active,
          playerCount: g.players.size,
          potAmount: g.potAmount,
          calledNumbers: g.calledNumbers.length,
          winner: g.winner ? g.winner.name : null
        })) }
      }));
      break;
      
    case 'broadcast':
      const game = gameLogic.getGame(command.data.gameId);
      if (game) {
        gameLogic.broadcastToGame(command.data.gameId, {
          type: 'adminBroadcast',
          data: command.data.message
        });
      }
      break;
  }
}

async function handleRegistration(client: Client, message: GameMessage) {
  const { name, phone, stake, payment, gameType, boardId } = message.data;
  
  const player: Player = {
    id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    phone,
    stake,
    payment,
    boardId,
    gameType,
    boardNumbers: [],
    markedNumbers: new Set(),
    connected: true,
    balance: payment,
    totalWon: 0,
    socket: client.socket
  };
  
  client.playerId = player.id;
  
  client.socket.send(JSON.stringify({
    type: 'registered',
    data: { playerId: player.id, balance: player.balance }
  }));
}

async function handleJoinGame(client: Client, message: GameMessage) {
  const { gameId, playerId } = message.data;
  const game = gameLogic.getGame(gameId);
  
  if (!game) {
    sendError(client.socket, 'Game not found');
    return;
  }
  
  // Find player (in real app, this would be from database)
  // For now, we'll create a new player
  const player: Player = {
    id: playerId,
    name: message.data.name || 'Guest',
    phone: message.data.phone || '',
    stake: message.data.stake || 25,
    payment: message.data.payment || 25,
    boardId: message.data.boardId || 1,
    gameType: game.type,
    boardNumbers: [],
    markedNumbers: new Set(),
    connected: true,
    balance: message.data.payment || 25,
    totalWon: 0,
    socket: client.socket
  };
  
  const joined = gameLogic.joinGame(gameId, player);
  
  if (joined) {
    client.gameId = gameId;
    client.playerId = player.id;
    
    client.socket.send(JSON.stringify({
      type: 'joined',
      data: {
        gameId,
        boardNumbers: player.boardNumbers,
        gameType: game.type,
        boardConfig: message.data.gameType
      }
    }));
    
    // Notify all players about new player
    gameLogic.broadcastToGame(gameId, {
      type: 'playerJoined',
      data: { playerId: player.id, playerName: player.name }
    });
  } else {
    sendError(client.socket, 'Could not join game');
  }
}

async function handleStartGame(client: Client, message: GameMessage) {
  const { gameId } = message.data;
  const game = gameLogic.getGame(gameId);
  
  if (!game) {
    sendError(client.socket, 'Game not found');
    return;
  }
  
  const success = gameLogic.startGame(gameId);
  
  client.socket.send(JSON.stringify({
    type: 'gameStarting',
    data: { gameId, success }
  }));
}

async function handleMarkNumber(client: Client, message: GameMessage) {
  const { gameId, playerId, number } = message.data;
  const game = gameLogic.getGame(gameId);
  
  if (!game) {
    sendError(client.socket, 'Game not found');
    return;
  }
  
  const player = game.players.get(playerId);
  if (!player) {
    sendError(client.socket, 'Player not found');
    return;
  }
  
  player.markedNumbers.add(number);
  
  // Check for win
  const winPattern = gameLogic['checkWin'](player, game.type, game.calledNumbers);
  if (winPattern) {
    client.socket.send(JSON.stringify({
      type: 'winReady',
      data: { pattern: winPattern }
    }));
  }
}

async function handleClaimWin(client: Client, message: GameMessage) {
  const { gameId, playerId } = message.data;
  const game = gameLogic.getGame(gameId);
  
  if (!game) {
    sendError(client.socket, 'Game not found');
    return;
  }
  
  const player = game.players.get(playerId);
  if (!player) {
    sendError(client.socket, 'Player not found');
    return;
  }
  
  // Verify win
  const winPattern = gameLogic['checkWin'](player, game.type, game.calledNumbers);
  if (!winPattern) {
    sendError(client.socket, 'No winning pattern found');
    return;
  }
  
  // Calculate winnings
  const winnings = Math.floor(game.potAmount * 0.8 * 0.97);
  player.balance += winnings;
  player.totalWon += winnings;
  game.winner = player;
  game.winningPattern = winPattern;
  
  // Stop calling numbers
  gameLogic.stopCalling(gameId);
  
  // Broadcast winner
  gameLogic.broadcastToGame(gameId, {
    type: 'winner',
    data: {
      playerId: player.id,
      playerName: player.name,
      pattern: winPattern,
      amount: winnings
    }
  });
}

async function handleWithdraw(client: Client, message: GameMessage) {
  const { playerId, amount, account } = message.data;
  
  // In real app, this would process actual withdrawal
  // For now, just update balance
  
  client.socket.send(JSON.stringify({
    type: 'withdrawalProcessed',
    data: {
      success: true,
      amount,
      newBalance: 0 // Simplified
    }
  }));
}

async function handleGetState(client: Client, message: GameMessage) {
  const { gameId } = message.data;
  const game = gameLogic.getGame(gameId);
  
  if (!game) {
    sendError(client.socket, 'Game not found');
    return;
  }
  
  client.socket.send(JSON.stringify({
    type: 'gameState',
    data: {
      gameId,
      type: game.type,
      active: game.active,
      calledNumbers: game.calledNumbers,
      currentNumber: game.currentNumber,
      isCalling: game.isCalling,
      players: Array.from(game.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        connected: p.connected
      })),
      winner: game.winner ? {
        id: game.winner.id,
        name: game.winner.name,
        pattern: game.winningPattern
      } : null,
      potAmount: game.potAmount
    }
  }));
}

function sendError(socket: WebSocket, message: string) {
  try {
    socket.send(JSON.stringify({
      type: 'error',
      data: { message }
    }));
  } catch (error) {
    console.error('Error sending error message:', error);
  }
}

function cleanupClient(client: Client) {
  clients.delete(client);
  
  if (client.gameId && client.playerId) {
    const game = gameLogic.getGame(client.gameId);
    if (game) {
      const player = game.players.get(client.playerId);
      if (player) {
        player.connected = false;
      }
    }
  }
}