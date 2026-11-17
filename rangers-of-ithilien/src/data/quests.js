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
//                                        'stockade' (stockades and war-camps) or a region name
//   bands         { count, base }       so many bands beaten on the road since it was taken
//   discover      { ids }               all of these places found
//   discoverCount { set, count }        so many found among: 'ruins' | 'villages' | 'places'
//   seek          { set, count, base }  so many more found among a set: 'kind:<relic kind>' | 'farms' |
//                                        'villages' | 'region:<region name>'
//   gather        { item, count }       so many carried (handed over on return)
//   gatherAll     { items, count }      so many of each carried (handed over on return)
//   all           { of: [...] }         every one of these
//
// `reward`: { silver, arrows, items, honour }. Honour is renown points (systems/renown.js).

export const QUESTS = [
  // ---- Faramir: the clearing of Ithilien ----
  {
    id: 'f1', giver: 'faramir', title: 'The nearest fire',
    offer: 'There is a camp closer to this door than I like. A few stragglers, no more, but they will find the stair in time if they are let alone. Go and put that fire out. Mablung will see you have arrows.',
    remind: 'The nearest camp, ranger. It is marked on your map. Come back when it is cold for good.',
    done: 'Good. One fire the fewer, and the woods about our door are our own again. Take this; you will want it for the next.',
    objective: { type: 'clearCamp', camp: 'nearest' },
    reward: { silver: 15, items: { draught: 2 }, arrows: 10, honour: 20 },
  },
  {
    id: 'f2', giver: 'faramir', requires: ['f1'], title: 'The home woods',
    offer: 'Now the rest of the near country. Five camps broken, counting the one you have done, and a man might walk from here to Cormallen without looking over his shoulder.',
    remind: 'Five camps in all. Work outward from the falls.',
    done: 'Five. I walked out to one of them yesterday and there were flowers in the ash. Here: greaves, for the brambles as much as the orcs.',
    objective: { type: 'clearCount', count: 5 },
    reward: { silver: 25, items: { leatherGreaves: 1 }, honour: 30 },
  },
  {
    id: 'f3', giver: 'faramir', requires: ['f2'], title: 'The road under the mountains',
    offer: 'East of us the old road runs south from the Black Gate. Beyond it the heather stands higher than a man, and things hide in it. Find the road, and break one camp on the far side. Keep to the ways between the bushes.',
    remind: 'Find the Harad Road, and break a camp in the heather beyond it.',
    done: 'So the heather can be won too. I was not sure of it. Arrows, and silver for Mablung’s table.',
    objective: { type: 'all', of: [{ type: 'discover', ids: ['haradroad'] }, { type: 'clearWhere', where: 'heather', count: 1 }] },
    reward: { silver: 30, arrows: 20, honour: 35 },
  },
  {
    id: 'f4', giver: 'faramir', requires: ['f2'], title: 'The stockade',
    offer: 'Some of them have done more than light a fire. Our scouts have seen camps ringed with sharpened stakes, and a captain in each who keeps the others from running. Break one such, captain and all.',
    remind: 'A camp with a stockade and a captain. They lie well out from here. Go armed, and go mended.',
    done: 'A captain down. The rest will hear of it, and sleep the worse. This came up from Pelargir with the last of the ships. It is broad in the blade; it will not break on Uruk iron.',
    objective: { type: 'clearWhere', where: 'stockade', count: 1 },
    reward: { silver: 40, items: { falchion: 1 }, honour: 50 },
  },
  {
    id: 'f9', giver: 'faramir', requires: ['f3'], title: 'The road bands',
    offer: 'They still come down the Harad Road in bands, out of the north, as if the Gate were open and someone waited for them at the end of it. Meet three such bands on the road and break them. Leave the great hosts alone; that is work for the King’s army.',
    remind: 'Three bands on the Harad Road. Wait by it, and let them come to you.',
    done: 'Three! The road will be quieter for a while. Arrows; you will have spent yours.',
    objective: { type: 'bands', count: 3, base: 0 },
    reward: { silver: 40, arrows: 30, honour: 50 },
  },
  {
    id: 'f5', giver: 'faramir', requires: ['f3'], title: 'The Cross-roads',
    offer: 'Far to the south the four roads meet in a ring of great trees, and the old king sits there in stone. The King’s men set his head back on his shoulders in the spring. Go and see whether he keeps it.',
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
    id: 'f7', giver: 'faramir', requires: ['f4'], title: 'Thirty fires out',
    offer: 'Thirty camps broken, and I will write to the King that North Ithilien may be planted this year.',
    remind: 'Thirty in all. The map will show you what you have done.',
    done: 'Thirty! Then the letter goes south tonight. The White Company wears this; so shall you.',
    objective: { type: 'clearCount', count: 30 },
    reward: { silver: 60, items: { whiteCompanyMail: 1 }, honour: 80 },
  },
  {
    id: 'f10', giver: 'faramir', requires: ['f4'], title: 'Five captains',
    offer: 'Each stockade has a captain, and each captain has a name among them. Five more, ranger, and they will have no one left who can hold a company together.',
    remind: 'Five stockades or war-camps broken, captains and all.',
    done: 'Five captains. I had a bow made for the day someone could tell me that. It is yours.',
    objective: { type: 'clearWhere', where: 'stockade', count: 5 },
    reward: { silver: 60, items: { greatBow: 1 }, honour: 90 },
  },
  {
    id: 'f12', giver: 'faramir', requires: ['f7'], title: 'Sixty fires out',
    offer: 'Sixty. I do not ask it lightly. The settlers will come at midsummer, and I would have the woods they walk in be quiet ones.',
    remind: 'Sixty camps broken in all.',
    done: 'Sixty. The first carts came over the river this morning. Take these; the Houses of Healing sent them for whoever needed them most.',
    objective: { type: 'clearCount', count: 60 },
    reward: { silver: 100, items: { salve: 2 }, honour: 100 },
  },
  {
    id: 'f11', giver: 'faramir', requires: ['f10'], title: 'The war-camps',
    offer: 'There remain the war-camps: great stockades in the south, with more captains than one and the heaviest of the Uruks. There are three. Break them all.',
    remind: 'The three war-camps, in the deep south. Go mended, and go with a full quiver.',
    done: 'All three. There is nothing left in Ithilien that can call itself an army. This sword was made in Anórien for a captain who did not come home. He would be glad of you.',
    objective: { type: 'clearWhere', where: 'warcamp', count: 'all' },
    reward: { silver: 120, items: { anorianSword: 1 }, honour: 120 },
  },
  {
    id: 'f13', giver: 'faramir', requires: ['f12'], title: 'A hundred fires',
    offer: 'A hundred camps. When I say it aloud it sounds like boasting. It will not be, once it is done.',
    remind: 'A hundred camps broken in all.',
    done: 'A hundred. I have stopped counting the ones that are left; you will count them for me. Here, for the road.',
    objective: { type: 'clearCount', count: 100 },
    reward: { silver: 150, items: { salve: 3 }, honour: 140 },
  },
  {
    id: 'f8', giver: 'faramir', requires: ['f13', 'f11'], title: 'The garden of Gondor',
    offer: 'There is only one task left, and it is all of them. Every fire, ranger, from the fens to the Morgul road. I do not set a day for it.',
    remind: 'Every camp. Take the time it takes. Ask to see my map if you are at a loss; the scouts bring me word of more than you have found.',
    done: 'It is done, then. I did not think to say so in my lifetime. The King has sent these, for the one who did it. Go and look at the land, ranger. Walk it slowly. You have earned the sight of it more than any of us.',
    objective: { type: 'clearCount', count: 'all' },
    reward: { silver: 300, items: { kingsMail: 1, kingsGift: 1 }, honour: 300 },
  },

  // ---- Éowyn: the old land, and the gardens ----
  {
    id: 'e1', giver: 'eowyn', title: 'Kingsfoil', picture: 'kingsfoil',
    offer: 'Will you gather for me? There is a leaf the old wives of Gondor call kingsfoil: low, plain, white-flowered, sweet when it is crushed. Here, I have drawn it for you: a rosette of long leaves and a few white stars above. It likes the edges of glades, and in the shade it has a pale glimmer about it that no other flower has. Bring me five plants and I will show you what the Houses of Healing taught me.',
    remind: 'Five plants of kingsfoil. Look in the glades, where the light gets in.',
    done: 'These are good. Smell that! Here, take these draughts; and bring me more whenever you find it. Two plants make one draught, if I do the steeping.',
    objective: { type: 'gather', item: 'athelas', count: 5 },
    reward: { items: { draught: 3 }, honour: 15 },
  },
  {
    id: 'e2', giver: 'eowyn', title: 'The old places',
    offer: 'I am making a map of what Ithilien was. Not the camps; Faramir has that map, and welcome to it. The old things: arches, shrines, standing stones, whatever was built here before the Shadow. They lie in every quarter of the land, and the old roads ran between them; the rangers still know those ways, and once you have found a place you can come and go by them. Find me four.',
    remind: 'Four of the old places. The old paths lead to most of them, if you can keep to a path.',
    done: 'Four! Sit, and tell me each one. … I shall draw them in tonight. This is for your trouble, and for the telling.',
    objective: { type: 'discoverCount', set: 'ruins', count: 4 },
    reward: { silver: 20, items: { waybread: 4 }, honour: 20 },
  },
  {
    id: 'e3', giver: 'eowyn', requires: ['e2'], title: 'A village in the trees',
    offer: 'There were villages here. I have found their names in a book of Faramir’s and not one of them on the ground. Find me a village, ranger, even a dead one.',
    remind: 'A ruined village: houses in a ring, a well, a broken cross. The lanes of great beeches lead to them.',
    done: 'A well, and a market cross? Then people will live there again; I mean to see to it. Thank you.',
    objective: { type: 'discoverCount', set: 'villages', count: 1 },
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
    offer: 'My map has more empty vellum than ink. Fifteen of the old places, and I will call it a map and not a hope.',
    remind: 'Fifteen of the old places in all.',
    done: 'Fifteen. Look: it is a country now, not a wilderness with names. My brother’s smith made this for me when I rode to war. I would rather it went on riding.',
    objective: { type: 'discoverCount', set: 'ruins', count: 15 },
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
    id: 'e7', giver: 'eowyn', requires: ['e4'], title: 'Thirty old places',
    offer: 'Thirty, now. There are corners of the map I have only guessed at.',
    remind: 'Thirty of the old places in all.',
    done: 'Thirty. I could walk it in my sleep now, I think, and dream of it besides. Take these, and come home whole.',
    objective: { type: 'discoverCount', set: 'ruins', count: 30 },
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
  orcTrinket: 'They hoard rubbish, all of them. Look in what they drop and in their stores.',
  redEye: 'Only the Uruks wear the Eye, and their captains. You will find more of them in the south.',
  blackCoin: 'Every company carries a little of it. The bigger camps have more.',
  arrowheads: 'Only the archers in the bands coming down the road still carry the blackened arrowheads. Wait by the Harad Road.',
  captainToken: 'Every captain has one: in the stockades, the war-camps, and at the head of the great hosts on the road.',
  haradGold: 'The Southrons wear it, in the heather and the south. And the captains keep some in their stores.',
};

/**
 * Errands: lesser work that never runs out. Each giver works through `kinds` in
 * turn; systems/quests.js fills in the particulars and the count from the
 * ranger's progress, and skips a kind that cannot be done.
 */
export const ERRANDS = {
  faramir: {
    kinds: ['trophy', 'region', 'bands', 'trophy', 'scouted', 'captain'],
    trophies: [['orcBlade', 3], ['orcTrinket', 4], ['redEye', 2], ['arrowheads', 3], ['blackCoin', 3], ['captainToken', 1], ['haradGold', 2]],
    gifts: ['leatherCap', 'guardSword', 'ironGreaves', 'citadelGreaves', 'citadelHelm'],
    text: {
      trophy: (p) => ({
        title: `${p.itemName} for the count`,
        offer: `I would know how many of them are still out there, and what they carry. Bring me ${p.count} ${p.itemName.toLowerCase()}. ${p.hint}`,
        remind: `${p.count} ${p.itemName.toLowerCase()}, for the count.`,
        done: 'Good. Into the forge with them, and into the tally. Here.',
      }),
      region: (p) => ({
        title: `Fires in ${p.region.replace(/^The /, 'the ')}`,
        offer: `The scouts say ${p.region.replace(/^The /, 'the ')} is busier than it should be. Break ${p.count} camp${p.count > 1 ? 's' : ''} there.`,
        remind: `${p.count} camp${p.count > 1 ? 's' : ''} broken in ${p.region.replace(/^The /, 'the ')}.`,
        done: 'That country will sleep the better for it. Thank you.',
      }),
      bands: (p) => ({
        title: 'Watch on the road',
        offer: `Another band has been seen on the Harad Road, and where there is one there are more. Meet ${p.count === 1 ? 'one' : p.count} on the road and break ${p.count === 1 ? 'it' : 'them'}.`,
        remind: `${p.count} band${p.count > 1 ? 's' : ''} broken on the Harad Road.`,
        done: 'The road is ours again, for a while. Take this.',
      }),
      scouted: (p) => ({
        title: 'A scout’s report',
        offer: `A scout came in last night with word of a camp ${p.where}. I have marked it on your map. See to it.`,
        remind: `The camp ${p.where}. It is marked on your map.`,
        done: 'Good. I shall tell the scout; she will be glad she came back to report it.',
      }),
      captain: () => ({
        title: 'Another captain',
        offer: 'There is a captain still holding a stockade together out there. Break it, and him.',
        remind: 'A stockade or a war-camp broken, captain and all.',
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
        offer: `I have read of ${p.kindPlural} in Ithilien and I have not got one on my map that you have not seen already. Find me another.`,
        remind: `Another of the ${p.kindPlural}, one not yet on my map.`,
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
        offer: p.kind === 'hamlet' ? 'There is another village I have a name for and no place. Find me one more village.' : 'I want to know where the farms were, so the settlers know where the good land is. Find me an old farmstead I have not got.',
        remind: p.kind === 'hamlet' ? 'Another ruined village.' : 'Another old farmstead.',
        done: 'Thank you. It goes on the map, and in the book for the settlers.',
      }),
    },
  },
};
