import { EventEmitter } from "node:events";

// Barramento em memória (uma instância no Railway) para atualizar o painel ao vivo via SSE.
const g = globalThis as unknown as { __bus?: EventEmitter };
export const bus = g.__bus ?? (g.__bus = new EventEmitter().setMaxListeners(0));

export type BusEvent =
  | { type: "request"; showId: number; songId: number; title: string; credit: string }
  | { type: "queue"; showId: number }
  | { type: "show" }
  | { type: "comment" }
  | { type: "suggestion" };

export function emit(event: BusEvent) {
  bus.emit("event", event);
}
