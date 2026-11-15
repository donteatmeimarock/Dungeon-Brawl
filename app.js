// Dungeon Brawl - App Controller & UI State Machine

class App {
  constructor() {
    this.game = null;
    this.currentArmorySlot = 'sword';
    this.currentSpellSlotIndex = 0;
    this.qrCodeInstance = null;
    this.localReady = false;
    this.remoteReady = false;
    this.resultsCountdownInterval = null;
    this.returnToMenuOnShopClose = false;
    this.selectedBotDifficulty = 'normal';
    try {
      this.selectedBotDifficulty = localStorage.getItem('dungeon_brawl_bot_difficulty') || 'normal';
    } catch (e) {}

    this.init();
  }

  init() {
    // Initialize Game Engine
    const canvas = document.getElementById('game-canvas');
    this.game = new GameEngine(canvas);

    // Setup Game Event Callbacks
    this.game.onHUDUpdate = (hudData) => this.updateBattleHUD(hudData);
    this.game.onRoundEnd = (roundData) => this.handleRoundEnd(roundData);
    this.game.onMatchEnd = (matchData) => this.handleMatchEnd(matchData);

    // Setup Network Event Callbacks
    network.onConnected = (opponentProfile) => this.handleOpponentConnected(opponentProfile);
    network.onDisconnected = (msg) => this.handleOpponentDisconnected(msg);
    network.onOpponentReady = (ready) => this.handleOpponentReadyStatus(ready);
    network.onPacket = (packet) => this.game.handleNetworkPacket(packet);
    network.onStatusChange = (status, msg) => this.handleNetworkStatus(status, msg);

    // Bind UI DOM Events
    this.bindEvents();

    // Load initial Player Data
    this.refreshHeaderCoins();
    this.refreshDailyWinBar();
    this.refreshArmoryUI();
    this.initPlayerName();

    // Check URL parameters for direct challenge link
    this.checkUrlForChallenge();
  }

  bindEvents() {
    // Header & Sound
    document.getElementById('audio-toggle-btn').addEventListener('click', () => {
      const isMuted = soundFX.toggleMute();
      document.getElementById('audio-toggle-btn').textContent = isMuted ? '🔇' : '🔊';
    });

    const nameInput = document.getElementById('player-name-input');
    nameInput.addEventListener('change', () => {
      playerStorage.setPlayerName(nameInput.value);
      this.refreshArmoryUI();
    });

    // Menu Actions
    document.getElementById('btn-create-challenge').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.startHostChallenge();
    });

    document.getElementById('btn-join-challenge').addEventListener('click', () => {
      soundFX.playButtonClick();
      const code = document.getElementById('input-challenge-code').value.trim();
      if (!code) {
        alert('Please enter a challenge code!');
        return;
      }
      this.startJoinChallenge(code);
    });

    // Solo Training Difficulty Selector
    const updateRewardLabel = (diff) => {
      const rewardEl = document.getElementById('bot-reward-display');
      if (!rewardEl) return;
      if (diff === 'nightmare') {
        rewardEl.textContent = 'Win: 🪙 300 Coins';
      } else if (diff === 'hard') {
        rewardEl.textContent = 'Win: 🪙 200 Coins';
      } else {
        rewardEl.textContent = 'Win: 🪙 120 Coins';
      }
    };
    updateRewardLabel(this.selectedBotDifficulty);

    const diffPills = document.querySelectorAll('#bot-difficulty-selector .difficulty-pill');
    diffPills.forEach(pill => {
      if (pill.getAttribute('data-difficulty') === this.selectedBotDifficulty) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
      pill.addEventListener('click', () => {
        soundFX.playButtonClick();
        diffPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.selectedBotDifficulty = pill.getAttribute('data-difficulty');
        updateRewardLabel(this.selectedBotDifficulty);
        try {
          localStorage.setItem('dungeon_brawl_bot_difficulty', this.selectedBotDifficulty);
        } catch (e) {}
      });
    });

    document.getElementById('btn-solo-practice').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.startSoloPractice();
    });

    // Horde Survival Mode Buttons
    const btnHordeSolo = document.getElementById('btn-horde-solo');
    if (btnHordeSolo) {
      btnHordeSolo.addEventListener('click', () => {
        soundFX.playButtonClick();
        this.startSoloHorde();
      });
    }

    const btnHordeCoop = document.getElementById('btn-horde-coop');
    if (btnHordeCoop) {
      btnHordeCoop.addEventListener('click', () => {
        soundFX.playButtonClick();
        this.startHostHorde();
      });
    }

    // Armory & Shop Openers
    document.getElementById('btn-open-armory').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.openArmoryModal();
    });

    document.getElementById('btn-close-armory').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.closeArmoryModal();
    });

    document.getElementById('btn-open-shop').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.openShopModal();
    });

    document.getElementById('btn-close-shop').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.closeShopModal();
    });

    // Save Codes Modal Controls
    document.getElementById('btn-open-save-codes').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.openSaveCodeModal();
    });

    document.getElementById('btn-close-save-codes').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.closeSaveCodeModal();
    });

    document.getElementById('btn-copy-save-code').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.copySaveCode();
    });

    document.getElementById('btn-import-save-code').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.handleImportSaveCode();
    });

    document.getElementById('btn-clear-save-import').addEventListener('click', () => {
      soundFX.playButtonClick();
      document.getElementById('save-code-import-box').value = '';
      this.showSaveCodeFeedback('');
    });

    document.getElementById('save-code-export-box').addEventListener('click', (e) => {
      e.target.select();
    });

    // Close modals on overlay backdrop click
    document.getElementById('modal-shop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-shop') {
        soundFX.playButtonClick();
        this.closeShopModal();
      }
    });

    document.getElementById('modal-armory').addEventListener('click', (e) => {
      if (e.target.id === 'modal-armory') {
        soundFX.playButtonClick();
        this.closeArmoryModal();
      }
    });

    document.getElementById('modal-save-codes').addEventListener('click', (e) => {
      if (e.target.id === 'modal-save-codes') {
        soundFX.playButtonClick();
        this.closeSaveCodeModal();
      }
    });

    // Escape key closes open modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const shopModal = document.getElementById('modal-shop');
        const armoryModal = document.getElementById('modal-armory');
        const saveCodesModal = document.getElementById('modal-save-codes');
        if (shopModal && shopModal.classList.contains('active')) {
          this.closeShopModal();
        } else if (armoryModal && armoryModal.classList.contains('active')) {
          this.closeArmoryModal();
        } else if (saveCodesModal && saveCodesModal.classList.contains('active')) {
          this.closeSaveCodeModal();
        }
      }
    });

    // Lobby Actions
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      soundFX.playButtonClick();
      const code = document.getElementById('lobby-challenge-code').textContent;
      navigator.clipboard.writeText(code).then(() => {
        alert(`Challenge code ${code} copied to clipboard!`);
      });
    });

    document.getElementById('btn-copy-link').addEventListener('click', () => {
      soundFX.playButtonClick();
      const code = document.getElementById('lobby-challenge-code').textContent;
      const url = `${window.location.origin}${window.location.pathname}?duel=${code}`;
      navigator.clipboard.writeText(url).then(() => {
        alert(`Direct battle link copied! Share with your friend on any device.`);
      });
    });

    document.getElementById('btn-leave-lobby').addEventListener('click', () => {
      soundFX.playButtonClick();
      network.disconnect();
      this.showView('view-menu');
    });

    document.getElementById('btn-lobby-armory').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.openArmoryModal();
    });

    document.getElementById('btn-toggle-ready').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.toggleReadyStatus();
    });

    // Armory Slot Clicks
    document.querySelectorAll('.loadout-slot-box').forEach(slotEl => {
      slotEl.addEventListener('click', () => {
        soundFX.playButtonClick();
        const slotType = slotEl.getAttribute('data-slot');
        const spellIdx = slotEl.getAttribute('data-spell-index');
        this.selectArmorySlot(slotType, spellIdx !== null ? parseInt(spellIdx) : 0);
      });
    });

    // Shop Category Tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        soundFX.playButtonClick();
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderShopItems(tab.getAttribute('data-category'));
      });
    });

    // Match Results Actions
    document.getElementById('btn-results-rematch').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.clearResultsCountdown();
      document.getElementById('modal-results').classList.remove('active');
      if (this.game && this.game.gameMode === 'horde') {
        if (this.game.isCoop) {
          this.startCoopHordeMatch();
        } else {
          this.startSoloHorde();
        }
      } else {
        if (network.isBot) {
          network.startBotMatch(this.getProfile(), this.selectedBotDifficulty);
        }
        this.startBestOf5Match();
      }
    });

    document.getElementById('btn-results-shop').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.clearResultsCountdown();
      document.getElementById('modal-results').classList.remove('active');
      this.returnToMenuOnShopClose = true;
      this.openShopModal();
    });

    document.getElementById('btn-results-menu').addEventListener('click', () => {
      soundFX.playButtonClick();
      this.clearResultsCountdown();
      document.getElementById('modal-results').classList.remove('active');
      network.disconnect();
      this.game.stop();
      this.showView('view-menu');
    });

    // Mobile Virtual Touch Joystick & Buttons
    this.setupTouchControls();
  }

  showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
    if (viewId === 'view-battle') {
      document.body.classList.add('battle-active');
    } else {
      document.body.classList.remove('battle-active');
    }
    if (viewId === 'view-menu') {
      this.refreshDailyWinBar();
    }
  }

  initPlayerName() {
    const input = document.getElementById('player-name-input');
    if (input && playerStorage.data.playerName) {
      input.value = playerStorage.data.playerName;
    }
  }

  refreshHeaderCoins() {
    const coins = playerStorage.getCoins();
    document.getElementById('header-coin-count').textContent = coins;
    document.getElementById('shop-coin-count').textContent = coins;
  }

  refreshDailyWinBar() {
    const status = playerStorage.getDailyWinStatus();
    this.renderDailyWinCard('menu-daily-win-bar', status, false);
    this.renderDailyWinCard('results-daily-win-bar', status, true);
  }

  renderDailyWinCard(elemId, status, compact = false) {
    const container = document.getElementById(elemId);
    if (!container) return;

    const cappedWins = Math.min(status.wins, status.target);
    const pct = Math.round((cappedWins / status.target) * 100);
    const isClaimed = status.claimed;

    container.className = `daily-win-card${compact ? ' compact' : ''}${isClaimed ? ' claimed' : ''}`;
    container.innerHTML = `
      <div class="daily-win-header">
        <div class="daily-win-title">
          <span>${isClaimed ? '🎉' : '🏆'}</span>
          <span>DAILY WIN BAR</span>
          <span class="daily-win-count">${cappedWins} / ${status.target} Wins Today</span>
        </div>
        <div class="daily-win-reward ${isClaimed ? 'claimed' : ''}">
          ${isClaimed ? `✅ +${status.reward} Coins Claimed` : `🪙 +${status.reward} Coins`}
        </div>
      </div>
      <div class="daily-win-track" role="progressbar" aria-valuenow="${cappedWins}" aria-valuemin="0" aria-valuemax="${status.target}">
        <div class="daily-win-fill" style="width: ${pct}%;"></div>
        <div class="daily-win-divider" style="left: 33.333%;"></div>
        <div class="daily-win-divider" style="left: 66.666%;"></div>
      </div>
    `;
  }

  checkUrlForChallenge() {
    const urlParams = new URLSearchParams(window.location.search);
    const duelCode = urlParams.get('duel') || urlParams.get('code');
    if (duelCode) {
      document.getElementById('input-challenge-code').value = duelCode.toUpperCase();
      // Optional: prompt to connect
      setTimeout(() => {
        if (confirm(`Challenge code "${duelCode.toUpperCase()}" detected. Join duel now?`)) {
          this.startJoinChallenge(duelCode.toUpperCase());
        }
      }, 500);
    }
  }

  // ================= MULTIPLAYER FLOWS =================
  async startHostChallenge() {
    const profile = this.getProfile();
    const result = await network.hostChallenge(null, profile);
    if (result.success) {
      this.setupLobbyView(result.code);
    } else {
      alert('Could not create room: ' + result.error);
    }
  }

  async startJoinChallenge(code) {
    const profile = this.getProfile();
    const result = await network.joinChallenge(code, profile);
    if (result.success) {
      this.setupLobbyView(result.code);
    } else {
      alert('Could not connect to room: ' + result.error);
    }
  }

  startSoloPractice() {
    const profile = this.getProfile();
    network.startBotMatch(profile, this.selectedBotDifficulty);
    this.setupLobbyView('BOT-DUEL');
  }

  startSoloHorde() {
    const validation = playerStorage.validateLoadout();
    if (!validation.valid) {
      alert(`Cannot battle yet!\n\n${validation.errors.join('\n')}\n\nPlease open your Armory and equip all required gear.`);
      this.openArmoryModal();
      return;
    }

    network.disconnect();
    network.gameMode = 'horde';
    this.showView('view-battle');

    const localProfile = this.getProfile();
    const equipped = localProfile.equipped;
    const sword = getItem(equipped.sword);
    const bow = getItem(equipped.bow);
    const spells = (equipped.spells || []).map(id => getItem(id));

    if (sword) document.getElementById('hud-icon-sword').textContent = sword.icon;
    if (bow) document.getElementById('hud-icon-bow').textContent = bow.icon;
    if (spells[0]) document.getElementById('hud-icon-spell-0').textContent = spells[0].icon;
    if (spells[1]) document.getElementById('hud-icon-spell-1').textContent = spells[1].icon;
    if (spells[2]) document.getElementById('hud-icon-spell-2').textContent = spells[2].icon;

    this.game.startHordeMatch(localProfile, null);
  }

  async startHostHorde() {
    const validation = playerStorage.validateLoadout();
    if (!validation.valid) {
      alert(`Cannot battle yet!\n\n${validation.errors.join('\n')}\n\nPlease open your Armory and equip all required gear.`);
      this.openArmoryModal();
      return;
    }

    const profile = this.getProfile();
    const result = await network.hostChallenge(null, profile, 'horde');
    if (result.success) {
      this.setupLobbyView(result.code);
    } else {
      alert('Could not create Horde room: ' + result.error);
    }
  }

  startCoopHordeMatch() {
    this.showView('view-battle');
    const localProfile = this.getProfile();
    const remoteProfile = network.opponentProfile || {
      name: 'Ally',
      equipped: playerStorage.getEquipped()
    };

    const equipped = localProfile.equipped;
    const sword = getItem(equipped.sword);
    const bow = getItem(equipped.bow);
    const spells = (equipped.spells || []).map(id => getItem(id));

    if (sword) document.getElementById('hud-icon-sword').textContent = sword.icon;
    if (bow) document.getElementById('hud-icon-bow').textContent = bow.icon;
    if (spells[0]) document.getElementById('hud-icon-spell-0').textContent = spells[0].icon;
    if (spells[1]) document.getElementById('hud-icon-spell-1').textContent = spells[1].icon;
    if (spells[2]) document.getElementById('hud-icon-spell-2').textContent = spells[2].icon;

    this.game.startHordeMatch(localProfile, remoteProfile);
  }

  setupLobbyView(roomCode) {
    this.showView('view-lobby');
    document.getElementById('lobby-challenge-code').textContent = roomCode;

    // Adapt lobby header & badges for Horde Co-op vs Duel
    const isHorde = network.gameMode === 'horde';
    const badge = document.getElementById('lobby-match-type-badge');
    const badgeTitle = document.getElementById('lobby-match-type-title');
    const badgeSubtitle = document.getElementById('lobby-match-type-subtitle');
    const remoteCard = document.querySelector('.player-card.remote');

    if (isHorde) {
      if (badge) badge.classList.add('coop');
      if (badgeTitle) badgeTitle.textContent = 'CO-OP';
      if (badgeSubtitle) badgeSubtitle.textContent = 'HORDE SURVIVAL';
      if (remoteCard) remoteCard.classList.add('coop');
      document.getElementById('lobby-remote-name').textContent = 'Ally (Player 2)';
      document.getElementById('lobby-status-msg').textContent = 'Waiting for ally to connect...';
    } else {
      if (badge) badge.classList.remove('coop');
      if (badgeTitle) badgeTitle.textContent = 'VS';
      if (badgeSubtitle) badgeSubtitle.textContent = 'BEST OF 5';
      if (remoteCard) remoteCard.classList.remove('coop');
      document.getElementById('lobby-remote-name').textContent = 'Challenger';
      document.getElementById('lobby-status-msg').textContent = 'Waiting for opponent to connect...';
    }

    // Generate QR Code for mobile instant scanning
    const qrContainer = document.getElementById('qrcode-container');
    qrContainer.innerHTML = '';
    const shareUrl = `${window.location.origin}${window.location.pathname}?duel=${roomCode}`;
    try {
      this.qrCodeInstance = new QRCode(qrContainer, {
        text: shareUrl,
        width: 120,
        height: 120,
        colorDark: '#000000',
        colorLight: '#ffffff'
      });
    } catch (e) {
      console.warn('QR code generation notice', e);
    }

    this.localReady = false;
    this.remoteReady = false;
    this.updateReadyUI();
    this.renderLobbyProfiles();
  }

  getProfile() {
    return {
      name: playerStorage.data.playerName || 'Gladiator',
      equipped: playerStorage.getEquipped()
    };
  }

  renderLobbyProfiles() {
    // Local player card
    document.getElementById('lobby-local-name').textContent = playerStorage.data.playerName || 'You';
    const localEquipped = playerStorage.getEquipped();
    document.getElementById('lobby-local-loadout').innerHTML = this.formatLoadoutSummary(localEquipped);

    // Remote player card
    const remote = network.opponentProfile;
    if (remote) {
      document.getElementById('lobby-remote-name').textContent = remote.name || 'Challenger';
      document.getElementById('lobby-remote-loadout').innerHTML = this.formatLoadoutSummary(remote.equipped);
    } else {
      document.getElementById('lobby-remote-name').textContent = 'Challenger';
      document.getElementById('lobby-remote-loadout').innerHTML = `
        <div class="gear-summary-item">Waiting for opponent to connect...</div>
      `;
    }
  }

  formatLoadoutSummary(equipped) {
    if (!equipped) return '';
    const s = getItem(equipped.sword) || {};
    const b = getItem(equipped.bow) || {};
    const a = getItem(equipped.armor) || {};
    const am = getItem(equipped.amulet) || {};
    const sp = (equipped.spells || []).map(id => getItem(id)).filter(Boolean);

    return `
      <div class="gear-summary-item"><span>⚔️</span> <strong>Sword:</strong> ${s.name || 'None'}</div>
      <div class="gear-summary-item"><span>🏹</span> <strong>Bow:</strong> ${b.name || 'None'}</div>
      <div class="gear-summary-item"><span>🛡️</span> <strong>Armor:</strong> ${a.name || 'None'}</div>
      <div class="gear-summary-item"><span>📿</span> <strong>Amulet:</strong> ${am.name || 'None'}</div>
      <div class="gear-summary-item"><span>✨</span> <strong>Spells:</strong> ${sp.map(spell => spell.name).join(', ')}</div>
    `;
  }

  handleOpponentConnected(opponentProfile) {
    document.getElementById('lobby-status-msg').textContent = 'Opponent connected! Prepare for battle.';
    document.getElementById('lobby-status-msg').style.color = 'var(--accent-green)';
    this.renderLobbyProfiles();
  }

  handleOpponentDisconnected(msg) {
    document.getElementById('lobby-status-msg').textContent = 'Opponent disconnected.';
    document.getElementById('lobby-status-msg').style.color = 'var(--accent-red)';
    this.remoteReady = false;
    this.updateReadyUI();
  }

  handleOpponentReadyStatus(isReady) {
    this.remoteReady = isReady;
    this.updateReadyUI();
    this.checkBothReady();
  }

  handleNetworkStatus(status, msg) {
    const el = document.getElementById('lobby-status-msg');
    if (el) el.textContent = msg;
  }

  toggleReadyStatus() {
    // Validate mandatory loadout requirement
    const validation = playerStorage.validateLoadout();
    if (!validation.valid) {
      alert(`Cannot battle yet!\n\n${validation.errors.join('\n')}\n\nPlease open your Armory and equip all required gear.`);
      this.openArmoryModal();
      return;
    }

    this.localReady = !this.localReady;
    this.updateReadyUI();

    if (network.isConnected() && !network.isBot) {
      network.send({
        type: 'READY_STATUS',
        ready: this.localReady
      });
    }

    this.checkBothReady();
  }

  updateReadyUI() {
    const localPill = document.getElementById('lobby-local-ready');
    localPill.textContent = this.localReady ? 'READY' : 'NOT READY';
    localPill.className = `ready-pill ${this.localReady ? 'ready' : ''}`;

    const remotePill = document.getElementById('lobby-remote-ready');
    if (network.opponentProfile) {
      remotePill.textContent = this.remoteReady ? 'READY' : 'NOT READY';
      remotePill.className = `ready-pill ${this.remoteReady ? 'ready' : ''}`;
    } else {
      remotePill.textContent = 'CONNECTING...';
      remotePill.className = 'ready-pill';
    }

    const btn = document.getElementById('btn-toggle-ready');
    btn.textContent = this.localReady ? 'CANCEL READY' : 'READY FOR BATTLE';
  }

  checkBothReady() {
    if (this.localReady && (this.remoteReady || network.isBot)) {
      const isHorde = network.gameMode === 'horde';
      document.getElementById('lobby-status-msg').textContent = isHorde
        ? 'Both warriors ready! Surviving the Horde in 3...'
        : 'Both warriors ready! Entering Arena in 3...';
      setTimeout(() => {
        if (isHorde) {
          this.startCoopHordeMatch();
        } else {
          this.startBestOf5Match();
        }
      }, 1000);
    }
  }

  startBestOf5Match() {
    this.showView('view-battle');
    const localProfile = this.getProfile();
    const remoteProfile = network.opponentProfile || {
      name: 'Challenger',
      equipped: playerStorage.getEquipped()
    };

    // Update Bottom Action HUD Icons
    const equipped = localProfile.equipped;
    const sword = getItem(equipped.sword);
    const bow = getItem(equipped.bow);
    const spells = (equipped.spells || []).map(id => getItem(id));

    if (sword) document.getElementById('hud-icon-sword').textContent = sword.icon;
    if (bow) document.getElementById('hud-icon-bow').textContent = bow.icon;
    if (spells[0]) document.getElementById('hud-icon-spell-0').textContent = spells[0].icon;
    if (spells[1]) document.getElementById('hud-icon-spell-1').textContent = spells[1].icon;
    if (spells[2]) document.getElementById('hud-icon-spell-2').textContent = spells[2].icon;

    this.game.startMatch(localProfile, remoteProfile);
  }

  // ================= BATTLE HUD =================
  updateBattleHUD(hudData) {
    if (!hudData) return;

    if (hudData.gameMode === 'horde') {
      const dropStr = hudData.drop ? ` · DROP ${hudData.drop}/3` : '';
      document.getElementById('hud-round-label').textContent = `🧟 WAVE ${hudData.wave}${dropStr}`;
      const scoreGemsRow = document.querySelector('.score-gems-row');
      if (scoreGemsRow) {
        scoreGemsRow.innerHTML = `<span style="font-size: 13px; font-weight: 800; color: #66bb6a; letter-spacing: 0.5px;">${hudData.zombiesRemaining} ZOMBIES REMAINING</span>`;
      }

      const remoteBox = document.querySelectorAll('.hud-player-box')[1];
      if (remoteBox) {
        if (!hudData.isCoop) {
          remoteBox.style.visibility = 'hidden';
        } else {
          remoteBox.style.visibility = 'visible';
          const rName = document.getElementById('hud-remote-name');
          if (rName) rName.style.color = '#69f0ae'; // Ally green
        }
      }
    } else {
      document.getElementById('hud-round-label').textContent = `ROUND ${hudData.round} OF ${hudData.maxRounds}`;
      const scoreGemsRow = document.querySelector('.score-gems-row');
      if (scoreGemsRow && !scoreGemsRow.querySelector('.score-gem')) {
        scoreGemsRow.innerHTML = `
          <div id="hud-score-local" style="display: flex; gap: 4px;">
            <span class="score-gem" id="lgem-1">💎</span>
            <span class="score-gem" id="lgem-2">💎</span>
            <span class="score-gem" id="lgem-3">💎</span>
          </div>
          <span style="font-weight: 900; color: #fff; font-size: 16px;">:</span>
          <div id="hud-score-remote" style="display: flex; gap: 4px;">
            <span class="score-gem" id="rgem-1">💎</span>
            <span class="score-gem" id="rgem-2">💎</span>
            <span class="score-gem" id="rgem-3">💎</span>
          </div>
        `;
      }

      // Score gems
      for (let i = 1; i <= 3; i++) {
        const lGem = document.getElementById(`lgem-${i}`);
        const rGem = document.getElementById(`rgem-${i}`);
        if (lGem) lGem.className = `score-gem ${i <= (hudData.score ? hudData.score.local : 0) ? 'won' : ''}`;
        if (rGem) rGem.className = `score-gem ${i <= (hudData.score ? hudData.score.remote : 0) ? 'won' : ''}`;
      }

      const remoteBox = document.querySelectorAll('.hud-player-box')[1];
      if (remoteBox) {
        remoteBox.style.visibility = 'visible';
        const rName = document.getElementById('hud-remote-name');
        if (rName) rName.style.color = '#ff5252';
      }
    }

    // Health bars
    if (hudData.local) {
      document.getElementById('hud-local-name').textContent = hudData.local.name;
      document.getElementById('hud-local-hp-num').textContent = `${hudData.local.hp}/${hudData.local.maxHp}`;
      const hpPct = Math.max(0, (hudData.local.hp / hudData.local.maxHp) * 100);
      document.getElementById('hud-local-hp-bar').style.width = `${hpPct}%`;

      const shieldPct = Math.min(100, (hudData.local.shield / 50) * 100);
      document.getElementById('hud-local-shield-bar').style.width = `${shieldPct}%`;

      // Cooldown overlays
      this.updateCooldownOverlay('hud-cd-sword', hudData.local.swordCooldown);
      this.updateCooldownOverlay('hud-cd-bow', hudData.local.bowCooldown);
      this.updateCooldownOverlay('hud-cd-dash', hudData.local.dashCooldown);
      this.updateCooldownOverlay('hud-cd-spell-0', hudData.local.spellCooldowns[0]);
      this.updateCooldownOverlay('hud-cd-spell-1', hudData.local.spellCooldowns[1]);
      this.updateCooldownOverlay('hud-cd-spell-2', hudData.local.spellCooldowns[2]);

      // Active Weapon hot bar indicator
      const activeWp = hudData.local.activeWeapon || 'melee';
      const slot1 = document.getElementById('hotbar-slot-1');
      const slot2 = document.getElementById('hotbar-slot-2');
      if (slot1 && slot2) {
        if (activeWp === 'ranged') {
          slot1.classList.remove('active');
          slot2.classList.add('active');
        } else {
          slot1.classList.add('active');
          slot2.classList.remove('active');
        }
      }
    }

    if (hudData.remote) {
      document.getElementById('hud-remote-name').textContent = hudData.remote.name;
      document.getElementById('hud-remote-hp-num').textContent = `${hudData.remote.hp}/${hudData.remote.maxHp}`;
      const hpPct = Math.max(0, (hudData.remote.hp / hudData.remote.maxHp) * 100);
      document.getElementById('hud-remote-hp-bar').style.width = `${hpPct}%`;

      const shieldPct = Math.min(100, (hudData.remote.shield / 50) * 100);
      document.getElementById('hud-remote-shield-bar').style.width = `${shieldPct}%`;
    }
  }

  updateCooldownOverlay(elemId, cd) {
    const el = document.getElementById(elemId);
    if (!el) return;
    if (cd > 0.05) {
      el.style.display = 'flex';
      el.textContent = cd.toFixed(1) + 's';
    } else {
      el.style.display = 'none';
    }
  }

  handleRoundEnd(roundData) {
    // Round end banner is drawn in canvas
  }

  handleMatchEnd(matchData) {
    const isHorde = matchData.gameMode === 'horde';
    const isWin = matchData.isLocalWin;
    const titleEl = document.getElementById('results-title');

    if (isHorde) {
      titleEl.textContent = matchData.wavesSurvived >= 3 ? '🧟 HORDE SURVIVED!' : '💀 HORDE OVER';
      titleEl.className = `results-title ${matchData.wavesSurvived >= 3 ? 'victory' : 'defeat'}`;

      document.getElementById('results-subtext').textContent =
        `You survived ${matchData.wavesSurvived} waves and defeated ${matchData.zombiesKilled} zombies!`;

      document.getElementById('results-score').textContent =
        `Waves Cleared: ${matchData.wavesSurvived} | Slain: ${matchData.zombiesKilled}`;

      const rematchBtn = document.getElementById('btn-results-rematch');
      if (rematchBtn) rematchBtn.textContent = '🧟 Play Again';
    } else {
      titleEl.textContent = isWin ? '🏆 MATCH VICTORY! 🏆' : '💀 DEFEAT';
      titleEl.className = `results-title ${isWin ? 'victory' : 'defeat'}`;

      document.getElementById('results-subtext').textContent = isWin
        ? 'You won the Best of 5 duel! You earned Gold Coins.'
        : 'You fell in battle! Consolation coins awarded.';

      document.getElementById('results-score').textContent = `Final Score: ${matchData.score.local} - ${matchData.score.remote}`;

      const rematchBtn = document.getElementById('btn-results-rematch');
      if (rematchBtn) rematchBtn.textContent = '⚔️ Rematch';
    }

    const dailyBonus = matchData.dailyBonusEarned || 0;
    document.getElementById('results-coins-won').textContent = dailyBonus > 0
      ? `+${matchData.coinsEarned} Gold Coins! (+${dailyBonus} Daily Win Bonus!)`
      : `+${matchData.coinsEarned} Gold Coins!`;

    if (dailyBonus > 0) {
      soundFX.playCoinPickup();
    }

    this.refreshHeaderCoins();
    this.refreshDailyWinBar();

    // Auto-teleport to menu after 10 seconds if won
    this.clearResultsCountdown();

    const teleportBox = document.getElementById('results-auto-teleport');
    const countdownNum = document.getElementById('teleport-countdown-num');

    if (isWin) {
      if (teleportBox) teleportBox.style.display = 'inline-flex';
      let remainingSec = 10;
      if (countdownNum) countdownNum.textContent = remainingSec;

      this.resultsCountdownInterval = setInterval(() => {
        remainingSec -= 1;
        if (countdownNum) countdownNum.textContent = Math.max(0, remainingSec);

        if (remainingSec <= 0) {
          this.clearResultsCountdown();
          document.getElementById('modal-results').classList.remove('active');
          network.disconnect();
          this.game.stop();
          this.showView('view-menu');
        }
      }, 1000);
    } else {
      if (teleportBox) teleportBox.style.display = 'none';
    }

    document.getElementById('modal-results').classList.add('active');
  }

  clearResultsCountdown() {
    if (this.resultsCountdownInterval) {
      clearInterval(this.resultsCountdownInterval);
      this.resultsCountdownInterval = null;
    }
    const teleportBox = document.getElementById('results-auto-teleport');
    if (teleportBox) teleportBox.style.display = 'none';
  }

  // ================= ARMORY & LOADOUT SYSTEM =================
  openArmoryModal() {
    this.refreshArmoryUI();
    document.getElementById('modal-armory').classList.add('active');
  }

  closeArmoryModal() {
    document.getElementById('modal-armory').classList.remove('active');
    this.renderLobbyProfiles();
  }

  refreshArmoryUI() {
    const equipped = playerStorage.getEquipped();
    const validation = playerStorage.validateLoadout();

    const alertEl = document.getElementById('armory-status-alert');
    const alertText = document.getElementById('armory-status-text');

    if (validation.valid) {
      alertEl.className = 'loadout-status-alert valid';
      alertText.textContent = '✅ Loadout complete! All 5 battle categories equipped. Ready for battle.';
    } else {
      alertEl.className = 'loadout-status-alert invalid';
      alertText.textContent = `⚠️ Incomplete Loadout: ${validation.errors[0]}`;
    }

    // Populate the 5 slot boxes
    const sword = getItem(equipped.sword);
    const bow = getItem(equipped.bow);
    const armor = getItem(equipped.armor);
    const amulet = getItem(equipped.amulet);
    const spells = (equipped.spells || []).map(id => getItem(id));

    if (sword) {
      document.getElementById('loadout-icon-sword').textContent = sword.icon;
      document.getElementById('loadout-name-sword').textContent = sword.name;
    }
    if (bow) {
      document.getElementById('loadout-icon-bow').textContent = bow.icon;
      document.getElementById('loadout-name-bow').textContent = bow.name;
    }
    if (armor) {
      document.getElementById('loadout-icon-armor').textContent = armor.icon;
      document.getElementById('loadout-name-armor').textContent = armor.name;
    }
    if (amulet) {
      document.getElementById('loadout-icon-amulet').textContent = amulet.icon;
      document.getElementById('loadout-name-amulet').textContent = amulet.name;
    }

    spells.forEach((sp, idx) => {
      if (sp) {
        document.getElementById(`loadout-icon-spell-${idx}`).textContent = sp.icon;
        document.getElementById(`loadout-name-spell-${idx}`).textContent = sp.name;
      }
    });

    // Populate drawer of available items
    this.selectArmorySlot(this.currentArmorySlot, this.currentSpellSlotIndex);
  }

  selectArmorySlot(slotType, spellIndex = 0) {
    this.currentArmorySlot = slotType;
    this.currentSpellSlotIndex = spellIndex;

    const categoryMap = {
      sword: 'swords',
      bow: 'bows',
      armor: 'armors',
      amulet: 'amulets',
      spell: 'spells'
    };
    const categoryKey = categoryMap[slotType] || 'swords';

    const titleEl = document.getElementById('armory-drawer-title');
    titleEl.textContent = `Available ${categoryKey.toUpperCase()} (Click to Equip)`;

    const catalogGrid = document.getElementById('armory-catalog-grid');
    catalogGrid.innerHTML = '';

    const allCategoryItems = ITEMS[categoryKey] || [];
    const equipped = playerStorage.getEquipped();

    allCategoryItems.forEach(item => {
      const isUnlocked = playerStorage.isUnlocked(item.id);
      let isEquipped = false;

      if (slotType === 'spell') {
        isEquipped = equipped.spells[spellIndex] === item.id;
      } else {
        isEquipped = equipped[slotType] === item.id;
      }

      const card = document.createElement('div');
      card.className = `item-card ${item.rarity || 'common'}`;

      card.innerHTML = `
        <div class="item-card-header">
          <div class="item-card-icon">${item.icon}</div>
          <div>
            <div class="item-card-title">${item.name}</div>
            <div class="item-rarity-pill">${item.rarity}</div>
          </div>
        </div>
        <div class="item-desc">${item.desc}</div>
        <div class="item-action-bar">
          <span style="font-size: 11px; color: ${isUnlocked ? 'var(--accent-green)' : 'var(--text-dim)'}">
            ${isUnlocked ? 'UNLOCKED' : `LOCKED (🪙 ${item.cost})`}
          </span>
          ${
            !isUnlocked
              ? `<button class="item-btn buy" data-buy="${item.id}">Buy in Shop</button>`
              : isEquipped
              ? `<button class="item-btn equipped" disabled>EQUIPPED</button>`
              : `<button class="item-btn equip" data-equip="${item.id}">EQUIP</button>`
          }
        </div>
      `;

      // Equip button listener
      const equipBtn = card.querySelector('[data-equip]');
      if (equipBtn) {
        equipBtn.addEventListener('click', () => {
          soundFX.playButtonClick();
          playerStorage.equipItem(slotType, item.id, spellIndex);
          this.refreshArmoryUI();
        });
      }

      // Buy button redirect
      const buyBtn = card.querySelector('[data-buy]');
      if (buyBtn) {
        buyBtn.addEventListener('click', () => {
          this.closeArmoryModal();
          this.openShopModal();
        });
      }

      catalogGrid.appendChild(card);
    });
  }

  // ================= SHOP SYSTEM =================
  openShopModal() {
    this.refreshHeaderCoins();
    this.renderShopItems('all');
    document.getElementById('modal-shop').classList.add('active');
  }

  closeShopModal() {
    document.getElementById('modal-shop').classList.remove('active');
    this.refreshArmoryUI();

    // If shop was opened after a round/duel ends (or from battle view), send back to homescreen
    const isBattleViewActive = document.getElementById('view-battle') && document.getElementById('view-battle').classList.contains('active');
    if (this.returnToMenuOnShopClose || isBattleViewActive) {
      this.returnToMenuOnShopClose = false;
      this.clearResultsCountdown();
      const resultsModal = document.getElementById('modal-results');
      if (resultsModal) resultsModal.classList.remove('active');
      network.disconnect();
      this.game.stop();
      this.showView('view-menu');
      this.refreshHeaderCoins();
    }
  }

  renderShopItems(categoryFilter = 'all') {
    const grid = document.getElementById('shop-items-grid');
    grid.innerHTML = '';

    let itemsToRender = [];
    if (categoryFilter === 'all') {
      itemsToRender = [
        ...ITEMS.swords,
        ...ITEMS.bows,
        ...ITEMS.armors,
        ...ITEMS.amulets,
        ...ITEMS.spells
      ];
    } else {
      itemsToRender = ITEMS[categoryFilter] || [];
    }

    const equipped = playerStorage.getEquipped();

    itemsToRender.forEach(item => {
      const isUnlocked = playerStorage.isUnlocked(item.id);
      let isEquipped = false;

      if (item.category === 'spell') {
        isEquipped = (equipped.spells || []).includes(item.id);
      } else {
        isEquipped = equipped[item.category] === item.id;
      }

      const card = document.createElement('div');
      card.className = `item-card ${item.rarity || 'common'}`;

      card.innerHTML = `
        <div class="item-card-header">
          <div class="item-card-icon">${item.icon}</div>
          <div>
            <div class="item-card-title">${item.name}</div>
            <div class="item-rarity-pill">${item.category.toUpperCase()} • ${item.rarity}</div>
          </div>
        </div>
        <div class="item-desc">${item.desc}</div>
        <div class="item-action-bar">
          <span class="item-price">${isUnlocked ? 'OWNED' : `🪙 ${item.cost}`}</span>
          ${
            !isUnlocked
              ? `<button class="item-btn buy" data-buy-item="${item.id}">UNLOCK (🪙 ${item.cost})</button>`
              : isEquipped
              ? `<button class="item-btn equipped" disabled>EQUIPPED</button>`
              : `<button class="item-btn equip" data-shop-equip="${item.id}">EQUIP</button>`
          }
        </div>
      `;

      // Buy button
      const buyBtn = card.querySelector('[data-buy-item]');
      if (buyBtn) {
        buyBtn.addEventListener('click', () => {
          const res = playerStorage.buyItem(item.id);
          if (res.success) {
            soundFX.playCoinPickup();
            this.refreshHeaderCoins();
            // Automatically prompt to equip
            if (confirm(`Unlocked ${item.name}! Would you like to equip it now?`)) {
              if (item.category === 'spell') {
                playerStorage.equipItem('spell', item.id, 0);
              } else {
                playerStorage.equipItem(item.category, item.id);
              }
            }
            this.renderShopItems(categoryFilter);
          } else {
            alert(res.message);
          }
        });
      }

      // Equip button
      const equipBtn = card.querySelector('[data-shop-equip]');
      if (equipBtn) {
        equipBtn.addEventListener('click', () => {
          soundFX.playButtonClick();
          if (item.category === 'spell') {
            playerStorage.equipItem('spell', item.id, 0);
          } else {
            playerStorage.equipItem(item.category, item.id);
          }
          this.renderShopItems(categoryFilter);
        });
      }

      grid.appendChild(card);
    });
  }

  // ================= SAVE CODES SYSTEM =================
  openSaveCodeModal() {
    this.refreshSaveCodeExport();
    this.showSaveCodeFeedback('');
    document.getElementById('modal-save-codes').classList.add('active');
  }

  closeSaveCodeModal() {
    document.getElementById('modal-save-codes').classList.remove('active');
  }

  refreshSaveCodeExport() {
    const exportBox = document.getElementById('save-code-export-box');
    if (exportBox) {
      exportBox.value = playerStorage.exportSaveCode();
    }
  }

  showSaveCodeFeedback(message, type = 'success') {
    const el = document.getElementById('save-code-feedback');
    if (!el) return;
    if (!message) {
      el.style.display = 'none';
      el.textContent = '';
      el.className = 'save-code-feedback';
      return;
    }
    el.textContent = message;
    el.className = `save-code-feedback ${type}`;
    el.style.display = 'block';
  }

  copySaveCode() {
    const exportBox = document.getElementById('save-code-export-box');
    if (!exportBox) return;
    const code = exportBox.value;
    exportBox.focus();
    exportBox.select();

    const tryLegacyCopy = () => {
      const copied = document.execCommand && document.execCommand('copy');
      this.showSaveCodeFeedback(
        copied ? '✅ Save code copied to clipboard!' : 'Select and copy the code above manually.',
        copied ? 'success' : 'error'
      );
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(
        () => this.showSaveCodeFeedback('✅ Save code copied to clipboard!', 'success'),
        tryLegacyCopy
      );
    } else {
      tryLegacyCopy();
    }
  }

  handleImportSaveCode() {
    const importBox = document.getElementById('save-code-import-box');
    if (!importBox) return;

    const result = playerStorage.importSaveCode(importBox.value);
    if (!result.success) {
      this.showSaveCodeFeedback(`❌ ${result.message}`, 'error');
      return;
    }

    soundFX.playCoinPickup();
    this.initPlayerName();
    this.refreshHeaderCoins();
    this.refreshDailyWinBar();
    this.refreshArmoryUI();
    this.renderLobbyProfiles();
    this.refreshSaveCodeExport();
    importBox.value = '';
    this.showSaveCodeFeedback(`✅ ${result.message}`, 'success');
  }

  // ================= MOBILE TOUCH CONTROLS =================
  setupTouchControls() {
    const joystick = document.getElementById('touch-joystick');
    if (!joystick) return;

    let touchStartX = 0;
    let touchStartY = 0;

    joystick.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const rect = joystick.getBoundingClientRect();
      touchStartX = rect.left + rect.width / 2;
      touchStartY = rect.top + rect.height / 2;
      this.game.touchMove.active = true;
    }, { passive: true });

    joystick.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const dist = Math.hypot(dx, dy);
      const maxR = 50;

      if (dist > 0) {
        this.game.touchMove.x = dx / Math.max(dist, maxR);
        this.game.touchMove.y = dy / Math.max(dist, maxR);
      }
    }, { passive: true });

    joystick.addEventListener('touchend', () => {
      this.game.touchMove.active = false;
      this.game.touchMove.x = 0;
      this.game.touchMove.y = 0;
    }, { passive: true });

    // Touch Action Buttons
    const btnSword = document.getElementById('touch-sword');
    if (btnSword) {
      btnSword.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.game.localPlayer) {
          this.game.localPlayer.setWeapon('melee');
          this.game.localPlayer.attackSword();
        }
      });
    }

    const btnBow = document.getElementById('touch-bow');
    if (btnBow) {
      btnBow.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.game.localPlayer) {
          this.game.localPlayer.setWeapon('ranged');
          this.game.localPlayer.attackBow();
        }
      });
    }

    const btnDash = document.getElementById('touch-dash');
    if (btnDash) {
      btnDash.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.game.localPlayer) this.game.localPlayer.dash();
      });
    }

    const btnSpell = document.getElementById('touch-spell');
    if (btnSpell) {
      btnSpell.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.game.localPlayer) {
          // Cast available spell
          const availableIdx = this.game.localPlayer.spellCooldowns.findIndex(cd => cd <= 0);
          if (availableIdx !== -1) {
            this.game.localPlayer.castSpell(availableIdx);
          }
        }
      });
    }

    // Hot Bar Interactive Click & Tap Handlers (Slots 1-5 + Dash)
    const bindHotbar = (id, action) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          if (this.game && this.game.localPlayer) {
            action();
          }
        });
      }
    };

    // Slot 1: Equips close range melee weapon
    bindHotbar('hotbar-slot-1', () => this.game.localPlayer.setWeapon('melee'));
    bindHotbar('hud-slot-sword', () => this.game.localPlayer.setWeapon('melee'));

    // Slot 2: Equips ranged bow weapon
    bindHotbar('hotbar-slot-2', () => this.game.localPlayer.setWeapon('ranged'));
    bindHotbar('hud-slot-bow', () => this.game.localPlayer.setWeapon('ranged'));

    bindHotbar('hud-slot-spell-0', () => this.game.localPlayer.castSpell(0));
    bindHotbar('hud-slot-spell-1', () => this.game.localPlayer.castSpell(1));
    bindHotbar('hud-slot-spell-2', () => this.game.localPlayer.castSpell(2));
    bindHotbar('hud-slot-dash', () => this.game.localPlayer.dash());
  }
}

// Start application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});

