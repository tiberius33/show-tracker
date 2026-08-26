/**
 * Shared setlist.fm response parsing — extracts songs with per-song set/encore
 * labels from a setlist.fm setlist object (the `sets.set[]` structure).
 *
 * setlist.fm labels each set as either a regular set or an encore (`set.encore`
 * holds the encore's 1-based number). Regular sets and encores are counted
 * separately so labels come out right even when a show has multiple regular
 * sets before its encore(s) — e.g. Set I, Set II, Encore, Encore II.
 */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const toRoman = (n) => ROMAN[n - 1] || String(n);

export function extractSongsFromSetlist(setlistFmSetlist) {
  const songs = [];
  let regularSetCount = 0;
  let encoreCount = 0;

  if (setlistFmSetlist?.sets?.set) {
    setlistFmSetlist.sets.set.forEach(set => {
      let setLabel;
      if (set.encore) {
        encoreCount++;
        setLabel = encoreCount === 1 ? 'Encore' : `Encore ${toRoman(encoreCount)}`;
      } else {
        regularSetCount++;
        setLabel = `Set ${toRoman(regularSetCount)}`;
      }

      if (set.song) {
        set.song.forEach(song => {
          songs.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            name: (song.name || '').trim(),
            set: setLabel,
            cover: song.cover ? song.cover.name : null,
            tape: song.tape || false,
          });
        });
      }
    });
  }

  return songs;
}
