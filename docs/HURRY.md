# Hurry (15 minutes until the boss finale)

Select the mode in the main menu or lobby. The host chooses the team's mode.
After 15 minutes of combat, Hurry enters exactly three boss stages: one random
Easy stage, then one random Medium stage, then one random Hard stage. Each
available stage within its tier has equal probability. The host chooses the
whole queue once and shares it with clients. The player keeps their Pokémon,
HP, and upgrades. Winning all three stages wins the run; losing ends it.
Locked stages and stages with missing assets are excluded. The finale only
starts if all three tiers have a playable stage. Standard still uses Arceus.
Card choices, pauses, and story arenas add time to the outer run.

Use **Test sau 15′ · Hurry** in the main menu to jump straight to the finale
with your selected Pokémon at level 43 and fully upgraded starting moves.
The test starts with toggleable invincibility and does not save run rewards.

## Progression

- The first three level-ups retain the previous Hurry XP costs. Starting at
  level 4, each level-up costs the sum of five consecutive level-ups from the
  previous Hurry curve. The XP budget that previously reached level 200 now
  reaches level 43 (42 card choices). This is not a level cap or a guarantee
  that every run will reach level 43.
- A move upgrade card applies up to two existing upgrade steps without
  exceeding the move's maximum level. Learning and evolution remain separate
  choices.
- A stat card applies up to five existing upgrade steps, preserving their
  original caps and arithmetic. Healing remains a single 45% heal. The summary
  counts applied upgrade steps, not card selections.
- Bombs and traps use the equivalent level from the previous progression to
  preserve their damage. Achievements, missions, and records still count the
  actual displayed level.
- A locked chest supplies the XP needed for one level-up, accounting for XP
  collection multipliers.

## Enemies and timing

Before the finale, `matchTime` advances at twice the rate of combat time. It drives
waves, reinforcements, bosses, and Rift legendary strength. Surge intervals,
events, and weather opportunities are also compressed; physics, attack warnings,
and combat time limits remain unchanged.

The following multipliers apply on top of the existing curves, with
`p = clamp(matchTime / 1800, 0, 1)`:

| Enemy | Additional HP multiplier | Additional damage multiplier |
| --- | --- | --- |
| Regular, including elites | ×(1 + 0.60p) | ×(1 + 0.20p) |
| Regular and Rift bosses | ×(1 + 0.40p) | ×(1 + 0.12p) |

These multipliers add no movement speed, enemies, or XP. They do not depend on
the player's level, damage, or cards. They apply when an enemy spawns and do not
heal existing enemies. Finale stages use the boss selection mechanics and run
at normal speed, with the outer match clock paused during each arena.

## Verification

`node --test --test-isolation=none tests/*.test.cjs`

The Hurry tests cover XP equivalence, bundled upgrades, caps, evolutions,
time-based scaling, and reinforcement and event scheduling. To tune the balance,
compare Hurry at 2/5/9/12/15 minutes with Standard at 4/10/18/24/30 minutes:
card choices, time spent in menus, evolutions, damage, time to kill, and survival.
Also test accumulated XP, chests, XP bonuses, and teams of 2–4 players.
The coefficients are a starting point; automated tests do not replace playtests.

`node tools/build.js` regenerates the bundle and root entry page. Regenerate the
English entry page with `tools/make_seo_pages.py` as described in the build script.
If the ignored `js/core/firebase-config.js` file is missing, the build produces
a local version without Firebase and prints a warning. Restore that configuration
before publishing a version with cloud services.
