// Everything that can be carried. Pure data.
//
// Gear has a `slot`: 'sword' | 'bow' | 'body' | 'helm' | 'legs'. Swords and bows
// have `damage`; armour has `defence` (the share of each blow it turns; the
// pieces add up). Gear has a `look`, used by entities/figure.js to dress the
// ranger in it. Gear sells for half its `value`.
// Everything else has a `kind`: 'heal' | 'herb' | 'seed' | 'goods' | 'trophy' | 'kit'.
// Goods and trophies sell for their full value.
//
// Where gear comes from is part of the balance: most of it is sold by Mablung
// once the ranger's renown is high enough (SHOP below); some only falls from the
// enemy, and the best pieces are gifts for great deeds (data/quests.js).

const STEEL = 0xd0d4dc, IRON = 0x6a6a70, BLACK = 0x3a3a40, BRIGHT = 0xe8eaf0, GOLD = 0xc9a84a, BRONZE = 0xa8743a;
const LEATHER = 0x6b4a2a, DARK = 0x3a3028;

export const ITEMS = {
  // ---- swords ----
  rangerSword: { name: 'Ranger’s sword', slot: 'sword', damage: 14, value: 20, look: { blade: STEEL, hilt: DARK, shape: 'straight' }, text: 'Plain, well kept, and yours.' },
  orcCleaver: { name: 'Orc cleaver', slot: 'sword', damage: 15, value: 12, look: { blade: IRON, hilt: 0x2a2420, shape: 'broad' }, text: 'More butcher’s tool than sword, but heavy.' },
  orcScimitar: { name: 'Orc scimitar', slot: 'sword', damage: 16, value: 16, look: { blade: IRON, hilt: 0x2a2420, shape: 'curved' }, text: 'Ugly iron with a wicked edge.' },
  longKnife: { name: 'Long knife of the rangers', slot: 'sword', damage: 16, value: 40, look: { blade: STEEL, hilt: LEATHER, shape: 'knife' }, text: 'Short, quick, and easy to keep sharp.' },
  guardSword: { name: 'Sword of the Ithilien guard', slot: 'sword', damage: 17, value: 70, look: { blade: STEEL, hilt: 0x4d6238, shape: 'straight' }, text: 'Issued to the rangers before the war. Good plain work.' },
  southronScimitar: { name: 'Southron scimitar', slot: 'sword', damage: 18, value: 55, look: { blade: BRIGHT, hilt: GOLD, shape: 'curved' }, text: 'Curved steel from the far south, bright as a new moon.' },
  falchion: { name: 'Falchion of Pelargir', slot: 'sword', damage: 19, value: 120, look: { blade: STEEL, hilt: 0x3a4a6a, shape: 'broad' }, text: 'A seaman’s blade, broad near the point.' },
  urukBlade: { name: 'Uruk war-blade', slot: 'sword', damage: 20, value: 60, look: { blade: BLACK, hilt: 0x7a2a22, shape: 'broad' }, text: 'Black, heavy and notched. It was made to hack through shields.' },
  riddermarkSword: { name: 'Sword of the Riddermark', slot: 'sword', damage: 20, value: 180, look: { blade: STEEL, hilt: GOLD, shape: 'straight' }, text: 'From Rohan, with a horse on the pommel. Éowyn knows the smith.' },
  haradBlade: { name: 'Blade of the Harad lords', slot: 'sword', damage: 21, value: 210, look: { blade: BRIGHT, hilt: 0x8a2a22, shape: 'curved' }, text: 'A long curved sword with a red-wrapped grip. Taken in the war.' },
  dolAmrothSword: { name: 'Sword of Dol Amroth', slot: 'sword', damage: 22, value: 280, look: { blade: BRIGHT, hilt: 0x3a5a9a, shape: 'straight' }, text: 'Silver and blue, from the swan-knights of the coast.' },
  captainsBlade: { name: 'Captain’s blade', slot: 'sword', damage: 24, value: 140, look: { blade: BLACK, hilt: GOLD, shape: 'curved' }, text: 'A captain of Mordor carried this. It is better than he was.' },
  dunedainSword: { name: 'Long sword of the Dúnedain', slot: 'sword', damage: 24, value: 380, look: { blade: STEEL, hilt: DARK, shape: 'long' }, text: 'Northern work, plain in the hilt and true in the blade.' },
  guardBlade: { name: 'Blade of the Tower Guard', slot: 'sword', damage: 26, value: 520, look: { blade: BRIGHT, hilt: BLACK, shape: 'long' }, text: 'Forged in Minas Tirith. It has waited long for a good use.' },
  anorianSword: { name: 'Sword of Anórien', slot: 'sword', damage: 28, value: 680, look: { blade: BRIGHT, hilt: GOLD, shape: 'long' }, text: 'Made for a captain of the beacon-hills, and never drawn in anger.' },
  westernesseBlade: { name: 'Sword of Westernesse', slot: 'sword', damage: 31, value: 900, look: { blade: 0xdfe8ff, hilt: GOLD, shape: 'long' }, text: 'Old beyond reckoning. Letters run along it that glint at dusk.' },
  kingsGift: { name: 'The King’s gift', slot: 'sword', damage: 34, value: 1200, look: { blade: 0xf4f6ff, hilt: 0xd8d8e2, shape: 'long' }, text: 'Sent from the City for the ranger who cleared Ithilien.' },

  // ---- bows ----
  rangerBow: { name: 'Ranger’s bow', slot: 'bow', damage: 16, value: 20, look: { wood: LEATHER }, text: 'Yew, and long service.' },
  orcBow: { name: 'Orc bow', slot: 'bow', damage: 17, value: 22, look: { wood: 0x2a2420 }, text: 'Short, black, and stronger than it looks.' },
  elmBow: { name: 'Elm hunting bow', slot: 'bow', damage: 18, value: 55, look: { wood: 0x8a6a42 }, text: 'A countryman’s bow, pale and supple.' },
  southronBow: { name: 'Southron short bow', slot: 'bow', damage: 19, value: 45, look: { wood: 0x8a2a22, tips: GOLD }, text: 'Red-lacquered, with gilt tips. It shoots flat and fast.' },
  ashBow: { name: 'Ash bow of Lossarnach', slot: 'bow', damage: 20, value: 130, look: { wood: 0xb08a5a }, text: 'Strong and light, from the valley of flowers.' },
  hornBow: { name: 'Horn bow of Harad', slot: 'bow', damage: 21, value: 190, look: { wood: 0x4a3020, tips: 0xece6d4 }, text: 'Horn and sinew. It sings when it looses.' },
  blackBow: { name: 'Great black bow', slot: 'bow', damage: 21, value: 90, look: { wood: 0x1c1a1a, long: true }, text: 'Taken from an orc captain. It takes a strong arm.' },
  yewBow: { name: 'Yew bow of Lebennin', slot: 'bow', damage: 24, value: 360, look: { wood: 0x7a4a26, long: true }, text: 'Cut from the old yews by the sea, and seasoned twenty years.' },
  citadelBow: { name: 'Bow of the Citadel archers', slot: 'bow', damage: 26, value: 500, look: { wood: 0x2a2a30, tips: 0xd8d8e2, long: true }, text: 'Black and silver, from the archers of the Tower.' },
  greatBow: { name: 'Great bow of Ithilien', slot: 'bow', damage: 28, value: 650, look: { wood: 0x4d6238, long: true }, text: 'A bow of the White Company, taller than its bearer.' },
  galadhrimBow: { name: 'Bow of the Galadhrim', slot: 'bow', damage: 32, value: 1000, look: { wood: 0xd8d0a8, tips: 0xe8e0b0, long: true }, text: 'Elven work, light as a branch. How it came to Ithilien no one will say.' },

  // ---- armour: body ----
  leatherJerkin: { name: 'Leather jerkin', slot: 'body', defence: 0.06, value: 35, look: { tunic: 0x6b4e30, sleeve: 0x5a4028 }, text: 'Turns a glancing cut.' },
  gambeson: { name: 'Quilted gambeson', slot: 'body', defence: 0.08, value: 60, look: { tunic: 0xcfc2a0, sleeve: 0xbfb290 }, text: 'Thick linen, many times stitched. Warm, too.' },
  orcHauberk: { name: 'Orc ring-shirt', slot: 'body', defence: 0.1, value: 45, look: { tunic: 0x4a3a30, sleeve: 0x3a2e26, mail: 0x5a5048 }, text: 'Rusty rings on greasy leather. It works, more or less.' },
  mailShirt: { name: 'Mail shirt', slot: 'body', defence: 0.13, value: 150, look: { tunic: 0x8a8e96, sleeve: 0x4d6238, mail: 0x9aa0a8 }, text: 'Rings of Gondor, a little rusted.' },
  scaleCoat: { name: 'Southron scale coat', slot: 'body', defence: 0.15, value: 140, look: { tunic: BRONZE, sleeve: 0x8a2a22, mail: 0xc08a48 }, text: 'Bronze scales sewn on red cloth. It rattles.' },
  blackMail: { name: 'Blackened mail', slot: 'body', defence: 0.17, value: 300, look: { tunic: 0x2a2a2e, sleeve: 0x2a2a2e, mail: 0x3a3a40 }, text: 'Mail dulled with soot, so it does not catch the light.' },
  brigandine: { name: 'Brigandine of Dol Amroth', slot: 'body', defence: 0.19, value: 420, look: { tunic: 0x2e4a7a, sleeve: 0x8a8e96, badge: 0xe8eaf0 }, text: 'Plates riveted under blue cloth, with the swan on the breast.' },
  whiteCompanyMail: { name: 'Mail of the White Company', slot: 'body', defence: 0.21, value: 560, look: { tunic: 0xb8bcc4, sleeve: 0x3f5a34, mail: 0xc8ccd4, badge: 0x3f5a34 }, text: 'Light, close-woven, and green-cloaked.' },
  citadelMail: { name: 'Mail of the Citadel', slot: 'body', defence: 0.24, value: 760, look: { tunic: 0x1c1c22, sleeve: 0x9aa0a8, mail: 0x2a2a32, badge: 0xf2f0e6 }, text: 'Black and silver, from the armouries of the Tower itself, with the White Tree on the breast.' },
  kingsMail: { name: 'Mail of the King’s Men', slot: 'body', defence: 0.27, value: 1100, look: { tunic: 0xe8eaf0, sleeve: 0xb8bcc4, mail: 0xf0f2f8, badge: 0xc9a84a }, text: 'Bright as frost. There are not many of these in the world.' },

  // ---- armour: helms ----
  leatherCap: { name: 'Leather cap', slot: 'helm', defence: 0.03, value: 30, look: { color: 0x5a4028 }, text: 'Better than a hood when the arrows come.' },
  orcHelm: { name: 'Orc iron cap', slot: 'helm', defence: 0.04, value: 20, look: { color: 0x4a4a52, nasal: true }, text: 'Dented. You would rather not know what dented it.' },
  southronHelm: { name: 'Southron helm', slot: 'helm', defence: 0.05, value: 70, look: { color: BRONZE, crest: 0x8a2a22 }, text: 'A bronze bowl with a red horsehair crest.' },
  gondorHelm: { name: 'Helm of Gondor', slot: 'helm', defence: 0.06, value: 220, look: { color: 0xb8bcc4, nasal: true }, text: 'A plain steel helm with a guard for the nose.' },
  citadelHelm: { name: 'Winged helm of the Citadel', slot: 'helm', defence: 0.08, value: 600, look: { color: 0xd8dce4, wings: 0xf2f0e6 }, text: 'Tall, with the wings of sea-birds at the sides.' },

  // ---- armour: legs ----
  leatherGreaves: { name: 'Leather greaves', slot: 'legs', defence: 0.03, value: 45, look: { color: 0x5a4028 }, text: 'Boiled leather from knee to ankle.' },
  orcGreaves: { name: 'Orc shin-plates', slot: 'legs', defence: 0.04, value: 30, look: { color: 0x3a3a40 }, text: 'Iron strapped on with hide. They chafe.' },
  ironGreaves: { name: 'Steel greaves', slot: 'legs', defence: 0.05, value: 260, look: { color: 0xa8acb4 }, text: 'Gondor’s make, jointed at the knee.' },
  citadelGreaves: { name: 'Greaves of the Citadel', slot: 'legs', defence: 0.07, value: 520, look: { color: 0x2a2a32 }, text: 'Black steel chased with silver.' },

  // ---- to eat and drink ----
  draught: { name: 'Healing draught', kind: 'heal', heal: 60, value: 22, text: 'Kingsfoil steeped by Éowyn. Restores a good deal.' },
  waybread: { name: 'Waybread', kind: 'heal', heal: 22, value: 7, text: 'Rangers’ fare. Better than it tastes.' },
  salve: { name: 'Salve of the Houses of Healing', kind: 'heal', heal: 100, value: 55, text: 'Made in Minas Tirith. Closes any wound that is not mortal.' },

  // ---- gathered in the woods ----
  athelas: { name: 'Kingsfoil', kind: 'herb', value: 2, text: 'A plain leaf with a clean scent. Éowyn has a use for it.' },
  thymeSeed: { name: 'Wild thyme seed', kind: 'seed', value: 1, text: 'From the low purple thyme of the open glades.' },
  baySeed: { name: 'Bay berries', kind: 'seed', value: 1, text: 'Dark berries from the bay laurel of the woods.' },
  poppySeed: { name: 'Poppy heads', kind: 'seed', value: 1, text: 'Red poppies still come up where the old fields were.' },
  oliveStone: { name: 'Olive stones', kind: 'seed', value: 1, text: 'From the wild olives of the south, gone back to the forest.' },

  // ---- taken from the enemy ----
  orcTrinket: { name: 'Orc trinkets', kind: 'goods', value: 3, text: 'Teeth, bent coins, a brass ring. Mablung will melt them down.' },
  blackCoin: { name: 'Coin of Mordor', kind: 'goods', value: 6, text: 'Stamped with the Eye. Worth its weight and no more.' },
  haradGold: { name: 'Gold of Harad', kind: 'goods', value: 16, text: 'An armlet of red gold.' },
  orcBlade: { name: 'Notched orc blade', kind: 'trophy', value: 2, text: 'Broken iron. Faramir wants them counted and melted.' },
  redEye: { name: 'Red Eye badge', kind: 'trophy', value: 4, text: 'Daubed on a scrap of hide. The Uruks wore them.' },
  arrowheads: { name: 'Blackened arrowheads', kind: 'trophy', value: 4, text: 'Barbed and black. Only the archers of the road bands still carry these.' },
  captainToken: { name: 'Captain’s token', kind: 'trophy', value: 10, text: 'An iron ring with a mark of rank. Each one is a captain fewer.' },

  // ---- for keeping gear in order ----
  whetstone: { name: 'Whetstone', kind: 'kit', mends: 'sword', value: 8, text: 'Puts the edge back on a blade. You must know how to use it.' },
  bowstring: { name: 'Spare bowstring', kind: 'kit', mends: 'bow', value: 8, text: 'Waxed linen. A worn string loses the bow its strength.' },
};

export const SLOTS = ['sword', 'bow', 'body', 'helm', 'legs'];
export const SLOT_NAMES = { sword: 'Sword', bow: 'Bow', body: 'Armour', helm: 'Helm', legs: 'Greaves' };
export const SEEDS = ['thymeSeed', 'baySeed', 'poppySeed', 'oliveStone'];

/**
 * What Mablung sells, and the renown needed before he will part with it.
 * Renown runs to 50, reached only by a ranger who has done nearly everything,
 * so the best of it comes late.
 */
export const SHOP = [
  { item: 'waybread', renown: 0 },
  { item: 'draught', renown: 0 },
  { item: 'arrows', renown: 0, count: 10, price: 12, name: 'Arrows (10)' },
  { item: 'leatherJerkin', renown: 0 },
  { item: 'leatherCap', renown: 1 },
  { item: 'elmBow', renown: 2 },
  { item: 'longKnife', renown: 2 },
  { item: 'gambeson', renown: 3 },
  { item: 'leatherGreaves', renown: 4 },
  { item: 'arrows', renown: 5, count: 30, price: 32, name: 'A full quiver (30 arrows)' },
  { item: 'guardSword', renown: 5 },
  { item: 'mailShirt', renown: 7 },
  { item: 'ashBow', renown: 8 },
  { item: 'falchion', renown: 10 },
  { item: 'salve', renown: 11 },
  { item: 'gondorHelm', renown: 12 },
  { item: 'hornBow', renown: 13 },
  { item: 'blackMail', renown: 15 },
  { item: 'haradBlade', renown: 17 },
  { item: 'ironGreaves', renown: 19 },
  { item: 'yewBow', renown: 21 },
  { item: 'brigandine', renown: 23 },
  { item: 'dolAmrothSword', renown: 25 },
  { item: 'citadelBow', renown: 28 },
  { item: 'dunedainSword', renown: 30 },
  { item: 'citadelGreaves', renown: 33 },
  { item: 'citadelMail', renown: 36 },
  { item: 'guardBlade', renown: 38 },
  { item: 'citadelHelm', renown: 41 },
  { item: 'westernesseBlade', renown: 45 },
  { item: 'galadhrimBow', renown: 48 },
];

/** Services at Mablung's table. Field repair is a skill he teaches once; then the kits are sold. */
export const REPAIR = { teachRenown: 6, teachPrice: 45 };
/** Honing a blade or restringing a bow: each step adds 1 damage, up to 3; renown and silver for each step. */
export const HONE = [
  { renown: 4, price: 30 },
  { renown: 14, price: 90 },
  { renown: 28, price: 220 },
];
