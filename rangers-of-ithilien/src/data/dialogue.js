// What people say. All text here is our own writing.
// A node's text may be a string or a function of the game context.

import { CAMPS } from '../world/campSites.js';

export const DIALOGUE = {
  faramir: {
    name: 'Faramir',
    title: 'Prince of Ithilien',
    start: 'hello',
    nodes: {
      hello: {
        text: 'Well met, ranger. The Shadow is gone, and still I catch myself listening for it. Old habits. But Ithilien is ours to mend now, and I mean to see it a garden again before I am grey.',
        options: [
          { label: 'What would you have me do?', to: 'charge' },
          { label: 'Tell me of the land.', to: 'land' },
          { label: 'How goes the clearing?', to: 'report' },
          { label: 'Farewell.' },
        ],
      },
      charge: {
        text: 'Those who fled the Black Gate did not all flee far. Orcs, and Men who served the Enemy, have gone to ground in our woods. Find their camps and break them: when the last of a company falls, the camp is ours and the land about it begins to mend. Near home they are few and hungry. Farther out they are many, and some are led. Go softly and they may not see you until you choose; and go lightly near the mountains and the Morgul road.',
        options: [{ label: 'Tell me of the land.', to: 'land' }, { label: 'I will see it done.' }],
      },
      land: {
        text: 'The Great River bounds us on the west, the Mountains of Shadow on the east. This was farmland once, the garden of Gondor: you will find the walls and lanes of it yet under the trees. Our stream runs down to Cormallen, where the King’s host made merry. Southward the old road runs from Osgiliath to the Cross-roads and on into the dead vale: a long march, and the woods darken as you go. North, the trees give out upon the heath. The farther you range from this window, the less I can promise for your safety.',
        options: [{ label: 'What would you have me do?', to: 'charge' }, { label: 'My thanks.' }],
      },
      report: {
        text: (ctx) => {
          const n = ctx.cleared.length, total = CAMPS.length;
          if (n === 0) return 'It has not begun. No camp has been broken yet, and our scouts count more than a hundred fires between the river and the mountains. Start near home and work outward.';
          if (n < total) return `${n} of ${total} camps broken, by our count. I walked out to one of them yesterday and there were flowers in the ash. Keep on.`;
          return 'Every fire we knew of is out. I did not think to say so this year. Go and look at the land, ranger. You earned the sight of it.';
        },
        options: [{ label: 'Good.' }],
      },
    },
  },

  eowyn: {
    name: 'Éowyn',
    title: 'Lady of Rohan',
    start: 'hello',
    nodes: {
      hello: {
        text: 'There you are! Sit a moment if you like; no one here will think the less of you. I came to Ithilien to heal and to grow things, and I find both are slow work, and I like them very much.',
        options: [
          { label: 'What grows here?', to: 'herbs' },
          { label: 'What of the camps?', to: 'camps' },
          { label: 'Farewell.' },
        ],
      },
      herbs: {
        text: 'Everything, once it is let alone. Thyme and sage underfoot, bay and olive, and flowers I have no names for yet. Where the Enemy’s folk have camped the land goes grey and sour. But it does not stay so. Drive them off, and in a little while you can watch the colour come back. I think that is the best thing I have seen since the war.',
        options: [{ label: 'What of the camps?', to: 'camps' }, { label: 'I will watch for it.' }],
      },
      camps: {
        text: (ctx) => {
          const ruins = ctx.discovered.filter((id) => ctx.ruinIds.includes(id)).length;
          const tail = ruins === 0
            ? 'And bring me word of any ruin you find. I am making a map of the old places, and I mean to see them all when the roads are safe.'
            : `And keep bringing me word of the old places. ${ruins} on my map so far, and room for more.`;
          return 'Faramir will tell you where to look. I will tell you to come home afterward. ' + tail;
        },
        options: [{ label: 'I will.' }],
      },
    },
  },

  mablung: {
    name: 'Mablung',
    title: 'Ranger of Ithilien, keeper of the stores',
    start: 'hello',
    nodes: {
      hello: {
        text: 'Ranger. If it is arrows you want, I have them. If it is anything better than arrows, you will have to earn the Captain\u2019s good word first; I do not hand out mail to every lad who can find the door.',
        options: [
          { label: 'Show me what you have.', trade: true },
          { label: 'How do I fight them?', to: 'fight' },
          { label: 'Farewell.' },
        ],
      },
      fight: {
        text: 'Bow first, while they are still wondering what the noise was. Bend it full before you loose; a half-drawn bow is a thrown stick. When they close, the sword, and keep moving: an orc lifts his blade a moment before he swings, and that moment is yours to step away in. Walk soft and they see you late. And if it goes ill, run for the falls. They will not follow you here.',
        options: [{ label: 'Show me what you have.', trade: true }, { label: 'My thanks.' }],
      },
    },
  },
};
