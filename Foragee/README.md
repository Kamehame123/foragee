# 🍃 Foragee

A cozy foraging game that runs in the browser. Gather wood, stone, fiber, berries and mushrooms; craft a campfire, a backpack and a torch; sell surplus to the trader; till the garden and grow berries, pumpkins, carrots, corn, strawberries, potatoes, tomatoes and onions; build a well, chicken coop and bee box; fish the pond for trout; and charter new islands to explore. There is no fail state - the forest regrows and every day starts fresh.

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
| Plant seeds | Interact with a tilled plot, then pick a seed |
| Eat best food | `F` |
| Crafting panel | `C` |
| Bag | `I` |
| Menu / close panel | `Esc` |
| Mute | `M` |

Click food chips in the bottom bar (or the Eat buttons in the bag) to eat a specific item.

On a phone or tablet the game switches to a touch layout automatically: drag the stick in the bottom-left to move, hold **🌿 Gather** in the bottom-right to gather, and tap **🍓 Eat** to eat. Craft, Bag and Help stay in the top bar.

## The loop

1. **Forage.** Hold `E` near trees, boulders, berry bushes, tall grass, mushroom patches and clay banks. Apple and hazelnut trees, beehives, herb patches and reed beds are scattered around the forest, and the pond west of the homestead has fishing spots.
2. **Eat and rest.** Berries, mushrooms, apples, honey, fish and cooked meals restore energy. The tent at the homestead sleeps until morning and refills your energy, and once you have built a campfire you can rest beside it for a quick top-up without losing the day.
3. **Trade.** The stall east of the campfire buys everything you gather and sells tools: axe, pickaxe, hoe, fishing rod and watering can, plus steel upgrades, seeds and fishing bait.
4. **Craft.** A campfire unlocks cooking; a stone hearth widens the glow. A backpack and basket add inventory space, a torch or crystal lantern lights the night, and trail boots make you faster. Six new meals — pumpkin soup, cornbread, carrot cake, nut roast, fish stew and grilled trout — restore more energy than raw food. Strawberry jam, potato stew, tomato soup and onion pie join the menu once you grow the new garden crops.
5. **Farm.** Till the four plots with the hoe, then interact with the tilled soil to choose a seed: fast carrots, tall corn, slow pumpkins or berries. A watering can, a garden well and rainy days all speed growth.
6. **Build the homestead.** A chicken coop adds fresh eggs and a bee box adds honey every morning. Both pay out when you sleep and when the day rolls over.
7. **Sail.** Interact with the rowboat by the pond dock to open the island charters. Buy an island with coins, then sail there. Every island has its own map, resource mix and a boat waiting to take you home or onward.
8. **Settle in.** The goal list in the top-left pays out coins as you hit milestones. Earning 400 coins is the long-term target.

Weather drifts between clear, cloudy, rain, fog and storms. Rain and storms help crops grow and speed up resource regrowth; storms bring heavier rain and the occasional flash of lightning. The HUD clock shows the current sky.

Keep fishing bait in your bag to automatically land one extra fish whenever you finish a fishing spot. The pond occasionally yields a river trout, which sells well and cooks into grilled trout.

Open the **Field guide** from the pause menu for a pocket almanac of every item, crop, recipe and island, including what you have discovered so far.

## Add-on tools

A strip of round buttons on the right edge opens a set of optional extras. Each one is a self-contained file in `js/modules/`, keeps its own small `localStorage` key, and can be ignored without affecting the main game.

| Tool | Key | What it does |
| --- | --- | --- |
| Minimap | `V` | Live overhead map of the current island with resource nodes, water, buildings and the player |
| Achievements | `A` | 24 milestone badges that pop up as you reach them |
| Daily tasks | `T` | Three small goals each in-game day; rewards are paid automatically |
| Field journal | `J` | A short diary of days, voyages, new tools, buildings and gathering milestones |
| Photo mode | `P` | Saves a framed PNG snapshot of the current scene |
| Save manager | `B` | Export/import a save file plus three manual backup slots |
| Weather glass | `L` | Six-day weather outlook with farming advice |
| Traveller | `Q` | A visitor every other day who buys and sells one lot of goods |
| Companion | `Y` | A duck or cat that follows you around; rename it and choose its species |
| Weather effects | `O` | Toggles rain streaks, fog banks, drifting leaves and storm flashes |
| Soundtrack | `U` | Soft generated ambient music with a volume slider |

The night sky gets a starfield, moon and the occasional shooting star on its own. All module state lives under separate `foragee-*-v1` keys, so the main save is never touched.

## Islands

Charters are permanent and only cost coins:

| Island | Cost | What grows there |
| --- | --- | --- |
| Home Isle | — | Your homestead, garden, pond and trader |
| Bramble Isle | 120 | Berries, hazelnuts, fiber and honey |
| Amber Isle | 300 | Stone, iron, crystal and clay |
| Mist Isle | 520 | Trout, reeds, nuts and crystal, around a hidden pond |
| Orchard Isle | 700 | Apples, hazelnuts, honey, berries, fiber and herbs |
| Fern Isle | 900 | Rare herbs, mushrooms, reeds, clay and crystal |
| Glass Isle | 1150 | Crystal, clay, stone, mushrooms and iron |
| Tidepool Isle | 1400 | Reeds, clay, fiber, mushrooms, apples, and a tidal pond |

Buy a charter from the rowboat at the pond dock, or from the boat on any island you have already reached. Your bag, tools, coins and upgrades travel with you. Each island remembers which nodes you harvested, and nodes regrow while you are away.

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
    ├── game.js       Loop, state, saving, interactions, lighting
    └── modules/      Optional add-ons (minimap, badges, journal, music…)
        ├── base.js   Shared tool strip, panels, popups and storage helper
        └── *.js      One file per add-on, loaded after game.js
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
