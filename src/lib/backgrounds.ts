export type BoardBg = {
  id: string;
  name: string;
  value: string;
  preview: string;
};

export const SOLIDS: BoardBg[] = [
  { id: "sunshine", name: "Sunshine", value: "#fef3c7", preview: "#fef3c7" },
  { id: "blossom", name: "Blossom", value: "#fce7f3", preview: "#fce7f3" },
  { id: "sky", name: "Sky", value: "#dbeafe", preview: "#dbeafe" },
  { id: "mint", name: "Mint", value: "#dcfce7", preview: "#dcfce7" },
  { id: "lavender", name: "Lavender", value: "#ede9fe", preview: "#ede9fe" },
  { id: "peach", name: "Peach", value: "#fed7aa", preview: "#fed7aa" },
  { id: "aqua", name: "Aqua", value: "#cffafe", preview: "#cffafe" },
  { id: "rose", name: "Rose", value: "#fee2e2", preview: "#fee2e2" },
];

export const GRADIENTS: BoardBg[] = [
  {
    id: "sunrise",
    name: "Sunrise",
    value: "linear-gradient(135deg, #fef3c7 0%, #fce7f3 50%, #ddd6fe 100%)",
    preview: "linear-gradient(135deg, #fef3c7 0%, #fce7f3 50%, #ddd6fe 100%)",
  },
  {
    id: "ocean",
    name: "Ocean",
    value: "linear-gradient(135deg, #dbeafe 0%, #cffafe 50%, #a7f3d0 100%)",
    preview: "linear-gradient(135deg, #dbeafe 0%, #cffafe 50%, #a7f3d0 100%)",
  },
  {
    id: "forest",
    name: "Forest",
    value: "linear-gradient(135deg, #dcfce7 0%, #a7f3d0 50%, #6ee7b7 100%)",
    preview: "linear-gradient(135deg, #dcfce7 0%, #a7f3d0 50%, #6ee7b7 100%)",
  },
  {
    id: "lavender-dreams",
    name: "Lavender Dreams",
    value: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 50%, #c4b5fd 100%)",
    preview: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 50%, #c4b5fd 100%)",
  },
  {
    id: "sunset",
    name: "Sunset",
    value: "linear-gradient(135deg, #fef3c7 0%, #fed7aa 30%, #fca5a5 70%, #f472b6 100%)",
    preview: "linear-gradient(135deg, #fef3c7 0%, #fed7aa 30%, #fca5a5 70%, #f472b6 100%)",
  },
  {
    id: "aurora",
    name: "Aurora",
    value: "linear-gradient(135deg, #ddd6fe 0%, #f0abfc 33%, #67e8f9 66%, #6ee7b7 100%)",
    preview: "linear-gradient(135deg, #ddd6fe 0%, #f0abfc 33%, #67e8f9 66%, #6ee7b7 100%)",
  },
];

export const ALL_BGS: BoardBg[] = [...SOLIDS, ...GRADIENTS];
