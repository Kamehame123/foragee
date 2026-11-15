# 🍃 Foragee

A cozy foraging game that runs in the browser. Gather wood, stone, fiber, berries and mushrooms; craft a campfire, a backpack and a torch; sell surplus to the trader; till the garden and grow berries. There is no fail state — the forest regrows and every day starts fresh.

No build step, no dependencies, no assets. Pure HTML, CSS and canvas.

## Run it

Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari), or serve the folder:

```sh
npx serve Foragee
```

Progress is saved automatically to `localStorage` under `foragee-save-v1`.

## Controls

| Action | Key |
| --- | --- |
| Move | `WASD` or arrow keys |
| Sprint | `Shift` (drains energy) |
| Gather / interact | `E` or `Space` (hold to keep gathering) |
| Plant pumpkin seeds | Hold `Shift` while planting |
| Eat best food | `F` |
| Crafting panel | `C` |
| Bag | `I` |
| Menu / close panel | `Esc` |
| Mute | `M` |

Click food chips in the bottom bar (or the Eat buttons in the bag) to eat a specific item.

On a phone or tablet the game switches to a touch layout automatically: drag the stick in the bottom-left to move, hold **🌿 Gather** in the bottom-right to gather, and tap **🍓 Eat** to eat. Craft, Bag and Help stay in the top bar.

## The loop

1. **Forage.** Hold `E` near trees, boulders, berry bushes, tall grass, mushroom patches and clay banks. Apple trees, beehives and herb patches are scattered around the forest, and the pond west of the homestead has fishing spots.
2. **Eat and rest.** Berries, mushrooms, apples, honey and fish restore energy. The tent at the homestead sleeps until morning and refills your energy.
3. **Trade.** The stall east of the campfire buys everything you gather and sells tools: axe, pickaxe, hoe, fishing rod and watering can, plus steel upgrades and seeds.
4. **Craft.** A campfire unlocks cooking; a stone hearth widens the glow. A backpack and basket add inventory space, a torch or crystal lantern lights the night, and trail boots make you faster.
5. **Farm.** Till the four plots with the hoe, plant seeds, and harvest ripe berries about 45 seconds later. Hold `Shift` while planting to sow slower, heartier pumpkins. A watering can speeds growth.
6. **Settle in.** The goal list in the top-left pays out coins as you hit milestones. Earning 400 coins is the long-term target.

Weather drifts between clear, cloudy, rain and fog. Rain helps crops grow; the HUD clock shows the current sky.

## Project layout

```
Foragee/
├── index.html        HUD, panels and start screen markup
├── css/style.css     Cozy dark UI, responsive layout, animations
└── js/
    ├── utils.js      Math helpers, seeded RNG, WebAudio synth
    ├── items.js      Item, node, recipe, shop and goal definitions
    ├── world.js      Procedural world, resource nodes, structures, rendering
    ├── player.js     Movement and hand-drawn character
    ├── ui.js         HUD, inventory bar, panels, toasts, start screen
    └── game.js       Loop, state, saving, interactions, lighting
```

Tuning lives at the top of `js/game.js` (`DAY_LENGTH`, `BASE_CAPACITY`, `BASKET_BONUS`), in `js/items.js` (yields, costs, prices, crops, weather, goals) and in `js/world.js` (world layout and spawning).

## Notes

- Characters, trees, rocks and the homestead are drawn procedurally with canvas paths, so there are no image files to manage.
- Sound is synthesized with the Web Audio API and starts after your first click.
- Touch controls appear automatically on coarse-pointer devices; the keyboard layout is unchanged on desktop.

## Deploy

The repository root includes a GitHub Actions workflow (`.github/workflows/pages.yml`) that publishes the `Foragee/` folder to GitHub Pages on every push to `main`.

1. Push the repository to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Open `https://<your-username>.github.io/<repo>/`.
