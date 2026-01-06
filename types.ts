export interface Player {
  id: string;
  name: string;
  phone: string;
  stake: number;
  payment: number;
  boardId: number;
  gameType: GameType;
  socket?: WebSocket;
  boardNumbers: number[];
  markedNumbers: Set<number>;
  connected: boolean;
  balance: number;
  totalWon: number;
}

export interface Game {
  id: string;
  type: GameType;
  active: boolean;
  players: Map<string, Player>;
  calledNumbers: number[];
  currentNumber: number | null;
  isCalling: boolean;
  winner: Player | null;
  winningPattern: string;
  startTime: Date;
  potAmount: number;
}

export type GameType = 
  | '75ball' 
  | '90ball' 
  | '30ball' 
  | '50ball' 
  | 'pattern' 
  | 'coverall';

export interface GameMessage {
  type: string;
  data: any;
  playerId?: string;
}

export interface AdminCommand {
  type: string;
  password: string;
  data?: any;
}

export interface BoardConfig {
  id: string;
  name: string;
  columns: number;
  rows: number;
  range: number;
  patterns: string[];
}

export const BOARD_CONFIGS: Record<GameType, BoardConfig> = {
  '75ball': {
    id: '75ball',
    name: '75-ቢንጎ',
    columns: 5,
    rows: 5,
    range: 75,
    patterns: ['row', 'column', 'diagonal', 'four-corners', 'full-house']
  },
  '90ball': {
    id: '90ball',
    name: '90-ቢንጎ',
    columns: 9,
    rows: 3,
    range: 90,
    patterns: ['one-line', 'two-lines', 'full-house']
  },
  '30ball': {
    id: '30ball',
    name: '30-ቢንጎ',
    columns: 3,
    rows: 3,
    range: 30,
    patterns: ['full-house']
  },
  '50ball': {
    id: '50ball',
    name: '50-ቢንጎ',
    columns: 5,
    rows: 5,
    range: 50,
    patterns: ['row', 'column', 'diagonal', 'four-corners', 'full-house']
  },
  'pattern': {
    id: 'pattern',
    name: 'ንድፍ ቢንጎ',
    columns: 5,
    rows: 5,
    range: 75,
    patterns: ['x-pattern', 'frame', 'postage-stamp', 'small-diamond']
  },
  'coverall': {
    id: 'coverall',
    name: 'ሙሉ ቤት',
    columns: 9,
    rows: 5,
    range: 90,
    patterns: ['full-board']
  }
};