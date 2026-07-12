// Designup Connect — Design System
// Dark Mode is the default. Light mode is toggled from Profile.
//
// ─── PALETTE SWITCHER ─────────────────────────────────────────────────────────
// Change ACTIVE_PALETTE to preview a different colour scheme instantly.
// ─────────────────────────────────────────────────────────────────────────────

type PaletteName =
  | 'terracotta' | 'prussian'   | 'saffron' | 'sage'  | 'teal'
  | 'champagne'  | 'burgundy'   | 'indigo'  | 'copper' | 'sand'
  // Sand base + swapped accent:
  | 'sand_slate' | 'sand_cobalt' | 'sand_steel' | 'sand_jade'
  | 'sand_rose'  | 'sand_coral'  | 'sand_plum'  | 'sand_mauve'
  | 'sand_olive' | 'sand_smokedteal'
  // Sand base + pastel greens:
  | 'sand_mint' | 'sand_pistachio' | 'sand_eucalyptus'
  // Cool grey base + accent variants:
  | 'grey_jade' | 'grey_slate' | 'grey_warm';

const ACTIVE_PALETTE: PaletteName = 'sand_jade';

// ─── A: Terracotta + Charcoal ─────────────────────────────────────────────────
// Warm, material, studio-like. References clay, stone, warm concrete.
const terracotta = {
  dark: {
    background: '#0D0B09', surface: '#1A1612', surfaceElevated: '#221E18',
    border: '#2E2720', text: '#FFFFFF', textSecondary: '#9A9490',
    textMuted: '#5A5450', accent: '#C4622D', gold: '#D4A853',
    tabBar: '#120F0C', scanOverlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#FAF7F2', surface: '#F0EBE3', surfaceElevated: '#E8E1D6',
    border: '#D8D0C4', text: '#1A1612', textSecondary: '#5A5450',
    textMuted: '#9A9490', accent: '#A84E22', gold: '#9A7A1A',
    tabBar: '#FAF7F2', scanOverlay: 'rgba(0,0,0,0.5)',
  },
};

// ─── B: Prussian Slate ────────────────────────────────────────────────────────
// Architectural, deep. References aged bronze, oxidised copper.
const prussian = {
  dark: {
    background: '#080C0C', surface: '#101818', surfaceElevated: '#182222',
    border: '#1E2E2E', text: '#FFFFFF', textSecondary: '#90A0A0',
    textMuted: '#506060', accent: '#2D8A8A', gold: '#C9A84C',
    tabBar: '#0A1010', scanOverlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#F4F7F7', surface: '#E8EEEE', surfaceElevated: '#DCE4E4',
    border: '#CDD8D8', text: '#080C0C', textSecondary: '#506060',
    textMuted: '#90A0A0', accent: '#1F6666', gold: '#9A7A20',
    tabBar: '#F4F7F7', scanOverlay: 'rgba(0,0,0,0.5)',
  },
};

// ─── C: Ink + Saffron ─────────────────────────────────────────────────────────
// High contrast editorial. References Wallpaper*, Architectural Digest.
const saffron = {
  dark: {
    background: '#080808', surface: '#141414', surfaceElevated: '#1C1C1C',
    border: '#242424', text: '#FFFFFF', textSecondary: '#9A9A9A',
    textMuted: '#5A5A5A', accent: '#E8871A', gold: '#C49A2A',
    tabBar: '#0A0A0A', scanOverlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#FAFAF8', surface: '#F2F1EE', surfaceElevated: '#E8E7E2',
    border: '#DDDBD4', text: '#080808', textSecondary: '#5A5A5A',
    textMuted: '#9A9A9A', accent: '#C46C0A', gold: '#9A7A1A',
    tabBar: '#FAFAF8', scanOverlay: 'rgba(0,0,0,0.5)',
  },
};

// ─── D: Muted Sage ────────────────────────────────────────────────────────────
// Quiet luxury. References Aesop, Kelly Wearstler, Indian craft heritage.
const sage = {
  dark: {
    background: '#090C09', surface: '#131813', surfaceElevated: '#1A211A',
    border: '#222922', text: '#FFFFFF', textSecondary: '#94A094',
    textMuted: '#546054', accent: '#6B8F71', gold: '#B89A3A',
    tabBar: '#0B0E0B', scanOverlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#F6F8F5', surface: '#ECF0EB', surfaceElevated: '#E0E6DF',
    border: '#D0D8CE', text: '#090C09', textSecondary: '#546054',
    textMuted: '#94A094', accent: '#4A7050', gold: '#9A7A20',
    tabBar: '#F6F8F5', scanOverlay: 'rgba(0,0,0,0.5)',
  },
};

// ─── E: Champagne + Noir ──────────────────────────────────────────────────────
// Ultra-luxury. References Bottega Veneta, high jewellery, fashion week.
// Warm champagne gold as accent on the deepest near-black background.
const champagne = {
  dark: {
    background: '#080706', surface: '#131210', surfaceElevated: '#1C1A17',
    border: '#2A2720', text: '#F5EDD8', textSecondary: '#A09880',
    textMuted: '#605848', accent: '#C8A96E', gold: '#C8A96E',
    tabBar: '#0A0907', scanOverlay: 'rgba(0,0,0,0.65)',
  },
  light: {
    background: '#FAF8F2', surface: '#F2EEE4', surfaceElevated: '#E8E2D4',
    border: '#D8D0BC', text: '#1A1612', textSecondary: '#605848',
    textMuted: '#A09880', accent: '#9A7840', gold: '#9A7840',
    tabBar: '#FAF8F2', scanOverlay: 'rgba(0,0,0,0.45)',
  },
};

// ─── F: Burgundy + Ink ────────────────────────────────────────────────────────
// Rich, confident, authoritative. References vintage design journals,
// leather-bound portfolios, the Connaught bar.
const burgundy = {
  dark: {
    background: '#09080A', surface: '#150F12', surfaceElevated: '#1E1419',
    border: '#2C1C22', text: '#FFFFFF', textSecondary: '#A09098',
    textMuted: '#605058', accent: '#A83252', gold: '#C9A84C',
    tabBar: '#0B090C', scanOverlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#FAF7F8', surface: '#F2ECF0', surfaceElevated: '#E8E0E4',
    border: '#D8CCD2', text: '#09080A', textSecondary: '#605058',
    textMuted: '#A09098', accent: '#8C2840', gold: '#9A7820',
    tabBar: '#FAF7F8', scanOverlay: 'rgba(0,0,0,0.5)',
  },
};

// ─── G: Deep Indigo ───────────────────────────────────────────────────────────
// Classic, considered, permanent. References premium stationery, Moleskine,
// India ink, the night sky over a courtyard house.
const indigo = {
  dark: {
    background: '#08080F', surface: '#10101C', surfaceElevated: '#181828',
    border: '#202038', text: '#FFFFFF', textSecondary: '#9090B8',
    textMuted: '#505078', accent: '#7B82D4', gold: '#C9A84C',
    tabBar: '#0A0A12', scanOverlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#F6F6FA', surface: '#EEEEF6', surfaceElevated: '#E4E4F0',
    border: '#D0D0E4', text: '#08080F', textSecondary: '#505078',
    textMuted: '#9090B8', accent: '#4A52AA', gold: '#9A7A20',
    tabBar: '#F6F6FA', scanOverlay: 'rgba(0,0,0,0.5)',
  },
};

// ─── H: Raw Copper ────────────────────────────────────────────────────────────
// Material warmth. References hand-hammered metal, artisan craft,
// the patina of a well-used studio. Warm without being orange.
const copper = {
  dark: {
    background: '#0C0906', surface: '#1A1410', surfaceElevated: '#231C16',
    border: '#302418', text: '#FFFFFF', textSecondary: '#A89078',
    textMuted: '#685848', accent: '#B87040', gold: '#C9A04A',
    tabBar: '#0E0B08', scanOverlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#FAF6F2', surface: '#F0E8E0', surfaceElevated: '#E6DDD2',
    border: '#D8CCC0', text: '#0C0906', textSecondary: '#685848',
    textMuted: '#A89078', accent: '#9A5A28', gold: '#9A7A20',
    tabBar: '#FAF6F2', scanOverlay: 'rgba(0,0,0,0.5)',
  },
};

// ─── I: Warm Sand + Espresso ──────────────────────────────────────────────────
// Natural, tactile, grounded. References raw linen, travertine stone,
// Tadao Ando concrete, Indian handmade paper.
const sand = {
  dark: {
    background: '#0C0A08', surface: '#1C1814', surfaceElevated: '#26221C',
    border: '#342E26', text: '#F0E8D8', textSecondary: '#A8998A',
    textMuted: '#685E52', accent: '#C8A878', gold: '#C8A050',
    tabBar: '#0E0C0A', scanOverlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#FAF8F4', surface: '#F0EBE2', surfaceElevated: '#E6DFD4',
    border: '#D8D0C4', text: '#1C1814', textSecondary: '#685E52',
    textMuted: '#A8998A', accent: '#9A7848', gold: '#9A7820',
    tabBar: '#FAF8F4', scanOverlay: 'rgba(0,0,0,0.5)',
  },
};

// ─── Original: Teal ───────────────────────────────────────────────────────────
const teal = {
  dark: {
    background: '#0A0A0A', surface: '#161616', surfaceElevated: '#1E1E1E',
    border: '#2A2A2A', text: '#FFFFFF', textSecondary: '#9A9A9A',
    textMuted: '#5A5A5A', accent: '#00B4B4', gold: '#B8972A',
    tabBar: '#111111', scanOverlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#FFFFFF', surface: '#F5F5F5', surfaceElevated: '#EFEFEF',
    border: '#E0E0E0', text: '#0A0A0A', textSecondary: '#5A5A5A',
    textMuted: '#9A9A9A', accent: '#007A7A', gold: '#9A7A1A',
    tabBar: '#FFFFFF', scanOverlay: 'rgba(0,0,0,0.5)',
  },
};

// ─── Sand base, accent variants ───────────────────────────────────────────────
// Same warm sand backgrounds + gold CTAs. Only accent changes each time.
const sandBase = (accentDark: string, accentLight: string) => ({
  dark: {
    background: '#0C0A08', surface: '#1C1814', surfaceElevated: '#26221C',
    border: '#342E26', text: '#F0E8D8', textSecondary: '#A8998A',
    textMuted: '#685E52', accent: accentDark, gold: '#C8A050',
    tabBar: '#0E0C0A', scanOverlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#FAF8F4', surface: '#F0EBE2', surfaceElevated: '#E6DFD4',
    border: '#D8D0C4', text: '#1C1814', textSecondary: '#685E52',
    textMuted: '#A8998A', accent: accentLight, gold: '#9A7820',
    tabBar: '#FAF8F4', scanOverlay: 'rgba(0,0,0,0.5)',
  },
});

const sand_slate      = sandBase('#7A9AAA', '#4A7080');
const sand_cobalt     = sandBase('#5E7E9E', '#3A5E80');
const sand_steel      = sandBase('#6E8898', '#485E6E');
const sand_jade       = sandBase('#6A9888', '#407060');
const sand_rose       = sandBase('#B87878', '#905055');
const sand_coral      = sandBase('#C07868', '#904840');
const sand_plum       = sandBase('#9A7898', '#705068');
const sand_mauve      = sandBase('#A88898', '#786070');
const sand_olive      = sandBase('#8A9068', '#5A6040');
const sand_smokedteal = sandBase('#5A8880', '#386058');

// ─── Sand base + Pastel Greens ────────────────────────────────────────────────
// Lighter, airier greens vs jade. Mint is coolest, pistachio is yellow-green,
// eucalyptus sits between them with a grey-green softness.
const sand_mint        = sandBase('#5DB8A0', '#398070'); // cool aqua-mint
const sand_pistachio   = sandBase('#88A870', '#587848'); // yellow-green, botanical
const sand_eucalyptus  = sandBase('#78A890', '#4A7060'); // grey-green, softest

// ─── Cool Grey Base ───────────────────────────────────────────────────────────
// Replaces warm beige with a neutral cool grey — cards feel less sandy.
// Gold CTAs kept the same so hierarchy stays clear.
const greyBase = (accentDark: string, accentLight: string) => ({
  dark: {
    background: '#0A0A0C', surface: '#16161A', surfaceElevated: '#202026',
    border: '#2C2C34', text: '#F0F0F2', textSecondary: '#9898A8',
    textMuted: '#5C5C6C', accent: accentDark, gold: '#C8A050',
    tabBar: '#0C0C10', scanOverlay: 'rgba(0,0,0,0.65)',
  },
  light: {
    background: '#F4F4F7', surface: '#EAEAEF', surfaceElevated: '#DFDFE8',
    border: '#CECEDA', text: '#18181E', textSecondary: '#525260',
    textMuted: '#9494A8', accent: accentLight, gold: '#9A7820',
    tabBar: '#F4F4F7', scanOverlay: 'rgba(0,0,0,0.5)',
  },
});

const grey_jade  = greyBase('#6A9888', '#407060'); // same jade accent, grey cards
const grey_slate = greyBase('#7A9AAA', '#4A7080'); // slate blue on grey
const grey_warm  = greyBase('#A89080', '#786050'); // warm taupe accent on grey

const palettes = {
  terracotta, prussian, saffron, sage, champagne, burgundy, indigo, copper, sand, teal,
  sand_slate, sand_cobalt, sand_steel, sand_jade, sand_rose,
  sand_coral, sand_plum, sand_mauve, sand_olive, sand_smokedteal,
  sand_mint, sand_pistachio, sand_eucalyptus,
  grey_jade, grey_slate, grey_warm,
};

export const Colors = palettes[ACTIVE_PALETTE];

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const Radius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 999,
};

export const FontSize = {
  xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 30,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
