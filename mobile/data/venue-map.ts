export type StallType = 'brand' | 'cafe' | 'lounge' | 'feature' | 'directory' | 'service' | 'entry' | 'exit';

export interface Stall {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: StallType;
  brandId?: string;
}

export interface NavNode {
  id: string;
  x: number;
  y: number;
}

export const VENUE_MAP = {
  refWidth: 1500,
  refHeight: 2000,

  stalls: [
    { id: 'ad-cafe-1',        label: 'AD CAFÉ',                       x:  272, y:  419, w: 195, h: 125, type: 'cafe' },
    { id: 'fca',              label: 'FCA',                           x:  586, y:  406, w: 125, h:  55, type: 'brand' },
    { id: 'attitudes',        label: 'ATTITUDES',                     x:  681, y:  602, w:  95, h:  75, type: 'brand' },
    { id: 'fenesta',          label: 'FENESTA',                       x:  789, y:  534, w: 105, h:  65, type: 'brand' },
    { id: 'india-circus',     label: 'INDIA CIRCUS BY KRSNAA MEHTA', x:  785, y:  618, w: 105, h: 120, type: 'brand' },
    { id: 'sioraa',           label: 'SIORAA',                        x:  972, y:  451, w: 115, h:  60, type: 'brand' },
    { id: 'ad-cafe-2',        label: 'AD CAFÉ',                       x: 1089, y:  430, w:  95, h:  55, type: 'cafe' },
    { id: 'asign',            label: 'ASIGN',                         x: 1089, y:  499, w:  95, h:  55, type: 'brand' },
    { id: 'ad-discoveries-1', label: 'AD DISCOVERIES',                x: 1255, y:  443, w:  95, h: 125, type: 'directory' },

    { id: 'merino',       label: 'MERINO',       x: 234, y:  600, w:  88, h: 135, type: 'brand' },
    { id: 'square-knots', label: 'SQUARE KNOTS', x: 233, y:  743, w:  88, h: 100, type: 'brand' },
    { id: 'masha-art',    label: 'MASHA ART',    x: 233, y:  990, w:  88, h: 210, type: 'brand' },
    { id: 'square-foot',  label: 'SQUARE FOOT',  x: 236, y: 1300, w:  88, h: 155, type: 'brand' },
    { id: 'venzo',        label: 'VENZO',         x: 236, y: 1500, w:  88, h:  80, type: 'brand' },
    { id: 'espravo',      label: 'ESPRAVO',       x: 265, y: 1690, w: 128, h:  80, type: 'brand' },

    { id: 'takshni',         label: 'TAKSHNI',                        x: 368, y:  637, w: 105, h:  65, type: 'brand' },
    { id: 'exhibit-320',     label: 'EXHIBIT 320',                    x: 484, y:  667, w: 155, h:  65, type: 'brand' },
    { id: 'rivvaz',          label: 'RIVVAZ',                         x: 371, y:  708, w: 105, h:  65, type: 'brand' },
    { id: 'delta-faucet',    label: 'DELTA FAUCET COMPANY',           x: 404, y:  856, w: 165, h: 108, type: 'brand' },
    { id: 'specta-surfaces', label: 'SPECTA SURFACES',                x: 382, y: 1045, w: 105, h:  85, type: 'brand' },
    { id: 'temple-town',     label: 'TEMPLE TOWN BY MEERA PYARELAL', x: 483, y: 1021, w: 105, h: 118, type: 'brand' },
    { id: 'align-mr-glass',  label: 'ALIGN BY MR. GLASS',            x: 371, y: 1157, w: 105, h:  80, type: 'brand' },
    { id: 'bespoke-gallery', label: 'BESPOKE ART GALLERY AHMEDABAD', x: 483, y: 1145, w: 105, h: 115, type: 'brand' },
    { id: 'ipse-ipsa-ipsum', label: 'IPSE IPSA IPSUM',               x: 369, y: 1303, w: 105, h:  80, type: 'brand' },
    { id: 'metanestt',       label: 'METANESTT',                      x: 479, y: 1316, w: 105, h:  65, type: 'brand' },
    { id: 'ozone',           label: 'OZONE',                          x: 393, y: 1393, w: 178, h:  65, type: 'brand' },
    { id: 'beyond-square',   label: 'BEYOND SQUARE UDAIPUR',          x: 384, y: 1551, w: 178, h:  80, type: 'brand' },

    { id: 'ad-selections',    label: 'AD SELECTIONS',            x: 698, y:  769, w: 175, h: 138, type: 'feature' },
    { id: 'ad-lounge',        label: 'AD LOUNGE',                x: 697, y:  986, w: 175, h: 225, type: 'lounge' },
    { id: 'ica-italian-wood', label: 'ICA ITALIAN WOOD FINISHES', x: 701, y: 1348, w: 175, h: 135, type: 'brand' },
    { id: 'jaipur-rugs',      label: 'JAIPUR RUGS',              x: 688, y: 1555, w: 175, h: 105, type: 'brand' },

    { id: 'ad-cafe-3',     label: 'AD CAFÉ',                    x:  964, y: 636, w: 115, h:  60, type: 'cafe' },
    { id: 'formforge',     label: 'FORMFORGE BY ABHINAV GOYAL', x:  972, y: 699, w: 115, h: 108, type: 'brand' },
    { id: 'the-artisania', label: 'THE ARTISANIA',              x: 1082, y: 626, w: 115, h: 145, type: 'brand' },

    { id: 'littlebird-india', label: 'LITTLEBIRD INDIA',             x:  976, y:  820, w: 105, h:  80, type: 'brand' },
    { id: 'art-and-charlie',  label: 'ART AND CHARLIE',              x: 1089, y:  820, w: 108, h:  80, type: 'brand' },
    { id: 'kalakaari-haath',  label: 'KALAKAARI HAATH',              x:  972, y:  910, w: 105, h:  85, type: 'brand' },
    { id: 'solid-bench',      label: 'SOLID BENCH',                  x: 1090, y:  904, w: 108, h:  85, type: 'brand' },
    { id: 'coast-to-coast',   label: 'COAST TO COAST DESIGNS',       x:  972, y: 1045, w: 105, h:  92, type: 'brand' },
    { id: 'ad-pro-directory', label: 'AD PRO DIRECTORY',             x: 1080, y: 1042, w: 108, h:  92, type: 'directory' },
    { id: 'aadyam-handwoven', label: 'AADYAM HANDWOVEN',             x:  972, y: 1164, w: 105, h:  90, type: 'brand' },
    { id: 'amore-muro',       label: 'AMORE MURO',                   x: 1089, y: 1150, w: 108, h:  90, type: 'brand' },
    { id: 'art-centrix',      label: 'ART CENTRIX SPACE',            x:  975, y: 1301, w: 105, h:  88, type: 'brand' },
    { id: 'house-of-esthete', label: 'THE HOUSE OF ESTHETE',         x: 1083, y: 1302, w: 108, h:  88, type: 'brand' },
    { id: 'antique-loft',     label: 'THE ANTIQUE LOFT - COLLEZIONI', x: 967, y: 1395, w: 220, h:  70, type: 'brand' },
    { id: 'poltrona-frau',    label: 'POLTRONA FRAU',                x:  977, y: 1555, w: 220, h:  95, type: 'brand' },
    { id: 'baccarat',         label: 'BACCARAT',                     x:  970, y: 1694, w: 220, h:  95, type: 'brand' },

    { id: 'ad-discoveries-2',  label: 'AD DISCOVERIES',             x: 1250, y:  707, w: 110, h: 125, type: 'directory' },
    { id: 'simpolo',           label: 'SIMPOLO TILE & BATHWARE',    x: 1248, y:  887, w: 110, h: 208, type: 'brand' },
    { id: 'house-of-edwa',     label: 'HOUSE OF EDWA',              x: 1250, y: 1111, w: 110, h:  90, type: 'brand' },
    { id: 'nilaya-reddy',      label: 'NILAYA REDDY FINE JEWELLERY', x: 1254, y: 1214, w: 110, h: 105, type: 'brand' },
    { id: 'ad-cafe-4',         label: 'AD CAFÉ',                    x: 1251, y: 1382, w: 110, h:  88, type: 'cafe' },

    { id: 'box-office', label: 'BOX OFFICE', x: 576, y: 1747, w: 180, h:  78, type: 'service' },
    { id: 'exit-1',     label: 'EXIT',        x: 841, y: 1815, w:  82, h:  55, type: 'exit' },
    { id: 'entry-1',    label: 'ENTRY',       x: 634, y: 1889, w: 100, h:  38, type: 'entry' },
  ] as Stall[],

  // Nav nodes placed in actual corridor/aisle spaces — never inside a stall box.
  //
  // Vertical corridors:
  //   xL=195  — between left wall and MERINO column (x=234)
  //   xCL=345 — between MERINO column (ends 322) and center-left stalls (start 368)
  //   xC=660  — between center-left stalls (end ~590) and center block (start 698)
  //   xR=920  — between center block (end 873) and right section (start 964)
  //   xFR=1225— between right section (end ~1197) and far-right stalls (start 1248)
  //
  // Horizontal corridors:
  //   y=390  — top aisle, above all stalls
  //   y=570  — after top stall zone (AD CAFÉ ends 544, ASIGN ends 554)
  //   y=965  — middle aisle (AD SELECTIONS ends 907, DELTA FAUCET ends 964, AD LOUNGE starts 986)
  //   y=1270 — lower-middle (AD LOUNGE ends 1211, ICA starts 1348)
  //   y=1500 — lower (ICA ends 1483, JAIPUR starts 1555)
  //   y=1665 — near-bottom (VENZO ends 1580, ESPRAVO starts 1690)
  navNodes: [
    // Column xL=195 (between left wall and MERINO at x=234)
    { id: 'a1', x: 195, y:  390 },
    { id: 'a2', x: 195, y:  570 },
    { id: 'a3', x: 195, y:  965 },
    { id: 'a4', x: 195, y: 1270 },
    { id: 'a5', x: 195, y: 1500 },
    { id: 'a6', x: 195, y: 1665 },

    // Column xCL=345 (between MERINO col ends-322 and center-left starts-368)
    // b1↔b2 omitted: AD CAFÉ (x=272-467, y=419-544) blocks x=345 in that range
    { id: 'b1', x: 345, y:  390 },
    { id: 'b2', x: 345, y:  570 },
    { id: 'b3', x: 345, y:  965 },
    { id: 'b4', x: 345, y: 1270 },
    { id: 'b5', x: 345, y: 1500 },
    { id: 'b6', x: 345, y: 1665 },

    // Column xC=660 (between center-left ends-~590 and center block starts-698)
    // c1↔c2 omitted: FCA (x=586-711, y=406-461) blocks x=660 in that range
    { id: 'c1', x: 660, y:  390 },
    { id: 'c2', x: 660, y:  570 },
    { id: 'c3', x: 660, y:  965 },
    { id: 'c4', x: 660, y: 1270 },
    { id: 'c5', x: 660, y: 1500 },
    { id: 'c6', x: 660, y: 1665 },

    // Column xR=920 (between center block ends-873 and right section starts-964)
    { id: 'd1', x: 920, y:  390 },
    { id: 'd2', x: 920, y:  570 },
    { id: 'd3', x: 920, y:  965 },
    { id: 'd4', x: 920, y: 1270 },
    { id: 'd5', x: 920, y: 1500 },
    { id: 'd6', x: 920, y: 1665 },

    // Column xFR=1225 (between right section ends-~1197 and far-right starts-1248)
    { id: 'e1', x: 1225, y:  390 },
    { id: 'e2', x: 1225, y:  570 },
    { id: 'e3', x: 1225, y:  965 },
    { id: 'e4', x: 1225, y: 1270 },
  ] as NavNode[],

  navEdges: [
    // Vertical — column xL=195 (clear full height, left of all stalls)
    ['a1','a2'], ['a2','a3'], ['a3','a4'], ['a4','a5'], ['a5','a6'],

    // Vertical — column xCL=345 (b1-b2 skipped: AD CAFÉ blocks that segment)
    ['b2','b3'], ['b3','b4'], ['b4','b5'], ['b5','b6'],

    // Vertical — column xC=660 (c1-c2 skipped: FCA blocks that segment)
    ['c2','c3'], ['c3','c4'], ['c4','c5'], ['c5','c6'],

    // Vertical — column xR=920
    ['d1','d2'], ['d2','d3'], ['d3','d4'], ['d4','d5'], ['d5','d6'],

    // Vertical — column xFR=1225
    ['e1','e2'], ['e2','e3'], ['e3','e4'],

    // Horizontal — y=390 (top aisle, above all stalls)
    ['a1','b1'], ['b1','c1'], ['c1','d1'], ['d1','e1'],

    // Horizontal — y=570 (below top stall zone)
    ['a2','b2'], ['b2','c2'], ['c2','d2'], ['d2','e2'],

    // Horizontal — y=965 (middle aisle, after DELTA FAUCET ends-964)
    ['a3','b3'], ['b3','c3'], ['c3','d3'], ['d3','e3'],

    // Horizontal — y=1270 (lower-middle)
    ['a4','b4'], ['b4','c4'], ['c4','d4'], ['d4','e4'],

    // Horizontal — y=1500 (lower)
    ['a5','b5'], ['b5','c5'], ['c5','d5'],

    // Horizontal — y=1665 (near-bottom)
    ['a6','b6'], ['b6','c6'], ['c6','d6'],
  ],
};
