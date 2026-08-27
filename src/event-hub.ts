import type { AgentEvent } from "./events.js";

type EventListener = (event: AgentEvent) => void;

export class RunEventHub {
  private readonly listeners = new Map<string, Set<EventListener>>();

  publish(runId: string, event: AgentEvent) {
    for (const listener of this.listeners.get(runId) ?? []) listener(event);
  }

  subscribe(runId: string, listener: EventListener) {
    const listeners = this.listeners.get(runId) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(runId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(runId);
    };
  }
}
