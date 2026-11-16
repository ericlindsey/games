// Everything that can be carried. Pure data.
// slot: 'sword' | 'bow' | 'armour' for gear; kind: 'heal' | 'herb' | 'goods' otherwise.
// `value` is the price in silver at Henneth Annûn; goods sell for it in full, gear and supplies for half.

export const ITEMS = {
  rangerSword: { name: 'Ranger\u2019s sword', slot: 'sword', damage: 14, value: 20, text: 'Plain, well kept, and yours.' },
  orcScimitar: { name: 'Orc scimitar', slot: 'sword', damage: 17, value: 16, text: 'Ugly iron with a wicked edge.' },
  haradBlade: { name: 'Southron blade', slot: 'sword', damage: 21, value: 70, text: 'Curved steel from the far south, bright as a new moon.' },
  dunedainSword: { name: 'Long sword of the D\u00fanedain', slot: 'sword', damage: 25, value: 160, text: 'Northern work, plain in the hilt and true in the blade.' },
  gondorBlade: { name: 'Blade of the Tower Guard', slot: 'sword', damage: 29, value: 240, text: 'Forged in Minas Tirith. It has waited long for a good use.' },
  westernesseBlade: { name: 'Sword of Westernesse', slot: 'sword', damage: 34, value: 460, text: 'Old beyond reckoning. Letters run along it that glint at dusk.' },

  rangerBow: { name: 'Ranger\u2019s bow', slot: 'bow', damage: 16, value: 20, text: 'Yew, and long service.' },
  orcBow: { name: 'Orc bow', slot: 'bow', damage: 19, value: 26, text: 'Short, black, and stronger than it looks.' },
  hornBow: { name: 'Horn bow of Harad', slot: 'bow', damage: 24, value: 90, text: 'Horn and sinew. It sings when it looses.' },
  lebenninBow: { name: 'Yew bow of Lebennin', slot: 'bow', damage: 28, value: 200, text: 'Cut from the old yews by the sea, and seasoned twenty years.' },
  greatBow: { name: 'Great bow of Ithilien', slot: 'bow', damage: 32, value: 280, text: 'A bow of the White Company, taller than its bearer.' },
  galadhrimBow: { name: 'Bow of the Galadhrim', slot: 'bow', damage: 37, value: 520, text: 'Elven work, light as a branch. How it came to Ithilien no one will say.' },

  leatherJerkin: { name: 'Leather jerkin', slot: 'armour', defence: 0.12, value: 35, text: 'Turns a glancing cut.' },
  mailShirt: { name: 'Mail shirt', slot: 'armour', defence: 0.22, value: 110, text: 'Rings of Gondor, a little rusted.' },
  brigandine: { name: 'Brigandine of Dol Amroth', slot: 'armour', defence: 0.3, value: 190, text: 'Plates riveted under blue cloth, with the swan on the breast.' },
  ithilienMail: { name: 'Mail of the White Company', slot: 'armour', defence: 0.38, value: 300, text: 'Light, close-woven, and green-cloaked.' },
  citadelMail: { name: 'Mail of the Citadel', slot: 'armour', defence: 0.45, value: 420, text: 'Black and silver, from the armouries of the Tower itself.' },

  draught: { name: 'Healing draught', kind: 'heal', heal: 60, value: 18, text: 'Kingsfoil steeped by \u00c9owyn. Restores a good deal.' },
  waybread: { name: 'Waybread', kind: 'heal', heal: 22, value: 6, text: 'Rangers\u2019 fare. Better than it tastes.' },
  salve: { name: 'Salve of the Houses of Healing', kind: 'heal', heal: 100, value: 45, text: 'Made in Minas Tirith. Closes any wound that is not mortal.' },
  athelas: { name: 'Kingsfoil', kind: 'herb', value: 2, text: 'A plain leaf with a clean scent. \u00c9owyn has a use for it.' },

  orcTrinket: { name: 'Orc trinkets', kind: 'goods', value: 3, text: 'Teeth, bent coins, a brass ring. Mablung will melt them down.' },
  blackCoin: { name: 'Coin of Mordor', kind: 'goods', value: 7, text: 'Stamped with the Eye. Worth its weight and no more.' },
  haradGold: { name: 'Gold of Harad', kind: 'goods', value: 18, text: 'An armlet of red gold.' },
};

/** What Mablung sells, and the renown needed before he will part with it. */
export const SHOP = [
  { item: 'waybread', renown: 0 },
  { item: 'draught', renown: 0 },
  { item: 'arrows', renown: 0, count: 10, price: 12, name: 'Arrows (10)' },
  { item: 'leatherJerkin', renown: 0 },
  { item: 'orcBow', renown: 1 },
  { item: 'mailShirt', renown: 2 },
  { item: 'arrows', renown: 3, count: 30, price: 30, name: 'A full quiver (30 arrows)' },
  { item: 'haradBlade', renown: 3 },
  { item: 'hornBow', renown: 4 },
  { item: 'brigandine', renown: 6 },
  { item: 'dunedainSword', renown: 7 },
  { item: 'salve', renown: 8 },
  { item: 'lebenninBow', renown: 9 },
  { item: 'citadelMail', renown: 11 },
  { item: 'westernesseBlade', renown: 13 },
  { item: 'galadhrimBow', renown: 15 },
];
