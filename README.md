# ⚔️ Dungeon Brawl: Arena of Champions (1v1 PvP)

A real-time cross-device multiplayer PvP arena game where two players connect using a **Challenge Code** to battle in a **Best of 5** duel.

---

## 🎮 Game Features

- **Cross-Device Matchmaking**: Connect two devices (Desktop, Laptop, iPhone, Android, Tablet) across local WiFi or the Internet using a 5-character **Challenge Code**, **Direct Share Link**, or **QR Code**.
- **Best of 5 Round System**: First fighter to win 3 rounds takes the match crown!
- **Strict 5-Slot Battle Loadout**: Before going into battle, you must equip:
  1. ⚔️ **1 Sword** (Melee attack, sweep arcs, on-hit burns, lightning, or lifesteal)
  2. 🏹 **1 Bow** (Ranged arrows, spread shot, piercing ballista, or venom)
  3. 🛡️ **1 Armor** (Protection, health pool bonus, damage reduction, passives like Thornmail or Phoenix Revive)
  4. 📿 **1 Amulet** (Buffs like passive health regen, movement speed, cooldown reduction, or vampirism)
  5. ✨ **3 Unique Spells** (Choose from Fireball, Frost Nova, Holy Mend, Shadow Blink, Meteor Strike, Lightning Smite, Toxic Miasma, and Arcane Aegis)
- **Progression & Weapons Shop**:
  - Earn Gold Coins for winning matches (+120 coins) and rounds (+20 coins). Even defeat gives a consolation prize (+35 coins)!
  - Spend your coins in the **Weapons & Gear Shop** to unlock new swords, bows, armors, amulets, and magic spells.
  - Persistent save state stored automatically in `localStorage`.
- **Procedural Web Audio**: Zero external audio downloads needed—features real-time synthesized sword swings, metallic clangs, arrow shots, explosions, ice crackles, and victory fanfares.
- **Solo AI Training Dummy**: Test weapons, spell combos, and movement anytime against an AI champion.

---

## 🚀 How to Run & Play

### 1. Start the Server
In this directory, run:
```bash
node server.js
```
*(Or `npm start`)*

The console will display:
```text
📡 Local Host:       http://localhost:3000
📱 Other Devices/LAN: http://192.168.0.XX:3000
```

### 2. Connect Two Devices

#### Device 1 (Host):
1. Open `http://localhost:3000` (or the network IP on another computer/phone).
2. Click **"Create Duel Room"**.
3. You will receive a **Challenge Code** (e.g. `BRAWL-9271`), a clickable **"Copy Link"** button, and an on-screen **QR Code**.

#### Device 2 (Challenger):
1. On your phone, tablet, or another computer, open the network URL or scan the QR code.
2. Enter the **Challenge Code** into the input box and click **"Join"**.
3. Both devices will connect with ultra-low latency!

### 3. Equip & Ready Up
1. Click **"Armory & Loadout"** to view and customize your 5 mandatory slots.
2. Click **"READY FOR BATTLE"**. When both gladiators are ready, the match begins!

---

## 🕹️ Controls & Hot Bar

### Hot Bar (Slots 1 to 5):
- **Slot 1 (Close Range / Sword)**: Press `1` to equip. Wherever you click attacks with melee until you change weapons.
- **Slot 2 (Ranged / Bow)**: Press `2` to equip. Wherever you click shoots a projectile until you change weapons.
- **Slot 3 (Spell 1)**: `3` or `Q`
- **Slot 4 (Spell 2)**: `4` or `C`
- **Slot 5 (Spell 3)**: `5`, `R`, or `F`
- **Mobility (Dash)**: `Spacebar` (brief invulnerability)

### Movement & Aim:
- **Move**: `W`, `A`, `S`, `D` or Arrow Keys
- **Aim**: Mouse cursor (or touch aim)

### Mobile & Tablet (Touchscreen):
- **Move**: Virtual touch joystick on the bottom-left of the screen.
- **Actions**: Floating touch buttons for 🗡️ Sword, 🏹 Bow, ⚡ Dash, and ✨ Spells on the bottom-right.

---

## 🛒 Gear & Spell Catalog

| Category | Starter Free Gear | Unlockable Upgrades |
| :--- | :--- | :--- |
| **Swords** | Rusty Iron Blade | Flame Saber, Thunder Katana, Frostbite Rapier, Void Greatsword, Celestial Claymore |
| **Bows** | Hunter's Shortbow | Venom Recurve, Triple Crossbow, Storm Bow, Sniper Ballista, Dragonbreath Bow |
| **Armor** | Padded Leather Vest | Knight's Heavy Plate, Shadowstalker Cloak, Thornmail Hauberk, Phoenix Feather Robe, Titan's Obsidian Bulwark |
| **Amulets** | Charm of Vigor (HP Regen) | Swiftwing Pendant (Speed), Bloodstone Eye (Lifesteal), Chrono Talisman (CDR), Berserker's Fang, Archmage's Prism |
| **Spells** | Fireball, Frost Nova, Holy Mend | Shadow Blink, Lightning Smite, Toxic Miasma, Arcane Aegis, Meteor Strike, Graviton Vortex |

