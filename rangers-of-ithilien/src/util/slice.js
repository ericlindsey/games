// Work that would stall a frame is written as a generator that yields every
// little while (a row of the ground, a row of plants), so it can be done a few
// milliseconds a frame as the ranger walks, or all at once while loading.

/** Run a builder to the end at once; its result. */
export function finish(gen) {
  let r;
  while (!(r = gen.next()).done);
  return r.value;
}
