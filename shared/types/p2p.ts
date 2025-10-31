export type P2PMessageType =
  | 'HELLO'
  | 'WELCOME'
  | 'PEERS'
  | 'BLOCK'
  | 'TRANSACTION'
  | 'REQUEST_BLOCKS'
  | 'BLOCKS'
  | 'PING'
  | 'PONG';

export interface PeerInfo {
  id: string;
  address: string; // e.g. ws://host:port
  connectedAt: number;
  lastSeen: number;
}

export interface HelloPayload {
  id: string;
  address: string;
  version?: string;
}

export interface BlockPayload {
  // Keep loose typing to avoid circular import; runtime validation still required
  block: any;
}

export interface TransactionPayload {
  tx: any;
}

export interface RequestBlocksPayload {
  fromHeight: number;
  toHeight?: number;
}

export interface BlocksPayload {
  blocks: any[];
}

export interface P2PMessage<T = any> {
  type: P2PMessageType;
  payload: T;
  timestamp: number;
}