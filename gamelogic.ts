import { Game, Player, GameType, BOARD_CONFIGS } from "./types.ts";

export class GameLogic {
  private games: Map<string, Game> = new Map();
  private callIntervals: Map<string, number> = new Map();

  createGame(type: GameType): Game {
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const game: Game = {
      id: gameId,
      type,
      active: false,
      players: new Map(),
      calledNumbers: [],
      currentNumber: null,
      isCalling: false,
      winner: null,
      winningPattern: '',
      startTime: new Date(),
      potAmount: 0
    };
    this.games.set(gameId, game);
    return game;
  }

  getGame(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }

  getAllGames(): Game[] {
    return Array.from(this.games.values());
  }

  joinGame(gameId: string, player: Player): boolean {
    const game = this.games.get(gameId);
    if (!game || game.active) return false;
    
    player.boardNumbers = this.generateBoardNumbers(game.type);
    game.players.set(player.id, player);
    game.potAmount += player.stake;
    
    return true;
  }

  private generateBoardNumbers(gameType: GameType): number[] {
    const config = BOARD_CONFIGS[gameType];
    const numbers: number[] = [];
    
    switch (gameType) {
      case '75ball':
      case '50ball':
      case 'pattern':
        // Generate 5x5 board with BINGO column ranges
        const columnRanges = gameType === '75ball' || gameType === 'pattern' 
          ? [[1,15], [16,30], [31,45], [46,60], [61,75]]
          : [[1,10], [11,20], [21,30], [31,40], [41,50]];
        
        for (let col = 0; col < 5; col++) {
          const [min, max] = columnRanges[col];
          const colNumbers = new Set<number>();
          while (colNumbers.size < 5) {
            colNumbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
          }
          numbers.push(...Array.from(colNumbers));
        }
        break;
        
      case '90ball':
        // Generate 3x9 board with column ranges 1-9, 10-19, etc.
        for (let col = 0; col < 9; col++) {
          const min = col * 10 + 1;
          const max = Math.min((col + 1) * 10, 90);
          const count = Math.floor(Math.random() * 3) + 1; // 1-3 numbers per column
          const colNumbers = new Set<number>();
          while (colNumbers.size < count) {
            colNumbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
          }
          // Distribute across 3 rows
          const positions = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, count);
          for (let row = 0; row < 3; row++) {
            if (positions.includes(row)) {
              const num = Array.from(colNumbers)[positions.indexOf(row)];
              numbers[row * 9 + col] = num;
            }
          }
        }
        break;
        
      case '30ball':
        // Generate 3x3 board
        const allNumbers = new Set<number>();
        while (allNumbers.size < 9) {
          allNumbers.add(Math.floor(Math.random() * 30) + 1);
        }
        numbers.push(...Array.from(allNumbers));
        break;
        
      case 'coverall':
        // Generate 5x9 board with 45 unique numbers
        const coverallNumbers = new Set<number>();
        while (coverallNumbers.size < 45) {
          coverallNumbers.add(Math.floor(Math.random() * 90) + 1);
        }
        numbers.push(...Array.from(coverallNumbers));
        break;
    }
    
    return numbers;
  }

  startGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.active) return false;
    
    game.active = true;
    this.startCallingNumbers(gameId);
    
    return true;
  }

  private startCallingNumbers(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;
    
    game.isCalling = true;
    
    // Call a number every 7 seconds
    const interval = setInterval(() => {
      this.callNextNumber(gameId);
    }, 7000);
    
    this.callIntervals.set(gameId, interval);
    
    // Call first number immediately
    setTimeout(() => this.callNextNumber(gameId), 1000);
  }

  private callNextNumber(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game || !game.active || !game.isCalling) return;
    
    const config = BOARD_CONFIGS[game.type];
    let number: number;
    
    do {
      number = Math.floor(Math.random() * config.range) + 1;
    } while (game.calledNumbers.includes(number));
    
    game.calledNumbers.push(number);
    game.currentNumber = number;
    
    // Check for winners
    this.checkWinners(gameId);
  }

  stopCalling(gameId: string): void {
    const interval = this.callIntervals.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.callIntervals.delete(gameId);
    }
    
    const game = this.games.get(gameId);
    if (game) {
      game.isCalling = false;
    }
  }

  private checkWinners(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game || game.winner) return;
    
    for (const player of game.players.values()) {
      const winPattern = this.checkWin(player, game.type, game.calledNumbers);
      if (winPattern) {
        game.winner = player;
        game.winningPattern = winPattern;
        this.declareWinner(gameId, player, winPattern);
        this.stopCalling(gameId);
        break;
      }
    }
  }

  private checkWin(player: Player, gameType: GameType, calledNumbers: number[]): string | null {
    const markedNumbers = new Set(
      player.boardNumbers.filter(n => calledNumbers.includes(n))
    );
    
    const config = BOARD_CONFIGS[gameType];
    
    for (const pattern of config.patterns) {
      if (this.checkPattern(pattern, player.boardNumbers, markedNumbers, gameType)) {
        return pattern;
      }
    }
    
    return null;
  }

  private checkPattern(
    pattern: string, 
    boardNumbers: number[], 
    markedNumbers: Set<number>,
    gameType: GameType
  ): boolean {
    const config = BOARD_CONFIGS[gameType];
    
    switch (pattern) {
      case 'row':
        for (let row = 0; row < config.rows; row++) {
          let complete = true;
          for (let col = 0; col < config.columns; col++) {
            const index = row * config.columns + col;
            if (index < boardNumbers.length && !markedNumbers.has(boardNumbers[index])) {
              complete = false;
              break;
            }
          }
          if (complete) return true;
        }
        return false;
        
      case 'column':
        for (let col = 0; col < config.columns; col++) {
          let complete = true;
          for (let row = 0; row < config.rows; row++) {
            const index = row * config.columns + col;
            if (index < boardNumbers.length && !markedNumbers.has(boardNumbers[index])) {
              complete = false;
              break;
            }
          }
          if (complete) return true;
        }
        return false;
        
      case 'diagonal':
        if (config.rows !== config.columns) return false;
        // Main diagonal
        let diag1Complete = true;
        for (let i = 0; i < config.rows; i++) {
          const index = i * config.columns + i;
          if (!markedNumbers.has(boardNumbers[index])) {
            diag1Complete = false;
            break;
          }
        }
        if (diag1Complete) return true;
        
        // Anti-diagonal
        let diag2Complete = true;
        for (let i = 0; i < config.rows; i++) {
          const index = i * config.columns + (config.columns - 1 - i);
          if (!markedNumbers.has(boardNumbers[index])) {
            diag2Complete = false;
            break;
          }
        }
        return diag2Complete;
        
      case 'four-corners':
        if (boardNumbers.length >= 25) {
          const corners = [
            boardNumbers[0],  // top-left
            boardNumbers[4],  // top-right
            boardNumbers[20], // bottom-left
            boardNumbers[24]  // bottom-right
          ];
          return corners.every(n => markedNumbers.has(n));
        }
        return false;
        
      case 'full-house':
        return boardNumbers.every(n => markedNumbers.has(n));
        
      case 'one-line':
        // For 90-ball: any row complete
        if (gameType === '90ball') {
          for (let row = 0; row < 3; row++) {
            let rowComplete = true;
            for (let col = 0; col < 9; col++) {
              const index = row * 9 + col;
              if (boardNumbers[index] && !markedNumbers.has(boardNumbers[index])) {
                rowComplete = false;
                break;
              }
            }
            if (rowComplete) return true;
          }
        }
        return false;
        
      case 'two-lines':
        if (gameType === '90ball') {
          let lines = 0;
          for (let row = 0; row < 3; row++) {
            let rowComplete = true;
            for (let col = 0; col < 9; col++) {
              const index = row * 9 + col;
              if (boardNumbers[index] && !markedNumbers.has(boardNumbers[index])) {
                rowComplete = false;
                break;
              }
            }
            if (rowComplete) lines++;
          }
          return lines >= 2;
        }
        return false;
        
      case 'full-board':
        return boardNumbers.every(n => markedNumbers.has(n));
        
      default:
        return false;
    }
  }

  private declareWinner(gameId: string, player: Player, pattern: string): void {
    const game = this.games.get(gameId);
    if (!game) return;
    
    // Calculate winnings (80% of pot minus 3% service charge)
    const winnings = Math.floor(game.potAmount * 0.8 * 0.97);
    player.balance += winnings;
    player.totalWon += winnings;
    
    // Broadcast winner
    this.broadcastToGame(gameId, {
      type: 'winner',
      data: {
        playerId: player.id,
        playerName: player.name,
        pattern: pattern,
        amount: winnings
      }
    });
  }

  broadcastToGame(gameId: string, message: any): void {
    const game = this.games.get(gameId);
    if (!game) return;
    
    const jsonMessage = JSON.stringify(message);
    
    for (const player of game.players.values()) {
      if (player.socket && player.connected) {
        try {
          player.socket.send(jsonMessage);
        } catch (error) {
          console.error(`Error sending to player ${player.id}:`, error);
        }
      }
    }
  }

  resetGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    
    this.stopCalling(gameId);
    
    game.calledNumbers = [];
    game.currentNumber = null;
    game.winner = null;
    game.winningPattern = '';
    game.active = false;
    game.startTime = new Date();
    
    // Reset player boards
    for (const player of game.players.values()) {
      player.boardNumbers = this.generateBoardNumbers(game.type);
      player.markedNumbers.clear();
    }
    
    return true;
  }

  removePlayer(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    
    return game.players.delete(playerId);
  }
}

export const gameLogic = new GameLogic();