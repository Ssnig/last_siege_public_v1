/**
 * 2.5D Isometric Atmospheric Scenery Props & Ambient NPC Catalog.
 *
 * @remarks
 * Props are purely cosmetic and non-usable (no collision/mechanics), providing
 * visual depth and worldbuilding for historical Burmese battlefields.
 */

export type PropCategory = "trees" | "rocks" | "caves" | "ruins" | "npcs";

export interface PropDefinition {
  typeId: string;
  name: string;
  category: PropCategory;
  imageSrc: string;
  width: number;
  height: number;
  defaultScale: number;
  anchorY: number; // Bottom contact anchor (0.85-0.95) for accurate isometric ground positioning
  description: string;
}

export const PROP_CATALOG: Record<string, PropDefinition> = {
  // Trees & Flora
  tree_banyan: {
    typeId: "tree_banyan",
    name: "Ancient Banyan",
    category: "trees",
    imageSrc: "/assets/props/trees/tree_banyan.webp",
    width: 160,
    height: 180,
    defaultScale: 0.9,
    anchorY: 0.9,
    description: "Sacred Bodhi/Banyan tree with sprawling canopy and aerial roots.",
  },
  tree_palm: {
    typeId: "tree_palm",
    name: "Toddy Palm Cluster",
    category: "trees",
    imageSrc: "/assets/props/trees/tree_palm.webp",
    width: 120,
    height: 170,
    defaultScale: 0.85,
    anchorY: 0.92,
    description: "Iconic tropical palm trees found across dry central plains.",
  },
  tree_golden: {
    typeId: "tree_golden",
    name: "Golden Champak",
    category: "trees",
    imageSrc: "/assets/props/trees/tree_golden.webp",
    width: 130,
    height: 150,
    defaultScale: 0.85,
    anchorY: 0.9,
    description: "Flowering golden temple tree symbolizing peace and prosperity.",
  },
  tree_dead: {
    typeId: "tree_dead",
    name: "Ancient Dead Tree",
    category: "trees",
    imageSrc: "/assets/props/trees/tree_dead.webp",
    width: 130,
    height: 150,
    defaultScale: 0.85,
    anchorY: 0.9,
    description: "Twisted bare tree from the arid plains of Bagan.",
  },

  // Rocks & Geological Formations
  rock_boulder: {
    typeId: "rock_boulder",
    name: "Mossy Boulder",
    category: "rocks",
    imageSrc: "/assets/props/rocks/rock_boulder.webp",
    width: 110,
    height: 90,
    defaultScale: 0.9,
    anchorY: 0.85,
    description: "Weathered granite boulder covered with mountain moss.",
  },
  rock_cliff: {
    typeId: "rock_cliff",
    name: "Limestone Karst Outcrop",
    category: "rocks",
    imageSrc: "/assets/props/rocks/rock_cliff.webp",
    width: 140,
    height: 130,
    defaultScale: 0.9,
    anchorY: 0.88,
    description: "Rugged karst formation reminiscent of Hpa-An limestone peaks.",
  },
  rock_cluster: {
    typeId: "rock_cluster",
    name: "River Stone Cluster",
    category: "rocks",
    imageSrc: "/assets/props/rocks/rock_cluster.webp",
    width: 100,
    height: 70,
    defaultScale: 0.8,
    anchorY: 0.82,
    description: "Smooth river stones scattered near waterways.",
  },

  // Caves & Grottoes
  cave_entrance: {
    typeId: "cave_entrance",
    name: "Sacred Cavern Entrance",
    category: "caves",
    imageSrc: "/assets/props/caves/cave_entrance.webp",
    width: 170,
    height: 150,
    defaultScale: 0.95,
    anchorY: 0.9,
    description: "Mysterious dark grotto mouth carved into limestone mountain.",
  },
  cave_grotto: {
    typeId: "cave_grotto",
    name: "Sunlit Grotto Alcove",
    category: "caves",
    imageSrc: "/assets/props/caves/cave_grotto.webp",
    width: 130,
    height: 120,
    defaultScale: 0.9,
    anchorY: 0.88,
    description: "A natural rocky hollow with warm atmospheric lighting.",
  },

  // Ruined Buildings & Ancient Masonry
  ruins_pagoda: {
    typeId: "ruins_pagoda",
    name: "Ancient Bagan Pagoda Ruins",
    category: "ruins",
    imageSrc: "/assets/props/ruins/ruins_pagoda.webp",
    width: 150,
    height: 175,
    defaultScale: 0.9,
    anchorY: 0.92,
    description: "Weathered terracotta stupa with crumbling brick tiers.",
  },
  ruins_arch: {
    typeId: "ruins_arch",
    name: "Crumbling Torana Gateway",
    category: "ruins",
    imageSrc: "/assets/props/ruins/ruins_arch.webp",
    width: 130,
    height: 150,
    defaultScale: 0.9,
    anchorY: 0.92,
    description: "Ancient stone archway overgrown with creeping jungle vines.",
  },
  ruins_pillar: {
    typeId: "ruins_pillar",
    name: "Sanctuary Columns & Dais",
    category: "ruins",
    imageSrc: "/assets/props/ruins/ruins_pillar.webp",
    width: 110,
    height: 120,
    defaultScale: 0.85,
    anchorY: 0.88,
    description: "Carved royal stone pillars from a forgotten kingdom hall.",
  },
  ruins_wall: {
    typeId: "ruins_wall",
    name: "Crumbling Ruin Wall",
    category: "ruins",
    imageSrc: "/assets/props/ruins/ruins_wall.webp",
    width: 140,
    height: 110,
    defaultScale: 0.9,
    anchorY: 0.88,
    description: "Ancient overgrown terracotta brick wall section with climbing ivy.",
  },
  ruins_cart: {
    typeId: "ruins_cart",
    name: "Burmese Bullock Cart",
    category: "ruins",
    imageSrc: "/assets/props/ruins/ruins_cart.webp",
    width: 120,
    height: 90,
    defaultScale: 0.85,
    anchorY: 0.85,
    description: "Traditional wooden cart with large spoked wheels.",
  },
  ruins_shrine: {
    typeId: "ruins_shrine",
    name: "Nat Spirit Shrine",
    category: "ruins",
    imageSrc: "/assets/props/ruins/ruins_shrine.webp",
    width: 100,
    height: 130,
    defaultScale: 0.85,
    anchorY: 0.9,
    description: "Sacred village spirit house erected on wooden stilts.",
  },

  // NPCs & Kingdom Fauna
  npc_monk: {
    typeId: "npc_monk",
    name: "Meditating Monk",
    category: "npcs",
    imageSrc: "/assets/props/npcs/npc_monk.webp",
    width: 70,
    height: 90,
    defaultScale: 0.7,
    anchorY: 0.92,
    description: "A serene monk in saffron robes reciting parittas.",
  },
  npc_villager: {
    typeId: "npc_villager",
    name: "Kingdom Villager",
    category: "npcs",
    imageSrc: "/assets/props/npcs/npc_villager.webp",
    width: 70,
    height: 90,
    defaultScale: 0.7,
    anchorY: 0.92,
    description: "Local citizen wearing traditional longyi.",
  },
  npc_hermit: {
    typeId: "npc_hermit",
    name: "Forest Hermit (Yat-the)",
    category: "npcs",
    imageSrc: "/assets/props/npcs/npc_hermit.webp",
    width: 70,
    height: 90,
    defaultScale: 0.7,
    anchorY: 0.92,
    description: "Forest mystic in ascetic robe with wooden walking staff.",
  },
  npc_peacock: {
    typeId: "npc_peacock",
    name: "Royal Peacock",
    category: "npcs",
    imageSrc: "/assets/props/npcs/npc_peacock.webp",
    width: 80,
    height: 80,
    defaultScale: 0.75,
    anchorY: 0.9,
    description: "Golden kingdom peacock with fan feathers slightly raised.",
  },
  npc_ox: {
    typeId: "npc_ox",
    name: "Resting Sacred Ox",
    category: "npcs",
    imageSrc: "/assets/props/npcs/npc_ox.webp",
    width: 100,
    height: 70,
    defaultScale: 0.75,
    anchorY: 0.88,
    description: "White hump-backed ox resting peacefully on the meadow.",
  },
};

