# PokéSurvivor · Mystery Dungeon

Bullet-heaven Pokémon game inspired by Survivor.io and Megabonk, featuring sprites from *Pokémon Mystery Dungeon*, roguelike progression, **966 Pokémon across all 9 generations**, shinies, and regional gacha banners. Includes original music and sound effects composed specifically for the game.

Built with HTML + CSS + vanilla JavaScript on HTML5 2D Canvas. No build step required for local play, zero runtime dependencies, and **fully offline-capable**: no internet connection needed to play.

> **Authorship / Autoría**
>
> The source code and original music of PokéSurvivor are written and owned by **Jonathan Piera Torregrosa**, owner of this GitHub account (JPTER78) and of pokesurvivor.com. Google copyright removal request **4-2352000042234** (against pokesurvivor.co) was submitted by me.
>
> PokéSurvivor (su código y su música original) lo ha escrito y es de **Jonathan Piera Torregrosa**, dueño de esta cuenta (JPTER78) y de pokesurvivor.com.

> **Crypto Disclaimer / Aviso sobre criptomonedas**
>
> PokéSurvivor has **no official cryptocurrency, token, or NFT**, and none has ever been created by the author. Any token using the game's name was created by unaffiliated third parties. **The developer takes no responsibility for any purchase, sale, or investment** you make with them, and nothing here constitutes financial or investment advice. The game is free and will remain free.
>
> PokéSurvivor **no tiene ninguna criptomoneda, token ni NFT oficial**, y yo no he creado ninguno. Cualquier token que use el nombre del juego lo han creado terceros. **No me hago cargo de ninguna compra, venta o inversión** que hagas con ellos y nada de lo que hay aquí es una recomendación de inversión. El juego es gratis y lo seguirá siendo.

---

## How to Play

Double-click `index.html` (or `dev.html` for development). Create an account or play as a guest, complete the personality quiz to discover your starter, and jump into the dungeon.

| Key | Action |
|---|---|
| `W` `A` `S` `D` / Arrow keys | Movement |
| `1` `2` `3` `4` (or `U` `I` `O` `P`) | Select active move |
| `Q` / `E` | Cycle moves |
| `J` | Toggle Auto-Swap (Move 1 ⇄ 2) |
| `Esc` / `P` | Pause |

**On mobile or tablet (landscape mode):** Touch anywhere and drag to move (the joystick appears under your touch). Tap any move icon at the bottom to switch your active attack, and tap the top-right button to pause. You can install it as a PWA app ("Add to Home Screen"). In **Settings**, you can adjust volume, graphic quality (with auto mode), damage numbers, screen shake intensity, FPS display, and account details.

Your Pokémon automatically attacks using the currently active move (or all linked moves in a **Bond**: defeating legendary Pokémon allows you to fuse moves to fire them simultaneously from a single slot, up to 4 moves). Rocks, chests, and tall grass can be broken; walls and trees block enemy shots; water slows down movement and lava burns (affecting enemies too).

Across the map you will discover **Altars of Power**, healing **Springs**, **Locked Chests** (stand near them for a few seconds to open), and **Traps** that damage foes. Occasionally a **Rift (Grieta)** will open: enter it to battle a **Legendary Pokémon** in a dedicated arena.

Features a full **Type Effectiveness Chart** (e.g., Bubble Beam deals extra damage to Charmander) and dynamic **Weather Conditions** (Sun, Rain, Sandstorm, Snow, Fog) that buff certain elemental types and weaken others.

Complete **Daily and Weekly Missions** to earn tickets and PokéCoins; unlock **Achievements** for medals and custom titles; and customize your **Profile** to showcase your top 3 favorite Pokémon, personal best records, and badges. During runs, find **Held Items** (Leftovers, Choice Band, Focus Sash...) and **evolve moves** once they reach maximum level. Enemies have distinct AI behaviors: healing allies, casting shields, summoning swarms, or telegraphing area-of-effect hazard attacks.

**Upgrades** are tracked per Pokémon. The **Gacha** system uses **Tickets** earned through gameplay (×1 from regular Pokémon, ×10 from bosses and legendaries), featuring an authentic pixel-art slot machine.

Every encountered enemy has a 1/4096 chance to spawn as a **Shiny**: sparkles with an on-screen directional arrow pointing to its location, and defeating it unlocks the shiny permanently in your collection. The gacha offers a 1/100 shiny rate. In your collection, switch freely between normal and shiny forms.

Audio begins after the first user interaction (browser autoplay policy). Adjust volume or mute using the speaker icon in the top-right corner or through the pause menu.

Save data is stored locally in browser `localStorage`.

Video gameplay previews (with original soundtrack) are available in `videos/`: including a boss encounter, wild shiny capture, and gacha shiny pull.

---

## Cloud Save and Online Features

- **Firebase Database:** Sign in with username/password or Google to sync save files across all devices seamlessly. Without configuration, the game defaults to browser `localStorage`.
- **Co-op Multiplayer (Up to 4 Players) & Leaderboards:** With a cloud account, access the **Friends** menu (add by nickname, invite to custom room via WebRTC P2P mesh) and **Rankings** (survival time: solo or party, daily vs all-time, friends-only, and per-species leaderboards).
- **Publishing on GitHub Pages:** See [docs/PUBLICAR.md](docs/PUBLICAR.md) (or English developer guide).
- **Automatic Cloud Merging:** If you play on multiple devices simultaneously or offline, your progress is intelligently merged: collections combine (you will never lose a Pokémon or a shiny), stats and talent upgrades keep the highest level, while coins and active partner use the newest save version.

---

## License

Code is licensed under [PolyForm Noncommercial 1.0.0](LICENSE-NONCOMMERCIAL.md) since 2026-10-14: free to use, study, and modify for **strictly non-commercial purposes** (no selling the game, charging fees, or monetizing features). Commits up to `b297089` were published under MIT. Sprites (CC BY-NC 4.0), font (OFL), and Pokémon intellectual property have their respective conditions: see [LICENSE](LICENSE) and [CREDITS.md](CREDITS.md). This is an unofficial, non-profit fan project.

**The only official website is [pokesurvivor.com](https://pokesurvivor.com).** The game is and will always remain free.

---

## Project Structure

```
index.html              Production entry point + script loader bundle
dev.html                Development entry point (loads unminified modular scripts)
css/style.css           Mystery Dungeon retro-themed pixel art interface
assets/pokemon/{dex}/   PMD sprite sheets (Idle, Walk, Attack, Shoot, Charge, Hurt, Faint)
assets/pokemon/{dex}/s/ Shiny sprite sheets
assets/fonts/           Pixelify Sans (OFL) and custom numeric font (tools/make_font.py)
js/
  net/      Social (nicknames, friends, lobbies), P2P networking (WebRTC + signaling),
            co-op logic (party synchronization), online rankings
  core/     Utilities, db (cloud + local storage), audio (synthesizer + SFX), input,
            sprites (PMD sheet animator), camera, i18n & locales
  data/     pokedex*, sprites-meta*, moves, starters (+ quiz), enemies, items,
            upgrades, abilities, achievements, music (notation scores), lang-*
  world/    tiles (procedural pixel art generator), world (infinite map, props, collision)
  entities/ player, enemy, projectile, pickup, fx, vfx
  systems/  combat, spawner, levelup, gacha, rift, judgment, story-encounters, boss-forms
  ui/       icons, ui, hud, login, test, menu, gacha-ui, run-ui, social-ui, ranking-ui
  game.js   Main game loop and state management
tools/      Build pipelines, asset generation, and data scrapers
```

`*` = generated asset. To regenerate them (requires Python 3 + Pillow and internet access):

```bash
python tools/fetch_sprites.py    # Normal and shiny sprites + js/data/sprites-meta.js
python tools/fetch_pokedex.py    # js/data/pokedex.js
python tools/fetch_credits.py    # CREDITS.md
```

Fast local bundling (no dependencies):
```bash
node tools/quick_build.js        # Compiles js/app.min.js and updates index.html in ~0.05s
```

---

## Technical Implementation Notes

- **PMD Sprites:** Columns = animation frames; Rows = 8 directions (Down, DownRight, Right, UpRight, Up, UpLeft, Left, DownLeft — aligned with `-Offsets.png`). Each animation has custom frame dimensions, anchored to the ground plane extracted from `-Shadow.png` to prevent sprite jitter during attacks.
- **Coordinate System:** An entity's `(x, y)` corresponds to its **feet/ground anchor**. Collision calculations occur on the 2D ground plane; projectiles fly on this plane and are rendered with height elevation and ground shadows.
- **World Generation:** Infinite map built in 16×16 tile chunks: raw terrain and obstacle data are generated on demand; visual textures are baked into an `ImageData` buffer at pixel resolution (~4 ms per chunk in Chrome) only for currently visible chunks.
- **Performance:** Enemy spatial hash grid rebuilt every frame. Even with 400+ active enemies, full simulation + canvas rendering executes in under ~3 ms per frame on modern browsers.
- **Metadata in `.js` instead of `.json`:** Allows the game to run seamlessly via the `file://` protocol where browser `fetch()` is restricted by CORS.
- **Shinies:** Custom palette shifts from SpriteCollab assets; stored in `s/` with palette quantization for minimal disk footprint.
- **Audio Engine:** Custom Web Audio API synthesizer with lookahead scheduling (queuing notes 150 ms ahead) and convolution reverb. Music scores are authored in a compact custom text format in `js/data/music.js`. SFX playback features polyphony voice caps and minimum re-trigger cooldowns to prevent audio distortion in dense crowds.
- **Icons:** Procedural canvas character maps rendered directly to data URLs at clean integer pixel scales.

---

## Credits and Attribution

Pokémon sprites provided by [SpriteCollab](https://github.com/PMDCollab/SpriteCollab) under **CC BY-NC 4.0** (Non-Commercial with Attribution). The complete list of contributing artists is preserved in [`CREDITS.md`](CREDITS.md). Pokémon is a registered trademark of Nintendo, Creatures Inc., and GAME FREAK Inc. This project is not affiliated with, endorsed by, or sponsored by Nintendo or The Pokémon Company.
