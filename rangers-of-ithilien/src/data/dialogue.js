// What people say. All text here is our own writing.
// A node's text may be a string or a function of the game context.
// (Faramir's and Éowyn's account of the land and the work is told in their
// first tasks, data/quests.js, rather than behind buttons of its own.)

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
          { label: 'How goes the clearing?', to: 'report' },
          { label: 'Farewell.' },
        ],
      },
      report: {
        text: (ctx) => {
          const n = ctx.cleared.length, total = CAMPS.length;
          if (n === 0) return 'It has not begun. No camp has been broken yet, and our scouts count a hundred fires between the river and the mountains. Start near home and work outward.';
          if (n < total) return `${n} of ${total} camps broken, by our count. Each one is a little more of the land given back. Keep on.`;
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
        options: [{ label: 'Farewell.' }],
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
          { label: 'Will you see to my gear?', trade: true },
          { label: 'How do I fight them?', to: 'fight' },
          { label: 'Farewell.' },
        ],
      },
      fight: {
        text: 'Bow first, while they are still wondering what the noise was. Bend it full before you loose; a half-drawn bow is a thrown stick. When they close, the sword, and keep moving: an orc lifts his blade a moment before he swings, and that moment is yours to step away in. Walk soft and they see you late. And if it goes ill, run for the falls. They will not follow you here. One more thing: an edge dulls and a string wears. Bring them to me before they fail you.',
        options: [{ label: 'Show me what you have.', trade: true }, { label: 'My thanks.' }],
      },
    },
  },
};
