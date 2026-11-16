// Everything that can be carried. Pure data.
// slot: 'sword' | 'bow' | 'armour' for gear; kind: 'heal' | 'herb' | 'goods' otherwise.
// `value` is the price in silver at Henneth Annûn; goods sell for it in full, gear and supplies for half.

export const ITEMS = {
  rangerSword: { name: 'Ranger’s sword', slot: 'sword', damage: 14, value: 20, text: 'Plain, well kept, and yours.' },
  orcScimitar: { name: 'Orc scimitar', slot: 'sword', damage: 17, value: 16, text: 'Ugly iron with a wicked edge.' },
  haradBlade: { name: 'Southron blade', slot: 'sword', damage: 22, value: 46, text: 'Curved steel from the far south, bright as a new moon.' },
  gondorBlade: { name: 'Blade of the Tower Guard', slot: 'sword', damage: 29, value: 120, text: 'Forged in Minas Tirith. It has waited long for a good use.' },

  rangerBow: { name: 'Ranger’s bow', slot: 'bow', damage: 16, value: 20, text: 'Yew, and long service.' },
  orcBow: { name: 'Orc bow', slot: 'bow', damage: 19, value: 16, text: 'Short, black, and stronger than it looks.' },
  hornBow: { name: 'Horn bow of Harad', slot: 'bow', damage: 25, value: 60, text: 'Horn and sinew. It sings when it looses.' },
  greatBow: { name: 'Great bow of Ithilien', slot: 'bow', damage: 33, value: 140, text: 'A bow of the White Company, taller than its bearer.' },

  leatherJerkin: { name: 'Leather jerkin', slot: 'armour', defence: 0.12, value: 30, text: 'Turns a glancing cut.' },
  mailShirt: { name: 'Mail shirt', slot: 'armour', defence: 0.25, value: 90, text: 'Rings of Gondor, a little rusted.' },
  ithilienMail: { name: 'Mail of the White Company', slot: 'armour', defence: 0.4, value: 200, text: 'Light, close-woven, and green-cloaked.' },

  draught: { name: 'Healing draught', kind: 'heal', heal: 60, value: 14, text: 'Kingsfoil steeped by Éowyn. Restores a good deal.' },
  waybread: { name: 'Waybread', kind: 'heal', heal: 22, value: 5, text: 'Rangers’ fare. Better than it tastes.' },
  athelas: { name: 'Kingsfoil', kind: 'herb', value: 3, text: 'A plain leaf with a clean scent. Éowyn has a use for it.' },

  orcTrinket: { name: 'Orc trinkets', kind: 'goods', value: 4, text: 'Teeth, bent coins, a brass ring. Mablung will melt them down.' },
  blackCoin: { name: 'Coin of Mordor', kind: 'goods', value: 9, text: 'Stamped with the Eye. Worth its weight and no more.' },
  haradGold: { name: 'Gold of Harad', kind: 'goods', value: 22, text: 'An armlet of red gold.' },
};

/** What Mablung sells, and the renown needed before he will part with it. */
export const SHOP = [
  { item: 'waybread', renown: 0 },
  { item: 'draught', renown: 0 },
  { item: 'arrows', renown: 0, count: 10, price: 8, name: 'Arrows (10)' },
  { item: 'leatherJerkin', renown: 0 },
  { item: 'orcBow', renown: 1 },
  { item: 'mailShirt', renown: 2 },
  { item: 'haradBlade', renown: 3 },
  { item: 'hornBow', renown: 4 },
];
