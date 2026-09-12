/**
 * Fixture responses for the band-source adapter tests.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ PROVENANCE: THESE ARE CONSTRUCTED, NOT CAPTURED.                    │
 * │                                                                     │
 * │ They were hand-built to the documented row shape because the branch │
 * │ that introduced them had no network route to elgoose.net or         │
 * │ api.phish.net — the egress proxy refused CONNECT to both with a     │
 * │ 403 — so no live response could be fetched and saved.               │
 * │                                                                     │
 * │ WHAT THAT MEANS FOR THESE TESTS. A fixture written from the same    │
 * │ field list the adapter's FIELDS map was written from cannot prove   │
 * │ the field names are right; both would be wrong together. What the   │
 * │ tests below DO prove is the logic that sits on top of the mapping,  │
 * │ and which is where the real complexity lives:                       │
 * │                                                                     │
 * │   - the envelope check (elgoose's numeric 0 vs phish.net's          │
 * │     boolean false), including the string spellings a truthy check   │
 * │     would silently mishandle                                        │
 * │   - flat-array-to-grouped-show transformation                       │
 * │   - set/encore labels landing on the app's canonical labels,        │
 * │     including a show with two encores                               │
 * │   - transition marks: '>' and '->' segue, ',' and '' do not         │
 * │   - soundcheck rows being dropped and counted                       │
 * │   - ordering across sets regardless of the order rows arrive in     │
 * │   - one date carrying two shows                                     │
 * │                                                                     │
 * │ TO REPLACE WITH REAL CAPTURES: fetch                                │
 * │   elgoose.net/api/v2/setlists/showdate/2023-12-30.json              │
 * │   api.phish.net/v5/setlists/showdate/1997-11-22.json?apikey=…       │
 * │ and paste the bodies over ELGOOSE_RADIO_CITY / PHISHNET_HAMPTON     │
 * │ below. The tests assert on song titles, labels and marks rather     │
 * │ than on array indices, so a real capture of the same show should    │
 * │ need few if any assertion changes — and any assertion that DOES     │
 * │ break is a field name that needs correcting in the adapter's FIELDS │
 * │ map, which is exactly the signal this arrangement exists to give.   │
 * └─────────────────────────────────────────────────────────────────────┘
 */

// Goose, Radio City Music Hall, 2023-12-30. An abridged setlist — enough
// rows to exercise two sets, an encore, a segue chain, a footnote, a jam
// chart flag and a soundcheck row, not the full show.
const ELGOOSE_RADIO_CITY = {
  error: 0,
  error_message: null,
  data: [
    {
      showdate: '2023-12-30', permalink: 'https://elgoose.net/setlists/?d=2023-12-30',
      venuename: 'Radio City Music Hall', city: 'New York', state: 'NY', country: 'USA',
      settype: 'Soundcheck', setnumber: 1, position: 1, songname: 'Arcadia',
      transition: '', footnote: '', isjamchart: 0, jamchart_description: null,
      soundcheck: 1, opener: 0, isoriginal: 1, gap: null, tourname: 'Fall Tour 2023',
      show_id: 1601, uniqueid: 'eg-arcadia', artist_id: 1, slug: 'arcadia',
    },
    {
      showdate: '2023-12-30', permalink: 'https://elgoose.net/setlists/?d=2023-12-30',
      venuename: 'Radio City Music Hall', city: 'New York', state: 'NY', country: 'USA',
      settype: 'Set', setnumber: 1, position: 1, songname: 'Hot Tea',
      transition: ' > ', footnote: 'With a Tom Sawyer tease', isjamchart: 0,
      jamchart_description: null, soundcheck: 0, opener: 1, isoriginal: 1, gap: 3,
      tourname: 'Fall Tour 2023', show_id: 1601, uniqueid: 'eg-hot-tea',
      artist_id: 1, slug: 'hot-tea',
    },
    {
      showdate: '2023-12-30', permalink: 'https://elgoose.net/setlists/?d=2023-12-30',
      venuename: 'Radio City Music Hall', city: 'New York', state: 'NY', country: 'USA',
      settype: 'Set', setnumber: 1, position: 2, songname: 'Arrow',
      transition: ' -> ', footnote: '', isjamchart: 1,
      jamchart_description: 'Patient, melodic build into a full-band peak.',
      soundcheck: 0, opener: 0, isoriginal: 1, gap: 8, tourname: 'Fall Tour 2023',
      show_id: 1601, uniqueid: 'eg-arrow', artist_id: 1, slug: 'arrow',
    },
    {
      showdate: '2023-12-30', permalink: 'https://elgoose.net/setlists/?d=2023-12-30',
      venuename: 'Radio City Music Hall', city: 'New York', state: 'NY', country: 'USA',
      settype: 'Set', setnumber: 1, position: 3, songname: 'Madhuvan',
      transition: ',', footnote: '', isjamchart: 0, jamchart_description: null,
      soundcheck: 0, opener: 0, isoriginal: 1, gap: 0, tourname: 'Fall Tour 2023',
      show_id: 1601, uniqueid: 'eg-madhuvan', artist_id: 1, slug: 'madhuvan',
    },
    {
      showdate: '2023-12-30', permalink: 'https://elgoose.net/setlists/?d=2023-12-30',
      venuename: 'Radio City Music Hall', city: 'New York', state: 'NY', country: 'USA',
      settype: 'Set', setnumber: 2, position: 1, songname: 'Tumble',
      transition: '', footnote: '', isjamchart: 0, jamchart_description: null,
      soundcheck: 0, opener: 0, isoriginal: 1, gap: 12, tourname: 'Fall Tour 2023',
      show_id: 1601, uniqueid: 'eg-tumble', artist_id: 1, slug: 'tumble',
    },
    {
      showdate: '2023-12-30', permalink: 'https://elgoose.net/setlists/?d=2023-12-30',
      venuename: 'Radio City Music Hall', city: 'New York', state: 'NY', country: 'USA',
      settype: 'Encore', setnumber: 1, position: 1, songname: 'Time to Flee',
      transition: '', footnote: 'Guest: Marcus King on guitar', isjamchart: 0,
      jamchart_description: null, soundcheck: 0, opener: 0, isoriginal: 1, gap: 21,
      tourname: 'Fall Tour 2023', show_id: 1601, uniqueid: 'eg-time-to-flee',
      artist_id: 1, slug: 'time-to-flee',
    },
  ],
};

// Phish, Hampton Coliseum, 1997-11-22. Abridged; two encores, which is the
// case the e/e2 set-code parsing exists for.
const PHISHNET_HAMPTON = {
  error: false,
  error_message: null,
  data: [
    {
      showid: 1252344800, showdate: '1997-11-22',
      permalink: 'https://phish.net/setlists/phish-november-22-1997-hampton-coliseum-hampton-va-usa.html',
      venue: 'Hampton Coliseum', city: 'Hampton', state: 'VA', country: 'USA',
      tourname: '1997 Fall Tour',
      setlistnotes: 'This show was officially released as Hampton Comes Alive.',
      set: '1', position: 1, song: 'Mikes Song', songid: 848, transmark: ' > ',
      footnote: '', gap: 4, isjamchart: 0, jamchart_description: null,
      soundcheck: '', artistid: 1,
    },
    {
      showid: 1252344800, showdate: '1997-11-22',
      permalink: 'https://phish.net/setlists/phish-november-22-1997-hampton-coliseum-hampton-va-usa.html',
      venue: 'Hampton Coliseum', city: 'Hampton', state: 'VA', country: 'USA',
      tourname: '1997 Fall Tour',
      setlistnotes: 'This show was officially released as Hampton Comes Alive.',
      set: '1', position: 2, song: 'Simple', songid: 1130, transmark: ' -> ',
      footnote: 'Unfinished.', gap: 7, isjamchart: 1,
      jamchart_description: 'Uncommonly patient Simple.', soundcheck: '', artistid: 1,
    },
    {
      showid: 1252344800, showdate: '1997-11-22',
      permalink: 'https://phish.net/setlists/phish-november-22-1997-hampton-coliseum-hampton-va-usa.html',
      venue: 'Hampton Coliseum', city: 'Hampton', state: 'VA', country: 'USA',
      tourname: '1997 Fall Tour',
      setlistnotes: 'This show was officially released as Hampton Comes Alive.',
      set: '2', position: 1, song: 'Halleys Comet', songid: 508, transmark: ', ',
      footnote: '', gap: 15, isjamchart: 0, jamchart_description: null,
      soundcheck: '', artistid: 1,
    },
    {
      showid: 1252344800, showdate: '1997-11-22',
      permalink: 'https://phish.net/setlists/phish-november-22-1997-hampton-coliseum-hampton-va-usa.html',
      venue: 'Hampton Coliseum', city: 'Hampton', state: 'VA', country: 'USA',
      tourname: '1997 Fall Tour',
      setlistnotes: 'This show was officially released as Hampton Comes Alive.',
      set: 'e', position: 1, song: 'Sleeping Monkey', songid: 1149, transmark: ' > ',
      footnote: '', gap: 33, isjamchart: 0, jamchart_description: null,
      soundcheck: '', artistid: 1,
    },
    {
      showid: 1252344800, showdate: '1997-11-22',
      permalink: 'https://phish.net/setlists/phish-november-22-1997-hampton-coliseum-hampton-va-usa.html',
      venue: 'Hampton Coliseum', city: 'Hampton', state: 'VA', country: 'USA',
      tourname: '1997 Fall Tour',
      setlistnotes: 'This show was officially released as Hampton Comes Alive.',
      set: 'e2', position: 1, song: 'Rocky Top', songid: 1061, transmark: '',
      footnote: '', gap: 19, isjamchart: 0, jamchart_description: null,
      soundcheck: '', artistid: 1,
    },
  ],
};

// One date, two shows — a festival day or a two-a-day. Distinguished by
// show_id, which is what the adapters group on.
const ELGOOSE_TWO_SHOWS_ONE_DATE = {
  error: 0,
  error_message: null,
  data: [
    {
      showdate: '2024-06-22', permalink: 'https://elgoose.net/setlists/?d=2024-06-22a',
      venuename: 'The Gorge Amphitheatre', city: 'George', state: 'WA', country: 'USA',
      settype: 'Set', setnumber: 1, position: 1, songname: 'Dripfield',
      transition: '', footnote: '', isjamchart: 0, jamchart_description: null,
      soundcheck: 0, opener: 1, isoriginal: 1, gap: 2, tourname: 'Summer 2024',
      show_id: 1700, uniqueid: 'eg-dripfield', artist_id: 1, slug: 'dripfield',
    },
    {
      showdate: '2024-06-22', permalink: 'https://elgoose.net/setlists/?d=2024-06-22b',
      venuename: 'Bonnaroo', city: 'Manchester', state: 'TN', country: 'USA',
      settype: 'Set', setnumber: 1, position: 1, songname: 'Red Bird',
      transition: '', footnote: '', isjamchart: 0, jamchart_description: null,
      soundcheck: 0, opener: 1, isoriginal: 1, gap: 5, tourname: 'Summer 2024',
      show_id: 1701, uniqueid: 'eg-red-bird', artist_id: 1, slug: 'red-bird',
    },
  ],
};

const ELGOOSE_ERROR = {
  error: 1,
  error_message: 'No results found',
  data: [],
};

const PHISHNET_ERROR = {
  error: true,
  error_message: 'Invalid API key',
  data: [],
};

// The trap the explicit envelope checks exist for. If either adapter tested
// its error node truthily, a *string* "true"/"1" would read as falsy and a
// hard failure would be reported as a successful empty result.
const PHISHNET_ERROR_STRING = {
  error: 'true',
  error_message: 'Invalid API key',
  data: [],
};

module.exports = {
  ELGOOSE_ERROR,
  ELGOOSE_RADIO_CITY,
  ELGOOSE_TWO_SHOWS_ONE_DATE,
  PHISHNET_ERROR,
  PHISHNET_ERROR_STRING,
  PHISHNET_HAMPTON,
};
