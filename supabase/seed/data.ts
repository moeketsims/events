/**
 * Demo data for the CUT Fundraising Gala Dinner. BUILD-SPEC §11.
 *
 * Every person here is invented. Names are drawn from the language groups of
 * the Free State so the guest list reads like a real CUT event, but no row
 * corresponds to a living person: emails are all `@example.com`, reserved by
 * RFC 2606 and undeliverable, and phones are all in the `+27 82 000 00xx`
 * block. Nothing from CUT's actual donor or alumni records may enter the system
 * before the POPIA review (PLAN.md §5.4).
 */

export type SeedContact = {
  firstName: string;
  lastName: string;
  tags: string[];
  alumniYear?: number;
  donorTier?: string;
  organisation?: string;
  title?: string;
};

export const CONTACTS: SeedContact[] = [
  {
    firstName: 'Naledi',
    lastName: 'Mokoena',
    tags: ['alumni', 'donor'],
    alumniYear: 2009,
    donorTier: 'gold',
  },
  { firstName: 'Thabo', lastName: 'Mofokeng', tags: ['alumni'], alumniYear: 2014 },
  {
    firstName: 'Lerato',
    lastName: 'Dlamini',
    tags: ['alumni', 'donor'],
    alumniYear: 2002,
    donorTier: 'platinum',
  },
  {
    firstName: 'Sipho',
    lastName: 'Ndlovu',
    tags: ['partner'],
    organisation: 'Bloem Engineering Works',
    title: 'Managing Director',
  },
  { firstName: 'Ayanda', lastName: 'Khumalo', tags: ['alumni'], alumniYear: 2018 },
  {
    firstName: 'Johan',
    lastName: 'van der Merwe',
    tags: ['donor'],
    donorTier: 'silver',
    organisation: 'Free State Agri',
  },
  { firstName: 'Palesa', lastName: 'Radebe', tags: ['alumni', 'staff'], alumniYear: 2011 },
  { firstName: 'Karabo', lastName: 'Sithole', tags: ['alumni'], alumniYear: 1998 },
  {
    firstName: 'Refilwe',
    lastName: 'Molefe',
    tags: ['alumni', 'donor'],
    alumniYear: 2006,
    donorTier: 'gold',
  },
  { firstName: 'Tebogo', lastName: 'Nkosi', tags: ['alumni'], alumniYear: 2016 },
  { firstName: 'Annelie', lastName: 'Botha', tags: ['staff'], title: 'Faculty Administrator' },
  {
    firstName: 'Mandla',
    lastName: 'Zulu',
    tags: ['alumni', 'partner'],
    alumniYear: 1995,
    organisation: 'Zulu Quantity Surveyors',
  },
  { firstName: 'Dineo', lastName: 'Tshabalala', tags: ['alumni'], alumniYear: 2020 },
  { firstName: 'Pieter', lastName: 'Steyn', tags: ['donor'], donorTier: 'silver' },
  {
    firstName: 'Nomsa',
    lastName: 'Maseko',
    tags: ['alumni', 'donor'],
    alumniYear: 2004,
    donorTier: 'gold',
  },
  { firstName: 'Kagiso', lastName: 'Letsoalo', tags: ['alumni'], alumniYear: 2013 },
  { firstName: 'Zanele', lastName: 'Mthembu', tags: ['staff'], title: 'Senior Lecturer' },
  { firstName: 'Tshepo', lastName: 'Motaung', tags: ['alumni'], alumniYear: 2008 },
  {
    firstName: 'Marelize',
    lastName: 'du Plessis',
    tags: ['partner'],
    organisation: 'Mangaung Hospitality Group',
  },
  {
    firstName: 'Bongani',
    lastName: 'Mahlangu',
    tags: ['alumni', 'donor'],
    alumniYear: 2001,
    donorTier: 'platinum',
  },
  { firstName: 'Puleng', lastName: 'Seleke', tags: ['alumni'], alumniYear: 2017 },
  { firstName: 'Hendrik', lastName: 'Kruger', tags: ['donor'], donorTier: 'bronze' },
  { firstName: 'Thandiwe', lastName: 'Nhlapo', tags: ['alumni', 'staff'], alumniYear: 2010 },
  { firstName: 'Lebohang', lastName: 'Moloi', tags: ['alumni'], alumniYear: 1993 },
  { firstName: 'Anele', lastName: 'Gumede', tags: ['alumni'], alumniYear: 2019 },
  {
    firstName: 'Susanna',
    lastName: 'Fourie',
    tags: ['partner'],
    organisation: 'Clarens Guest Estates',
  },
  {
    firstName: 'Katlego',
    lastName: 'Phiri',
    tags: ['alumni', 'donor'],
    alumniYear: 2005,
    donorTier: 'gold',
  },
  { firstName: 'Nolwazi', lastName: 'Buthelezi', tags: ['alumni'], alumniYear: 2015 },
  { firstName: 'Gerhard', lastName: 'Coetzee', tags: ['donor'], donorTier: 'silver' },
  { firstName: 'Mpho', lastName: 'Ramaphosa', tags: ['alumni'], alumniYear: 2012 },
  {
    firstName: 'Zinhle',
    lastName: 'Cele',
    tags: ['alumni', 'donor'],
    alumniYear: 2000,
    donorTier: 'gold',
  },
  { firstName: 'Neo', lastName: 'Makhanya', tags: ['alumni'], alumniYear: 2021 },
  { firstName: 'Elsabe', lastName: 'Venter', tags: ['staff'], title: 'Head of Department' },
  { firstName: 'Sibusiso', lastName: 'Mabaso', tags: ['alumni'], alumniYear: 1988 },
  {
    firstName: 'Boitumelo',
    lastName: 'Kgosi',
    tags: ['alumni', 'partner'],
    alumniYear: 2007,
    organisation: 'Kgosi Consulting',
  },
  { firstName: 'Chantel', lastName: 'Nel', tags: ['donor'], donorTier: 'bronze' },
  { firstName: 'Lungile', lastName: 'Sibanda', tags: ['alumni'], alumniYear: 2003 },
  {
    firstName: 'Reneilwe',
    lastName: 'Mashego',
    tags: ['alumni', 'donor'],
    alumniYear: 1985,
    donorTier: 'platinum',
  },
  {
    firstName: 'Jacobus',
    lastName: 'Pretorius',
    tags: ['partner'],
    organisation: 'Cheetahs Rugby Union',
  },
  { firstName: 'Ntombi', lastName: 'Zwane', tags: ['alumni', 'staff'], alumniYear: 1997 },
];

export type SeedLot = {
  lotNumber: number;
  title: string;
  description: string;
  donorName: string;
  startingBid: number;
  reserve?: number;
  /** How many seeded bids to place. Lot 6 opens empty so the demo can show a first bid. */
  seedBids: number;
  image: string;
};

export const LOTS: SeedLot[] = [
  {
    lotNumber: 1,
    title: 'Weekend for two at a Clarens guesthouse',
    description:
      'Two nights for two in the Eastern Free State, breakfast included. Valid for twelve months, subject to availability.',
    donorName: 'Clarens Guest Estates',
    startingBid: 3000,
    seedBids: 3,
    image: 'lot-1.jpg',
  },
  {
    lotNumber: 2,
    title: 'Signed Cheetahs rugby jersey',
    description: 'Match jersey signed by the full squad, framed and ready to hang.',
    donorName: 'Cheetahs Rugby Union',
    startingBid: 1500,
    seedBids: 4,
    image: 'lot-2.jpg',
  },
  {
    lotNumber: 3,
    title: 'Original artwork by a CUT Design graduate',
    description:
      'Mixed media on canvas, 900 x 600 mm, from the 2025 graduate exhibition. Certificate of authenticity included.',
    donorName: 'CUT Faculty of Humanities',
    startingBid: 5000,
    // Deliberately above what the seeded bids reach, so the demo can show a lot
    // closing unsold under reserve.
    reserve: 6000,
    seedBids: 2,
    image: 'lot-3.jpg',
  },
  {
    lotNumber: 4,
    title: 'Executive braai set',
    description: 'Hand-forged tools in a leather roll, with a hardwood board and a cast-iron grid.',
    donorName: 'Bloem Engineering Works',
    startingBid: 2000,
    seedBids: 3,
    image: 'lot-4.jpg',
  },
  {
    lotNumber: 5,
    title: 'One year of CUT Hotel School Sunday lunches',
    description: 'Sunday lunch for two, once a month for a year, at the CUT Hotel School.',
    donorName: 'CUT Hotel School',
    startingBid: 6000,
    seedBids: 2,
    image: 'lot-5.jpg',
  },
  {
    lotNumber: 6,
    title: "Sponsor a first-year's textbooks for a year",
    description:
      'A full year of prescribed textbooks for one first-year student in financial need. CUT is a public benefit organisation; a Section 18A certificate can be issued on request.',
    donorName: 'CUT Annual Fund',
    startingBid: 1500,
    seedBids: 0,
    image: 'lot-6.jpg',
  },
];

export const STAFF = [
  {
    email: 'admin@demo.cut-events.test',
    fullName: 'Abongile Demo',
    role: 'platform_admin' as const,
  },
  {
    email: 'organiser@demo.cut-events.test',
    fullName: 'Qondakele Demo',
    role: 'organiser' as const,
  },
  { email: 'door@demo.cut-events.test', fullName: 'Thabo Door', role: 'door_staff' as const },
];

export const DEPARTMENT = {
  name: 'Institutional Advancement (Demo)',
  slug: 'demo',
};

export const EVENT = {
  title: 'CUT Fundraising Gala Dinner (Demo)',
  slug: 'cut-fundraising-gala-dinner-demo',
  description:
    'An evening in support of the CUT Annual Fund, with a silent auction through dinner. The real gala is on the university calendar; this is the demonstration copy of it.',
  // 18:00 SAST on Friday 30 October 2026 is 16:00 UTC.
  startsAt: '2026-10-30T16:00:00.000Z',
  endsAt: '2026-10-30T21:00:00.000Z',
  venueName: 'CUT Hotel School, Bloemfontein',
  venueAddress: '20 President Brand Street, Bloemfontein, 9301',
  capacity: 200,
  rsvpDeadline: '2026-10-23T21:59:59.000Z',
};

/** Silent auction closes at 21:30 SAST = 19:30 UTC. */
export const AUCTION_CLOSES_AT = '2026-10-30T19:30:00.000Z';

/** How the 40 invitations divide. BUILD-SPEC §11. */
export const SPLIT = {
  accepted: 28,
  declined: 6,
  pending: 6,
  /** Of the accepted, how many are already through the door with bidder numbers. */
  checkedIn: 12,
};
