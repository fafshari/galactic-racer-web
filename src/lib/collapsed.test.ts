import { describe, expect, it } from 'vitest';
import { parseCollapsed, setCollapsed } from './collapsed.ts';

describe('collapsed panels', () => {
  it('read a saved list, ignoring anything that is not a panel key', () => {
    expect([...parseCollapsed(['planner.parts', 3, null])]).toEqual(['planner.parts']);
    expect(parseCollapsed('nonsense').size).toBe(0);
  });

  it('collapse and expand one panel, leaving the others', () => {
    const saved = parseCollapsed(['planner.parts']);
    expect(setCollapsed(saved, 'planner.abilities', true)).toEqual(['planner.abilities', 'planner.parts']);
    expect(setCollapsed(saved, 'planner.parts', false)).toEqual([]);
  });
});
