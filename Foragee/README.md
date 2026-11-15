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
| Eat best food | `F` |
| Crafting panel | `C` |
| Bag | `I` |
| Menu / close panel | `Esc` |
| Mute | `M` |

Click food chips in the bottom bar (or the Eat buttons in the bag) to eat a specific item.

## The loop

1. **Forage.** Hold `E` near trees, boulders, berry bushes, tall grass and mushroom patches. Gathering costs energy.
2. **Eat and rest.** Berries and mushrooms restore energy. The tent at the homestead sleeps until morning and refills your energy.
3. **Trade.** The stall east of the campfire buys everything you gather and sells an axe, a pickaxe, a hoe, and berry seeds.
4. **Craft.** A campfire unlocks cooking, a backpack adds 20 inventory space, a torch lights up the night, and trail boots make you faster.
5. **Farm.** Till the three plots with the hoe, plant seeds, and harvest ripe berries about 45 seconds later.
6. **Settle in.** The goal list in the top-left pays out coins as you hit milestones. Earning 400 coins is the long-term target.

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

Tuning lives at the top of `js/game.js` (`DAY_LENGTH`, `BASE_CAPACITY`), in `js/items.js` (yields, costs, prices, goals) and in `js/world.js` (`PLOT_GROW_TIME`).

## Notes

- Characters, trees, rocks and the homestead are drawn procedurally with canvas paths, so there are no image files to manage.
- Sound is synthesized with the Web Audio API and starts after your first click.
- Designed for a keyboard and mouse. A touch layout is not included yet.
