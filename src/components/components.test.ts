// @vitest-environment jsdom
// Behaviour of the smaller components. (Drawer and InfoTip use native <dialog> and popover, which jsdom lacks;
// tests/e2e/showcase.spec.ts covers them in a real browser.)
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { labels, planner } from '~/lib/data/index.ts';
import { decodeBuild, evaluate } from '~/lib/engine/index.ts';
import { describeRow } from '~/lib/format/format.ts';
import AbilitySlot from './AbilitySlot/AbilitySlot.svelte';
import ChangeRow from './ChangeRow/ChangeRow.svelte';
import KeywordText from './KeywordText/KeywordText.svelte';
import ModeSwitch from './ModeSwitch/ModeSwitch.svelte';
import PartCard from './PartCard/PartCard.svelte';

const part = planner.affixes.find((p) => p.name === 'Ramjet Accelerator I');
const ability = planner.abilities[0];
if (!part || !ability) throw new Error('fixtures missing');

describe('ModeSwitch', () => {
  it('presses the current option and reports changes', async () => {
    const onchange = vi.fn();
    render(ModeSwitch, { label: 'Game mode', options: [{ value: 'mp', label: 'Multiplayer Tour' }, { value: 'campaign', label: 'Campaign' }], value: 'mp', onchange });
    expect(screen.getByRole('button', { name: 'Multiplayer Tour' }).getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: 'Campaign' }));
    expect(onchange).toHaveBeenCalledWith('campaign');
  });
});

describe('KeywordText', () => {
  it("sets the game's keywords apart", () => {
    const { container } = render(KeywordText, { text: part.desc, keywords: part.hl });
    expect([...container.querySelectorAll('em')].map((e) => e.textContent)).toEqual(['Cooled', 'Ramjet']);
  });
});

describe('PartCard', () => {
  it('picks the part from the card, unless disabled', async () => {
    const onselect = vi.fn();
    const { unmount } = render(PartCard, { part, onselect });
    await fireEvent.click(screen.getByRole('button', { name: `Add ${part.name}` }));
    expect(onselect).toHaveBeenCalledOnce();
    unmount();
    render(PartCard, { part, onselect, disabled: true });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: `Add ${part.name}` }).disabled).toBe(true);
  });
});

describe('AbilitySlot', () => {
  it('names the slot and its contents for screen readers', async () => {
    const onselect = vi.fn();
    const onremove = vi.fn();
    render(AbilitySlot, { ability, label: 'Ability 1', onselect, onremove });
    await fireEvent.click(screen.getByRole('button', { name: `Ability 1: ${ability.name}. Change` }));
    await fireEvent.click(screen.getByRole('button', { name: `Remove ${ability.name}` }));
    expect([onselect.mock.calls.length, onremove.mock.calls.length]).toEqual([1, 1]);
  });

  it('offers to fill an empty slot', () => {
    render(AbilitySlot, { ability: null, label: 'Ability 3', onselect: vi.fn() });
    expect(screen.getByRole('button', { name: 'Ability 3: empty. Add an ability' })).toBeTruthy();
  });
});

describe('ChangeRow', () => {
  it('shows base → value and where the change comes from', () => {
    const b = decodeBuild('gr2-m106475806');
    const row = evaluate(planner, b).rows.find((r) => r.field === 'Deceleration');
    if (!row) throw new Error('no brake row');
    const { container } = render(ChangeRow, { view: describeRow(labels, row) });
    expect(container.querySelector('.reading')?.textContent.replace(/\s+/g, ' ').trim()).toBe('2800 → 6030.8 (+115.4%)');
    expect(screen.getByText('Acceleration 7')).toBeTruthy();
  });
});
