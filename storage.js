// Dungeon Brawl - Storage & Player State Management

const STORAGE_KEY = 'dungeon_brawl_save_v1';
const SAVE_CODE_PREFIX = 'DB1-';
const DAILY_WIN_TARGET = 3;
const DAILY_WIN_REWARD = 50;

function computeSaveChecksum(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function encodeBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(b64url) {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

const DEFAULT_SAVE = {
  playerName: 'Gladiator',
  coins: 100, // Starter coins
  unlocked: [
    'sword_rusty',
    'bow_short',
    'armor_leather',
    'amulet_copper',
    'spell_fireball',
    'spell_frost_nova',
    'spell_holy_mend'
  ],
  equipped: {
    sword: 'sword_rusty',
    bow: 'bow_short',
    armor: 'armor_leather',
    amulet: 'amulet_copper',
    spells: ['spell_fireball', 'spell_frost_nova', 'spell_holy_mend']
  },
  stats: {
    matchesPlayed: 0,
    matchesWon: 0,
    roundsWon: 0,
    coinsEarned: 100
  },
  dailyWins: {
    date: null,
    wins: 0,
    claimed: false
  }
};

class PlayerStorage {
  constructor() {
    this.data = this.load();
    this.ensureDailyWinCurrent();
  }

  getLocalDateKey(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ensureDailyWinCurrent(shouldSave = true) {
    const today = this.getLocalDateKey();
    if (!this.data.dailyWins || this.data.dailyWins.date !== today) {
      this.data.dailyWins = {
        date: today,
        wins: 0,
        claimed: false
      };
      if (shouldSave) this.save();
    }
    return this.data.dailyWins;
  }

  getDailyWinStatus() {
    const daily = this.ensureDailyWinCurrent();
    return {
      date: daily.date,
      wins: daily.wins || 0,
      target: DAILY_WIN_TARGET,
      reward: DAILY_WIN_REWARD,
      claimed: Boolean(daily.claimed)
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge with defaults in case of new items or missing fields
        const merged = { ...DEFAULT_SAVE, ...parsed };
        merged.equipped = { ...DEFAULT_SAVE.equipped, ...(parsed.equipped || {}) };
        merged.stats = { ...DEFAULT_SAVE.stats, ...(parsed.stats || {}) };
        merged.dailyWins = { ...DEFAULT_SAVE.dailyWins, ...(parsed.dailyWins || {}) };
        if (!Array.isArray(merged.unlocked)) merged.unlocked = [...DEFAULT_SAVE.unlocked];
        if (!Array.isArray(merged.equipped.spells) || merged.equipped.spells.length !== 3) {
          merged.equipped.spells = [...DEFAULT_SAVE.equipped.spells];
        }
        return merged;
      }
    } catch (e) {
      console.warn('Failed to parse saved game data, using defaults', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_SAVE));
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }

  getCoins() {
    return this.data.coins;
  }

  addCoins(amount) {
    this.data.coins += Math.max(0, amount);
    this.data.stats.coinsEarned += Math.max(0, amount);
    this.save();
    return this.data.coins;
  }

  isUnlocked(itemId) {
    return this.data.unlocked.includes(itemId);
  }

  buyItem(itemId) {
    const item = getItem(itemId);
    if (!item) return { success: false, message: 'Item not found.' };
    if (this.isUnlocked(itemId)) return { success: false, message: 'Item already unlocked!' };
    if (this.data.coins < item.cost) {
      return { success: false, message: `Need ${item.cost - this.data.coins} more coins!` };
    }

    this.data.coins -= item.cost;
    this.data.unlocked.push(itemId);
    this.save();
    return { success: true, message: `Unlocked ${item.name}!`, item };
  }

  equipItem(slot, itemId, spellIndex = 0) {
    const item = getItem(itemId);
    if (!item) return { success: false, message: 'Invalid item.' };
    if (!this.isUnlocked(itemId)) return { success: false, message: 'Item is not unlocked yet.' };

    if (slot === 'sword' && item.category === 'sword') {
      this.data.equipped.sword = itemId;
    } else if (slot === 'bow' && item.category === 'bow') {
      this.data.equipped.bow = itemId;
    } else if (slot === 'armor' && item.category === 'armor') {
      this.data.equipped.armor = itemId;
    } else if (slot === 'amulet' && item.category === 'amulet') {
      this.data.equipped.amulet = itemId;
    } else if (slot === 'spell' && item.category === 'spell') {
      // Must be equipped in one of the 3 spell slots (0, 1, or 2)
      const spells = [...this.data.equipped.spells];
      const existingIdx = spells.indexOf(itemId);
      if (existingIdx !== -1 && existingIdx !== spellIndex) {
        // Swap spells if already equipped in another slot
        spells[existingIdx] = spells[spellIndex];
      }
      spells[spellIndex] = itemId;
      this.data.equipped.spells = spells;
    } else {
      return { success: false, message: 'Item category does not match slot.' };
    }

    this.save();
    return { success: true, message: `Equipped ${item.name}!`, equipped: this.data.equipped };
  }

  getEquipped() {
    return this.data.equipped;
  }

  /**
   * Validate that the loadout has:
   * 1 sword, 1 bow, 1 armor, 1 amulet, and 3 spells
   */
  validateLoadout(loadout = this.data.equipped) {
    const errors = [];

    if (!loadout.sword || !getItem(loadout.sword) || getItem(loadout.sword).category !== 'sword') {
      errors.push('You must equip 1 Sword (Melee weapon).');
    }

    if (!loadout.bow || !getItem(loadout.bow) || getItem(loadout.bow).category !== 'bow') {
      errors.push('You must equip 1 Bow (Ranged weapon).');
    }

    if (!loadout.armor || !getItem(loadout.armor) || getItem(loadout.armor).category !== 'armor') {
      errors.push('You must equip 1 Armor (Protection).');
    }

    if (!loadout.amulet || !getItem(loadout.amulet) || getItem(loadout.amulet).category !== 'amulet') {
      errors.push('You must equip 1 Amulet (Small buff).');
    }

    if (!Array.isArray(loadout.spells) || loadout.spells.length !== 3) {
      errors.push('You must equip exactly 3 Spells.');
    } else {
      const uniqueSpells = new Set();
      loadout.spells.forEach((sId, idx) => {
        const sp = getItem(sId);
        if (!sp || sp.category !== 'spell') {
          errors.push(`Spell slot ${idx + 1} has an invalid spell.`);
        } else {
          uniqueSpells.add(sId);
        }
      });
      if (uniqueSpells.size !== 3) {
        errors.push('You must equip 3 distinct Spells (no duplicates).');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  recordMatch(won, roundsWonCount) {
    this.data.stats.matchesPlayed++;
    if (won) this.data.stats.matchesWon++;
    this.data.stats.roundsWon += roundsWonCount;

    const daily = this.ensureDailyWinCurrent(false);
    let dailyBonusEarned = 0;

    if (won) {
      daily.wins = (daily.wins || 0) + 1;
      if (!daily.claimed && daily.wins >= DAILY_WIN_TARGET) {
        daily.claimed = true;
        dailyBonusEarned = DAILY_WIN_REWARD;
        this.data.coins += DAILY_WIN_REWARD;
        this.data.stats.coinsEarned += DAILY_WIN_REWARD;
      }
    }

    this.save();
    return {
      dailyBonusEarned,
      dailyWins: this.getDailyWinStatus()
    };
  }

  setPlayerName(name) {
    this.data.playerName = (name || 'Gladiator').trim().slice(0, 15);
    this.save();
  }

  resetAllProgress() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    this.ensureDailyWinCurrent(false);
    this.save();
  }

  exportSaveCode() {
    this.ensureDailyWinCurrent(false);
    const starterSet = new Set(DEFAULT_SAVE.unlocked);
    const extraUnlocked = this.data.unlocked.filter(id => !starterSet.has(id));
    const payload = {
      v: 1,
      n: this.data.playerName || DEFAULT_SAVE.playerName,
      c: this.data.coins,
      u: extraUnlocked,
      e: [
        this.data.equipped.sword,
        this.data.equipped.bow,
        this.data.equipped.armor,
        this.data.equipped.amulet,
        ...(this.data.equipped.spells || [])
      ],
      s: [
        this.data.stats.matchesPlayed || 0,
        this.data.stats.matchesWon || 0,
        this.data.stats.roundsWon || 0,
        this.data.stats.coinsEarned || 0
      ],
      d: [
        this.data.dailyWins.date,
        this.data.dailyWins.wins || 0,
        this.data.dailyWins.claimed ? 1 : 0
      ]
    };
    const encoded = encodeBase64Url(JSON.stringify(payload));
    const body = `${SAVE_CODE_PREFIX}${encoded}`;
    return `${body}.${computeSaveChecksum(body)}`;
  }

  normalizeImportedSave(payload) {
    const toNonNegInt = (val, fallback = 0) => {
      const n = Number(val);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
    };

    const playerName = (typeof payload.n === 'string' ? payload.n : DEFAULT_SAVE.playerName)
      .trim()
      .slice(0, 15) || DEFAULT_SAVE.playerName;
    const coins = toNonNegInt(payload.c, DEFAULT_SAVE.coins);

    const unlockedSet = new Set(DEFAULT_SAVE.unlocked);
    if (Array.isArray(payload.u)) {
      payload.u.forEach(id => {
        if (typeof id === 'string' && getItem(id)) {
          unlockedSet.add(id);
        }
      });
    }

    const eqArr = Array.isArray(payload.e) ? payload.e : [];
    const pickSlot = (idx, category) => {
      const id = eqArr[idx];
      const item = typeof id === 'string' ? getItem(id) : null;
      return item && item.category === category && unlockedSet.has(id)
        ? id
        : DEFAULT_SAVE.equipped[category];
    };

    const pickedSpells = [];
    eqArr.slice(4, 7).forEach(id => {
      const item = typeof id === 'string' ? getItem(id) : null;
      if (item && item.category === 'spell' && unlockedSet.has(id) && !pickedSpells.includes(id)) {
        pickedSpells.push(id);
      }
    });
    for (const id of unlockedSet) {
      if (pickedSpells.length >= 3) break;
      const item = getItem(id);
      if (item && item.category === 'spell' && !pickedSpells.includes(id)) {
        pickedSpells.push(id);
      }
    }

    const stArr = Array.isArray(payload.s) ? payload.s : [];
    const dailyArr = Array.isArray(payload.d) ? payload.d : [];
    const dailyDate = typeof dailyArr[0] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dailyArr[0])
      ? dailyArr[0]
      : null;

    return {
      playerName,
      coins,
      unlocked: Array.from(unlockedSet),
      equipped: {
        sword: pickSlot(0, 'sword'),
        bow: pickSlot(1, 'bow'),
        armor: pickSlot(2, 'armor'),
        amulet: pickSlot(3, 'amulet'),
        spells: pickedSpells
      },
      stats: {
        matchesPlayed: toNonNegInt(stArr[0], 0),
        matchesWon: toNonNegInt(stArr[1], 0),
        roundsWon: toNonNegInt(stArr[2], 0),
        coinsEarned: toNonNegInt(stArr[3], coins)
      },
      dailyWins: {
        date: dailyDate,
        wins: toNonNegInt(dailyArr[1], 0),
        claimed: Boolean(dailyArr[2])
      }
    };
  }

  importSaveCode(rawCode) {
    if (typeof rawCode !== 'string') {
      return { success: false, message: 'Please paste a valid save code.' };
    }

    const compact = rawCode.replace(/\s+/g, '');
    if (!compact.startsWith(SAVE_CODE_PREFIX)) {
      return { success: false, message: 'Invalid save code format (missing DB1- prefix).' };
    }

    const dotIndex = compact.lastIndexOf('.');
    if (dotIndex <= SAVE_CODE_PREFIX.length) {
      return { success: false, message: 'Invalid or incomplete save code.' };
    }

    const body = compact.slice(0, dotIndex);
    const checksum = compact.slice(dotIndex + 1);
    if (!/^[0-9a-f]{8}$/i.test(checksum) || computeSaveChecksum(body) !== checksum.toLowerCase()) {
      return { success: false, message: 'Corrupted save code (checksum mismatch).' };
    }

    let payload;
    try {
      const encoded = body.slice(SAVE_CODE_PREFIX.length);
      payload = JSON.parse(decodeBase64Url(encoded));
    } catch (e) {
      return { success: false, message: 'Failed to decode save code.' };
    }

    if (!payload || typeof payload !== 'object' || payload.v !== 1) {
      return { success: false, message: 'Unsupported save code version.' };
    }

    this.data = this.normalizeImportedSave(payload);
    this.ensureDailyWinCurrent(false);
    this.save();

    return {
      success: true,
      message: `Loaded save for "${this.data.playerName}" (${this.data.coins} coins, ${this.data.unlocked.length} items)!`,
      data: this.data
    };
  }
}

// Global player storage instance
const playerStorage = new PlayerStorage();

