// The tasks given at Henneth Annûn and in the settlements. Pure data;
// systems/quests.js knows how to read the objectives and builds the errands.
// All text is our own writing.
//
// The story (since v0.7) runs province by province, in two threads that meet:
//   Faramir  frees each province, hold and camps, and learns who is gathering
//            the remnants: the Marshal, who waits at the last in the Morgul Marches.
//   Éowyn    maps each province of woods (its old places, and the village or
//            farmstead where its settlers will live); once it is free and mapped
//            the ranger meets the settlers' boat on the Anduin and leads them home.
//   Settlers then ask for help of their own (ERRANDS.village), and their place
//            grows with each task done: fields cleared and sown, houses mended.
//
// There are two sorts of task:
//   QUESTS   the told tasks, in Faramir's and Éowyn's chains, each given once.
//   ERRANDS  lesser work, built when offered: Faramir's and Éowyn's, which never
//            run out, and each settlement's, a short run that grows the place.
//
// objective types:
//   clearCamp     { camp }              that particular camp is broken ('nearest' or a camp id)
//   clearCount    { count }             so many camps broken in all ('all' for every one)
//   clearWhere    { where, count }      so many broken among camps matching: 'stockade' | 'heather' | 'warcamp' | 'province:<id>'
//   clearSince    { where, count, base } so many more broken (since the task was taken) among camps matching
//                                        'any', 'stockade' (stockades and war-camps) or 'province:<id>'
//   bands         { count, base }       so many bands beaten on the road since it was taken
//   discover      { ids }               all of these places found (landmarks, ruins, or 'site:<id>' villages and farms)
//   discoverCount { set, count }        so many found among: 'ruins' | 'villages' | 'places'
//   seek          { set, count, base }  so many more found among a set: 'ruins' | 'kind:<relic kind>' | 'farms' |
//                                        'villages' | 'province:<id>'
//                 (a `where` or `set` ending '@<province id>' counts only what lies in that province;
//                  'region:<name>' is still read for errands taken before there were provinces)
//   holdFound     { province }          that province's hold found (seen, or broken)
//   freed         { province }          that province freed: its hold and three in four of its camps
//   settled       { site }              that settlement's people led home from their boat
//   grown         { sites }             those settlements ('all' for every one) grown as far as they go
//   gather        { item, count }       so many carried (handed over on return)
//   gatherAll     { items, count }      so many of each carried (handed over on return)
//   all           { of: [...] }         every one of these
//
// A told task may also have `requires` (tasks handed in first) and `whenFreed`
// (offered only once that province is free).
// `reward`: { silver, arrows, items, honour }. Honour is renown points (systems/renown.js).

export const QUESTS = [
  // ---- Faramir: the freeing of Ithilien, province by province ----
  {
    id: 'f1', giver: 'faramir', title: 'The nearest fire',
    offer: 'Those who fled the Black Gate did not all flee far. Orcs, and Men who served the Enemy, have gone to ground in our woods, each company round its own fire. Where they camp the land sickens: the light goes dim and grey about them, and nothing sings. Break a camp, down to the last of its company, and the land about it begins to mend; you will see it come back while you stand there.\n\nAnd there is one closer to this door than I like. A few stragglers, no more, hungry and frightened, but they will find the stair in time if they are let alone. Go softly and they will not see you until you choose. Put that fire out. Mablung will see you have arrows, and if it goes ill, come back here: they will not follow you to the falls.',
    remind: 'The nearest camp, ranger. It is marked on your map. Come back when it is cold for good.',
    done: 'Good. One fire the fewer, and the woods about our door are our own again. Take this; you will want it for the next.',
    objective: { type: 'clearCamp', camp: 'nearest' },
    reward: { silver: 15, items: { draught: 2 }, arrows: 10, honour: 20 },
  },
  {
    id: 'f2', giver: 'faramir', requires: ['f1'], title: 'Who leads them',
    offer: 'Look about you, when you are out there: this was farmland once, the garden of Gondor, and you will find the walls and lanes of it yet under the trees. The Great River bounds us on the west and the Mountains of Shadow on the east, and the land climbs from the one to the other. The farther you go from this window, toward the mountains or the Morgul road or the heath in the north, the more of them there are, and the worse they are led.\n\nAnd they are led. Stragglers should scatter, and these have not. Somewhere in these woods whoever leads them keeps the strongest camp, ringed with stakes: their hold. Find it for me, and break four more of the little camps about it on your way, five in these woods in all. Do not go into the hold yet, unless you are sure of yourself.',
    remind: 'Find the hold of the Window Woods, and break five camps in these woods. Your map will show you where the woods end.',
    done: 'You have seen their hold, and five fires are out. Now I know what we are up against. Here: greaves, for the brambles as much as the orcs.',
    objective: { type: 'all', of: [{ type: 'holdFound', province: 'henneth' }, { type: 'clearWhere', where: 'province:henneth', count: 5 }] },
    reward: { silver: 25, items: { leatherGreaves: 1 }, honour: 30 },
  },
  {
    id: 'f14', giver: 'faramir', requires: ['f2'], title: 'The Window Woods',
    offer: 'Now break the hold, and enough of the camps with it that they give the woods up for lost: three in every four. Then the Window Woods are ours, from Cair Andros to the Harad Road.\n\nThe land is too wide to win all at once, so we shall win it a piece at a time: the Window Woods first, then the heath to the north, then the country beyond the road and southward. Your map shows where each begins and ends. And mark this: freeing a province is not the end of it, only the beginning. There are folk waiting on the far bank for land to live on. When a province is free, and the Lady Éowyn has her map of it, they can come. She will tell you how.',
    remind: 'Free the Window Woods: break their hold, and three camps in four with it. Your pack will show you how it stands.',
    done: 'Then the Window Woods are free. I walked down to the river this morning and met no one but a fox. And look at this: their captain wore it on a thong about his neck. An iron ring stamped with a mark I do not know. Not the Eye, not the White Hand. Someone new is gathering what is left of them. Go and tell the Lady Éowyn the woods are free; she has folk to bring over the river. Take these; the north will be harder on you than you think.',
    objective: { type: 'freed', province: 'henneth' },
    reward: { silver: 35, items: { draught: 2 }, honour: 45 },
  },
  {
    id: 'f15', giver: 'faramir', requires: ['f14'], title: 'Smoke on the heath',
    offer: 'North of the woods the land opens out into heath, all the way to the fens. They camp there because they think no one goes so far. But a fire on open heath is seen for miles; you will not lack for marks. Free Forlad as you freed the Window Woods, and look for that mark again on whoever holds it.',
    remind: 'Free Forlad, the North Plain: its hold, and three camps in four. Look for their smoke.',
    done: 'Forlad too, and that is the whole of the north. Their captain wore the same ring. Two captains, one mark: whoever it is has been at work a while. This was made in the City before it fell; wear it, and come home with your head.',
    objective: { type: 'freed', province: 'forlad' },
    reward: { silver: 40, arrows: 20, items: { gondorHelm: 1 }, honour: 55 },
  },
  {
    id: 'f3', giver: 'faramir', requires: ['f15'], title: 'The road under the mountains',
    offer: 'With the north quiet I can look east. Beyond our woods the old road runs south from the Black Gate, and beyond the road the heather stands higher than a man. Things hide in it, and things come down the road that I would know more of. Find the road, and break one camp on the far side of it. Keep to the ways between the bushes.',
    remind: 'Find the Harad Road, and break a camp in the heather beyond it.',
    done: 'So the heather can be won too. I was not sure of it. Arrows, and silver for Mablung’s table.',
    objective: { type: 'all', of: [{ type: 'discover', ids: ['haradroad'] }, { type: 'clearWhere', where: 'heather', count: 1 }] },
    reward: { silver: 30, arrows: 20, honour: 35 },
  },
  {
    id: 'f9', giver: 'faramir', requires: ['f3'], title: 'What the bands carry',
    offer: 'They still come down the Harad Road in bands, out of the north, as if the Gate were open and someone waited for them at the end of it. Someone does, I think: the one who stamps that ring. Meet three such bands on the road and break them, and look at what they carry. Leave the great hosts alone; that is work for the King’s army.',
    remind: 'Three bands on the Harad Road. Wait by it, and let them come to you.',
    done: 'Three! And orders on one of them, sealed with the mark from the rings: they are to gather at the Old Bridge. Now we know where he means to stand next. Arrows; you will have spent yours.',
    objective: { type: 'bands', count: 3, base: 0 },
    reward: { silver: 40, arrows: 30, honour: 50 },
  },
  {
    id: 'f16', giver: 'faramir', requires: ['f3'], title: 'The gorse',
    offer: 'The heather north of the stream they call the Gorse Fells, and someone holds it: there is a stockade out there, in an old digging under the mountains, and its captain keeps the camps of the fells in good order. Too good. Free the Gorse Fells, captain and all, and bring me word of who he answers to. No one will live in the fells, I think; but no one shall be hunted from them either.',
    remind: 'Free the Gorse Fells: break their hold, a stockade in an old digging in the heather, and three camps in four with it.',
    done: 'The fells are free. Mablung got a word out of the last of them before he died: they call the one who stamps the rings the Marshal. An Uruk, he said, a war-chief of the Vale, who would not run when the Tower fell. This came up from Pelargir with the last of the ships; it is broad in the blade, and will not break on Uruk iron.',
    objective: { type: 'freed', province: 'gorse' },
    reward: { silver: 45, items: { falchion: 1 }, honour: 60 },
  },
  {
    id: 'f17', giver: 'faramir', requires: ['f16', 'f9'], title: 'The Old Bridge',
    offer: 'South of us the woods run down to the Old Bridge, where the road from the river crossed the stream. The Marshal’s orders send them there, and the King’s builders will want that crossing. Free the Bridgelands. Their hold is a stockade; it will be the hardest fight you have had.',
    remind: 'Free the Bridgelands: break their hold, and three camps in four.',
    done: 'The bridge is ours, and the builders cross tomorrow. The captain carried more orders: what is left is to fall back south, into the Moonwood, and hold it. He is giving ground, ranger, and he knows it. The White Company wears this mail; so shall you.',
    objective: { type: 'freed', province: 'bridgelands' },
    reward: { silver: 60, items: { whiteCompanyMail: 1 }, honour: 80 },
  },
  {
    id: 'f18', giver: 'faramir', requires: ['f17'], title: 'The Moonwood',
    offer: 'Past the Old Bridge the woods grow old and dark: Eryn Ithil, the Moonwood. There are more stockades there than anywhere north of the road, and the Marshal has sent his best to hold them. Free it. Take your time, and come home to mend between.',
    remind: 'Free Eryn Ithil, the Moonwood: its hold, and three camps in four.',
    done: 'The Moonwood is free. I had a bow made for the day someone could tell me that. It is yours.',
    objective: { type: 'freed', province: 'ithil' },
    reward: { silver: 70, items: { greatBow: 1 }, honour: 100 },
  },
  {
    id: 'f19', giver: 'faramir', requires: ['f18'], title: 'The Southwood',
    offer: 'Then the Southwood, between the Moonwood and the road. That is where the war-camps are, great stockades with more captains than one: the Marshal’s lieutenants. Free it, and they fall with it.',
    remind: 'Free the Southwood: its hold, and three camps in four. Go mended, and go with a full quiver.',
    done: 'The Southwood too, and his lieutenants with it. There is nothing left between the Marshal and the King but the fells and the Marches. This sword was made in Anórien for a captain who did not come home. He would be glad of you.',
    objective: { type: 'freed', province: 'southwood' },
    reward: { silver: 100, items: { anorianSword: 1, salve: 2 }, honour: 140 },
  },
  {
    id: 'f20', giver: 'faramir', requires: ['f19'], title: 'The Ash Fells',
    offer: 'The heather under the mountains, south of the gorse, has gone grey with them: the Ash Fells. The Marshal’s strongest captains keep the holds there, in the old diggings, to guard his flank. Free them, and he stands alone.',
    remind: 'Free the Ash Fells: their hold, and three camps in four.',
    done: 'The fells are free, all of them. He has nothing left to send. Here, for the road south.',
    objective: { type: 'freed', province: 'ash' },
    reward: { silver: 150, items: { salve: 3 }, honour: 160 },
  },
  {
    id: 'f21', giver: 'faramir', requires: ['f20'], title: 'The Marshal',
    offer: 'Only the Morgul Marches are left: the strip along the southern road, from Osgiliath to the mouth of the Vale. The Marshal holds it himself, from his own stockade, and he will not run; he has nowhere left to run to. Free the Marches, and break his hold, and him in it. The Vale itself is not ours to enter; do not go in.',
    remind: 'Free the Morgul Marches: break the Marshal’s hold, and three camps in four. Do not enter the Vale.',
    done: 'Then he is gone, and his rings with him. Every province of Ithilien is free. I did not think to say so in my lifetime.',
    objective: { type: 'freed', province: 'morgul' },
    reward: { silver: 150, items: { salve: 2 }, honour: 220 },
  },
  {
    id: 'f8', giver: 'faramir', requires: ['f21'], title: 'The last fires',
    offer: 'There is only one task left, and it is the last of them all. Every fire, ranger, the whole hundred, from the fens to the Morgul road; the stragglers in the freed lands too, that the settlers still see from their doors. I do not set a day for it.',
    remind: 'Every camp. Take the time it takes. Ask to see my map if you are at a loss; the scouts bring me word of more than you have found.',
    done: 'It is done, then. The King has sent these, for the one who did it. Go and look at the land, ranger. Walk it slowly. You have earned the sight of it more than any of us.',
    objective: { type: 'clearCount', count: 'all' },
    reward: { silver: 300, items: { kingsMail: 1, kingsGift: 1 }, honour: 300 },
  },

  // ---- Éowyn: the map of Ithilien, and the settlers ----
  {
    id: 'e1', giver: 'eowyn', title: 'Kingsfoil', picture: 'kingsfoil',
    offer: 'Everything grows here, once it is let alone: thyme and sage underfoot, bay and olive, and flowers I have no names for yet. Where the Enemy’s folk have camped the land goes grey and sour, but it does not stay so; drive them off and in a little while you can watch the colour come back. I think that is the best thing I have seen since the war.\n\nWill you gather for me? There is a leaf the old wives of Gondor call kingsfoil: low, plain, white-flowered, sweet when it is crushed. Here, I have drawn it for you: a rosette of long leaves and a few white stars above. It likes the edges of glades, and in the shade it has a pale glimmer about it that no other flower has. Bring me five plants and I will show you what the Houses of Healing taught me.',
    remind: 'Five plants of kingsfoil. Look in the glades, where the light gets in.',
    done: 'These are good. Smell that! Here, take these draughts; and bring me more whenever you find it. Two plants make one draught, if I do the steeping. No one will ever grow it in rows, I think; it will only come where it pleases.',
    objective: { type: 'gather', item: 'athelas', count: 5 },
    reward: { items: { draught: 3 }, honour: 15 },
  },
  {
    id: 'm-henneth', giver: 'eowyn', title: 'The map of the Window Woods',
    offer: 'Faramir will tell you where to fight. I will tell you to come home afterward, and to look about you on the way. There are families waiting across the River, ranger, who lost their homes to the war, and I mean to give them new ones here. This is how it shall go, province by province. Faramir frees it. I make its map: the old places, arches, shrines, standing stones, whatever was built here before the Shadow, and the village where its people will live. Then I send to the River, and their boat comes over, and someone who knows the way must bring them in.\n\nWe begin with these woods. Find me four of the old places in the Window Woods, and the village my book puts between Cair Andros and the falls: houses in a ring about a well, on the old way south. The rangers still know the old roads between the places; once you have found one you can come and go by them.',
    remind: 'Four old places in the Window Woods, and the village between Cair Andros and the falls. The lanes of great beeches lead to it.',
    done: 'Four places, and the village! Sit, and tell me each one. … A well, and a market cross: then people will live there again. When Faramir has the woods free, I will send to Cair Andros for them. Here, for the telling.',
    objective: { type: 'all', of: [{ type: 'seek', set: 'ruins@henneth', count: 4, base: 0 }, { type: 'discover', ids: ['site:hamlet4'] }] },
    reward: { silver: 20, items: { waybread: 4 }, honour: 15 },
  },
  {
    id: 's-henneth', giver: 'eowyn', requires: ['m-henneth'], whenFreed: 'henneth', title: 'The landing at Cair Andros',
    offer: 'The woods are free and the map is made, so I have sent word over the River. Their boat will put in on our bank, across from Cair Andros: a dozen folk from Anórien, with all they own in bundles. They do not know the woods, and they are afraid of them still. Go down to the shore and meet them, and lead them to the village. Walk, do not run; they will keep to your heels, and they will stop if they lose sight of you. Their village is to be called Beechwell, they tell me.',
    remind: 'Meet the settlers’ boat on the shore across from Cair Andros, and lead them to Beechwell. Do not leave them behind.',
    done: 'They are home! Ardan sent a boy running to tell me, and he could hardly speak for running. Go and see them when you can; they will want your help with the fields, and you will see the place grow. Take this; it is little enough.',
    objective: { type: 'settled', site: 'hamlet4' },
    reward: { silver: 30, items: { draught: 2 }, honour: 20 },
  },
  {
    id: 'm-forlad', giver: 'eowyn', requires: ['m-henneth'], title: 'The map of Forlad',
    offer: 'Now the north. Forlad is open heath, and the old places stand up out of it where you would least look. Find me four of them, and the village: the book puts one on the east of the plain, toward the road. When Faramir has it free, folk from Lossarnach will come there.',
    remind: 'Four old places in Forlad, and its village, on the east of the plain.',
    done: 'Forlad is on the map. I can see it from here: the heath, the fens, the village by the road. When it is free, they can come.',
    objective: { type: 'all', of: [{ type: 'seek', set: 'ruins@forlad', count: 4, base: 0 }, { type: 'discover', ids: ['site:hamlet2'] }] },
    reward: { silver: 25, items: { draught: 2 }, honour: 20 },
  },
  {
    id: 's-forlad', giver: 'eowyn', requires: ['m-forlad'], whenFreed: 'forlad', title: 'The folk of Heathwick',
    offer: 'Forlad is free and mapped, and the folk from Lossarnach are at the River. Their boat puts in on the shore due west of the village. It is a long walk over the heath, and they have children with them. Bring them to Heathwick; that is what they will call it.',
    remind: 'Meet the boat on the shore west of the village in Forlad, and lead the settlers to Heathwick.',
    done: 'Heathwick has smoke in its chimneys again. My brother’s smith made this sword for me when I rode to war. I would rather it went on riding, with you.',
    objective: { type: 'settled', site: 'hamlet2' },
    reward: { silver: 35, items: { riddermarkSword: 1 }, honour: 25 },
  },
  {
    id: 'm-bridgelands', giver: 'eowyn', requires: ['m-forlad'], title: 'The map of the Bridgelands',
    offer: 'South of us, about the Old Bridge, the old fields run right down to the River. Find me four old places there, and the village: on the south side of the land, near the stream the bridge once crossed.',
    remind: 'Four old places in the Bridgelands, and its village near the southern stream.',
    done: 'The Bridgelands, mapped. There were more people there once than anywhere in Ithilien, I think. There will be again.',
    objective: { type: 'all', of: [{ type: 'seek', set: 'ruins@bridgelands', count: 4, base: 0 }, { type: 'discover', ids: ['site:hamlet0'] }] },
    reward: { silver: 30, items: { salve: 1 }, honour: 25 },
  },
  {
    id: 's-bridgelands', giver: 'eowyn', requires: ['m-bridgelands'], whenFreed: 'bridgelands', title: 'The folk of Bridgefold',
    offer: 'The Bridgelands are free and mapped. The boat from Pelargir is at our shore, west of the village: shipwrights’ families, who mean to farm now. Lead them in. They will call it Bridgefold.',
    remind: 'Meet the boat on the shore west of the village in the Bridgelands, and lead the settlers to Bridgefold.',
    done: 'Bridgefold! They sent me a loaf from their first baking, still warm when it got here. Here, for your trouble.',
    objective: { type: 'settled', site: 'hamlet0' },
    reward: { silver: 40, items: { salve: 1 }, honour: 30 },
  },
  {
    id: 'm-ithil', giver: 'eowyn', requires: ['m-bridgelands'], title: 'The map of the Moonwood',
    offer: 'The Moonwood is old forest, and the places in it are older. Find me four of them, and the village in its south-west, nearest the River: there is another further east, but the west one is nearer the landing.',
    remind: 'Four old places in the Moonwood, and the village in its south-west, nearest the River.',
    done: 'The Moonwood. My map is darker there, all trees; but there are names under them now.',
    objective: { type: 'all', of: [{ type: 'seek', set: 'ruins@ithil', count: 4, base: 0 }, { type: 'discover', ids: ['site:hamlet3'] }] },
    reward: { silver: 35, items: { draught: 3 }, honour: 30 },
  },
  {
    id: 's-ithil', giver: 'eowyn', requires: ['m-ithil'], whenFreed: 'ithil', title: 'The folk of Moonhallow',
    offer: 'The Moonwood is free and mapped. The settlers are from Lebennin, and their boat is at the shore west of the village. The woods are dark there; they will be glad of you. They mean to call it Moonhallow.',
    remind: 'Meet the boat on the shore west of the village in the Moonwood, and lead the settlers to Moonhallow.',
    done: 'Moonhallow is lived in. This bow came from Lebennin with them; they asked me to give it to whoever brought them home.',
    objective: { type: 'settled', site: 'hamlet3' },
    reward: { silver: 45, items: { yewBow: 1 }, honour: 35 },
  },
  {
    id: 'm-southwood', giver: 'eowyn', requires: ['m-ithil'], title: 'The map of the Southwood',
    offer: 'There are no villages left in the Southwood, only farms. Find me four of its old places, and the farmstead nearest the River, in the west: one family will take it, and the land about it, and make a start.',
    remind: 'Four old places in the Southwood, and the farmstead nearest the River.',
    done: 'The Southwood. It is almost all of my map now, ranger.',
    objective: { type: 'all', of: [{ type: 'seek', set: 'ruins@southwood', count: 4, base: 0 }, { type: 'discover', ids: ['site:farm3'] }] },
    reward: { silver: 40, items: { salve: 1 }, honour: 35 },
  },
  {
    id: 's-southwood', giver: 'eowyn', requires: ['m-southwood'], whenFreed: 'southwood', title: 'Olivegarth',
    offer: 'The Southwood is free and mapped. The family is Imrith’s, from Dol Amroth, with her sons and their wives. Their boat is at the shore west of the farm. Bring them to it; they mean to call it Olivegarth, for the wild olives.',
    remind: 'Meet the boat on the shore west of the farmstead in the Southwood, and lead the family to Olivegarth.',
    done: 'Olivegarth. Imrith says the olives only want pruning. Take these; I have no more use for them than you have.',
    objective: { type: 'settled', site: 'farm3' },
    reward: { silver: 50, items: { salve: 2 }, honour: 40 },
  },
  {
    id: 'm-morgul', giver: 'eowyn', requires: ['m-southwood'], title: 'The map of the Marches',
    offer: 'The last of it: the Morgul Marches. Go carefully. Find me the two old places there, and the farmstead nearest the River, west of the broken city. Someone will be brave enough to live there, when it is free.',
    remind: 'The two old places in the Morgul Marches, and the farmstead nearest the River.',
    done: 'The Marches are on the map. That is every province of the woods, ranger.',
    objective: { type: 'all', of: [{ type: 'seek', set: 'ruins@morgul', count: 2, base: 0 }, { type: 'discover', ids: ['site:farm25'] }] },
    reward: { silver: 45, items: { draught: 3 }, honour: 40 },
  },
  {
    id: 's-morgul', giver: 'eowyn', requires: ['m-morgul'], whenFreed: 'morgul', title: 'Marchstead',
    offer: 'The Marches are free. A family of the old Osgiliath folk, Dorvan’s, have asked for the farm west of the city: they want to see it rebuilt from their own door. Their boat is at the shore. Bring them home.',
    remind: 'Meet the boat on the shore west of the farmstead in the Marches, and lead the family to Marchstead.',
    done: 'Marchstead. Every province of the woods has its people again. I keep saying it to myself.',
    objective: { type: 'settled', site: 'farm25' },
    reward: { silver: 60, items: { salve: 2 }, honour: 45 },
  },
  {
    id: 'e-whole', giver: 'eowyn', requires: ['m-morgul'], title: 'The whole of it',
    offer: 'Every old place, ranger, every stone, the fells too. Then the map is done and I can send it to the King, and he will know what he has been given.',
    remind: 'Every one of the old places.',
    done: 'Every one. The map goes to the City tomorrow. And this came the other way, from a lady who passed through Minas Tirith in the spring and asked after the rangers. She said you would know what to do with it.',
    objective: { type: 'discoverCount', set: 'ruins', count: 'all' },
    reward: { silver: 100, items: { galadhrimBow: 1 }, honour: 120 },
  },
  {
    id: 'e-garden', giver: 'eowyn', requires: ['s-morgul'], title: 'The garden of Gondor',
    offer: 'They are all home. Now help them grow: every settlement, its fields sown and its houses mended, all that its people ask of you. Then Ithilien will be the garden of Gondor again, and not only in the old songs.',
    remind: 'Every settlement grown as far as it will go: help its people with all they ask.',
    done: 'Go and stand on the hill above Beechwell at evening, ranger, and look south. Smoke from every village, and the fields green. That is your doing, more than anyone’s. Thank you.',
    objective: { type: 'grown', sites: 'all' },
    reward: { silver: 200, items: { salve: 3 }, honour: 120 },
  },
];

/** Who carries each trophy, for Faramir to say when asked. */
export const TROPHY_HINTS = {
  orcBlade: 'Any orc carries one, and most of them break.',
  redEye: 'Only the Uruks wear the Eye, and their captains. You will find more of them in the south.',
  arrowheads: 'Only the archers in the bands coming down the road still carry the blackened arrowheads. Wait by the Harad Road.',
  captainToken: 'Every captain has one: in the stockades, the war-camps, and at the head of the great hosts on the road.',
};

/** Where each seed plant grows, for whoever asks for it. */
export const SEED_HINTS = {
  thymeSeed: 'Thyme likes the open glades of the north, where the sun gets to the ground.',
  baySeed: 'The bay grows in the woods proper, from the heath to the Moonwood, neither the open glades nor the darkest of it.',
  poppySeed: 'Poppies come up where the old fields were: look about the ruined farms and villages.',
  oliveStone: 'The wild olives are all in the south, past the Old Bridge and on toward the road.',
};

/**
 * Errands: lesser work, built when offered. Faramir and Éowyn each work through
 * their `kinds` in turn, a little bigger each time; systems/quests.js fills in
 * the particulars and skips a kind that cannot be done. Since v0.7 there are
 * fewer of them, and they are offered only when the giver has no told task to
 * offer: the story comes first.
 */
export const ERRANDS = {
  faramir: {
    // (the bounty, since v0.6, in place of "break 1 camp in X"; trophies are now
    // one kind in five, and all of them are for tracing the Marshal)
    kinds: ['scouted', 'bounty', 'trophy', 'bands', 'captain'],
    // (only trophies: they are found only while he has asked for them; coin and trinkets are plain loot, for selling)
    trophies: [['orcBlade', 3], ['redEye', 2], ['arrowheads', 3], ['captainToken', 1]],
    gifts: ['leatherCap', 'guardSword', 'ironGreaves', 'citadelGreaves', 'citadelHelm'],
    text: {
      trophy: (p) => ({
        title: `${p.itemName} for the count`,
        offer: `They are better kept than stragglers have any right to be: fed, and armed, and held together. ${p.marshal ? 'The Marshal sees to it' : 'Someone is seeing to it'}, and what they carry tells me where it comes from, and how many hands it passes through. Bring me ${p.count} ${p.itemName.toLowerCase()}. ${p.hint}`,
        remind: `${p.count} ${p.itemName.toLowerCase()}, for the count.`,
        done: 'Good. Into the tally with them, and then the forge. Mablung and I will sit up over these tonight. Here.',
      }),
      bounty: (p) => ({
        title: `A bounty on ${p.count} fires`,
        offer: `The Steward’s treasury has sent us silver for the work, and I would rather it went to the one doing it. For every ${p.count} camps you break, wherever they lie, there is a purse waiting here. Break ${p.count} more and come and claim it.`,
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
        offer: `A scout came in last night with word of a camp ${p.where}, in ${p.province}. They moved in lately, she says, and in good order, as if they had been sent. I have marked it on your map. See to it; every fire out brings ${p.province} nearer to free.`,
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
    // (since v0.7 no seed errands: the settlers ask for their own seed. A
    // farmstead found for her is given to a family once its province is free.)
    kinds: ['site', 'kingsfoil', 'kind'],
    gifts: ['gambeson', 'ashBow', 'hornBow', 'blackMail'],
    text: {
      kingsfoil: (p) => ({
        title: 'More kingsfoil',
        offer: `The draughts go quicker than I can make them, and the settlers need them as much as you do. Bring me ${p.count} plants of kingsfoil.`,
        remind: `${p.count} plants of kingsfoil.`,
        done: 'Thank you. Here are draughts from the last lot; these will make the next.',
      }),
      kind: (p) => ({
        title: p.title,
        offer: `I have read of ${p.kindPlural} in Ithilien, and there should be one in ${p.where} that is not yet on my map. Find it for me.`,
        remind: `One of the ${p.kindPlural}, in ${p.where}, not yet on my map.`,
        done: 'Another for the map! Tell me how it lies. … Thank you.',
      }),
      site: (p) => ({
        title: 'A farm for a family',
        offer: `A family has come over the River who would rather have land of their own than a house in a village. There is an old farmstead ${p.where}, in ${p.province}, that is not on my map. Find it for me, and ${p.free ? 'they will go and live there at once' : `when ${p.province} is free they will go and live there`}.`,
        remind: `The old farmstead ${p.where}, in ${p.province}.`,
        done: p.free ? 'Then it is theirs. They will be ploughing before the week is out; go and see them, when you pass.' : `Then it is theirs, as soon as ${p.province} is free. They will wait.`,
      }),
    },
  },
  // Each settlement's people ask for these, in this order, once they are home;
  // every one done grows the place a stage (systems/settlement.js). `remnant`
  // gives way to `place`, and that to `kingsfoil`, when it cannot be done.
  village: {
    kinds: ['seed', 'remnant', 'seed', 'kingsfoil'],
    text: {
      seed: (p) => ({
        title: `${p.itemName} for ${p.name}`,
        offer: p.first
          ? `We have cleared a field ${p.where}, and the ground is good, but we brought no seed fit for this country. ${p.itemName}: ${p.count} of them, and we can sow it this season. ${p.hint}`
          : `The first field is up, and we have cleared a second ${p.where}. ${p.itemName} for it, ${p.count} if you can find them. ${p.hint}`,
        remind: `${p.count} ${p.itemName.toLowerCase()}, for the new field at ${p.name}. ${p.hint}`,
        done: p.first ? 'Into the ground they go. Come back in a while and look at the rows. And if you ever want seed of your own, we shall have it to sell.' : 'That is both fields sown. We shall sell that seed too, when it comes in.',
      }),
      remnant: (p) => ({
        title: `A camp too near ${p.name}`,
        offer: `There is a camp still standing ${p.where}. We see its smoke from the green, and the children will not go past the well. Break it, and we will dare to work on the far houses.`,
        remind: `The camp ${p.where}, that troubles ${p.name}.`,
        done: 'Quiet at last. We start on the far roofs tomorrow.',
      }),
      place: (p) => ({
        title: `Old stones near ${p.name}`,
        offer: `The children talk of old stones ${p.where}, in the trees, and I would know what is there before they go looking for themselves. Will you see?`,
        remind: `The old place ${p.where}.`,
        done: 'Only old stones, then, and good ones. We shall take the children to see them, and start on the far roofs. Thank you; and Lady Éowyn will want it for her map.',
      }),
      kingsfoil: (p) => ({
        title: `Kingsfoil for ${p.name}`,
        offer: `Our healer has no kingsfoil, and the winter coughs will come. It will not grow in a garden; it must be found. ${p.count} plants, if you can.`,
        remind: `${p.count} plants of kingsfoil, for the healer at ${p.name}.`,
        done: p.last ? 'She is glad of them, and so am I. Look about you, ranger: every roof sound, and the cross set up again. We are a village again, and we shall not forget who brought us here.'
          : 'She is glad of them, and so am I. With a healer we can stand anything; we start on the far roofs tomorrow.',
      }),
    },
  },
};
