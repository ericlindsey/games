// The tasks given at Henneth Annûn. Pure data; systems/quests.js knows how to
// read the objectives. All text is our own writing.
//
// objective types:
//   clearCamp     { camp }              that particular camp is broken
//   clearCount    { count }             so many camps broken in all
//   clearWhere    { where, count }      so many broken among camps matching: 'stockade' | 'heather'
//   discover      { ids }               all of these places found
//   discoverCount { set, count }        so many found among: 'ruins' | 'villages'
//   gather        { item, count }       so many carried (handed over on return)

export const QUESTS = [
  {
    id: 'f1', giver: 'faramir', title: 'The nearest fire',
    offer: 'There is a camp closer to this door than I like. A few stragglers, no more, but they will find the stair in time if they are let alone. Go and put that fire out. Mablung will see you have arrows.',
    remind: 'The nearest camp, ranger. It is marked on your map. Come back when it is cold for good.',
    done: 'Good. One fire the fewer, and the woods about our door are our own again. Take this; you will want it for the next.',
    objective: { type: 'clearCamp', camp: 'nearest' },
    reward: { silver: 30, items: { draught: 2 }, arrows: 12, renown: 1 },
  },
  {
    id: 'f2', giver: 'faramir', requires: ['f1'], title: 'The home woods',
    offer: 'Now the rest of the near country. Five camps broken, counting the one you have done, and a man might walk from here to Cormallen without looking over his shoulder.',
    remind: 'Five camps in all. Work outward from the falls.',
    done: 'Five. I walked out to one of them yesterday and there were flowers in the ash. Here is something to turn a blade; the next ones will bite harder.',
    objective: { type: 'clearCount', count: 5 },
    reward: { silver: 50, items: { mailShirt: 1 }, renown: 1 },
  },
  {
    id: 'f3', giver: 'faramir', requires: ['f2'], title: 'The road under the mountains',
    offer: 'East of us the old road runs south from the Black Gate. Beyond it the heather stands higher than a man, and things hide in it. Find the road, and break one camp on the far side. Keep to the ways between the bushes.',
    remind: 'Find the Harad Road, and break a camp in the heather beyond it.',
    done: 'So the heather can be won too. I was not sure of it. Arrows, and silver for Mablung’s table.',
    objective: { type: 'all', of: [{ type: 'discover', ids: ['haradroad'] }, { type: 'clearWhere', where: 'heather', count: 1 }] },
    reward: { silver: 70, arrows: 30, renown: 1 },
  },
  {
    id: 'f4', giver: 'faramir', requires: ['f2'], title: 'The stockade',
    offer: 'Some of them have done more than light a fire. Our scouts have seen camps ringed with sharpened stakes, and a captain in each who keeps the others from running. Break one such, captain and all.',
    remind: 'A camp with a stockade and a captain. They lie well out from here. Go armed, and go mended.',
    done: 'A captain down. The rest will hear of it, and sleep the worse. This was my brother’s gift to the company, to be given for a deed like that. It is yours.',
    objective: { type: 'clearWhere', where: 'stockade', count: 1 },
    reward: { silver: 60, items: { gondorBlade: 1 }, renown: 2 },
  },
  {
    id: 'f5', giver: 'faramir', requires: ['f3'], title: 'The Cross-roads',
    offer: 'Far to the south the four roads meet in a ring of great trees, and the old king sits there in stone. The King’s men set his head back on his shoulders in the spring. Go and see whether he keeps it.',
    remind: 'South, a long way, where the road from the river crosses the road from the Gate.',
    done: 'Still crowned with flowers? Then some things mend that I never looked to see mended. Thank you for the long walk.',
    objective: { type: 'discover', ids: ['crossroads'] },
    reward: { silver: 90, items: { draught: 3 }, renown: 1 },
  },
  {
    id: 'f6', giver: 'faramir', requires: ['f5'], title: 'The broken city',
    offer: 'One more long road. Follow the highway west from the Cross-roads to the river, and look on Osgiliath from the eastern shore. I was born to defend it. I would know how it stands.',
    remind: 'Osgiliath: west along the southern road until you come to the river.',
    done: 'Broken, but not dead. We shall build it again, and I think you will carry stone for it. Until then, carry this.',
    objective: { type: 'discover', ids: ['osgiliath'] },
    reward: { silver: 60, items: { greatBow: 1 }, renown: 2 },
  },
  {
    id: 'f7', giver: 'faramir', requires: ['f4'], title: 'Thirty fires out',
    offer: 'Thirty camps broken, and I will write to the King that North Ithilien may be planted this year.',
    remind: 'Thirty in all. The map will show you what you have done.',
    done: 'Thirty! Then the letter goes south tonight. The White Company wears this; so shall you.',
    objective: { type: 'clearCount', count: 30 },
    reward: { silver: 150, items: { ithilienMail: 1 }, renown: 2 },
  },
  {
    id: 'f8', giver: 'faramir', requires: ['f7'], title: 'The garden of Gondor',
    offer: 'There is only one task left, and it is all of them. Every fire, ranger, from the fens to the Morgul road. I do not set a day for it.',
    remind: 'Every camp. Take the time it takes.',
    done: 'It is done, then. I did not think to say so in my lifetime. Go and look at the land, ranger. Walk it slowly. You have earned the sight of it more than any of us.',
    objective: { type: 'clearCount', count: 'all' },
    reward: { silver: 500, renown: 5 },
  },

  {
    id: 'e1', giver: 'eowyn', title: 'Kingsfoil',
    offer: 'Will you gather for me? There is a leaf the old wives of Gondor call kingsfoil: low, plain, white-flowered, sweet when it is crushed. It likes the edges of glades. Bring me five plants and I will show you what the Houses of Healing taught me.',
    remind: 'Five plants of kingsfoil. Look in the glades, where the light gets in.',
    done: 'These are good. Smell that! Here, take these draughts; and bring me more whenever you find it. Two plants make one draught, if I do the steeping.',
    objective: { type: 'gather', item: 'athelas', count: 5 },
    reward: { items: { draught: 3 }, renown: 1 },
  },
  {
    id: 'e2', giver: 'eowyn', title: 'The old places',
    offer: 'I am making a map of what Ithilien was. Not the camps; Faramir has that map, and welcome to it. The old things: arches, shrines, standing stones, whatever was built here before the Shadow. Find me four of them.',
    remind: 'Four of the old places. The old paths lead to most of them, if you can keep to a path.',
    done: 'Four! Sit, and tell me each one. … I shall draw them in tonight. This is for your trouble, and for the telling.',
    objective: { type: 'discoverCount', set: 'ruins', count: 4 },
    reward: { silver: 40, items: { waybread: 4 }, renown: 1 },
  },
  {
    id: 'e3', giver: 'eowyn', requires: ['e2'], title: 'A village in the trees',
    offer: 'There were villages here. I have found their names in a book of Faramir’s and not one of them on the ground. Find me a village, ranger, even a dead one.',
    remind: 'A ruined village: houses in a ring, a well, a broken cross. The lanes of great beeches lead to them.',
    done: 'A well, and a market cross? Then people will live there again; I mean to see to it. Thank you.',
    objective: { type: 'discoverCount', set: 'villages', count: 1 },
    reward: { silver: 60, items: { draught: 2 }, renown: 1 },
  },
  {
    id: 'e4', giver: 'eowyn', requires: ['e3'], title: 'The map of old Ithilien',
    offer: 'My map has more empty vellum than ink. Fifteen of the old places, and I will call it a map and not a hope.',
    remind: 'Fifteen of the old places in all.',
    done: 'Fifteen. Look: it is a country now, not a wilderness with names. I had this made for the one who filled it in.',
    objective: { type: 'discoverCount', set: 'ruins', count: 15 },
    reward: { silver: 160, items: { hornBow: 1, draught: 4 }, renown: 2 },
  },
];
