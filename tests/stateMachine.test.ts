import { describe, expect, it } from 'vitest';
import { InputBuffer } from '@/systems/InputBuffer';
import { StateMachine } from '@/systems/StateMachine';

interface States {
  idle: null;
  attack: { combo: number };
  dash: { angle: number };
}

function setup() {
  const log: string[] = [];
  const ctx = { charges: 1, log };
  const fsm = new StateMachine<typeof ctx, States>(ctx, {
    idle: { enter: (c) => c.log.push('enter idle') },
    attack: {
      enter: (c, p) => c.log.push(`enter attack ${String(p.combo)}`),
      update: (_c, _dt, t) => (t >= 100 ? { to: 'idle', payload: null } : null),
      exit: (c, to) => c.log.push(`exit attack -> ${to}`),
    },
    dash: {
      canEnter: (c) => c.charges > 0,
      enter: (c) => {
        c.charges -= 1;
        c.log.push('enter dash');
      },
    },
  });
  return { ctx, fsm, log };
}

describe('StateMachine', () => {
  it('passe la charge utile à enter et mesure le temps passé dans l’état', () => {
    const { fsm, log } = setup();
    fsm.start({ to: 'idle', payload: null });
    fsm.request({ to: 'attack', payload: { combo: 2 } });
    expect(fsm.current).toBe('attack');
    fsm.update(60);
    expect(fsm.timeInState).toBe(60);
    fsm.update(60);
    expect(fsm.current).toBe('idle');
    expect(log).toEqual(['enter idle', 'enter attack 2', 'exit attack -> idle', 'enter idle']);
  });

  it('refuse une transition quand canEnter renvoie faux', () => {
    const { fsm, ctx } = setup();
    fsm.start({ to: 'idle', payload: null });
    expect(fsm.request({ to: 'dash', payload: { angle: 0 } })).toBe(true);
    fsm.request({ to: 'idle', payload: null });
    expect(ctx.charges).toBe(0);
    expect(fsm.request({ to: 'dash', payload: { angle: 0 } })).toBe(false);
    expect(fsm.current).toBe('idle');
  });

  it('met en file une transition demandée pendant un enter', () => {
    const order: string[] = [];
    const fsm = new StateMachine<null, { a: null; b: null; c: null }>(null, {
      a: {},
      b: {
        enter: () => {
          order.push('b');
          fsm.request({ to: 'c', payload: null });
        },
      },
      c: { enter: () => order.push('c') },
    });
    fsm.start({ to: 'a', payload: null });
    fsm.request({ to: 'b', payload: null });
    expect(order).toEqual(['b', 'c']);
    expect(fsm.is('c')).toBe(true);
  });
});

describe('InputBuffer', () => {
  it('garde une action 150 ms puis l’oublie', () => {
    const buffer = new InputBuffer<'attack' | 'dash'>(150);
    buffer.press('attack', 1000);
    expect(buffer.peek('attack', 1100)).toBe(true);
    expect(buffer.peek('attack', 1151)).toBe(false);
    expect(buffer.peek('dash', 1100)).toBe(false);
  });

  it('consomme une action une seule fois', () => {
    const buffer = new InputBuffer<'attack'>(150);
    buffer.press('attack', 0);
    expect(buffer.consume('attack', 50)).toBe(true);
    expect(buffer.consume('attack', 60)).toBe(false);
  });
});
