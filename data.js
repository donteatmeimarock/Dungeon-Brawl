// Dungeon Brawl - Weapons, Armors, Amulets, and Spells Data Catalog

const ITEMS = {
  // ================= SWORDS (MELEE) =================
  swords: [
    {
      id: 'sword_rusty',
      name: 'Rusty Iron Blade',
      category: 'sword',
      icon: '🗡️',
      rarity: 'common',
      cost: 0,
      damage: 68,
      speed: 0.42, // swing cooldown in seconds
      range: 75,
      arc: Math.PI * 0.75, // 135 deg swing arc
      color: '#c0c0c0',
      trailColor: 'rgba(200, 200, 200, 0.4)',
      effect: 'none',
      desc: 'A reliable balanced blade. Deals 68 melee damage with standard swing speed.'
    },
    {
      id: 'sword_flame',
      name: 'Flame Saber',
      category: 'sword',
      icon: '🔥🗡️',
      rarity: 'rare',
      cost: 120,
      damage: 87,
      speed: 0.40,
      range: 80,
      arc: Math.PI * 0.8,
      color: '#ff5722',
      trailColor: 'rgba(255, 87, 34, 0.6)',
      effect: 'burn', // 5 dmg x 4 ticks over 3s
      desc: 'Forged in dragonfire. Deals 87 damage and inflicts Burn (20 fire damage over 3s).'
    },
    {
      id: 'sword_thunder',
      name: 'Thunder Katana',
      category: 'sword',
      icon: '⚡🗡️',
      rarity: 'rare',
      cost: 200,
      damage: 72,
      speed: 0.30, // very fast!
      range: 75,
      arc: Math.PI * 0.7,
      color: '#00e5ff',
      trailColor: 'rgba(0, 229, 255, 0.6)',
      effect: 'lightning', // sparks chain shock
      desc: 'Lightning-fast swings. Every hit releases a chain electric spark dealing 8 shock damage.'
    },
    {
      id: 'sword_frost',
      name: 'Frostbite Rapier',
      category: 'sword',
      icon: '❄️🗡️',
      rarity: 'rare',
      cost: 260,
      damage: 80,
      speed: 0.35,
      range: 82,
      arc: Math.PI * 0.65,
      color: '#80d8ff',
      trailColor: 'rgba(128, 216, 255, 0.6)',
      effect: 'chill', // slows enemy move speed by 35% for 2s
      desc: 'Chilled steel. Deals 80 damage and slows opponent movement speed by 35% for 2 seconds.'
    },
    {
      id: 'sword_void',
      name: 'Void Greatsword',
      category: 'sword',
      icon: '🔮🗡️',
      rarity: 'epic',
      cost: 350,
      damage: 132,
      speed: 0.58, // heavy slower hit
      range: 92,
      arc: Math.PI * 0.9,
      color: '#b388ff',
      trailColor: 'rgba(179, 136, 255, 0.65)',
      effect: 'lifesteal', // heals for 20% of melee damage
      desc: 'Massive abyssal cleaver. Deals 132 crushing damage and steals 20% of damage dealt as health.'
    },
    {
      id: 'sword_celestial',
      name: 'Celestial Claymore',
      category: 'sword',
      icon: '✨🗡️',
      rarity: 'legendary',
      cost: 500,
      damage: 147,
      speed: 0.44,
      range: 95,
      arc: Math.PI * 1.0, // huge 180 deg sweep!
      color: '#ffd700',
      trailColor: 'rgba(255, 215, 0, 0.7)',
      effect: 'holy_burst', // releases shockwave
      desc: 'Radiant holy relic. Wide 180° swing deals 147 damage + releases a 12 damage holy burst.'
    }
  ],

  // ================= BOWS (RANGED) =================
  bows: [
    {
      id: 'bow_short',
      name: "Hunter's Shortbow",
      category: 'bow',
      icon: '🏹',
      rarity: 'common',
      cost: 0,
      damage: 57,
      cooldown: 0.55,
      projSpeed: 620,
      projSize: 5,
      color: '#d7ccc8',
      effect: 'normal',
      desc: 'Standard hunter bow. Fires straight arrows dealing 57 damage with rapid reload speed.'
    },
    {
      id: 'bow_venom',
      name: 'Venom Recurve',
      category: 'bow',
      icon: '🧪🏹',
      rarity: 'rare',
      cost: 140,
      damage: 50,
      cooldown: 0.52,
      projSpeed: 640,
      projSize: 5,
      color: '#76ff03',
      effect: 'poison', // poison ticks 3 dmg x 4
      desc: 'Tipped with viper toxin. Deals 50 impact damage + 12 venom damage (3 dmg x 4 ticks).'
    },
    {
      id: 'bow_triple',
      name: 'Triple Crossbow',
      category: 'bow',
      icon: '🔱🏹',
      rarity: 'rare',
      cost: 220,
      damage: 42, // 42 x 3 = 126 if all 3 land!
      cooldown: 0.72,
      projSpeed: 600,
      projSize: 4,
      color: '#ff9800',
      effect: 'spread_3',
      desc: 'Mechanized repeating crossbow. Fires a 3-arrow fan spread (42 damage each).'
    },
    {
      id: 'bow_storm',
      name: 'Storm Bow',
      category: 'bow',
      icon: '🌩️🏹',
      rarity: 'epic',
      cost: 290,
      damage: 75,
      cooldown: 0.65,
      projSpeed: 680,
      projSize: 6,
      color: '#00e5ff',
      effect: 'storm_hit',
      desc: 'Charged with atmospheric voltage. Arrows deal 75 damage and summon a 12 dmg lightning bolt.'
    },
    {
      id: 'bow_sniper',
      name: 'Sniper Ballista',
      category: 'bow',
      icon: '🎯🏹',
      rarity: 'epic',
      cost: 380,
      damage: 147,
      cooldown: 1.15,
      projSpeed: 950, // ultra high speed
      projSize: 7,
      color: '#ff1744',
      effect: 'pierce',
      desc: 'Heavy ballista. Fires supersonic piercing bolts dealing 147 damage straight through obstacles!'
    },
    {
      id: 'bow_dragon',
      name: 'Dragonbreath Bow',
      category: 'bow',
      icon: '🐲🏹',
      rarity: 'legendary',
      cost: 550,
      damage: 113,
      cooldown: 0.85,
      projSpeed: 650,
      projSize: 8,
      color: '#ff3d00',
      effect: 'explosive',
      desc: 'Fires volcanic incendiary arrows that detonate in a 113 damage explosive blast on contact.'
    }
  ],

  // ================= ARMOR (PROTECTION) =================
  armors: [
    {
      id: 'armor_leather',
      name: 'Padded Leather Vest',
      category: 'armor',
      icon: '🦺',
      rarity: 'common',
      cost: 0,
      hpBonus: 0, // Base HP is 1000 -> 1000 Total HP!
      speedMod: 1.05,
      dmgReduction: 0.05,
      passive: 'none',
      desc: 'Lightweight cured leather. 1,000 Total HP and +5% Movement Speed.'
    },
    {
      id: 'armor_plate',
      name: "Knight's Heavy Plate",
      category: 'armor',
      icon: '🛡️',
      rarity: 'rare',
      cost: 150,
      hpBonus: 300, // 1,300 total HP!
      speedMod: 0.94,
      dmgReduction: 0.20, // takes 20% less damage!
      passive: 'fortified',
      desc: 'Tempered steel plate. +300 Max HP (1,300 total), 20% damage reduction, -6% Move Speed.'
    },
    {
      id: 'armor_shadow',
      name: 'Shadowstalker Cloak',
      category: 'armor',
      icon: '🥋',
      rarity: 'rare',
      cost: 230,
      hpBonus: 100, // 1,100 total HP
      speedMod: 1.20, // +20% movement speed!
      dmgReduction: 0.0,
      passive: 'evasion', // 18% chance to dodge any attack completely
      desc: 'Woven from shifting shadows. +100 Max HP, +20% Move Speed, and 18% chance to completely evade hits.'
    },
    {
      id: 'armor_thornmail',
      name: 'Thornmail Hauberk',
      category: 'armor',
      icon: '🌵🛡️',
      rarity: 'epic',
      cost: 320,
      hpBonus: 200, // 1,200 total HP
      speedMod: 1.0,
      dmgReduction: 0.12,
      passive: 'thorns', // reflects 25% melee damage
      desc: 'Barbed spiked steel. +200 Max HP and reflects 25% of all melee damage taken back to the attacker!'
    },
    {
      id: 'armor_phoenix',
      name: 'Phoenix Feather Robe',
      category: 'armor',
      icon: '🪶🛡️',
      rarity: 'epic',
      cost: 450,
      hpBonus: 150, // 1,150 total HP
      speedMod: 1.08,
      dmgReduction: 0.08,
      passive: 'phoenix_revive', // revives once per round with 35% HP
      desc: 'Blessed by the firebird. +150 Max HP. Once per round upon fatal damage, instantly revives with 35% HP!'
    },
    {
      id: 'armor_titan',
      name: "Titan's Obsidian Bulwark",
      category: 'armor',
      icon: '💎🛡️',
      rarity: 'legendary',
      cost: 600,
      hpBonus: 400, // 1,400 total HP!
      speedMod: 0.96,
      dmgReduction: 0.18,
      passive: 'barrier', // generates a 150 HP blue shield every 10 seconds
      desc: 'Carved from living obsidian. +400 Max HP (1,400 total) and regenerates a 150 HP kinetic barrier!'
    }
  ],

  // ================= AMULETS (BUFF) =================
  amulets: [
    {
      id: 'amulet_copper',
      name: 'Charm of Vigor',
      category: 'amulet',
      icon: '🥉📿',
      rarity: 'common',
      cost: 0,
      buffType: 'regen',
      value: 15,
      desc: 'Passive Health Regeneration: Restores 15 Health every 3 seconds during combat.'
    },
    {
      id: 'amulet_swift',
      name: 'Swiftwing Pendant',
      category: 'amulet',
      icon: '🪽📿',
      rarity: 'rare',
      cost: 110,
      buffType: 'speed_dash',
      value: 0.15,
      desc: 'Wind blessing: +15% Movement Speed and reduces Dash cooldown by 35%.'
    },
    {
      id: 'amulet_blood',
      name: 'Bloodstone Eye',
      category: 'amulet',
      icon: '🩸📿',
      rarity: 'rare',
      cost: 190,
      buffType: 'lifesteal',
      value: 0.06,
      desc: 'Vampiric gem: Heals you for 6% of all damage dealt with Swords, Bows, and Spells.'
    },
    {
      id: 'amulet_chrono',
      name: 'Chrono Talisman',
      category: 'amulet',
      icon: '⏳📿',
      rarity: 'epic',
      cost: 270,
      buffType: 'cooldown_reduction',
      value: 0.25,
      desc: 'Temporal dilation: 25% Cooldown Reduction across all 3 spells and bow attacks.'
    },
    {
      id: 'amulet_berserker',
      name: "Berserker's Fang",
      category: 'amulet',
      icon: '🐺📿',
      rarity: 'epic',
      cost: 290,
      buffType: 'berserk',
      value: 0.30,
      desc: 'When HP drops below 45%, unleash frenzy: +35% Attack Speed and +25% bonus Damage!'
    },
    {
      id: 'amulet_archmage',
      name: "Archmage's Prism",
      category: 'amulet',
      icon: '🔮📿',
      rarity: 'legendary',
      cost: 420,
      buffType: 'spell_power',
      value: 0.35,
      desc: 'Empowers magic: Spells deal +35% bonus damage and knock opponents backward!'
    }
  ],

  // ================= SPELLS (CHOOSE 3) =================
  spells: [
    {
      id: 'spell_fireball',
      name: 'Fireball',
      category: 'spell',
      icon: '🔥',
      rarity: 'common',
      cost: 0,
      cooldown: 5.5,
      damage: 150,
      castType: 'projectile',
      projSpeed: 520,
      splashRadius: 75,
      color: '#ff3d00',
      desc: 'Hurls an explosive fireball toward target that detonates on impact for 150 area damage.'
    },
    {
      id: 'spell_frost_nova',
      name: 'Frost Nova',
      category: 'spell',
      icon: '❄️',
      rarity: 'common',
      cost: 0,
      cooldown: 7.5,
      damage: 100,
      castType: 'aoe_around',
      radius: 125,
      freezeDuration: 1.4, // freeze duration in s
      color: '#00e5ff',
      desc: 'Explodes an icy blast in a wide ring around you, dealing 100 damage and freezing enemies for 1.4s.'
    },
    {
      id: 'spell_holy_mend',
      name: 'Holy Mend',
      category: 'spell',
      icon: '✨',
      rarity: 'common',
      cost: 0,
      cooldown: 11.0,
      healAmount: 220,
      castType: 'self_heal',
      color: '#76ff03',
      desc: 'Channels sacred restorative light, immediately restoring 220 Health to your hero.'
    },
    {
      id: 'spell_blink',
      name: 'Shadow Blink',
      category: 'spell',
      icon: '🌀',
      rarity: 'rare',
      cost: 150,
      cooldown: 5.0,
      distance: 210,
      castType: 'teleport',
      color: '#e040fb',
      desc: 'Instantly teleports 210 units toward cursor, breaking target locks and escaping danger.'
    },
    {
      id: 'spell_lightning',
      name: 'Lightning Smite',
      category: 'spell',
      icon: '⚡',
      rarity: 'rare',
      cost: 210,
      cooldown: 6.5,
      damage: 135,
      stunDuration: 0.6,
      castType: 'instant_point',
      radius: 65,
      color: '#ffd600',
      desc: 'Calls down an instant bolt of lightning at cursor location, dealing 135 damage with a brief stun.'
    },
    {
      id: 'spell_toxic_miasma',
      name: 'Toxic Miasma',
      category: 'spell',
      icon: '☣️',
      rarity: 'rare',
      cost: 190,
      cooldown: 8.5,
      damagePerSec: 45,
      duration: 5.0,
      castType: 'lobbed_cloud',
      radius: 100,
      color: '#00e676',
      desc: 'Lobs a toxic alchemical vial creating a dense corrosive cloud that poisons enemies (45 dmg/s).'
    },
    {
      id: 'spell_arcane_aegis',
      name: 'Arcane Aegis',
      category: 'spell',
      icon: '🛡️✨',
      rarity: 'epic',
      cost: 250,
      cooldown: 9.5,
      shieldAmount: 220,
      duration: 6.0,
      castType: 'shield',
      color: '#00b0ff',
      desc: 'Conjures a shimmering hexagonal arcane forcefield absorbing up to 220 incoming damage for 6s.'
    },
    {
      id: 'spell_meteor',
      name: 'Meteor Strike',
      category: 'spell',
      icon: '☄️',
      rarity: 'epic',
      cost: 320,
      cooldown: 11.5,
      damage: 260,
      delay: 0.85,
      radius: 115,
      castType: 'targeted_aoe',
      color: '#ff1744',
      desc: 'Summons a colossal fiery meteorite from the cosmos. Strikes ground after 0.8s for 260 crushing damage!'
    },
    {
      id: 'spell_vortex',
      name: 'Graviton Vortex',
      category: 'spell',
      icon: '🕳️',
      rarity: 'legendary',
      cost: 390,
      cooldown: 13.0,
      damage: 175,
      duration: 3.5,
      castType: 'vortex',
      radius: 130,
      color: '#651fff',
      desc: 'Creates a singularity that violently pulls the enemy into its center while crushing them over 3.5s!'
    }
  ]
};

// Helper lookup maps
const ITEM_MAP = {};
['swords', 'bows', 'armors', 'amulets', 'spells'].forEach(cat => {
  ITEMS[cat].forEach(item => {
    ITEM_MAP[item.id] = item;
  });
});

function getItem(id) {
  return ITEM_MAP[id] || null;
}
