// The tasks given at Henneth Annûn. Pure data; systems/quests.js knows how to
// read the objectives and builds the errands. All text is our own writing.
//
// There are two sorts of task:
//   QUESTS   the told tasks, in two chains (Faramir's and Éowyn's), each given once.
//   ERRANDS  lesser work that never runs out: each giver has several kinds, and
//            offers them in turn, each a little bigger than the last.
//
// objective types:
//   clearCamp     { camp }              that particular camp is broken ('nearest' or a camp id)
//   clearCount    { count }             so many camps broken in all ('all' for every one)
//   clearWhere    { where, count }      so many broken among camps matching: 'stockade' | 'heather' | 'warcamp'
//   clearSince    { where, count, base } so many more broken (since the task was taken) among camps matching
//                                        'stockade' (stockades and war-camps) or 'province:<id>'
//   bands         { count, base }       so many bands beaten on the road since it was taken
//   discover      { ids }               all of these places found
//   discoverCount { set, count }        so many found among: 'ruins' | 'villages' | 'places'
//   seek          { set, count, base }  so many more found among a set: 'kind:<relic kind>' | 'farms' |
//                                        'villages' | 'province:<id>'
//                 (a `where` or `set` ending '@<province id>' counts only what lies in that province;
//                  'region:<name>' is still read for errands taken before there were provinces)
//   freed         { province }          that province freed: its hold and three in four of its camps
//   gather        { item, count }       so many carried (handed over on return)
//   gatherAll     { items, count }      so many of each carried (handed over on return)
//   all           { of: [...] }         every one of these
//
// `reward`: { silver, arrows, items, honour }. Honour is renown points (systems/renown.js).

export const QUESTS = [
  // ---- Faramir: the clearing of Ithilien ----
  {
    id: 'f1', giver: 'faramir', title: 'The nearest fire',
    offer: 'Those who fled the Black Gate did not all flee far. Orcs, and Men who served the Enemy, have gone to ground in our woods, each company round its own fire. Where they camp the land sickens: the light goes dim and grey about them, and nothing sings. Break a camp, down to the last of its company, and the land about it begins to mend; you will see it come back while you stand there.\n\nAnd there is one closer to this door than I like. A few stragglers, no more, hungry and frightened, but they will find the stair in time if they are let alone. Go softly and they will not see you until you choose. Put that fire out. Mablung will see you have arrows, and if it goes ill, come back here: they will not follow you to the falls.',
    remind: 'The nearest camp, ranger. It is marked on your map. Come back when it is cold for good.',
    done: 'Good. One fire the fewer, and the woods about our door are our own again. Take this; you will want it for the next.',
    objective: { type: 'clearCamp', camp: 'nearest' },
    reward: { silver: 15, items: { draught: 2 }, arrows: 10, honour: 20 },
  },
  {
    id: 'f2', giver: 'faramir', requires: ['f1'], title: 'The home woods',
    offer: 'Now the rest of the near country. Look about you, when you are out there: this was farmland once, the garden of Gondor, and you will find the walls and lanes of it yet under the trees. The Great River bounds us on the west and the Mountains of Shadow on the east, and the land climbs from the one to the other. Our stream runs down to Cormallen, where the King\u2019s host made merry. The farther you go from this window, toward the mountains or the Morgul road or the heath in the north, the more of them there are, and the worse they are led.\n\nFive camps broken, counting the one you have done, and a man might walk from here to Cormallen without looking over his shoulder.',
    remind: 'Five camps in all. Work outward from the falls.',
    done: 'Five. I walked out to one of them yesterday and there were flowers in the ash. Here: greaves, for the brambles as much as the orcs.',
    objective: { type: 'clearCount', count: 5 },
    reward: { silver: 25, items: { leatherGreaves: 1 }, honour: 30 },
  },
  {
    id: 'f14', giver: 'faramir', requires: ['f2'], title: 'The Window Woods',
    offer: 'Five camps is a beginning. But they are not leaderless out there, and that troubles me: stragglers should scatter, and these have not. In these woods, between the river and the road, whoever leads them keeps the strongest camp of all, ringed with stakes: their hold. Break it, and enough of the rest that they give the woods up for lost. Then the Window Woods are ours, from Cair Andros to the Harad Road.\n\nThe land is too wide to win all at once, so we shall win it a piece at a time: the Window Woods first, then the heath to the north, then the country beyond the road and southward. Your map shows where each begins and ends. And there are folk waiting on the far bank for word that these woods are safe to settle. I would not keep them waiting long.',
    remind: 'Free the Window Woods: break their hold, and three camps in four with it. Your pack will show you how it stands.',
    done: 'Then the Window Woods are free. I walked down to the river this morning and met no one but a fox. Take these; the north will be harder on you than you think.',
    objective: { type: 'freed', province: 'henneth' },
    reward: { silver: 35, items: { draught: 2 }, honour: 45 },
  },
  {
    id: 'f15', giver: 'faramir', requires: ['f14'], title: 'Smoke on the heath',
    offer: 'North of the woods the land opens out into heath, all the way to the fens. They camp there because they think no one goes so far. But a fire on open heath is seen for miles; you will not lack for marks. Free Forlad as you freed the Window Woods.',
    remind: 'Free Forlad, the North Plain: its hold, and three camps in four. Look for their smoke.',
    done: 'Forlad too. That is the whole of the north, and I can send word over the river that the land is safe to walk. Arrows, for the road east; you will need them.',
    objective: { type: 'freed', province: 'forlad' },
    reward: { silver: 40, arrows: 30, honour: 55 },
  },
  // (Since v0.6a the rest of his chain follows the provinces, in CAMPAIGN order.
  // The old standalone tasks are gone: "The stockade" (every hold is one now),
  // "Five captains", and the counts of fifteen, thirty and fifty fires, which the
  // bounty errand and the provinces' own freeing now cover. Their rewards moved
  // onto the provinces below, so the gear still comes at about the same renown.)
  {
    id: 'f3', giver: 'faramir', requires: ['f15'], title: 'The road under the mountains',
    offer: 'With the north quiet I can look east. Beyond our woods the old road runs south from the Black Gate, and beyond the road the heather stands higher than a man. Things hide in it, and things come down the road that I would know more of. Find the road, and break one camp on the far side of it. Keep to the ways between the bushes.',
    remind: 'Find the Harad Road, and break a camp in the heather beyond it.',
    done: 'So the heather can be won too. I was not sure of it. Arrows, and silver for Mablung’s table.',
    objective: { type: 'all', of: [{ type: 'discover', ids: ['haradroad'] }, { type: 'clearWhere', where: 'heather', count: 1 }] },
    reward: { silver: 30, arrows: 20, honour: 35 },
  },
  {
    id: 'f16', giver: 'faramir', requires: ['f3'], title: 'The gorse',
    offer: 'The heather north of the stream they call the Gorse Fells, and someone holds it: there is a stockade out there, in an old digging under the mountains, and its captain keeps the camps of the fells in good order. Too good. Free the Gorse Fells, captain and all, and bring me anything he carried that tells me who he answers to.',
    remind: 'Free the Gorse Fells: break their hold, a stockade in the heather, and three camps in four with it.',
    done: 'The fells are free. He carried nothing written, but his company all wore the same mark, and it is not the Eye. Someone new is gathering them. This came up from Pelargir with the last of the ships; it is broad in the blade, and will not break on Uruk iron.',
    objective: { type: 'freed', province: 'gorse' },
    reward: { silver: 45, items: { falchion: 1 }, honour: 60 },
  },
  {
    id: 'f9', giver: 'faramir', requires: ['f3'], title: 'What the bands carry',
    offer: 'They still come down the Harad Road in bands, out of the north, as if the Gate were open and someone waited for them at the end of it. I would know who. Meet three such bands on the road and break them, and look at what they carry. Leave the great hosts alone; that is work for the King’s army.',
    remind: 'Three bands on the Harad Road. Wait by it, and let them come to you.',
    done: 'Three! And orders on one of them: they are bound for the Old Bridge, to gather there. Now we know where to look. Arrows; you will have spent yours.',
    objective: { type: 'bands', count: 3, base: 0 },
    reward: { silver: 40, arrows: 30, honour: 50 },
  },
  {
    id: 'f17', giver: 'faramir', requires: ['f16'], title: 'The Old Bridge',
    offer: 'South of us the woods run down to the Old Bridge, where the road from the river crossed the stream. They are gathering there, and the King’s builders will want that crossing. Free the Bridgelands. Their hold is a stockade by the road; it will be the hardest fight you have had.',
    remind: 'Free the Bridgelands: break their hold, and three camps in four.',
    done: 'The bridge is ours, and the builders cross tomorrow. And they found this in the captain’s gear: a map, with the Cross-roads marked on it. The White Company wears this mail; so shall you.',
    objective: { type: 'freed', province: 'bridgelands' },
    reward: { silver: 60, items: { whiteCompanyMail: 1 }, honour: 80 },
  },
  {
    id: 'f5', giver: 'faramir', requires: ['f17'], title: 'The Cross-roads',
    offer: 'Far to the south the four roads meet in a ring of great trees, and the old king sits there in stone. The map from the bridge marks it. The King’s men set his head back on his shoulders in the spring. Go and see whether he keeps it, and who else is there.',
    remind: 'South, a long way, where the road from the river crosses the road from the Gate.',
    done: 'Still crowned with flowers? Then some things mend that I never looked to see mended. Thank you for the long walk.',
    objective: { type: 'discover', ids: ['crossroads'] },
    reward: { silver: 40, items: { draught: 3 }, honour: 40 },
  },
  {
    id: 'f6', giver: 'faramir', requires: ['f5'], title: 'The broken city',
    offer: 'One more long road. Follow the highway west from the Cross-roads to the river, and look on Osgiliath from the eastern shore. I was born to defend it. I would know how it stands.',
    remind: 'Osgiliath: west along the southern road until you come to the river.',
    done: 'Broken, but not dead. We shall build it again, and I think you will carry stone for it. Until then, wear this; it was made in the city before it fell.',
    objective: { type: 'discover', ids: ['osgiliath'] },
    reward: { silver: 50, items: { gondorHelm: 1 }, honour: 60 },
  },
  {
    id: 'f18', giver: 'faramir', requires: ['f17'], title: 'The Moonwood',
    offer: 'Past the Old Bridge the woods grow old and dark: Eryn Ithil, the Moonwood. There are more stockades there than anywhere north of the road, and they are better led. Free it. Take your time, and come home to mend between.',
    remind: 'Free Eryn Ithil, the Moonwood: its hold, and three camps in four.',
    done: 'The Moonwood is free. I had a bow made for the day someone could tell me that. It is yours.',
    objective: { type: 'freed', province: 'ithil' },
    reward: { silver: 70, items: { greatBow: 1 }, honour: 100 },
  },
  {
    id: 'f19', giver: 'faramir', requires: ['f18'], title: 'The Southwood',
    offer: 'Then the Southwood, between the Moonwood and the road. That is where the war-camps are, and whoever gathers the remnants has put his strongest there. Free it.',
    remind: 'Free the Southwood: its hold, and three camps in four.',
    done: 'The Southwood too. The first carts of settlers came over the river this morning; they will go no further south than you have made safe. Take these; the Houses of Healing sent them for whoever needed them most.',
    objective: { type: 'freed', province: 'southwood' },
    reward: { silver: 100, items: { salve: 2 }, honour: 110 },
  },
  {
    id: 'f11', giver: 'faramir', requires: ['f19'], title: 'The war-camps',
    offer: 'There remain the war-camps: great stockades with more captains than one and the heaviest of the Uruks. They are his lieutenants, whoever he is. There are three. Break them all.',
    remind: 'The three war-camps, in the deep south. Go mended, and go with a full quiver.',
    done: 'All three. There is nothing left in Ithilien that can call itself an army. This sword was made in Anórien for a captain who did not come home. He would be glad of you.',
    objective: { type: 'clearWhere', where: 'warcamp', count: 'all' },
    reward: { silver: 120, items: { anorianSword: 1 }, honour: 120 },
  },
  {
    id: 'f20', giver: 'faramir', requires: ['f11'], title: 'The Ash Fells',
    offer: 'The heather under the mountains, south of the gorse, has gone grey with them: the Ash Fells. Their captains keep the strongest holds of all there, in the old diggings. Free them.',
    remind: 'Free the Ash Fells: their hold, and three camps in four.',
    done: 'The fells are free, all of them. Here, for the road south.',
    objective: { type: 'freed', province: 'ash' },
    reward: { silver: 150, items: { salve: 3 }, honour: 140 },
  },
  {
    id: 'f21', giver: 'faramir', requires: ['f20'], title: 'The mouth of the Vale',
    offer: 'Only the Morgul Marches are left: the strip along the southern road, from Osgiliath to the mouth of the Vale. Whoever has been gathering them is there, at the last. Free the Marches. The Vale itself is not ours to enter; do not go in.',
    remind: 'Free the Morgul Marches: their hold, and three camps in four. Do not enter the Vale.',
    done: 'Then he is gone, whoever he was, and his name with him. Every province of Ithilien is free. I did not think to say so in my lifetime.',
    objective: { type: 'freed', province: 'morgul' },
    reward: { silver: 150, items: { salve: 2 }, honour: 160 },
  },
  {
    id: 'f8', giver: 'faramir', requires: ['f21'], title: 'The garden of Gondor',
    offer: 'There is only one task left, and it is the last of them all. Every fire, ranger, the whole hundred, from the fens to the Morgul road; the stragglers in the freed lands too. I do not set a day for it.',
    remind: 'Every camp. Take the time it takes. Ask to see my map if you are at a loss; the scouts bring me word of more than you have found.',
    done: 'It is done, then. The King has sent these, for the one who did it. Go and look at the land, ranger. Walk it slowly. You have earned the sight of it more than any of us.',
    objective: { type: 'clearCount', count: 'all' },
    reward: { silver: 300, items: { kingsMail: 1, kingsGift: 1 }, honour: 300 },
  },

  // ---- Éowyn: the old land, and the gardens ----
  {
    id: 'e1', giver: 'eowyn', title: 'Kingsfoil', picture: 'kingsfoil',
    offer: 'Everything grows here, once it is let alone: thyme and sage underfoot, bay and olive, and flowers I have no names for yet. Where the Enemy\u2019s folk have camped the land goes grey and sour, but it does not stay so; drive them off and in a little while you can watch the colour come back. I think that is the best thing I have seen since the war.\n\nWill you gather for me? There is a leaf the old wives of Gondor call kingsfoil: low, plain, white-flowered, sweet when it is crushed. Here, I have drawn it for you: a rosette of long leaves and a few white stars above. It likes the edges of glades, and in the shade it has a pale glimmer about it that no other flower has. Bring me five plants and I will show you what the Houses of Healing taught me.',
    remind: 'Five plants of kingsfoil. Look in the glades, where the light gets in.',
    done: 'These are good. Smell that! Here, take these draughts; and bring me more whenever you find it. Two plants make one draught, if I do the steeping.',
    objective: { type: 'gather', item: 'athelas', count: 5 },
    reward: { items: { draught: 3 }, honour: 15 },
  },
  {
    id: 'e2', giver: 'eowyn', title: 'The old places',
    offer: 'Faramir will tell you where to fight. I will tell you to come home afterward, and to look about you on the way. I am making a map of what Ithilien was. Not the camps; Faramir has that map, and welcome to it. The old things: arches, shrines, standing stones, whatever was built here before the Shadow. They lie in every quarter of the land, and the old roads ran between them; the rangers still know those ways, and once you have found a place you can come and go by them. Find me four.',
    remind: 'Four of the old places. The old paths lead to most of them, if you can keep to a path.',
    done: 'Four! Sit, and tell me each one. … I shall draw them in tonight. This is for your trouble, and for the telling.',
    objective: { type: 'discoverCount', set: 'ruins', count: 4 },
    reward: { silver: 20, items: { waybread: 4 }, honour: 20 },
  },
  {
    id: 'e3', giver: 'eowyn', requires: ['e2'], title: 'A village in the trees',
    offer: 'There were villages here. I have found their names in a book of Faramir’s and not one of them on the ground. There are families waiting across the River, ranger, who have lost their own homes to the war, and when the Window Woods are safe they will cross at Cair Andros. I would have somewhere ready for them to go. The book puts a village in these woods, between the landing and the falls, on the old way south. Find it for me, even if it is dead.',
    remind: 'The village of the Window Woods: houses in a ring, a well, a broken cross, somewhere between Cair Andros and the falls. The lanes of great beeches lead to it.',
    done: 'A well, and a market cross? Then people will live there again; I mean to see to it. When Faramir has the woods quiet, that is where they shall go. Thank you.',
    objective: { type: 'seek', set: 'villages@henneth', count: 1, base: 0 },
    reward: { silver: 30, items: { draught: 2 }, honour: 25 },
  },
  {
    id: 'e5', giver: 'eowyn', requires: ['e3'], title: 'Seed for the gardens', picture: 'seeds',
    offer: 'When the settlers come they will want more than walls. I mean to have seed ready for them: thyme from the open glades, bay from the woods, poppies from the old fields, and olives from the south, where the trees have run wild. Two of each, to begin. They have a little gold glimmer about them when they are ripe.',
    remind: 'Two each of thyme seed, bay berries, poppy heads and olive stones.',
    done: 'All four! I shall start them in pots by the fall, where the spray keeps them damp. Here, for your trouble.',
    objective: { type: 'gatherAll', items: ['thymeSeed', 'baySeed', 'poppySeed', 'oliveStone'], count: 2 },
    reward: { silver: 40, items: { salve: 1 }, honour: 50 },
  },
  {
    id: 'e4', giver: 'eowyn', requires: ['e3'], title: 'The map of old Ithilien',
    offer: 'My map has more empty vellum than ink. Ten of the old places, and I will call it a map and not a hope.',
    remind: 'Ten of the old places in all.',
    done: 'Ten. Look: it is a country now, not a wilderness with names. My brother’s smith made this for me when I rode to war. I would rather it went on riding.',
    objective: { type: 'discoverCount', set: 'ruins', count: 10 },
    reward: { silver: 50, items: { riddermarkSword: 1 }, honour: 60 },
  },
  {
    id: 'e6', giver: 'eowyn', requires: ['e5'], title: 'Every village',
    offer: 'I have the names of every village that stood in North Ithilien. I want to set each name on the ground again. Find them all for me.',
    remind: 'Every ruined village in the land. Look for the lanes of great beeches.',
    done: 'All of them. Every one has a name again, and some of them will have people by the autumn. This bow came from Lebennin with the settlers; they asked me to give it to whoever had found their new homes.',
    objective: { type: 'discoverCount', set: 'villages', count: 'all' },
    reward: { silver: 60, items: { yewBow: 1 }, honour: 80 },
  },
  {
    id: 'e7', giver: 'eowyn', requires: ['e4'], title: 'Twenty old places',
    offer: 'Twenty, now. There are corners of the map I have only guessed at.',
    remind: 'Twenty of the old places in all.',
    done: 'Twenty. I could walk it in my sleep now, I think, and dream of it besides. Take these, and come home whole.',
    objective: { type: 'discoverCount', set: 'ruins', count: 20 },
    reward: { silver: 80, items: { salve: 2 }, honour: 90 },
  },
  {
    id: 'e8', giver: 'eowyn', requires: ['e7'], title: 'The whole of it',
    offer: 'Every old place, ranger, every stone. Then the map is done and I can send it to the King, and he will know what he has been given.',
    remind: 'Every one of the old places.',
    done: 'Every one. The map goes to the City tomorrow. And this came the other way, from a lady who passed through Minas Tirith in the spring and asked after the rangers. She said you would know what to do with it.',
    objective: { type: 'discoverCount', set: 'ruins', count: 'all' },
    reward: { silver: 100, items: { galadhrimBow: 1 }, honour: 200 },
  },
];

/** Who carries each trophy, for Faramir to say when asked. */
export const TROPHY_HINTS = {
  orcBlade: 'Any orc carries one, and most of them break.',
  redEye: 'Only the Uruks wear the Eye, and their captains. You will find more of them in the south.',
  arrowheads: 'Only the archers in the bands coming down the road still carry the blackened arrowheads. Wait by the Harad Road.',
  captainToken: 'Every captain has one: in the stockades, the war-camps, and at the head of the great hosts on the road.',
};

/**
 * Errands: lesser work that never runs out. Each giver works through `kinds` in
 * turn; systems/quests.js fills in the particulars and the count from the
 * ranger's progress, and skips a kind that cannot be done.
 */
export const ERRANDS = {
  faramir: {
    // (since v0.6 the old 'region' errand, "break 1 camp in X", is gone: it read
    // oddly beside Faramir's own call to free the whole province. A bounty on
    // every five to ten camps broken takes its place.)
    kinds: ['bounty', 'trophy', 'scouted', 'bands', 'trophy', 'captain'],
    // (only trophies: they are found only while he has asked for them; coin and trinkets are plain loot, for selling)
    trophies: [['orcBlade', 3], ['redEye', 2], ['arrowheads', 3], ['captainToken', 1]],
    gifts: ['leatherCap', 'guardSword', 'ironGreaves', 'citadelGreaves', 'citadelHelm'],
    text: {
      trophy: (p) => ({
        title: `${p.itemName} for the count`,
        offer: `They are better kept than stragglers have any right to be: fed, and armed, and held together. Someone is seeing to it, and I would know who. What they carry tells me where it comes from, and how many hands it passes through. Bring me ${p.count} ${p.itemName.toLowerCase()}. ${p.hint}`,
        remind: `${p.count} ${p.itemName.toLowerCase()}, for the count.`,
        done: 'Good. Into the tally with them, and then the forge. Mablung and I will sit up over these tonight. Here.',
      }),
      bounty: (p) => ({
        title: `A bounty on ${p.count} fires`,
        offer: `The Steward\u2019s treasury has sent us silver for the work, and I would rather it went to the one doing it. For every ${p.count} camps you break, wherever they lie, there is a purse waiting here. Break ${p.count} more and come and claim it.`,
        remind: `${p.count} more camps broken, anywhere, for the bounty.`,
        done: `${p.count} more fires out. Here is the purse, and there will be another for the next ${p.count}.`,
      }),
      bands: (p) => ({
        title: 'Watch on the road',
        offer: `Another band has been seen on the Harad Road, and where there is one there are more. Meet ${p.count === 1 ? 'one' : p.count} on the road and break ${p.count === 1 ? 'it' : 'them'}.`,
        remind: `${p.count} band${p.count > 1 ? 's' : ''} broken on the Harad Road.`,
        done: 'The road is ours again, for a while. Take this.',
      }),
      scouted: (p) => ({
        title: 'A scout’s report',
        offer: `A scout came in last night with word of a camp ${p.where}. They moved in lately, she says, and in good order, as if they had been sent. I have marked it on your map. See to it, and look about you for anything that says who sent them.`,
        remind: `The camp ${p.where}. It is marked on your map.`,
        done: 'Good. I shall tell the scout; she will be glad she came back to report it.',
      }),
      captain: (p) => ({
        title: 'Another captain',
        offer: `There is a captain still holding a stockade together in ${p.where}, and while he stands the camps about him take heart. Break it, and him.`,
        remind: `A stockade or a war-camp in ${p.where} broken, captain and all.`,
        done: 'One captain fewer. Well done.',
      }),
    },
  },
  eowyn: {
    kinds: ['seeds', 'kind', 'kingsfoil', 'area', 'seeds', 'site'],
    seeds: ['thymeSeed', 'baySeed', 'poppySeed', 'oliveStone'],
    gifts: ['gambeson', 'ashBow', 'hornBow', 'blackMail'],
    seedHints: {
      thymeSeed: 'Thyme likes the open glades of the north, where the sun gets to the ground.',
      baySeed: 'The bay grows in the woods proper, neither the open glades nor the darkest of it.',
      poppySeed: 'Poppies come up where the old fields were: look about the ruined farms and villages.',
      oliveStone: 'The wild olives are all in the south, past the Old Bridge and on toward the road.',
    },
    text: {
      seeds: (p) => ({
        title: `${p.itemName} for the gardens`,
        offer: `I want more ${p.itemName.toLowerCase()}. ${p.count} of them, if you can. ${p.hint}`,
        remind: `${p.count} ${p.itemName.toLowerCase()}. ${p.hint}`,
        done: 'Lovely. They go in tomorrow, in the bed under the south wall. Here.',
      }),
      kingsfoil: (p) => ({
        title: 'More kingsfoil',
        offer: `The draughts go quicker than I can make them. Bring me ${p.count} plants of kingsfoil.`,
        remind: `${p.count} plants of kingsfoil.`,
        done: 'Thank you. Here are draughts from the last lot; these will make the next.',
      }),
      kind: (p) => ({
        title: p.title,
        offer: `I have read of ${p.kindPlural} in Ithilien, and there should be one in ${p.where} that is not yet on my map. Find it for me.`,
        remind: `One of the ${p.kindPlural}, in ${p.where}, not yet on my map.`,
        done: 'Another for the map! Tell me how it lies. … Thank you.',
      }),
      area: (p) => ({
        title: `Old places in ${p.region.replace(/^The /, 'the ')}`,
        offer: `My map is thin in ${p.region.replace(/^The /, 'the ')}. Find me ${p.count === 1 ? 'one old place' : p.count + ' old places'} there that I do not have.`,
        remind: `${p.count === 1 ? 'An old place' : p.count + ' old places'} in ${p.region.replace(/^The /, 'the ')}, not yet on my map.`,
        done: 'Good. I shall draw them in tonight.',
      }),
      site: (p) => ({
        title: p.kind === 'hamlet' ? 'A lost village' : 'An old farmstead',
        offer: p.kind === 'hamlet' ? `There is another village I have a name for and no place. It should lie somewhere in ${p.where}. Find it for me.` : `I want to know where the farms were in ${p.where}, so the settlers know where the good land is. Find me an old farmstead I have not got.`,
        remind: p.kind === 'hamlet' ? `Another ruined village, in ${p.where}.` : `Another old farmstead, in ${p.where}.`,
        done: 'Thank you. It goes on the map, and in the book for the settlers.',
      }),
    },
  },
};
