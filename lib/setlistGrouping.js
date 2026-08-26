/**
 * Groups a stored setlist (array of song objects) into Set I / Set II / Encore
 * sections. Handles both the per-song `set` label (modern imports) and the
 * legacy `setBreak` marker (stamped only on the first song of each set/encore).
 */

const CANONICAL_ORDER = ['Set I', 'Set II', 'Set III', 'Set IV', 'Encore', 'Encore II', 'Encore III'];

export function setBreakToLabel(setBreak) {
  if (!setBreak) return null;
  if (setBreak === 'Main Set') return 'Set I';
  if (setBreak === 'Encore') return 'Encore';
  if (setBreak === 'Encore 2') return 'Encore II';
  const m = setBreak.match(/^Set (\d+)$/);
  if (m) {
    const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    return `Set ${ROMAN[parseInt(m[1]) - 1] || m[1]}`;
  }
  return setBreak;
}

// Groups a setlist into [{ label, songs }], in performance order.
// A song with no set/setBreak info of its own (e.g. manually added) falls
// into whichever group is currently open, rather than defaulting to Set I.
export function groupSongsBySet(setlist = []) {
  if (!setlist.length) return [];
  const groups = {};
  const order = [];
  const hasSetField = setlist.some(s => s.set);

  let currentLabel = 'Set I';
  if (hasSetField) {
    setlist.forEach(song => {
      if (song.set) currentLabel = song.set;
      if (!groups[currentLabel]) { groups[currentLabel] = []; order.push(currentLabel); }
      groups[currentLabel].push(song);
    });
  } else {
    setlist.forEach(song => {
      if (song.setBreak) currentLabel = setBreakToLabel(song.setBreak) || currentLabel;
      if (!groups[currentLabel]) { groups[currentLabel] = []; order.push(currentLabel); }
      groups[currentLabel].push(song);
    });
  }

  const keys = [
    ...CANONICAL_ORDER.filter(k => groups[k]),
    ...order.filter(k => !CANONICAL_ORDER.includes(k) && groups[k]),
  ];

  return keys.map(label => ({ label, songs: groups[label] }));
}

// Returns the setlist of every distinct set/encore label a show currently
// has, in performance order — used to populate a "which set?" selector.
export function getSetLabels(setlist = []) {
  return groupSongsBySet(setlist).map(g => g.label);
}

// Flattens groupSongsBySet() back into a single array, each song annotated
// with `_setLabel` (the section header to render immediately before it, or
// null if it continues the current section). Used by flat-list renderers
// that show a section header inline rather than via nested groups.
export function attachSetBoundaryLabels(setlist = []) {
  const groups = groupSongsBySet(setlist);
  const withLabels = [];
  groups.forEach(group => {
    group.songs.forEach((song, i) => {
      withLabels.push({ ...song, _setLabel: i === 0 ? group.label : null });
    });
  });
  return withLabels;
}
