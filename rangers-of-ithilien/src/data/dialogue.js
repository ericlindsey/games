// What people say. All text here is our own writing.
// A node's text may be a string or a function of the game context.
// (Faramir's and Éowyn's account of the land and the work is told in their
// first tasks, data/quests.js, rather than behind buttons of its own.)

import { CAMPS } from '../world/campSites.js';
import { PROVINCES, CAMPAIGN, provinceById } from '../world/provinces.js';
import { provinceStatus, statusLine, workingProvince } from '../systems/provinces.js';
import { SETTLEMENTS, settlingLine } from '../systems/settlement.js';

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
      // (since v0.7 he speaks of provinces: which are free, where the work is, and of the Marshal once he has a name)
      report: {
        text: (ctx) => {
          const st = ctx.state, n = ctx.cleared.length, total = CAMPS.length;
          if (n === 0) return 'It has not begun. No camp has been broken yet, and our scouts count a hundred fires between the river and the mountains. We shall win the land a piece at a time, a province at a time, beginning with these woods. Start near home and work outward.';
          const free = PROVINCES.filter((p) => provinceStatus(st, p.id).freed);
          if (free.length === PROVINCES.length) {
            return n < total ? `Every province is free, and the Marshal is dead. ${n} of ${total} fires are out; the rest are stragglers, and the settlers would sleep easier without them.`
              : 'Every fire we knew of is out. I did not think to say so this year. Go and look at the land, ranger. You earned the sight of it.';
          }
          const w = workingProvince(st), name = provinceById[w].name.replace(/^The /, 'the ');
          const freed = free.length ? `${free.length === 1 ? 'One province is' : `${free.length} provinces are`} free: ${free.map((p) => p.name.replace(/^The /, 'the ')).join(', ')}. ` : 'No province is free yet. ';
          const who = st.quests.done.includes('f16') ? 'The Marshal gives ground, but he is not beaten; he waits in the Morgul Marches, at the last.'
            : st.quests.done.includes('f14') ? 'And someone is gathering them; I would give a good deal to know who.' : '';
          return `${freed}The work is in ${name} now. ${statusLine(provinceStatus(st, w))} ${who}\n\nWhen a province is free, go to the Lady Éowyn: once she has its map she can send for settlers, and that is what all of this is for.`;
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
        options: [{ label: 'How goes the settling?', to: 'settling' }, { label: 'Farewell.' }],
      },
      // (since v0.7) where each province of the woods stands: free, mapped, its people home, how far they have come
      settling: {
        text: (ctx) => {
          const st = ctx.state;
          const lines = SETTLEMENTS.map((s) => `${provinceById[s.province].name}: ${settlingLine(st, s, st.quests.done.includes('m-' + s.province))}`);
          return 'Each province of the woods goes the same way. Faramir frees it, and I make its map: its old places, and the place its people will live. Then I send to the River, and you bring them in from their boat. After that it is theirs, and they will ask your help to make it grow.\n\n' + lines.join('\n');
        },
        options: [{ label: 'Thank you.', to: 'hello' }],
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
