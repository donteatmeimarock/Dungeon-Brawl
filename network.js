// Dungeon Brawl - PeerJS WebRTC Multiplayer Network Manager

const PEER_PREFIX = 'dbrawl-v1-';

class NetworkManager {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.isBot = false;
    this.botDifficulty = 'normal'; // 'normal', 'hard', 'nightmare'
    this.gameMode = 'duel'; // 'duel' or 'horde'
    this.roomCode = null;
    this.status = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, CONNECTED
    this.ping = 0;
    this.lastPingSent = 0;
    this.pingInterval = null;

    this.onConnected = null;
    this.onDisconnected = null;
    this.onOpponentReady = null;
    this.onPacket = null;
    this.onStatusChange = null;

    this.opponentProfile = null;
    this.myProfile = null;
  }

  generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  initPeer(customId = null) {
    return new Promise((resolve, reject) => {
      if (this.peer && !this.peer.destroyed) {
        this.peer.destroy();
      }

      try {
        // Use PeerJS standard public cloud broker
        const peerOptions = {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        };

        this.peer = customId ? new Peer(customId, peerOptions) : new Peer(peerOptions);

        this.peer.on('open', (id) => {
          resolve(id);
        });

        this.peer.on('error', (err) => {
          console.warn('PeerJS error:', err.type, err);
          if (this.onStatusChange) this.onStatusChange('ERROR', err.message || err.type);
          reject(err);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async hostChallenge(code, profile, gameMode = 'duel') {
    this.isHost = true;
    this.isBot = false;
    this.gameMode = gameMode;
    this.roomCode = (code || this.generateRoomCode()).toUpperCase().trim();
    this.myProfile = profile;
    this.updateStatus('CONNECTING', 'Creating arena room...');

    const fullPeerId = PEER_PREFIX + this.roomCode;

    try {
      await this.initPeer(fullPeerId);
      this.updateStatus('WAITING', `Room created! Code: ${this.roomCode}`);

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      return { success: true, code: this.roomCode, gameMode: this.gameMode };
    } catch (err) {
      if (err.type === 'unavailable-id') {
        // Try another code
        const altCode = this.generateRoomCode();
        return this.hostChallenge(altCode, profile, gameMode);
      }
      this.updateStatus('ERROR', 'Failed to initialize room: ' + err.message);
      return { success: false, error: err.message };
    }
  }

  async joinChallenge(code, profile) {
    this.isHost = false;
    this.isBot = false;
    this.roomCode = (code || '').toUpperCase().trim();
    this.myProfile = profile;

    if (!this.roomCode) {
      return { success: false, error: 'Challenge code is required!' };
    }

    this.updateStatus('CONNECTING', `Connecting to room ${this.roomCode}...`);

    try {
      await this.initPeer();
      const targetPeerId = PEER_PREFIX + this.roomCode;
      const conn = this.peer.connect(targetPeerId, {
        reliable: true
      });

      this.setupConnection(conn);
      return { success: true, code: this.roomCode };
    } catch (err) {
      this.updateStatus('ERROR', 'Could not connect: ' + err.message);
      return { success: false, error: err.message };
    }
  }

  startBotMatch(profile, difficulty = 'normal') {
    this.isHost = true;
    this.isBot = true;
    this.botDifficulty = difficulty;
    this.roomCode = 'BOT-TRAINER';
    this.myProfile = profile;
    this.status = 'CONNECTED';

    let botName = 'Sparring Partner (Normal)';
    let botSwords = ['sword_rusty', 'sword_flame'];
    let botBows = ['bow_short'];
    let botArmors = ['armor_leather', 'armor_plate'];
    let botAmulets = ['amulet_copper', 'amulet_swift'];
    let allSpells = ['spell_fireball', 'spell_frost_nova', 'spell_holy_mend'];

    if (difficulty === 'hard') {
      botName = 'Veteran Warrior (Hard)';
      botSwords = ['sword_thunder', 'sword_frost', 'sword_flame'];
      botBows = ['bow_venom', 'bow_triple', 'bow_storm'];
      botArmors = ['armor_plate', 'armor_shadow', 'armor_phoenix'];
      botAmulets = ['amulet_swift', 'amulet_chrono', 'amulet_blood'];
      allSpells = ['spell_lightning', 'spell_toxic_miasma', 'spell_frost_nova', 'spell_fireball', 'spell_holy_mend'];
    } else if (difficulty === 'nightmare') {
      botName = 'Grandmaster (Nightmare)';
      botSwords = ['sword_void', 'sword_celestial', 'sword_thunder'];
      botBows = ['bow_sniper', 'bow_dragon', 'bow_storm'];
      botArmors = ['armor_titan', 'armor_phoenix', 'armor_shadow'];
      botAmulets = ['amulet_berserker', 'amulet_blood', 'amulet_archmage'];
      allSpells = ['spell_meteor', 'spell_vortex', 'spell_lightning', 'spell_arcane_aegis', 'spell_fireball'];
    }

    // Pick 3 random unique spells for bot
    const shuffledSpells = [...allSpells].sort(() => 0.5 - Math.random()).slice(0, 3);

    this.opponentProfile = {
      name: botName,
      equipped: {
        sword: botSwords[Math.floor(Math.random() * botSwords.length)],
        bow: botBows[Math.floor(Math.random() * botBows.length)],
        armor: botArmors[Math.floor(Math.random() * botArmors.length)],
        amulet: botAmulets[Math.floor(Math.random() * botAmulets.length)],
        spells: shuffledSpells
      },
      ready: true
    };

    if (this.onConnected) this.onConnected(this.opponentProfile);
    if (this.onOpponentReady) this.onOpponentReady(true);
  }

  setupConnection(conn) {
    this.conn = conn;

    conn.on('open', () => {
      this.status = 'CONNECTED';
      this.updateStatus('CONNECTED', 'Challenger joined!');

      // Send Handshake with game mode
      this.send({
        type: 'HANDSHAKE',
        profile: this.myProfile,
        gameMode: this.gameMode
      });

      // Start ping loop
      this.startPingLoop();

      if (this.onConnected) {
        this.onConnected(this.opponentProfile, this.gameMode);
      }
    });

    conn.on('data', (data) => {
      this.handleIncomingData(data);
    });

    conn.on('close', () => {
      this.handleDisconnect('Challenger disconnected.');
    });

    conn.on('error', (err) => {
      console.warn('Connection error:', err);
      this.handleDisconnect('Connection error occurred.');
    });
  }

  startPingLoop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.lastPingSent = performance.now();
        this.send({ type: 'PING', time: this.lastPingSent });
      }
    }, 1500);
  }

  handleIncomingData(data) {
    if (!data || !data.type) return;

    if (data.type === 'PING') {
      this.send({ type: 'PONG', time: data.time });
      return;
    }

    if (data.type === 'PONG') {
      const now = performance.now();
      this.ping = Math.round(now - data.time);
      return;
    }

    if (data.type === 'HANDSHAKE') {
      this.opponentProfile = data.profile;
      if (data.gameMode) {
        this.gameMode = data.gameMode;
      }
      if (this.onConnected) {
        this.onConnected(this.opponentProfile, this.gameMode);
      }
      return;
    }

    if (data.type === 'READY_STATUS') {
      if (this.opponentProfile) {
        this.opponentProfile.ready = data.ready;
      }
      if (this.onOpponentReady) {
        this.onOpponentReady(data.ready);
      }
      return;
    }

    if (this.onPacket) {
      this.onPacket(data);
    }
  }

  send(packet) {
    if (this.isBot) {
      // In bot mode, we handle simulation internally in game engine
      return;
    }
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(packet);
      } catch (e) {
        console.warn('Failed to send packet', e);
      }
    }
  }

  updateStatus(status, message) {
    this.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(status, message);
    }
  }

  handleDisconnect(msg = 'Disconnected') {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.status = 'DISCONNECTED';
    this.conn = null;
    if (this.onDisconnected) {
      this.onDisconnected(msg);
    }
    this.updateStatus('DISCONNECTED', msg);
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.status = 'DISCONNECTED';
    this.isBot = false;
    this.botDifficulty = 'normal';
    this.gameMode = 'duel';
  }

  isConnected() {
    return this.isBot || (this.conn && this.conn.open);
  }
}

const network = new NetworkManager();

