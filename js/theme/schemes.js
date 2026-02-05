/**
 * @typedef {Object} ColorScheme
 * @property {string} id
 * @property {string} label
 * @property {string} primary
 * @property {string} primaryHover
 * @property {string} badgeMain
 * @property {string} badgeAlt
 * @property {string} highlight
 * @property {string} price
 * @property {string} chipBg
 * @property {string} chipText
 * @property {string} textOnPrimary
 */

/** @type {ColorScheme[]} */
export const COLOR_SCHEMES = [
  {
    id: "ruby-red",
    label: "Ruby Red",
    primary: "#C62828",
    primaryHover: "#B71C1C",
    badgeMain: "#E53935",
    badgeAlt: "#FFCDD2",
    highlight: "#FFD700",
    price: "#B71C1C",
    chipBg: "#FEE2E2",
    chipText: "#991B1B",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "sunset-orange",
    label: "Sunset Orange",
    primary: "#F4511E",
    primaryHover: "#E64A19",
    badgeMain: "#FF7043",
    badgeAlt: "#FFCCBC",
    highlight: "#FFD600",
    price: "#D84315",
    chipBg: "#FFF7ED",
    chipText: "#9A3412",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "golden-sand",
    label: "Golden Sand",
    primary: "#C5A059",
    primaryHover: "#B48E46",
    badgeMain: "#D4AF37",
    badgeAlt: "#F5F5DC",
    highlight: "#FFEB3B",
    price: "#8E6E37",
    chipBg: "#FEFCE8",
    chipText: "#854D0E",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "emerald-green",
    label: "Emerald Green",
    primary: "#059669",
    primaryHover: "#047857",
    badgeMain: "#10B981",
    badgeAlt: "#D1FAE5",
    highlight: "#FBBF24",
    price: "#065F46",
    chipBg: "#ECFDF5",
    chipText: "#065F46",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "olive-estate",
    label: "Olive Estate",
    primary: "#65A30D",
    primaryHover: "#4D7C0F",
    badgeMain: "#84CC16",
    badgeAlt: "#F7FEE7",
    highlight: "#FBBF24",
    price: "#365314",
    chipBg: "#ECFCCB",
    chipText: "#365314",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "ocean-blue",
    label: "Ocean Blue",
    primary: "#1E40AF",
    primaryHover: "#1E3A8A",
    badgeMain: "#3B82F6",
    badgeAlt: "#DBEAFE",
    highlight: "#F59E0B",
    price: "#1E3A8A",
    chipBg: "#EFF6FF",
    chipText: "#1E40AF",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "skyline-blue",
    label: "Skyline Blue",
    primary: "#2563EB",
    primaryHover: "#1D4ED8",
    badgeMain: "#60A5FA",
    badgeAlt: "#DBEAFE",
    highlight: "#FBBF24",
    price: "#1E40AF",
    chipBg: "#F8FAFC",
    chipText: "#334155",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "royal-purple",
    label: "Royal Purple",
    primary: "#7C3AED",
    primaryHover: "#6D28D9",
    badgeMain: "#A78BFA",
    badgeAlt: "#EDE9FE",
    highlight: "#FBBF24",
    price: "#5B21B6",
    chipBg: "#F5F3FF",
    chipText: "#5B21B6",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "terracotta",
    label: "Terracotta",
    primary: "#9A3412",
    primaryHover: "#7C2D12",
    badgeMain: "#EA580C",
    badgeAlt: "#FFEDD5",
    highlight: "#FBBF24",
    price: "#7C2D12",
    chipBg: "#FFF7ED",
    chipText: "#7C2D12",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "carbon-black",
    label: "Carbon Black",
    primary: "#1E293B",
    primaryHover: "#0F172A",
    badgeMain: "#475569",
    badgeAlt: "#F1F5F9",
    highlight: "#FBBF24",
    price: "#0F172A",
    chipBg: "#F8FAFC",
    chipText: "#1E293B",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "stone-gray",
    label: "Stone Gray",
    primary: "#4B5563",
    primaryHover: "#374151",
    badgeMain: "#9CA3AF",
    badgeAlt: "#F3F4F6",
    highlight: "#FBBF24",
    price: "#1F2937",
    chipBg: "#F9FAFB",
    chipText: "#374151",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "blush-rose",
    label: "Blush Rose",
    primary: "#BE185D",
    primaryHover: "#9D174D",
    badgeMain: "#EC4899",
    badgeAlt: "#FCE7F3",
    highlight: "#FBBF24",
    price: "#9D174D",
    chipBg: "#FDF2F8",
    chipText: "#9D174D",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "teal-coast",
    label: "Teal Coast",
    primary: "#0D9488",
    primaryHover: "#0F766E",
    badgeMain: "#2DD4BF",
    badgeAlt: "#CCFBF1",
    highlight: "#FBBF24",
    price: "#0F766E",
    chipBg: "#F0FDFA",
    chipText: "#0F766E",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "mustard-urban",
    label: "Mustard Urban",
    primary: "#A16207",
    primaryHover: "#854D0E",
    badgeMain: "#EAB308",
    badgeAlt: "#FEF9C3",
    highlight: "#FBBF24",
    price: "#713F12",
    chipBg: "#FEFCE8",
    chipText: "#713F12",
    textOnPrimary: "#FFFFFF"
  },
  {
    id: "mint-fresh",
    label: "Mint Fresh",
    primary: "#10B981",
    primaryHover: "#059669",
    badgeMain: "#34D399",
    badgeAlt: "#D1FAE5",
    highlight: "#FBBF24",
    price: "#065F46",
    chipBg: "#F0FDF4",
    chipText: "#065F46",
    textOnPrimary: "#FFFFFF"
  }
];
