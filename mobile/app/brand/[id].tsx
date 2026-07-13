import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  Alert, Platform, ToastAndroid, Modal, Dimensions,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const APP_W = Math.min(SCREEN_W, 430); // cap to app width on web
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useHeaderPaddingTop } from '../../lib/safeArea';
import { Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { getBrand, type ApiBrand } from '../../lib/api';
import NotesModal from '../../components/NotesModal';
import { getCachedCover, getCachedProductImage, subscribeToCache } from '../../lib/unsplash';

async function copyToClipboard(value: string, label: string) {
  await Clipboard.setStringAsync(value);
  if (Platform.OS === 'android') {
    ToastAndroid.show(`${label} copied`, ToastAndroid.SHORT);
  } else {
    Alert.alert('Copied', `${label} copied to clipboard`);
  }
}

function resolveId(raw: string): string {
  if (/^b\d{2,}$/.test(raw)) return raw;
  const match = raw.match(/^b(\d+)$/);
  if (match) return `b${match[1].padStart(2, '0')}`;
  return raw;
}

type SimState = 'idle' | 'capture' | 'saving' | 'success';
type BrandTab = 'about' | 'collections' | 'catalogue' | 'past_exhibitions' | 'projects';

interface Collection { id: string; name: string; description: string; images: string[] }
interface PastShow {
  id: string; exhibition_name: string; city: string; year: string; booth: string; images: string[];
  booth_images?: string[]; interaction_images?: string[]; product_images?: string[]; about?: string;
}

// Sample collections for select brands (brand_id → collections)
const BRAND_COLLECTIONS: Record<string, Collection[]> = {
  b01: [
    { id: 'b01-col1', name: 'Nocturne Collection', description: 'A suite of fixtures designed for the hours after sunset — warmer CCTs, softer diffusion, sculptural forms that hold their own in darkness.', images: ['https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=800', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'] },
    { id: 'b01-col2', name: 'Studio Edit 2025', description: 'Our annual curated selection of pieces that define how we see light this year — minimal, purposeful, material-honest.', images: ['https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=800', 'https://images.unsplash.com/photo-1513506003901-1e6a35f9e30a?w=800'] },
  ],
  b03: [
    { id: 'b03-col1', name: 'Monolith Series', description: 'Solid-form furniture built for longevity. Each piece references the permanence of stone — raw material, refined proportion.', images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800', 'https://images.unsplash.com/photo-1549187774-b4e9b0445b41?w=800', 'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=800'] },
  ],
  b07: [
    { id: 'b07-col1', name: 'Forest Edit', description: 'Furniture and objects designed around reclaimed and FSC-certified wood — celebrating grain, knot, and imperfection.', images: ['https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=800', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800'] },
    { id: 'b07-col2', name: 'Earth Tones', description: 'A palette-driven edit — all pieces in this collection share a commitment to natural, undyed, unsealed finishes.', images: ['https://images.unsplash.com/photo-1581539250439-c96689b516dd?w=800', 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=800'] },
  ],
  b11: [
    { id: 'b11-col1', name: 'Monsoon Botanicals', description: 'Original works inspired by the Indian monsoon — watercolour, ink, and mixed media on archival paper.', images: ['https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800', 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'] },
  ],
  'arisaa-b01-2024': [
    {
      id: 'arisaa-c01',
      name: 'Of the Earth',
      description: 'Wall pieces and reliefs in natural pigment, clay, and raw mineral — each surface a record of material time. Made to be read slowly: the closer you look, the more texture reveals itself.',
      images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0300321c-5336-41ec-be26-4c0082d245ca/Of+the+Earth+%281%29.png',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/b17cc747-fe59-4b03-ad7e-509fa988f324/_R8A2413-edit.jpg',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/6097b573-1fc9-4770-8965-2edcde445095/_R8A3250edited-new.jpg',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eb0013af-bbeb-40ec-8b21-77833b7e9bef/ARSD00415.jpg',
      ],
    },
    {
      id: 'arisaa-c02',
      name: 'Reflections',
      description: 'Mirrors shaped by hand rather than machine — each frame a study in material honesty. Gilded brass, raw linen, organic edge. Every surface is an invitation to look twice.',
      images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/f85e0e44-1696-4063-baaa-a8c0bcaf3049/Gilded+current4a.jpg',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0bd027f7-ee1f-46bf-9291-2fd7739d8061/web+rs.jpg',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/6097b573-1fc9-4770-8965-2edcde445095/_R8A3250edited-new.jpg',
      ],
    },
    {
      id: 'arisaa-c03',
      name: 'Woven Grounds',
      description: 'Floor pieces woven in natural wool, cotton, and jute — geometry and touch in conversation. Designed to age beautifully underfoot, each rug is a landscape you live on.',
      images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/50193dd1-52f1-4501-abe2-df9323063be4/Drava-web-3.png',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/a7d37874-2573-494d-9eb9-a45b71997213/ARSD00404.jpg',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eb0013af-bbeb-40ec-8b21-77833b7e9bef/ARSD00415.jpg',
      ],
    },
  ],
  'hjd-b01-2024': [
    {
      id: 'hjd-c01',
      name: 'The Rio Collection',
      description: 'Wall lights sculpted from natural stone — travertine, rainforest marble, alabaster, and pizzato — each with signature fluting and brass accents. Every piece is unique, shaped by the veining and colour of the stone it is carved from.',
      images: [
        'https://static.wixstatic.com/media/67a4ef_56422cdaf100415fac61c15a5d349eb1~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_dc0794650c6c43b696de70f4482da15b~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_79bde5707e094e9381712fdbb35a33be~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_64ac390b3a824bb6ab7b80fe2b40bf9e~mv2.jpg',
      ],
    },
    {
      id: 'hjd-c02',
      name: 'Totem Series',
      description: 'Freestanding floor lamps that read as sculpture. Built over 80+ hours in clay stoneware and claypaste on a mild steel armature, each totem carries the full material vocabulary of the studio from first lamp to latest form.',
      images: [
        'https://static.wixstatic.com/media/67a4ef_090f6f2764474878a6a056f4ec953a2a~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_1219ac2b81634ab4af00330ea192d085~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_32a6d73160f94665aeec5fa37c1be4c3~mv2.jpg',
      ],
    },
    {
      id: 'hjd-c03',
      name: 'Pendants & Chandeliers',
      description: 'Ceiling fixtures that define a room — from the delicate Bloom pendant tracing a flower\'s growth to the brass ring chandelier that turns negative space into ornament.',
      images: [
        'https://static.wixstatic.com/media/67a4ef_09c382a29a234c62af7e01dd6ee2cfd4~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_0766e8810f124207b10082023d41f7b4~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_cd84fd3879ee4b438781937ed5b8d8d7~mv2.jpg',
      ],
    },
  ],
};

// Sample past exhibitions for select brands
const BRAND_PAST_SHOWS: Record<string, PastShow[]> = {
  b01: [
    {
      id: 'b01-ps1', exhibition_name: 'Index Mumbai 2024', city: 'Mumbai', year: '2024', booth: 'Hall 2, B14',
      images: ['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'],
      booth_images: [
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
        'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=800',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      ],
      interaction_images: [
        'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800',
        'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800',
      ],
      product_images: [
        'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800',
        'https://images.unsplash.com/photo-1513506003901-1e6a35f9e30a?w=800',
        'https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=800',
      ],
      about: "Index Mumbai 2024 was our largest show of the year — 4 days, Hall 2, Booth B14. We debuted the Nocturne Collection to a floor of 800+ design professionals. The response to our diffused pendant range exceeded every prior year, with over 340 leads captured across the show.",
    },
    {
      id: 'b01-ps2', exhibition_name: 'AD Design Show 2024', city: 'Mumbai', year: '2024', booth: 'Pavilion 3',
      images: ['https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800'],
      booth_images: [
        'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
      ],
      interaction_images: [
        'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800',
        'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800',
      ],
      product_images: [
        'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800',
        'https://images.unsplash.com/photo-1513506003901-1e6a35f9e30a?w=800',
      ],
      about: "AD Design Show 2024 at NSCI Dome gave us the opportunity to show our Studio Edit pieces alongside the country's top architects and designers. Pavilion 3 became a destination for conversations around biophilic lighting — our Forest Pendant and Kelvin-tunable downlights drew continuous crowds.",
    },
    {
      id: 'b01-ps3', exhibition_name: 'India Design ID 2025', city: 'New Delhi', year: '2025', booth: 'Hall A, A7',
      images: ['https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800'],
      booth_images: [
        'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800',
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
      ],
      interaction_images: [
        'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800',
      ],
      product_images: [
        'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=800',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      ],
      about: "India Design ID 2025 in Delhi marked our first north India presence. Hall A, Booth A7 was designed as an immersive light environment — visitors experienced the Nocturne and Studio Edit ranges in a controlled atmosphere built to demonstrate CCT, CRI, and beam control. 200+ direct brand conversations over 4 days.",
    },
  ],
  b02: [
    {
      id: 'b02-ps1', exhibition_name: 'Index Mumbai 2024', city: 'Mumbai', year: '2024', booth: 'Hall 1, C6',
      images: ['https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800'],
      booth_images: [
        'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800',
        'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800',
      ],
      interaction_images: [
        'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800',
        'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800',
      ],
      product_images: [
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800',
        'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800',
      ],
      about: "Our debut at Index Mumbai 2024 introduced ClayCraft Ceramics to the professional interiors community. Hall 1, Booth C6 featured our full tableware and decor range alongside bespoke commission pieces. 3 large-scale project consultations began directly at the show.",
    },
    {
      id: 'b02-ps2', exhibition_name: 'Design Democracy 2025', city: 'Bengaluru', year: '2025', booth: "Maker's Pavilion",
      images: ['https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800'],
      booth_images: [
        'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800',
        'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800',
      ],
      interaction_images: [
        'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800',
      ],
      product_images: [
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800',
        'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800',
        'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800',
      ],
      about: "Design Democracy 2025 at Bangalore's Maker's Pavilion celebrated Indian material culture. Our raw-edge terracotta range found particular resonance with the Bengaluru design community and resulted in our first South India retail partnership.",
    },
  ],
  b05: [
    {
      id: 'b05-ps1', exhibition_name: 'ACETECH Mumbai 2024', city: 'Mumbai', year: '2024', booth: 'Hall 4, D9',
      images: ['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'],
      booth_images: [
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
        'https://images.unsplash.com/photo-1528459199957-0ff28496a7f6?w=800',
      ],
      interaction_images: [
        'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800',
        'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800',
      ],
      product_images: [
        'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800',
        'https://images.unsplash.com/photo-1528459199957-0ff28496a7f6?w=800',
      ],
      about: "ACETECH Mumbai 2024 was our first foray into the architecture + construction trade fair space. Hall 4, Booth D9 was dressed with our full soft furnishings catalogue — curtains, upholstery swatches, and handwoven cushion collections. Over 180 interior designers and architects visited with spec inquiries across 4 days.",
    },
    {
      id: 'b05-ps2', exhibition_name: 'ACETECH Bengaluru 2025', city: 'Bengaluru', year: '2025', booth: 'Hall B, B3',
      images: ['https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800'],
      booth_images: [
        'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
      ],
      interaction_images: [
        'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800',
      ],
      product_images: [
        'https://images.unsplash.com/photo-1528459199957-0ff28496a7f6?w=800',
        'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800',
      ],
      about: "Building on our ACETECH Mumbai presence, the Bengaluru 2025 edition let us take our handloom and natural-dye textile story deeper into South India. We launched the Earth Collection exclusively here — 100% natural indigo, turmeric, and madder dyes on Khadi base fabrics.",
    },
  ],
  'arisaa-b01-2024': [
    {
      id: 'arisaa-show01',
      exhibition_name: 'Salone Satellite',
      city: 'Milan, Italy',
      year: '2023',
      booth: 'Fiera Milano, Rho',
      images: ['https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eaa6dc82-80bd-42c7-9651-6f8cb287e0f6/Copy+of+MILAN+FEATURES-12.png'],
      booth_images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eaa6dc82-80bd-42c7-9651-6f8cb287e0f6/Copy+of+MILAN+FEATURES-12.png',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0309f91d-d641-4a6d-971b-0e875afae13e/ARSD00465+a.jpg',
      ],
      product_images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0300321c-5336-41ec-be26-4c0082d245ca/Of+the+Earth+%281%29.png',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0f54cb7d-3661-4bc6-a44c-dc96ef5e1b6b/Negi+Sculpture+%281%29.JPG',
      ],
      about: "Arisaa's international debut at Salone Satellite — the most visible platform for emerging design talent during Milan Design Week. The studio presented wall art, sculptural objects, and handwoven pieces to an international audience, drawing significant editorial attention and positioning the studio within a global craft dialogue.",
    },
    {
      id: 'arisaa-show02',
      exhibition_name: 'India Design ID',
      city: 'New Delhi',
      year: '2023',
      booth: 'Epicentre, Gurugram',
      images: ['https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/b17cc747-fe59-4b03-ad7e-509fa988f324/_R8A2413-edit.jpg'],
      booth_images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/b17cc747-fe59-4b03-ad7e-509fa988f324/_R8A2413-edit.jpg',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/6097b573-1fc9-4770-8965-2edcde445095/_R8A3250edited-new.jpg',
      ],
      product_images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0300321c-5336-41ec-be26-4c0082d245ca/Of+the+Earth+%281%29.png',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eb0013af-bbeb-40ec-8b21-77833b7e9bef/ARSD00415.jpg',
      ],
      about: "India's foremost curated design fair. Arisaa presented the full Of the Earth wall art collection alongside new sculptural pieces, engaging with architects, interior designers, and collectors from across India. The show generated strong inquiry for commissioned residential work.",
    },
    {
      id: 'arisaa-show03',
      exhibition_name: 'AD Design Show',
      city: 'Mumbai',
      year: '2023',
      booth: 'NSCI Dome, Worli',
      images: ['https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0309f91d-d641-4a6d-971b-0e875afae13e/ARSD00465+a.jpg'],
      booth_images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0309f91d-d641-4a6d-971b-0e875afae13e/ARSD00465+a.jpg',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0f54cb7d-3661-4bc6-a44c-dc96ef5e1b6b/Negi+Sculpture+%281%29.JPG',
      ],
      product_images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/f85e0e44-1696-4063-baaa-a8c0bcaf3049/Gilded+current4a.jpg',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/46106f34-d750-4d09-bb66-4216b194acdd/Antelope+Chair1.jpg',
      ],
      about: "Curated by Architectural Digest India — one of the most visible platforms for design in the country. Arisaa debuted the Reflections mirror collection and the Antelope Chair, both of which received significant editorial interest. Condé Nast Traveler shot the booth for a subsequent India design feature.",
    },
    {
      id: 'arisaa-show04',
      exhibition_name: 'Index Furniture & Interiors',
      city: 'Mumbai',
      year: '2024',
      booth: 'Bombay Exhibition Centre',
      images: ['https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/50193dd1-52f1-4501-abe2-df9323063be4/Drava-web-3.png'],
      booth_images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/50193dd1-52f1-4501-abe2-df9323063be4/Drava-web-3.png',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/a7d37874-2573-494d-9eb9-a45b71997213/ARSD00404.jpg',
      ],
      product_images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0300321c-5336-41ec-be26-4c0082d245ca/Of+the+Earth+%281%29.png',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/b17cc747-fe59-4b03-ad7e-509fa988f324/_R8A2413-edit.jpg',
      ],
      about: "Asia's largest furniture and interiors trade show. Arisaa presented the Woven Grounds rug collection alongside wall art and sculptural objects. The Drava rug drew particular attention for its approach to natural fibre and geometric restraint.",
    },
    {
      id: 'arisaa-show05',
      exhibition_name: 'Design Ahmedabad',
      city: 'Ahmedabad',
      year: '2022',
      booth: 'AMA Auditorium',
      images: ['https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eb0013af-bbeb-40ec-8b21-77833b7e9bef/ARSD00415.jpg'],
      booth_images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/eb0013af-bbeb-40ec-8b21-77833b7e9bef/ARSD00415.jpg',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/7aad5460-9855-49de-a92a-a2afbb5fbbc4/ARSD00488.jpg',
      ],
      product_images: [
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0f54cb7d-3661-4bc6-a44c-dc96ef5e1b6b/Negi+Sculpture+%281%29.JPG',
        'https://images.squarespace-cdn.com/content/v1/69904485b3641a103f437982/0300321c-5336-41ec-be26-4c0082d245ca/Of+the+Earth+%281%29.png',
      ],
      about: "A biennial showcase celebrating Ahmedabad as a UNESCO World Heritage City. Arisaa showed as a local studio with international reach, highlighting material sourcing from within Gujarat and Rajasthan. The first public showing in India.",
    },
  ],
  'hjd-b01-2024': [
    {
      id: 'hjd-show01',
      exhibition_name: 'AD Design Show',
      city: 'Mumbai',
      year: '2023',
      booth: 'NSCI Dome, Worli',
      images: ['https://static.wixstatic.com/media/67a4ef_56422cdaf100415fac61c15a5d349eb1~mv2.jpg'],
      booth_images: [
        'https://static.wixstatic.com/media/67a4ef_56422cdaf100415fac61c15a5d349eb1~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_090f6f2764474878a6a056f4ec953a2a~mv2.jpg',
      ],
      product_images: [
        'https://static.wixstatic.com/media/67a4ef_dc0794650c6c43b696de70f4482da15b~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_09c382a29a234c62af7e01dd6ee2cfd4~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_0766e8810f124207b10082023d41f7b4~mv2.jpg',
      ],
      about: "India's premier design show curated by Architectural Digest India. HJD showcased the complete Rio collection in natural stone and debuted the new Totem series, drawing significant trade and editorial attention.",
    },
    {
      id: 'hjd-show02',
      exhibition_name: 'Index Furniture & Interiors',
      city: 'Mumbai',
      year: '2022',
      booth: 'Bombay Exhibition Centre',
      images: ['https://static.wixstatic.com/media/67a4ef_1219ac2b81634ab4af00330ea192d085~mv2.jpg'],
      booth_images: [
        'https://static.wixstatic.com/media/67a4ef_1219ac2b81634ab4af00330ea192d085~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_090f6f2764474878a6a056f4ec953a2a~mv2.jpg',
      ],
      product_images: [
        'https://static.wixstatic.com/media/67a4ef_dbeb746a0e0d4818860f7ca0e1b47cb2~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_32a6d73160f94665aeec5fa37c1be4c3~mv2.jpg',
      ],
      about: "Asia's largest furniture and interiors trade exhibition. The brand exhibited the Kasa and Wilo collections alongside the Asteroid floor lamp, engaging architects and interior designers from across India.",
    },
    {
      id: 'hjd-show03',
      exhibition_name: 'India Design ID',
      city: 'New Delhi',
      year: '2022',
      booth: 'Epicentre, Gurugram',
      images: ['https://static.wixstatic.com/media/67a4ef_09c382a29a234c62af7e01dd6ee2cfd4~mv2.jpg'],
      booth_images: [
        'https://static.wixstatic.com/media/67a4ef_09c382a29a234c62af7e01dd6ee2cfd4~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_55b0829d87774f2395447d83d6754227~mv2.jpg',
      ],
      product_images: [
        'https://static.wixstatic.com/media/67a4ef_d3f11a36233e4e7dbd50e9f3db2d0a91~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_0766e8810f124207b10082023d41f7b4~mv2.jpg',
      ],
      about: "A curated design fair showcasing the best of Indian design practice. HJD debuted the Bloom Pendant and Ring Chandelier, both of which received editorial coverage in multiple shelter magazines following the show.",
    },
    {
      id: 'hjd-show04',
      exhibition_name: 'Maison Mumbai',
      city: 'Mumbai',
      year: '2024',
      booth: 'The St. Regis Mumbai',
      images: ['https://static.wixstatic.com/media/67a4ef_32a6d73160f94665aeec5fa37c1be4c3~mv2.jpg'],
      booth_images: [
        'https://static.wixstatic.com/media/67a4ef_32a6d73160f94665aeec5fa37c1be4c3~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_b3d47c130492463ab3aa6937e01a3c30~mv2.jpg',
      ],
      product_images: [
        'https://static.wixstatic.com/media/67a4ef_56422cdaf100415fac61c15a5d349eb1~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_f38a7995f1a54491ba9af44662cff605~mv2.jpg',
      ],
      about: "An exclusive showcase of luxury interiors and design products in a hotel setting. Featured the Legacy Totem and the new alabaster stone collection — the first time the full stone range was exhibited publicly.",
    },
    {
      id: 'hjd-show05',
      exhibition_name: 'Elle Décor Design Village',
      city: 'Mumbai',
      year: '2023',
      booth: 'Mehboob Studios, Bandra',
      images: ['https://static.wixstatic.com/media/67a4ef_cd84fd3879ee4b438781937ed5b8d8d7~mv2.jpg'],
      booth_images: [
        'https://static.wixstatic.com/media/67a4ef_cd84fd3879ee4b438781937ed5b8d8d7~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_a536db8364a149fb882c43f166803026~mv2.jpg',
      ],
      product_images: [
        'https://static.wixstatic.com/media/67a4ef_4e5babfdbacd4af29647f93faed472c8~mv2.jpg',
        'https://static.wixstatic.com/media/67a4ef_ccbe2d4fd03349b7bdee03fd7c6ab3ef~mv2.jpg',
      ],
      about: "Elle Décor India's annual design village bringing together the finest Indian interior and product designers. HJD showcased the full Orbis and Branch collections alongside the collaborative HJD × LBH pieces.",
    },
  ],
};

export default function BrandDetailScreen() {
  const { id: rawId, product: productParam } = useLocalSearchParams<{ id: string; product?: string }>();
  const { colors } = useTheme();
  const { isDemoMode, activeExhibitionId, activeExhibitionName, addDemoSavedBrand, demoWishlistedIds, toggleWishlistItem, notes, addNote } = useAuth();
  const headerPaddingTop = useHeaderPaddingTop();
  const id = resolveId(rawId ?? '');
  const [brand, setBrand] = useState<ApiBrand | null>(null);

  useEffect(() => {
    if (!id) return;
    getBrand(id, isDemoMode).then((b) => {
      setBrand(b);
      if (b && productParam) {
        const p = b.products.find((pr) => pr.id === productParam);
        if (p) setSelectedProduct(p);
      }
    }).catch(console.error);
  }, [id]);

  const projects = brand?.projects ?? [];
  const hasProjects = projects.length > 0;
  const collections = BRAND_COLLECTIONS[id] ?? [];
  const pastShows = BRAND_PAST_SHOWS[id] ?? [];

  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedPastShow, setSelectedPastShow] = useState<PastShow | null>(null);
  const [tab, setTab] = useState<BrandTab>('catalogue');
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [philosophyExpanded, setPhilosophyExpanded] = useState(false);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [wishlisted, setWishlisted] = useState<Set<string>>(() => new Set(demoWishlistedIds));
  const [simState, setSimState] = useState<SimState>('idle');
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
  const [galleryKey, setGalleryKey] = useState(0);
  const brandNotes = notes[id] ?? [];

  const openZoom = (uri: string) => setZoomImageUri(uri);
  const closeZoom = () => { setZoomImageUri(null); setGalleryKey((k) => k + 1); };
  const [, forceUpdate] = useState(0);
  const s = makeStyles(colors);

  useEffect(() => subscribeToCache(() => forceUpdate(n => n + 1)), []);

  const toggleWishlist = (itemId: string, productName?: string, imageUrl?: string, material?: string) => {
    const wasWishlisted = wishlisted.has(itemId);
    setWishlisted((prev) => {
      const next = new Set(prev);
      wasWishlisted ? next.delete(itemId) : next.add(itemId);
      return next;
    });
    toggleWishlistItem({
      id: itemId,
      brand_id: id,
      brand_name: brand?.name ?? '',
      product_name: productName ?? itemId,
      image_url: imageUrl ?? '',
      material: material,
    });
  };

  const handleSimCapture = () => {
    if (!brand) return;
    setSimState('saving');
    setTimeout(() => {
      setSimState('success');
      const exhId = activeExhibitionId ?? 'exh-001';
      const exhName = activeExhibitionName ?? 'Index Mumbai 2025';
      const isShowroomVisit = !activeExhibitionId;
      addDemoSavedBrand({
        id: `demo-save-${brand.id}`,
        brand_id: brand.id,
        brand_name: brand.name,
        brand_category: brand.category,
        brand_tagline: brand.tagline,
        product_image_url: brand.products[0]?.images[0] ?? '',
        exhibition_id: isShowroomVisit ? null : exhId,
        exhibition_name: isShowroomVisit ? null : exhName,
        booth_number: brand.booth_number,
        hall_number: brand.hall_number,
        saved_at: new Date().toISOString(),
      });
      setTimeout(() => setSimState('idle'), 2000);
    }, 1000);
  };

  // ── Product detail page ───────────────────────────────────────────────────
  if (selectedProduct) {
    const productIdx = brand?.products.findIndex((p) => p.id === selectedProduct.id) ?? -1;
    const safeIdx = productIdx >= 0 ? productIdx : 0;
    const productImages = selectedProduct.images.length > 0
      ? selectedProduct.images
      : Array.from({ length: 4 }, (_, i) =>
          getCachedProductImage(brand?.category ?? '', safeIdx * 4 + i, brand?.id ?? ''));

    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        {/* Back button — floats over the image */}
        <Pressable onPress={() => setSelectedProduct(null)} style={s.pdpBackBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </Pressable>

        <ScrollView contentContainerStyle={s.productScroll} showsVerticalScrollIndicator={false}>
          {/* Hero image */}
          <Pressable
            style={s.pdpHeroWrap}
            onPress={() => setShowGallery(true)}
          >
            <Image source={{ uri: productImages[0] }} style={s.pdpHeroImg} resizeMode="cover" />

            {/* Gradient overlay — brand pill above product name */}
            <View style={s.pdpHeroOverlay}>
              <Pressable
                style={s.pdpBrandPill}
                onPress={(e) => { e.stopPropagation(); setSelectedProduct(null); setTab('catalogue'); }}
              >
                <Text style={s.pdpBrandPillText}>{brand?.name}</Text>
                <Ionicons name="chevron-forward" size={11} color="rgba(255,255,255,0.85)" />
              </Pressable>
              <Text style={s.pdpHeroName}>{selectedProduct.name}</Text>
            </View>

            {/* Wishlist */}
            <Pressable
              style={s.pdpWishlistBtn}
              onPress={(e) => { e.stopPropagation(); toggleWishlist(selectedProduct.id, selectedProduct.name, productImages[0], selectedProduct.material); }}
            >
              <Ionicons
                name={wishlisted.has(selectedProduct.id) ? 'heart' : 'heart-outline'}
                size={22}
                color={wishlisted.has(selectedProduct.id) ? '#FF4444' : '#FFF'}
              />
            </Pressable>
          </Pressable>

          {/* Horizontal thumbnail strip */}
          {productImages.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.pdpThumbRow}
              style={[s.pdpThumbScroll, { backgroundColor: colors.surface }]}
            >
              {productImages.map((uri: string, i: number) => (
                <Pressable key={i} onPress={() => setShowGallery(true)} style={s.pdpThumbWrap}>
                  <Image source={{ uri }} style={s.pdpThumb} resizeMode="cover" />
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Details card — pulls up over image */}
          <View style={[s.pdpCard, { backgroundColor: colors.surface }]}>
            <Text style={[s.pdpDesc, { color: colors.textSecondary }]}>{selectedProduct.description}</Text>
            <View style={[s.pdpDivider, { backgroundColor: colors.border }]} />
            <View style={s.pdpSpecGrid}>
              {[
                { label: 'Material', value: selectedProduct.material },
                { label: 'Dimensions', value: selectedProduct.dimensions },
                { label: 'Colour', value: selectedProduct.color },
                { label: 'Customisable', value: selectedProduct.customisable },
              ].map(({ label, value }) => (
                <View key={label} style={[s.pdpSpecCell, { backgroundColor: colors.background }]}>
                  <Text style={[s.pdpSpecLabel, { color: colors.textMuted }]}>{label}</Text>
                  <Text style={[s.pdpSpecValue, { color: colors.text }]}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Full-screen gallery / single-image zoom — single Modal to avoid iOS nesting issues */}
        <Modal visible={showGallery} animationType="fade" transparent={false} statusBarTranslucent>
          {/* Centering wrapper constrains content to app width on web */}
          <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center' }}>
            <View style={{ flex: 1, width: APP_W }}>
              {zoomImageUri ? (
                // ── Single-image pinch-to-zoom view ──────────────────────────
                <View style={{ flex: 1 }}>
                  <Pressable
                    onPress={closeZoom}
                    style={{ position: 'absolute', top: 52, left: Spacing.lg, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 8 }}
                  >
                    <Ionicons name="chevron-back" size={22} color="#FFF" />
                  </Pressable>
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                    maximumZoomScale={5}
                    minimumZoomScale={1}
                    centerContent
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    bouncesZoom
                  >
                    <Image
                      source={{ uri: zoomImageUri }}
                      style={{ width: APP_W, height: APP_W }}
                      resizeMode="contain"
                    />
                  </ScrollView>
                </View>
              ) : (
                // ── Scrollable image grid ─────────────────────────────────────
                <View style={s.galleryModal}>
                  <View style={s.galleryHeader}>
                    <Text style={s.galleryTitle}>{selectedProduct.name}</Text>
                  </View>
                  <Pressable style={s.galleryClose} onPress={() => setShowGallery(false)}>
                    <Ionicons name="close" size={24} color="#FFF" />
                  </Pressable>
                  <ScrollView key={galleryKey} showsVerticalScrollIndicator={false}>
                    <View style={s.galleryGrid}>
                      {productImages.map((uri: string, i: number) => (
                        <Pressable key={i} onPress={() => openZoom(uri)}>
                          <Image source={{ uri }} style={s.galleryGridImg} resizeMode="contain" />
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Past show detail page ─────────────────────────────────────────────────
  if (selectedPastShow) {
    return (
      <PastShowDetailView
        show={selectedPastShow}
        colors={colors}
        onBack={() => setSelectedPastShow(null)}
      />
    );
  }

  // ── Brand detail page ─────────────────────────────────────────────────────
  const tabs: BrandTab[] = [
    'about',
    ...(collections.length > 0 ? ['collections' as BrandTab] : []),
    'catalogue',
    ...(pastShows.length > 0 ? ['past_exhibitions' as BrandTab] : []),
    ...(hasProjects ? ['projects' as BrandTab] : []),
  ];

  if (!brand) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Fixed top nav */}
      <View style={[s.header, { backgroundColor: colors.background, paddingTop: headerPaddingTop as any }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Fixed tab bar — horizontally scrollable */}
      <View style={[s.tabBarWrap, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBarContent}>
          {tabs.map((t) => (
            <Pressable
              key={t}
              style={[s.tabBtn, tab === t && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabLabel, { color: tab === t ? colors.accent : colors.textMuted }]}>
                {t === 'past_exhibitions' ? 'Past Shows' : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Single vertical ScrollView — remounts on tab change to reset scroll to top */}
      <ScrollView
        key={tab}
        style={s.brandTabPager}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Brand identity — scrolls away with content */}
        <BrandHeader brand={brand} brandNotes={brandNotes} colors={colors} onNotes={() => setShowNotes(true)} />

        <View style={s.tabContent}>

          {/* ── ABOUT TAB ─────────────────────────────────────────── */}
          {tab === 'about' && (
            <>
              <Text style={[s.sectionLabel, { color: colors.textMuted }]}>BRAND VISITING CARD</Text>
              <View style={[s.infoBlurb, { backgroundColor: colors.surface }]}>
                <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
                <Text style={[s.infoBlurbText, { color: colors.textMuted }]}>
                  This is the brand representative's contact card. Tap to reveal their details.
                </Text>
              </View>
              {!cardRevealed ? (
                <Pressable
                  style={[s.visitingCardPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setCardRevealed(true)}
                >
                  <View style={[s.vcInitialsBox, { backgroundColor: colors.accent + '22' }]}>
                    <Text style={[s.vcInitialsText, { color: colors.accent }]}>{brand.logo_initial}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[s.vcPreviewName, { color: colors.text }]}>{brand.contact_name}</Text>
                    <Text style={[s.vcPreviewBrand, { color: colors.accent }]}>{brand.name}</Text>
                    <Text style={[s.vcPreviewRole, { color: colors.textSecondary }]}>{brand.category} Brand Representative</Text>
                  </View>
                  <View style={s.vcRevealHint}>
                    <Ionicons name="eye-outline" size={15} color={colors.textMuted} />
                    <Text style={[s.vcRevealHintText, { color: colors.textMuted }]}>Tap to view</Text>
                  </View>
                </Pressable>
              ) : (
                <View style={[s.visitingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={s.vcRevealedTop}>
                    <View style={[s.vcInitialsBox, { backgroundColor: colors.accent + '22' }]}>
                      <Text style={[s.vcInitialsText, { color: colors.accent }]}>{brand.logo_initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.vcContact, { color: colors.text }]}>{brand.contact_name}</Text>
                      <Text style={[s.vcBrand, { color: colors.accent }]}>{brand.name}</Text>
                    </View>
                  </View>
                  <View style={[s.vcDivider, { backgroundColor: colors.border }]} />
                  <Pressable style={s.vcRow} onPress={() => copyToClipboard(brand.email, 'Email')}>
                    <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
                    <Text style={[s.vcDetail, { color: colors.textSecondary }]}>{brand.email}</Text>
                    <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
                  </Pressable>
                  <Pressable style={s.vcRow} onPress={() => copyToClipboard(brand.phone, 'Phone')}>
                    <Ionicons name="call-outline" size={14} color={colors.textMuted} />
                    <Text style={[s.vcDetail, { color: colors.textSecondary }]}>{brand.phone}</Text>
                    <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
                  </Pressable>
                  <Pressable style={s.vcRow} onPress={() => copyToClipboard(brand.website, 'Website')}>
                    <Ionicons name="globe-outline" size={14} color={colors.textMuted} />
                    <Text style={[s.vcDetail, { color: colors.textSecondary }]}>{brand.website}</Text>
                    <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
                  </Pressable>
                  {brand.instagram && (
                    <Pressable style={s.vcRow} onPress={() => copyToClipboard(brand.instagram!, 'Instagram')}>
                      <Ionicons name="logo-instagram" size={14} color={colors.textMuted} />
                      <Text style={[s.vcDetail, { color: colors.textSecondary }]}>{brand.instagram}</Text>
                      <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
                    </Pressable>
                  )}
                </View>
              )}

              <Text style={[s.sectionLabel, { color: colors.textMuted }]}>BRAND STORY</Text>
              <View style={[s.storyCard, { backgroundColor: colors.surface }]}>
                <Text style={[s.storyText, { color: colors.textSecondary }]} numberOfLines={storyExpanded ? undefined : 4}>
                  {brand.story}
                </Text>
                <Pressable onPress={() => setStoryExpanded((v) => !v)}>
                  <Text style={[s.readMore, { color: colors.gold }]}>
                    {storyExpanded ? 'Show less' : 'Read more'}
                  </Text>
                </Pressable>
              </View>

              {brand.design_philosophy ? (
                <>
                  <Text style={[s.sectionLabel, { color: colors.textMuted }]}>DESIGN PHILOSOPHY</Text>
                  <View style={[s.storyCard, { backgroundColor: colors.surface }]}>
                    <Text style={[s.storyText, { color: colors.textSecondary }]} numberOfLines={philosophyExpanded ? undefined : 4}>
                      {brand.design_philosophy}
                    </Text>
                    <Pressable onPress={() => setPhilosophyExpanded((v) => !v)}>
                      <Text style={[s.readMore, { color: colors.gold }]}>
                        {philosophyExpanded ? 'Show less' : 'Read more'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {isDemoMode && (
                <Pressable
                  style={[s.simBtn, { backgroundColor: colors.accent + '18', borderColor: colors.accent }]}
                  onPress={() => setSimState('capture')}
                >
                  <Ionicons name="qr-code-outline" size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.simBtnText, { color: colors.accent }]}>Simulate Brand Scan</Text>
                    <Text style={[s.simBtnSub, { color: colors.textMuted }]}>Demo: scan this brand's booth QR and save it</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                </Pressable>
              )}
            </>
          )}

          {/* ── COLLECTIONS TAB ───────────────────────────────────── */}
          {tab === 'collections' && (
            <View style={s.collectionsList}>
              {collections.map((col) => (
                <View key={col.id} style={s.collectionBlock}>
                  <Text style={[s.collectionHeading, { color: colors.text }]}>{col.name}</Text>
                  <Text style={[s.collectionAbout, { color: colors.textSecondary }]}>{col.description}</Text>
                  <CollageGrid images={col.images} />
                </View>
              ))}
            </View>
          )}

          {/* ── CATALOGUE TAB ─────────────────────────────────────── */}
          {tab === 'catalogue' && (() => {
            const rows: any[][] = [];
            for (let i = 0; i < brand.products.length; i += 2) {
              rows.push(brand.products.slice(i, i + 2));
            }
            return (
              <View style={s.gallery}>
                {rows.map((row, rowIdx) => (
                  <View key={rowIdx} style={s.galleryRow}>
                    {row.map((p: any, colIdx: number) => {
                      const productIdx = rowIdx * 2 + colIdx;
                      const fallbackImg = getCachedProductImage(brand.category, productIdx, brand.id);
                      const imgUri = p.images[0] || fallbackImg;
                      return (
                        <Pressable
                          key={p.id}
                          style={[s.galleryItem, { backgroundColor: colors.surface }]}
                          onPress={() => { setActiveImgIdx(0); setSelectedProduct(p); }}
                        >
                          <View>
                            <Image source={{ uri: imgUri }} style={s.galleryImg} resizeMode="cover" />
                            <Pressable
                              style={s.galleryHeart}
                              onPress={() => toggleWishlist(p.id, p.name, imgUri, p.material)}
                            >
                              <Ionicons
                                name={wishlisted.has(p.id) ? 'heart' : 'heart-outline'}
                                size={15}
                                color={wishlisted.has(p.id) ? '#FF4444' : '#FFF'}
                              />
                            </Pressable>
                            {(notes[p.id] ?? []).length > 0 && (
                              <View style={[s.galleryNoteDot, { backgroundColor: colors.accent }]}>
                                <Ionicons name="create" size={9} color="#FFF" />
                              </View>
                            )}
                          </View>
                          <View style={s.galleryCardBody}>
                            <Text style={[s.galleryCardName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                            <Text style={[s.galleryCardMaterial, { color: colors.textMuted }]} numberOfLines={1}>{p.material}</Text>
                            {p.customisable ? (
                              <View style={s.galleryCardPill}>
                                <Text style={s.galleryCardPillText}>Customisable</Text>
                              </View>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                    {row.length === 1 && <View style={{ flex: 1 }} />}
                  </View>
                ))}
              </View>
            );
          })()}

          {/* ── PAST EXHIBITIONS TAB ──────────────────────────────── */}
          {tab === 'past_exhibitions' && (
            <View style={s.pastShowsList}>
              {pastShows.map((show) => (
                <Pressable
                  key={show.id}
                  style={[s.pastShowCard, { backgroundColor: colors.surface }]}
                  onPress={() => setSelectedPastShow(show)}
                >
                  {show.images.length > 0 && (
                    <Image source={{ uri: show.images[0] }} style={s.pastShowImg} />
                  )}
                  <View style={s.pastShowBody}>
                    <View style={s.pastShowMeta}>
                      <View style={[s.pastShowYearBadge, { backgroundColor: '#E8EAE6' }]}>
                        <Text style={[s.pastShowYear, { color: '#6B7280' }]}>{show.year}</Text>
                      </View>
                    </View>
                    <Text style={[s.pastShowName, { color: colors.text }]}>{show.exhibition_name}</Text>
                    <View style={s.pastShowInfoRow}>
                      <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                      <Text style={[s.pastShowCity, { color: colors.textMuted }]}>{show.city}</Text>
                      <Text style={[s.pastShowBooth, { color: colors.textMuted }]}>· {show.booth}</Text>
                    </View>
                    <View style={[s.pastShowViewCta, { borderTopColor: colors.border }]}>
                      <Text style={[s.pastShowViewCtaText, { color: colors.accent }]}>View Show Details</Text>
                      <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* ── PROJECTS TAB ──────────────────────────────────────── */}
          {tab === 'projects' && (
            <View style={s.projectsList}>
              {projects.map((proj) => (
                <Pressable
                  key={proj.id}
                  style={[s.projectCard, { backgroundColor: colors.surface }]}
                  onPress={() => router.push(`/project/${proj.id}`)}
                >
                  <Image source={{ uri: proj.images[0] || getCachedCover(brand.category, proj.id) }} style={s.projectCardImg} resizeMode="cover" />
                  <View style={s.projectCardBody}>
                    <View style={[s.projectThemeBadge, { backgroundColor: '#E8EAE6' }]}>
                      <Text style={[s.projectThemeText, { color: '#6B7280' }]}>{proj.theme}</Text>
                    </View>
                    <Text style={[s.projectCardName, { color: colors.text }]}>{proj.name}</Text>
                    <View style={s.projectCardMeta}>
                      <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                      <Text style={[s.projectCardCity, { color: colors.textMuted }]}>{proj.city}</Text>
                    </View>
                    <Text style={[s.projectCardAbout, { color: colors.textSecondary }]} numberOfLines={3}>
                      {proj.about}
                    </Text>
                    <View style={[s.projectViewBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                      <Text style={[s.projectViewBtnText, { color: '#FFF' }]}>View Project</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      <NotesModal
        visible={showNotes}
        onClose={() => setShowNotes(false)}
        entityName={brand.name}
        notes={brandNotes}
        onAddNote={(text) => addNote(id, text)}
        colors={colors}
      />

      {/* ── Simulate Brand Scan Modal ── */}
      <Modal visible={simState !== 'idle'} animationType="slide" transparent>
        <View style={s.simOverlay}>
          <View style={[s.simModal, { backgroundColor: colors.background }]}>
            <Pressable style={s.simClose} onPress={() => setSimState('idle')}>
              <Ionicons name="close" size={22} color="#FFF" />
            </Pressable>

            {simState === 'capture' && (
              <>
                <View style={[s.simCamera, { backgroundColor: '#0A0A0A' }]}>
                  <View style={[s.simScanFrame, { borderColor: colors.accent }]}>
                    <View style={[s.simCorner, s.simCornerTL, { borderColor: colors.accent }]} />
                    <View style={[s.simCorner, s.simCornerTR, { borderColor: colors.accent }]} />
                    <View style={[s.simCorner, s.simCornerBL, { borderColor: colors.accent }]} />
                    <View style={[s.simCorner, s.simCornerBR, { borderColor: colors.accent }]} />
                    <View style={[s.simQrBox, { borderColor: colors.accent + '55' }]}>
                      <Ionicons name="qr-code-outline" size={56} color={colors.accent + 'AA'} />
                    </View>
                  </View>
                  <Text style={s.simHint}>Scanning {brand.name} booth QR</Text>
                </View>
                <View style={[s.simCaptureArea, { backgroundColor: colors.background }]}>
                  <Text style={[s.simCaptureBrand, { color: colors.text }]}>{brand.name}</Text>
                  <Text style={[s.simCaptureSub, { color: colors.textMuted }]}>{brand.hall_number} · Booth {brand.booth_number}</Text>
                  <Pressable style={[s.simCaptureBtn, { backgroundColor: colors.accent }]} onPress={handleSimCapture}>
                    <Ionicons name="scan" size={20} color="#FFF" />
                    <Text style={s.simCaptureBtnText}>Capture</Text>
                  </Pressable>
                </View>
              </>
            )}

            {simState === 'saving' && (
              <View style={[s.simResult, { backgroundColor: colors.background }]}>
                <View style={[s.simSavingIcon, { backgroundColor: colors.accent + '22' }]}>
                  <Ionicons name="sync-outline" size={36} color={colors.accent} />
                </View>
                <Text style={[s.simResultTitle, { color: colors.text }]}>Saving...</Text>
                <Text style={[s.simResultSub, { color: colors.textMuted }]}>Saving {brand.name} to your exhibition saves</Text>
              </View>
            )}

            {simState === 'success' && (
              <View style={[s.simResult, { backgroundColor: colors.background }]}>
                <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
                <Text style={[s.simResultTitle, { color: colors.text }]}>{brand.name} saved successfully</Text>
                <Text style={[s.simResultSub, { color: colors.textMuted }]}>
                  {activeExhibitionId
                    ? `Saved · ${activeExhibitionName}`
                    : `Saved · Showroom Visit · ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Dynamic collage grid — layout adapts to number of images
function CollageGrid({ images }: { images: string[] }) {
  const n = images.length;
  if (n === 0) return null;

  if (n === 1) {
    return (
      <Image source={{ uri: images[0] }} style={{ width: '100%', height: 240, borderRadius: Radius.md }} resizeMode="cover" />
    );
  }

  if (n === 2) {
    return (
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <Image source={{ uri: images[0] }} style={{ flex: 1, height: 210, borderRadius: Radius.md }} resizeMode="cover" />
        <Image source={{ uri: images[1] }} style={{ flex: 1, height: 210, borderRadius: Radius.md }} resizeMode="cover" />
      </View>
    );
  }

  if (n === 3) {
    return (
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <Image source={{ uri: images[0] }} style={{ flex: 3, height: 250, borderRadius: Radius.md }} resizeMode="cover" />
        <View style={{ flex: 2, gap: 3 }}>
          <Image source={{ uri: images[1] }} style={{ width: '100%', height: 122, borderRadius: Radius.md }} resizeMode="cover" />
          <Image source={{ uri: images[2] }} style={{ width: '100%', height: 125, borderRadius: Radius.md }} resizeMode="cover" />
        </View>
      </View>
    );
  }

  // 4+ images: pairs of rows
  const pairs: string[][] = [];
  for (let i = 0; i < n; i += 2) pairs.push(images.slice(i, i + 2));
  return (
    <View style={{ gap: 3 }}>
      {pairs.map((pair, pi) => (
        <View key={pi} style={{ flexDirection: 'row', gap: 3 }}>
          <Image source={{ uri: pair[0] }} style={{ flex: 1, height: 155, borderRadius: Radius.md }} resizeMode="cover" />
          {pair[1]
            ? <Image source={{ uri: pair[1] }} style={{ flex: 1, height: 155, borderRadius: Radius.md }} resizeMode="cover" />
            : <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

// Past show detail page — full-screen replacement rendered when a show is tapped
function PastShowDetailView({ show, colors, onBack }: { show: PastShow; colors: any; onBack: () => void }) {
  const s = makeStyles(colors);
  const headerPaddingTop = useHeaderPaddingTop();
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: headerPaddingTop as any }]}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Designup Connect</Text>
        <View style={{ width: 30 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.pastShowDetailScroll}>
        <View style={s.pastShowDetailHero}>
          <Text style={[s.pastShowDetailName, { color: colors.text }]}>{show.exhibition_name}</Text>
          <View style={s.pastShowDetailMeta}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={[s.pastShowDetailCity, { color: colors.textMuted }]}>{show.city}</Text>
            <Text style={[s.pastShowDetailBooth, { color: colors.textMuted }]}>· {show.booth}</Text>
          </View>
        </View>

        {show.booth_images && show.booth_images.length > 0 && (
          <View style={s.pastShowSection}>
            <Text style={[s.pastShowSectionLabel, { color: colors.textMuted }]}>BOOTH SETUP</Text>
            <CollageGrid images={show.booth_images} />
          </View>
        )}

        {show.interaction_images && show.interaction_images.length > 0 && (
          <View style={s.pastShowSection}>
            <Text style={[s.pastShowSectionLabel, { color: colors.textMuted }]}>AT THE SHOW</Text>
            <CollageGrid images={show.interaction_images} />
          </View>
        )}

        {show.product_images && show.product_images.length > 0 && (
          <View style={s.pastShowSection}>
            <Text style={[s.pastShowSectionLabel, { color: colors.textMuted }]}>PRODUCTS SHOWCASED</Text>
            <CollageGrid images={show.product_images} />
          </View>
        )}

        {show.about && (
          <View style={s.pastShowSection}>
            <Text style={[s.pastShowSectionLabel, { color: colors.textMuted }]}>ABOUT THIS EXHIBITION</Text>
            <View style={[s.pastShowAboutCard, { backgroundColor: colors.surface }]}>
              <Text style={[s.pastShowAboutText, { color: colors.textSecondary }]}>{show.about}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Brand identity header — rendered at the top of each tab's scroll so it scrolls away with content
function BrandHeader({ brand, brandNotes, colors, onNotes }: { brand: any; brandNotes: any[]; colors: any; onNotes: () => void }) {
  const s = makeStyles(colors);
  return (
    <View>
      <View style={s.brandIdentity}>
        <View style={[s.brandInitialsBox, { backgroundColor: colors.accent + '22' }]}>
          <Text style={[s.brandInitialsText, { color: colors.accent }]}>{brand.logo_initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.brandName, { color: colors.text }]}>{brand.name}</Text>
          <Text style={[s.brandCategory, { color: colors.textMuted }]}>{brand.category}</Text>
          <Text style={[s.brandTagline, { color: colors.textSecondary }]} numberOfLines={2}>{brand.tagline}</Text>
        </View>
        <Pressable
          style={[s.notesBtn, { borderColor: colors.gold, backgroundColor: colors.surface }]}
          onPress={onNotes}
        >
          <Ionicons name="create-outline" size={13} color={colors.gold} />
          <Text style={[s.notesBtnText, { color: colors.gold }]}>
            {brandNotes.length > 0 ? `${brandNotes.length} Note${brandNotes.length > 1 ? 's' : ''}` : 'Notes'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(_colors?: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'web' ? 14 : 56, paddingBottom: Spacing.sm,
    },
    headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    backBtn: { padding: 4, width: 30 },

    brandCoverImg: { width: '100%', height: 180 },
    brandIdentity: {
      flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md,
    },
    brandInitialsBox: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    brandInitialsText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    brandName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginBottom: 2 },
    brandCategory: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginBottom: 2 },
    brandTagline: { fontSize: FontSize.sm, lineHeight: 18 },
    notesBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderWidth: 1, borderRadius: Radius.full,
      paddingHorizontal: Spacing.sm, paddingVertical: 5,
      alignSelf: 'flex-start',
    },
    notesBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },

    tabBarWrap: { borderBottomWidth: 1 },
    tabBarContent: { paddingHorizontal: Spacing.lg, flexDirection: 'row' },
    tabBtn: {
      paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, marginRight: Spacing.sm,
    },
    tabLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

    brandTabPager: { flex: 1 },
    tabContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },

    scroll: { paddingBottom: 100 },

    sectionLabel: {
      fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
      letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.lg,
    },
    infoBlurb: {
      flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
      borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm,
    },
    infoBlurbText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },

    // Simulate brand scan button
    simBtn: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.md,
    },
    simBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    simBtnSub: { fontSize: FontSize.xs, marginTop: 2 },

    // Visiting card
    visitingCardPreview: {
      borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1,
      flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    },
    vcInitialsBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    vcInitialsText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
    vcPreviewName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    vcPreviewBrand: { fontSize: FontSize.sm },
    vcPreviewRole: { fontSize: FontSize.xs },
    vcRevealHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
    vcRevealHintText: { fontSize: FontSize.xs },
    visitingCard: { borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1 },
    vcRevealedTop: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', marginBottom: Spacing.md },
    vcContact: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: 2 },
    vcBrand: { fontSize: FontSize.sm },
    vcDivider: { height: 1, marginBottom: Spacing.md },
    vcRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    vcDetail: { flex: 1, fontSize: FontSize.sm },

    storyCard: { borderRadius: Radius.lg, padding: Spacing.lg },
    storyText: { fontSize: FontSize.sm, lineHeight: 22, marginBottom: Spacing.sm },
    readMore: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

    // Empty tab states
    emptyTabWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyTabTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, textAlign: 'center' },
    emptyTabBody: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20, maxWidth: 260 },

    // Collections tab
    collectionsList: { gap: Spacing.lg },
    collectionCard: { borderRadius: Radius.lg, overflow: 'hidden' },
    collectionImgScroll: { gap: Spacing.sm, padding: Spacing.sm },
    collectionImg: { width: 220, height: 160, borderRadius: Radius.md, resizeMode: 'cover' },
    collectionBody: { padding: Spacing.md, gap: Spacing.xs },
    collectionName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    collectionDesc: { fontSize: FontSize.sm, lineHeight: 20 },

    // Past Shows tab
    pastShowsList: { gap: Spacing.md },
    pastShowCard: { borderRadius: Radius.lg, overflow: 'hidden' },
    pastShowImg: { width: '100%', height: 160, resizeMode: 'cover' },
    pastShowBody: { padding: Spacing.md, gap: Spacing.xs },
    pastShowMeta: { flexDirection: 'row', gap: Spacing.sm },
    pastShowYearBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
    pastShowYear: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    pastShowName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    pastShowInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pastShowCity: { fontSize: FontSize.sm },
    pastShowBooth: { fontSize: FontSize.sm },

    // Catalogue (Products) gallery — explicit row-per-pair, flex:1 per item
    gallery: { gap: Spacing.sm },
    galleryRow: { flexDirection: 'row', gap: Spacing.sm },
    galleryItem: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden' },
    galleryImg: { width: '100%', height: 190 },
    galleryHeart: {
      position: 'absolute', top: 8, right: 8,
      backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14, padding: 4,
    },
    galleryNoteDot: {
      position: 'absolute', top: 8, left: 8,
      width: 20, height: 20, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    galleryCardBody: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, gap: 2 },
    galleryCardName: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
    galleryCardMaterial: { fontSize: 10 },
    galleryCardPill: {
      marginTop: 4, alignSelf: 'flex-start',
      paddingHorizontal: 6, paddingVertical: 2,
      borderRadius: Radius.full, backgroundColor: '#E8EAE6',
    },
    galleryCardPillText: { fontSize: 9, fontWeight: FontWeight.semibold, color: '#6B7280' },

    // Projects list — full-width cards stacked
    projectsList: { gap: Spacing.md },
    projectCard: { borderRadius: Radius.lg, overflow: 'hidden' },
    projectCardImg: { width: '100%', height: 200, resizeMode: 'cover' },
    projectCardBody: { padding: Spacing.md, gap: Spacing.sm },
    projectThemeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
    projectThemeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    projectCardName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, lineHeight: 20 },
    projectCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    projectCardCity: { fontSize: FontSize.xs },
    projectCardAbout: { fontSize: FontSize.sm, lineHeight: 20 },
    projectViewBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
      borderWidth: 1.5, borderRadius: Radius.md, paddingVertical: 10, marginTop: 4,
    },
    projectViewBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

    // Product detail — Option A (editorial)
    productScroll: { paddingBottom: 100 },
    pdpBackBtn: {
      position: 'absolute', top: 52, left: Spacing.lg, zIndex: 20,
      backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, padding: 8,
    },
    pdpHeroWrap: { width: '100%', height: 420, position: 'relative' },
    pdpHeroImg: { width: '100%', height: '100%' },
    pdpHeroOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, paddingTop: Spacing.md,
      gap: 8,
    },
    pdpHeroName: {
      color: '#FFF', fontSize: 28, fontWeight: FontWeight.bold,
      textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
    },
    pdpBrandPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full,
    },
    pdpBrandPillText: { color: '#FFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    pdpWishlistBtn: {
      position: 'absolute', top: 52, right: Spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 8,
    },
    pdpCard: {
      marginTop: -24, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: Spacing.lg, gap: Spacing.md,
    },
    pdpDesc: { fontSize: FontSize.sm, lineHeight: 22 },
    pdpDivider: { height: 1 },
    pdpSpecGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    pdpSpecCell: { width: '47%', borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
    pdpSpecLabel: {
      fontSize: 10, fontWeight: FontWeight.semibold,
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    pdpSpecValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

    // Thumbnail strip
    pdpThumbScroll: { marginTop: -1 },
    pdpThumbRow: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, gap: Spacing.xs },
    pdpThumbWrap: { borderRadius: Radius.sm, overflow: 'hidden' },
    pdpThumb: { width: 72, height: 72 },

    // Gallery lightbox — vertical grid
    galleryModal: { flex: 1, backgroundColor: '#000' },
    galleryClose: {
      position: 'absolute', top: 52, right: Spacing.lg, zIndex: 10,
      backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 8,
    },
    galleryHeader: {
      paddingTop: Platform.OS === 'web' ? 14 : 56, paddingBottom: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingRight: 60,
    },
    galleryTitle: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.bold },
    galleryGrid: { gap: 3, padding: 3 },
    galleryGridImg: { width: APP_W - 6, height: APP_W - 6, backgroundColor: '#111' },

    // Simulate scan modal
    simOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center' },
    simModal: { flex: 1, width: '100%', maxWidth: 390 },
    simClose: { position: 'absolute', top: 52, right: Spacing.lg, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 6 },
    simCamera: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 320 },
    simScanFrame: { width: 200, height: 200, position: 'relative', alignItems: 'center', justifyContent: 'center' },
    simCorner: { position: 'absolute', width: 24, height: 24, borderWidth: 3 },
    simCornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
    simCornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
    simCornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
    simCornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
    simQrBox: { width: 130, height: 130, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    simHint: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.sm, marginTop: Spacing.xl, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, overflow: 'hidden' },
    simCaptureArea: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
    simCaptureBrand: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    simCaptureSub: { fontSize: FontSize.sm },
    simCaptureBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 14, paddingHorizontal: Spacing.xl, borderRadius: Radius.md, marginTop: Spacing.md },
    simCaptureBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    simResult: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
    simSavingIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
    simResultTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center' },
    simResultSub: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },

    // Collections — collage layout
    collectionBlock: { gap: Spacing.md, marginBottom: Spacing.xl },
    collectionHeading: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    collectionAbout: { fontSize: FontSize.sm, lineHeight: 20 },

    // Past shows tab — view CTA on card
    pastShowViewCta: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
      marginTop: Spacing.sm, paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    pastShowViewCtaText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },

    // Past show detail page
    pastShowDetailScroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    pastShowDetailHero: { paddingTop: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
    pastShowDetailYearBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
    pastShowDetailYear: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    pastShowDetailName: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, lineHeight: 30 },
    pastShowDetailMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pastShowDetailCity: { fontSize: FontSize.sm },
    pastShowDetailBooth: { fontSize: FontSize.sm },
    pastShowSection: { marginBottom: Spacing.xl },
    pastShowSectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 1, marginBottom: Spacing.sm },
    pastShowAboutCard: { borderRadius: Radius.lg, padding: Spacing.lg },
    pastShowAboutText: { fontSize: FontSize.sm, lineHeight: 22 },
  });
}
