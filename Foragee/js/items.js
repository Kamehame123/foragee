'use strict';

/** Everything the player can hold. `food` items can be eaten with F. */
const ITEMS = {
  wood: {
    name: 'Wood',
    icon: '🪵',
    sell: 2,
    desc: 'Sturdy timber from the forest.',
  },
  stone: {
    name: 'Stone',
    icon: '🪨',
    sell: 3,
    desc: 'Rough stone, good for building.',
  },
  fiber: {
    name: 'Fiber',
    icon: '🌾',
    sell: 2,
    desc: 'Tough grass for weaving.',
  },
  berry: {
    name: 'Berries',
    icon: '🫐',
    sell: 5,
    desc: 'A sweet snack. +8 energy.',
    food: 8,
  },
  mushroom: {
    name: 'Mushroom',
    icon: '🍄',
    sell: 7,
    desc: 'Earthy and filling. +6 energy.',
    food: 6,
  },
  iron: {
    name: 'Iron',
    icon: '🔩',
    sell: 12,
    desc: 'A heavy nugget of raw iron.',
  },
  seed: {
    name: 'Berry Seeds',
    icon: '🌱',
    sell: 3,
    desc: 'Plant in a tilled garden plot.',
  },
  jam: {
    name: 'Berry Jam',
    icon: '🫙',
    sell: 20,
    desc: 'Sweet and restoring. +35 energy.',
    food: 35,
  },
  stew: {
    name: 'Forest Stew',
    icon: '🍲',
    sell: 35,
    desc: 'A hearty meal. +60 energy.',
    food: 60,
  },
};

const ITEM_ORDER = ['wood', 'stone', 'fiber', 'berry', 'mushroom', 'iron', 'seed', 'jam', 'stew'];

/**
 * Harvestable world nodes.
 * hp: swings needed (with the right tool each swing counts double)
 * range: how close the player must stand
 */
const NODE_TYPES = {
  tree: {
    name: 'Oak Tree',
    action: 'Chop',
    hp: 4,
    respawn: 42,
    range: 62,
    energy: 3,
    tool: 'axe',
    yields: [
      ['wood', 2, 3, 1],
      ['fiber', 0, 1, 0.35],
    ],
    particles: ['#6fae54', '#4f8f4a', '#8a5a3b'],
    shake: 5,
    sound: 'chop',
  },
  rock: {
    name: 'Boulder',
    action: 'Mine',
    hp: 4,
    respawn: 58,
    range: 56,
    energy: 4,
    tool: 'pickaxe',
    yields: [
      ['stone', 2, 3, 1],
    ],
    particles: ['#9aa3ad', '#7f8891', '#c3cbd4'],
    shake: 4,
    sound: 'mine',
  },
  ore: {
    name: 'Iron Vein',
    action: 'Mine',
    hp: 5,
    respawn: 90,
    range: 56,
    energy: 5,
    requires: 'pickaxe',
    tool: 'pickaxe',
    yields: [
      ['iron', 1, 2, 1],
      ['stone', 1, 1, 0.8],
    ],
    particles: ['#e08a4a', '#c3cbd4', '#f2c66a'],
    shake: 4,
    sound: 'mine',
  },
  bush: {
    name: 'Berry Bush',
    action: 'Forage',
    hp: 2,
    respawn: 34,
    range: 54,
    energy: 1,
    yields: [
      ['berry', 2, 4, 1],
      ['seed', 0, 1, 0.3],
    ],
    particles: ['#e0567a', '#4c8a46'],
    shake: 3,
    sound: 'rustle',
  },
  mush: {
    name: 'Mushroom Patch',
    action: 'Pick',
    hp: 1,
    respawn: 48,
    range: 50,
    energy: 1,
    yields: [
      ['mushroom', 1, 2, 1],
    ],
    particles: ['#e0876a', '#f2e6cf'],
    shake: 2,
    sound: 'rustle',
  },
  fiber: {
    name: 'Tall Grass',
    action: 'Gather',
    hp: 1,
    respawn: 24,
    range: 50,
    energy: 1,
    yields: [
      ['fiber', 2, 3, 1],
    ],
    particles: ['#9cc169', '#7aa84f'],
    shake: 2,
    sound: 'rustle',
  },
};

const RECIPES = [
  {
    id: 'campfire',
    name: 'Campfire',
    icon: '🔥',
    desc: 'A warm hub. Unlocks cooking and restores energy while you stand nearby.',
    cost: { wood: 12, stone: 8 },
    once: 'campfire',
    verb: 'Build',
  },
  {
    id: 'backpack',
    name: 'Woven Backpack',
    icon: '🎒',
    desc: 'Carry 20 more items.',
    cost: { fiber: 10, wood: 4 },
    once: 'backpack',
    verb: 'Weave',
  },
  {
    id: 'torch',
    name: 'Hand Torch',
    icon: '🕯️',
    desc: 'A warm circle of light for night-time foraging.',
    cost: { wood: 4, fiber: 3 },
    once: 'torch',
    verb: 'Craft',
  },
  {
    id: 'boots',
    name: 'Trail Boots',
    icon: '🥾',
    desc: 'Walk 15% faster through the undergrowth.',
    cost: { fiber: 6, iron: 2 },
    once: 'boots',
    verb: 'Craft',
  },
  {
    id: 'jam',
    name: 'Berry Jam',
    icon: '🫙',
    desc: 'A jar of sweet jam. +35 energy when eaten.',
    cost: { berry: 6, wood: 1 },
    needs: 'campfire',
    consumable: true,
    verb: 'Cook',
  },
  {
    id: 'stew',
    name: 'Forest Stew',
    icon: '🍲',
    desc: 'A hearty pot of stew. +60 energy when eaten.',
    cost: { mushroom: 3, berry: 4, wood: 1 },
    needs: 'campfire',
    consumable: true,
    verb: 'Cook',
  },
];

const SHOP_ITEMS = [
  {
    id: 'axe',
    kind: 'tool',
    name: 'Axe',
    icon: '🪓',
    price: 45,
    desc: 'Fell trees in half the swings.',
  },
  {
    id: 'pickaxe',
    kind: 'tool',
    name: 'Pickaxe',
    icon: '⛏️',
    price: 45,
    desc: 'Break boulders faster and mine iron veins.',
  },
  {
    id: 'hoe',
    kind: 'tool',
    name: 'Hoe',
    icon: '⚒️',
    price: 25,
    desc: 'Till the garden plots by the homestead.',
  },
  {
    id: 'seed',
    kind: 'item',
    name: 'Berry Seeds',
    icon: '🌱',
    price: 5,
    desc: 'Plant in a tilled plot. Harvest in about a minute.',
  },
];

const QUESTS = [
  {
    id: 'wood',
    icon: '🪵',
    title: 'Gather 10 wood',
    reward: 20,
    check: (s) => (s.stats.gathered.wood || 0) >= 10,
  },
  {
    id: 'axe',
    icon: '🪓',
    title: 'Buy an axe from the trader',
    reward: 20,
    check: (s) => !!s.tools.axe,
  },
  {
    id: 'campfire',
    icon: '🔥',
    title: 'Build a campfire',
    reward: 30,
    check: (s) => !!s.upgrades.campfire,
  },
  {
    id: 'harvest',
    icon: '🌱',
    title: 'Harvest a crop from the garden',
    reward: 30,
    check: (s) => (s.stats.harvested || 0) >= 1,
  },
  {
    id: 'earn',
    icon: '🪙',
    title: 'Earn 400 coins in total',
    reward: 100,
    check: (s) => (s.stats.earned || 0) >= 400,
  },
];
