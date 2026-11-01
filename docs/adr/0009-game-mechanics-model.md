# 0009. Game-mechanics model

- Status: Assumed
- Date: 2026-11-01

## Context

The game's numbers come from cooked data (configs, tunesets, passive rules). How they combine is decided by compiled code we can't read. The planner has to model that behaviour, and every model is a guess that in-game testing can confirm or overturn. These are the assumptions the engine currently makes, with the evidence behind each.

## Decision

| Area | Model | Evidence | Confidence |
|---|---|---|---|
| **Combine order** | `value = (base + Σadd + base·Σmultiple) · Πmultiply`, with `Set` overriding | Operation names from `ETuneOperations`; order not in data | Assumed |
| **Missing values** | Unversioned serialization omits values equal to the code default, so a missing field is the code default, shared by all vehicles. Shown as "of default" (change only) when the base is unknown | How UE unversioned properties work; explicit zeros are stored (e.g. `BoostTopSpeedIncreaseMph = 0`) | High |
| **Measured values** | Missing defaults may be filled from in-game measurement and flagged "measured": Ramjet `TopSpeedIncreaseMph = 80` | Speeder Bike peaked at 595 km/h with a known build, which works out to about 79 mph; the user confirmed 80 (2026-11-01) | Confirmed |
| **Units** | Speeds stored in mph, shown in km/h (× 1.609344) | Field names (`…Mph`) and in-game readouts | High |
| **Top speed** | `VehicleThrustConfig.HighSpeedStep[1]` + Power steps (+2.5 mph per Power; 4.1667 on Podracer) | Power tuneset ops | High |
| **Speed procs** | "Increase Speed" effects add `VehicleGameplayConfig.Power`, which feeds the power tuneset. The engine caps total Power at 60 | `TNS_Affix_IncreaseStat_Speed_*` are `IntAdd Power`; the power tuneset defines 60 steps | Feeding Power: high. **Cap: unknown, untested** |
| **Stacking** | A rule stacks per trigger if its requirement resets (`ResetOnCompletion`), it's a repeat event (`RamjetExplodeReset`), or the part is on the curated stacking list (Thermophilic Fuel, Overheat Loop, Expanding Fueltank, Calibrating Landings, Ability Catalyst) | Rule structure, descriptions ("each time"), removal on Crash | Inferred |
| **Sub-passives** | `AddPassiveRule` / `AddTrackedPassiveRule` grant sub-passives, which inherit the granting rule's conditions | Data structure | High |
| **Boost bonuses** | Afterburner +40 mph; Surge +15 mph while Surging, +50 mph burst (ramps in by 0.15 s, holds to 0.35 s, gone by 1.4 s) | Config values and the `SurgeBoostTimeVsStrength` curve | High (values); stacking of burst and sustained is unknown |
| **Part families** | Parts sharing a family are one effect at different rarities. A build holds **one rarity per family**. In a tour, owning a part removes its lower rarities from every offer (shops, rewards, packs). A higher rarity can still be offered, and taking it is a **buy-and-replace upgrade**: it replaces the owned part in the same slot instead of using a new one | `family` field in data; game behaviour confirmed by the user (2026-11-01) | Confirmed |

## Consequences

- The UI must keep showing which numbers are inferred or measured (tooltips and "of default" labels), not present them as fact.
- Each row maps to engine code (ADR 0008). Changing one means a superseding ADR and a test update.
- **The tour simulator must enforce the part-family rule**, and the port must carry it over with tests. The legacy version used to break it in two ways, both fixed on 2026-11-01:
  - Its normal rolls only skipped the exact parts you owned, so a lower rarity of an owned family could still be offered.
  - Buying or taking a higher rarity added it as an extra part instead of replacing the owned one. A higher rarity can now be taken even when all part slots are full, since it uses the existing slot.
- The planner already enforces one rarity per family and swaps rarity in place.

## Open questions

- **Power cap:** does Power above 60 from Speed procs add anything in game? Untested; the engine keeps the cap at 60 until there's evidence.
- **Surge burst and sustained bonus:** do they stack? Nobody has a test yet. A possible one:
  1. Use a build with no situational speed effects, on a long straight. Hold full throttle until the speedometer stops climbing; that's your top speed, T.
  2. Trigger Surge. Record the screen and step through the frames.
  3. Note the highest reading in the first half second, P, and the reading once it settles about 2 s later, S.
  4. S should be about T + 24 km/h.
  5. If P peaks near T + 80, the burst replaces the sustained bonus. Near T + 104, they stack.
  - **Caveat:** the burst lasts only about 1.4 s. If the vehicle can't accelerate that far that quickly, P never reaches either value and this test can't settle it.
- **Combine order:** confirm it against a part that combines a flat and a percentage change on the same field.
