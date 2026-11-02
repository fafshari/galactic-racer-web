# 0012. Build overview with slide-over drawer pickers

- Status: Accepted
- Date: 2026-11-01

## Context

The legacy build page is one long column of sections stacked on top of each other, each with its own search list:
- vehicle
- racer style
- upgrades
- abilities
- favours
- parts

The readout sits in a second column. Building means scrolling up and down between the list you're picking from and the readout that shows the effect.

The game has a build overview screen with three panels:
- **Vehicle stats:** speed, stat pips and max energy, with the vehicle art.
- **Racer style:** its traits, with the ability slots below.
- **Installed parts:** a list with icons and descriptions.

Everything is visible at once.

## Decision

- **Build page = overview + readout.**
  - The **overview** mirrors the game's panels: vehicle stats with interactive pips, racer style with traits, ability slots, installed parts (and favours in Campaign).
  - The **readout** stays in a column beside it: top speed and boosts, Situational effects, What changes.
- **Picking happens in a slide-over drawer.**
  - Clicking a vehicle, a style, an empty or filled ability slot, a part or "Add part" opens a drawer from the side. It holds the relevant picker: search, part cards with rarity toggles, ability list.
  - The overview and readout stay visible behind it, so the effect of a pick shows immediately.
- **Phones:** the panels stack in one column, and the drawer becomes a full-screen bottom sheet.
- **The tour simulator gets the same overhaul**, sharing the overview, drawer and card components.
- **The drawer closes after every selection** (vehicle, style, ability, part), returning to the overview so the change is visible in context. Changing a part's rarity happens on its card in the overview, so it doesn't need the drawer.
- **Accessibility:** the drawer is a proper dialog. It traps focus, closes on Escape, returns focus to the slot that opened it, and has a visible close button.

## Implementation (2026-11-01)

- **The overview.** It uses `Panel`s for:
  - Vehicle stats: vehicle, art, traits and the six `StatRow`s with power.
  - Racer style: `StylePanel`, with a rank switch in Campaign.
  - Abilities: four `AbilitySlot`s.
  - Installed parts: `PartRow`s with rarity chips.
  - Favours, in Campaign.
- **The readout column** holds the speed panel, situational effects and What changes. It's sticky on wide screens; everything stacks below 900 px.
- **One `Drawer`** swaps its content by picker: vehicle, style, ability (for a given slot), part, favour. It closes after each pick.
- **Rules:** every rule is a pure function in `src/lib/planner/`, and the Svelte island only holds state.
- **Narrow layouts:** rows that sit in narrow panels (`ChangeRow`, `PartRow`, `FavourRow`) were made to adapt to their own width rather than the screen's. `ChangeRow` wraps: the label keeps at least 11em and the value drops below it when they don't fit, readings never break inside themselves, and fields with several values (low / mid / high speed) get their own block under the label. Part and favour rows always put their tags and controls on a second line, so nothing overflows a narrow panel on any screen.
- **One improvement over the legacy page:** once the build no longer matches the link it was opened from, the hash is dropped. In the legacy page, a reload after editing a linked build silently reverted the edits.

## Tour simulator (2026-11-01)

- The tour shares the components (`Panel`, `ChoiceCard`, `PartCard`, `StatRow`, `Tag`) but not the drawer: each phase offers only a handful of choices, so they sit directly in the stage panel.
- Beside the stage, the side column shows the racer, owned abilities and parts, standings and the run log. It stacks below the stage on phones.

## Consequences

- Most of the component library (ADR 0006) is driven by this layout: overview panels, slots, drawer, picker contents.
- The parts picker's merged families and rarity toggle (already live) move into the drawer unchanged.
- Fewer things are visible at once in the picker, so search and filtering in the drawer must be fast and keyboard-friendly.
- The layout is tested in Playwright at desktop and phone widths (ADR 0013).
- Adding several parts means opening the drawer once per part. The drawer should reopen fast and keep its last search and scroll position, so this stays cheap.
