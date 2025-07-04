import { EventBus } from './event-bus.js';
import { AgentPlugin } from './types.js';

export interface PipelineDefinition {
  agents: string[]; // agent ids in registry (order optional)
  options?: {
    maxConcurrency?: number;
  };
}

export class DAGScheduler {
  constructor(private bus: EventBus, private registry: { getAgent(id: string): AgentPlugin | undefined }) {}

  async execute(def: PipelineDefinition, initialEventType = 'start', initialPayload: unknown = null): Promise<void> {
    const maxConc = def.options?.maxConcurrency ?? 4;
    let running = 0;
    const queue: (() => Promise<void>)[] = [];

    const schedule = async (fn: () => Promise<void>) => {
      if (running < maxConc) {
        running++;
        fn().finally(() => {
          running--;
          const next = queue.shift();
          if (next) schedule(next);
        });
      } else {
        queue.push(fn);
      }
    };

    // subscribe agents
    for (const id of def.agents) {
      const agent = this.registry.getAgent(id);
      if (!agent) throw new Error(`Agent not found: ${id}`);
      this.bus.subscribe(agent.meta.consumes, async (evt) => {
        schedule(async () => {
          const output = await agent.run(evt.payload, {
            emit: (type, payload) => this.bus.publish(type, payload),
            bus: this.bus
          });
          // auto emit if agent returns and didn't emit inside
          if (output !== undefined) {
            await this.bus.publish(agent.meta.produces, output);
          }
        });
      });
    }

    // kick off
    await this.bus.publish(initialEventType, initialPayload);
  }
} 