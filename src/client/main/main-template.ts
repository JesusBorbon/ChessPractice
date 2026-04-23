import type { BotDifficultyPreset, TimeControlPreset } from "./main-types";

type BuildMainAppMarkupParams = {
  botButtonLabel: string;
  botDifficultyOptions: Pick<BotDifficultyPreset, "level" | "label">[];
  timeControlOptions: Pick<TimeControlPreset, "id" | "label">[];
};

export function buildMainAppMarkup(params: BuildMainAppMarkupParams): string {
  const botDifficultyOptionsHtml = params.botDifficultyOptions
    .map((preset) => `<option value="${preset.level}">${preset.label}</option>`)
    .join("");

  const timeControlOptionsHtml = params.timeControlOptions
    .map((preset) => `<option value="${preset.id}">${preset.label}</option>`)
    .join("");

  return `
  <div class="app-shell">
    <section class="top-utility">
      <p class="muted quick-identity" id="quickIdentity">Guest</p>
      <div class="top-utility-actions">
        <div class="notifications-shell" id="notificationsShell">
          <button class="chip notifications-button" id="notificationsButton" type="button" aria-haspopup="dialog" aria-expanded="false">
            Notifications
            <span class="notifications-badge" id="notificationsBadge" hidden>0</span>
          </button>
          <section class="notifications-popover" id="notificationsPopover" hidden aria-live="polite" aria-label="Friend request notifications">
            <p class="muted notifications-status" id="notificationsStatus">No notifications right now.</p>
            <div class="notifications-list" id="notificationsList"></div>
          </section>
        </div>
        <button class="chip account-menu-button" id="accountMenuButton" type="button" aria-haspopup="dialog" aria-expanded="false">
          Account Menu
        </button>
      </div>
    </section>

    <div class="sidebar-backdrop" id="sidebarBackdrop" hidden></div>
    <aside class="account-sidebar" id="accountSidebar" aria-hidden="true">
      <header class="sidebar-header">
        <h2>Player Menu</h2>
        <button class="chip sidebar-close-button" id="sidebarCloseButton" type="button" aria-label="Close menu">Close</button>
      </header>

      <nav class="sidebar-nav" aria-label="Account sections">
        <button class="chip sidebar-tab active" id="sidebarProfileTab" type="button">Profile</button>
        <button class="chip sidebar-tab" id="sidebarHistoryTab" type="button">Saved Games</button>
      </nav>

      <section class="sidebar-panel" id="sidebarProfilePanel">
        <p class="muted" id="authStatus">Guest mode enabled.</p>
        <p class="muted" id="storedGamesMeta">Sign in/sign up to save up to 100 PGNs in cloud history.</p>
        <div class="sidebar-actions">
          <input class="auth-name-input" id="usernameInput" type="text" maxlength="24" placeholder="Custom username" hidden />
          <button class="chip" id="saveUsernameButton" type="button" hidden>Save username</button>
          <button class="chip" id="guestModeButton" type="button">Play as guest</button>
          <button class="action cta-rainbow" id="signInGoogleButton" type="button">Sign in / Sign up</button>
          <button class="chip" id="signOutButton" type="button" hidden>Sign out</button>
        </div>

        <section class="friends-section" aria-label="Friends section">
          <h3 class="friends-title">Friends</h3>
          <p class="muted friends-status" id="friendsStatus">Sign in to add friends by username or Friend ID.</p>
          <div class="friends-player-id-wrap">
            <span class="friends-player-id-label">Your Friend ID</span>
            <p class="friends-player-id" id="friendPlayerId">Sign in to reveal your Friend ID</p>
            <button class="chip" id="copyPlayerIdButton" type="button">Copy Friend ID</button>
          </div>
          <button class="friends-toggle" id="friendsToggleButton" type="button" aria-expanded="false">
            <div class="friends-toggle-copy">
              <p class="friends-toggle-title">Add and Invite Friends</p>
              <p class="friends-toggle-description">Tap to manage friends by username or Friend ID.</p>
            </div>
            <span class="friends-toggle-indicator" aria-hidden="true">Open</span>
          </button>
          <div class="friends-composer" id="friendsComposer">
            <div class="friends-add-row">
              <input class="auth-name-input" id="friendIdInput" type="text" placeholder="Username or 5-digit Friend ID" autocomplete="off" />
              <button class="chip" id="addFriendButton" type="button">Add</button>
            </div>
          </div>
          <div class="friends-list" id="friendsList"></div>
        </section>
      </section>

      <section class="sidebar-panel" id="sidebarHistoryPanel" hidden>
        <p class="muted" id="historyPanelStatus">Sign in to view your saved PGN history.</p>
        <div class="saved-games-list" id="savedGamesList"></div>
      </section>
    </aside>

    <nav class="game-nav" id="gameNav" hidden>
      <button class="nav-back-link" id="backToMenuButton" type="button">← Back to menu</button>
    </nav>

    <header class="hero">
      <section class="hero-card hero-copy">
        <h1>Multiplayer Chess</h1>
        <p>Create a room or join one with code.</p>
        <a class="analysis-board-link cta-rainbow" id="analysisBoardLink" href="/analyze">♟ Open Analysis Board</a>
      </section>
      <aside class="hero-card status-card">
        <div class="status-grid">
          <div>
            <strong>Room</strong>
            <div class="muted" id="roomBadge">No active room</div>
          </div>
          <div>
            <strong>Your seat</strong>
            <div class="muted" id="roleBadge">Not seated</div>
          </div>  
          <div>
            <strong>Match state</strong>
            <div class="muted" id="matchStatus">Create a room to start.</div>
          </div>
        </div>
      </aside>
    </header>

    <main class="layout">
      <section class="panel board-panel">
        <div class="board-toolbar">
          <button class="action cta-turquoise" id="createRoomButton" type="button">Create room</button>
          <button class="action cta-rainbow" id="playBotButton" type="button">Play vs Bot (${params.botButtonLabel})</button>
          <button class="ghost" id="rematchButton" type="button" hidden>Request rematch</button>
          <button class="ghost" id="roomSettingsButton" type="button" hidden>Settings</button>
          <button class="ghost" id="undoRequestButton" type="button" hidden>Request undo</button>
          <button class="ghost" id="undoDeclineButton" type="button" hidden>Decline undo</button>
          <button class="ghost" id="labelsOnlyButton" type="button" hidden>Labels only: Off</button>
          <button class="ghost" id="flipBoardButton" type="button" hidden>Flip board</button>
          <button class="ghost" id="resignButton" type="button" hidden>Resign</button>
        </div>
       <div class="pregame-placeholder" id="pregamePlaceholder">
          <div id="pregameWaiting">
            <h2>Waiting for opponent</h2>
            <p>Create or join a room. The board appears automatically once both players are connected.</p>
          </div>
          <div id="pregameSelection" hidden>
            <h2>Choose Your Color</h2>
            <div class="mode-row">
              <label class="mode-label" for="multiplayerTimeControlSelect">Game mode</label>
              <div class="mode-select-wrap">
                <select id="multiplayerTimeControlSelect" class="mode-select" aria-label="Choose multiplayer time control">
                  ${timeControlOptionsHtml}
                </select>
                <span class="mode-select-chevron" aria-hidden="true">▾</span>
              </div>
              <p class="muted" id="modeHint">Room creator selects the timer. Color choice and ready are still required.</p>
            </div>
            <div class="selection-grid">
              <div class="selection-col">
                <strong>You</strong>
                <div class="color-options">
                  <button class="color-opt-btn" id="myPickWhite">White</button>
                  <button class="color-opt-btn" id="myPickBlack">Black</button>
                </div>
                <div class="ready-badge" id="myReadyBadge">Ready!</div>
              </div>
              <div class="selection-col">
                <strong>Opponent</strong>
                <div class="color-options">
                  <button class="color-opt-btn disabled" id="opPickWhite">White</button>
                  <button class="color-opt-btn disabled" id="opPickBlack">Black</button>
                </div>
                <div class="ready-badge" id="opReadyBadge">Ready!</div>
              </div>
            </div>
            <div style="margin-top: 24px;">
              <button class="action" id="pregameReadyBtn">Ready to Play</button>
              <div id="pregameConflictWarning" hidden>Both players selected the same color. Please choose different colors to continue.</div>
            </div>
          </div>
        </div>

        <div class="board-wrap">
          <div class="board" id="board"></div>
          <svg class="board-arrows" id="arrowLayer" viewBox="0 0 800 800" aria-hidden="true"></svg>
        </div>
        <div class="board-caption" id="boardCaption">
          Tap or click one of your pieces, then choose a legal destination.
        </div>

        <div class="nav-row" id="gameNavRow" hidden>
          <button id="liveNavFirst" title="Go to start">⏮</button>
          <button id="liveNavPrev"  title="Previous move">◀</button>
          <button id="liveNavNext"  title="Next move">▶</button>
          <button id="liveNavLast"  title="Go to live">⏭</button>
        </div>
        <button class="focus-toggle-btn" id="focusModeBtn" type="button" aria-pressed="false">Focus</button>
      </section>

      <aside class="panel side-panel">
        <section class="control-card" id="inviteJoinCard">
          <h2 class="card-title">Invite or spectate <span class="title-decor">!!</span></h2>
          <div class="control-row">
            <button class="chip" id="copyLinkButton" type="button" hidden>Copy invite link</button>
            <button class="chip" id="leaveRoomButton" type="button" hidden>Leave room</button>
          </div>
          <div class="join-grid">
            <input class="join-input" id="roomInput" maxlength="4" inputmode="numeric" pattern="\\d{4}" placeholder="4-digit room ID" />
            <button class="action" id="spectateRoomButton" type="button">Spectate</button>
          </div>
          <div class="link-row">
            <button class="chip" id="roomInviteButton" type="button" hidden>Invite</button>
          </div>
        </section>

        <section class="seat-card" id="seatCard" hidden>
          <h2 class="card-title">Seats</h2>
          <div class="seat-grid">
            <article class="seat">
              <strong>White</strong>
              <span class="muted" id="whiteSeat">Waiting for player</span>
              <span class="clock-pill" id="whiteClock">03:00</span>
            </article>
            <article class="seat">
              <strong>Black</strong>
              <span class="muted" id="blackSeat">Waiting for player</span>
              <span class="clock-pill" id="blackClock">03:00</span>
            </article>
          </div>
          <div class="meta-grid" style="margin-top: 14px;">
            <div>
              <span class="meta-label">Turn</span>
              <span class="muted" id="turnMeta">White</span>
            </div>
            <div>
              <span class="meta-label">Moves</span>
              <span class="muted" id="movesMeta">0</span>
            </div>
            <div>
              <span class="meta-label">Viewers</span>
              <span class="muted" id="spectatorMeta">0</span>
            </div>
          </div>
          <section class="in-game-friend-panel" id="inGameFriendPanel" hidden>
            <p class="muted in-game-friend-meta" id="inGameFriendMeta">Opponent info unavailable.</p>
            <button class="chip" id="sendFriendRequestButton" type="button">Send Friend Request</button>
          </section>
          <section class="in-game-friend-request" id="inGameFriendRequest" hidden>
            <p class="in-game-friend-request-text" id="inGameFriendRequestText">Friend request incoming.</p>
            <div class="in-game-friend-request-actions">
              <button class="chip" id="declineInGameFriendRequestButton" type="button">Decline</button>
              <button class="action" id="acceptInGameFriendRequestButton" type="button">Accept</button>
            </div>
          </section>
        </section>

        <section class="summary-card" id="summaryCard" hidden>
          <h2 class="card-title">Game summary</h2>
          <p class="muted" id="summaryText">The server will keep this board authoritative for every device in the room.</p>
          <p class="muted" id="liveAnalysisText">Live analysis disabled.</p>
        </section>

        <section class="moves-card" id="movesCard" hidden>
          <h2 class="card-title">Moves</h2>
          <div class="move-list" id="moveList">
            <div class="empty-state">No moves yet.</div>
          </div>
        </section>
      </aside>
    </main>
  </div>

  <div class="bot-difficulty-overlay" id="botDifficultyOverlay" aria-hidden="true" hidden>
    <div class="bot-difficulty-backdrop" id="botDifficultyBackdrop" aria-hidden="true"></div>
    <div class="bot-difficulty-picker" id="botDifficultyPicker" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="botDifficultyTitle">
      <h2 class="bot-difficulty-title" id="botDifficultyTitle">Choose Bot Strength</h2>
      <p class="bot-difficulty-subtitle">Pick bot strength, clock mode, and your side before starting.</p>
      <label class="bot-difficulty-label bot-difficulty-level-label" for="botDifficultySelect">Bot level</label>
      <div class="bot-difficulty-select-wrap bot-difficulty-level-select-wrap">
        <select id="botDifficultySelect" class="bot-difficulty-select" aria-label="Choose bot difficulty">
          ${botDifficultyOptionsHtml}
        </select>
        <span class="bot-difficulty-select-chevron" aria-hidden="true">▾</span>
      </div>
      <label class="bot-difficulty-label bot-difficulty-time-label" for="botTimeControlSelect">Time control</label>
      <div class="bot-difficulty-select-wrap bot-difficulty-time-select-wrap">
        <select id="botTimeControlSelect" class="bot-difficulty-select" aria-label="Choose bot time control">
          ${timeControlOptionsHtml}
        </select>
        <span class="bot-difficulty-select-chevron" aria-hidden="true">▾</span>
      </div>
      <label class="bot-difficulty-label bot-difficulty-side-label" for="botSideSelect">Your side</label>
      <div class="bot-difficulty-select-wrap bot-difficulty-side-select-wrap">
        <select id="botSideSelect" class="bot-difficulty-select" aria-label="Choose your side against the bot">
          <option value="w">White</option>
          <option value="b">Black</option>
        </select>
        <span class="bot-difficulty-select-chevron" aria-hidden="true">▾</span>
      </div>
      <button class="chip bot-difficulty-start" id="startBotGameButton" type="button">Start Match</button>
    </div>
  </div>

  <div class="focus-hud" id="focusHud" hidden>
    <span class="focus-chip" id="focusTimer">00:00</span>

    <div id="focusMaterialHud" class="focus-material-hud" hidden></div>
  </div>

  <div class="promotion-dialog" id="promotionDialog" hidden>
    <div class="promotion-card">
      <h2 class="card-title">Choose a promotion</h2>
      <p class="muted">Select the piece that your pawn should become.</p>
      <div class="promotion-grid">
        <button class="promotion-button" data-promotion="q" type="button">Queen</button>
        <button class="promotion-button" data-promotion="r" type="button">Rook</button>
        <button class="promotion-button" data-promotion="b" type="button">Bishop</button>
        <button class="promotion-button" data-promotion="n" type="button">Knight</button>
      </div>
    </div>
  </div>

 <div class="modal-overlay" id="confirmDialog" hidden>
  <div class="modal-card">
    <div class="modal-header">
      <h2 class="modal-title" id="modalTitle">Leave Match?</h2>
      <p class="modal-text" id="modalDescription">Your current game progress will be lost.</p>
    </div>
    <div class="modal-actions">
      <button class="modal-btn cancel" id="confirmNoBtn" type="button">Stay</button>
      <button class="modal-btn confirm" id="confirmYesBtn" type="button">Confirm</button>
    </div>
  </div>
</div>

  <button class="chat-fab" id="chatFabButton" type="button" aria-label="Open live chat" hidden>
    <span>Chat</span>
    <span class="chat-fab-badge" id="chatFabBadge" hidden></span>
  </button>

  <section class="live-chat-panel" id="chatPanel" hidden>
    <header class="live-chat-header">
      <h2>Live Chat</h2>
      <button class="chip" id="chatCloseButton" type="button">Close</button>
    </header>
    <p class="muted" id="chatStatusText">Live chat is available only for seated multiplayer players during active matches.</p>
    <div class="live-chat-actions">
      <button class="chip" id="chatConsentButton" type="button">Accept Communication</button>
      <button class="action cta-turquoise chat-voice-btn" id="chatVoiceButton" type="button">Hold to Talk</button>
    </div>
    <div class="live-chat-messages" id="chatMessages">
      <div class="empty-state">No messages yet.</div>
    </div>
    <div class="live-chat-compose">
      <input class="join-input live-chat-input" id="chatInput" maxlength="420" placeholder="Type a message..." />
      <button class="action" id="chatSendButton" type="button">Send</button>
    </div>
  </section>

  <div class="toast" id="toast"></div>
  <div class="toast toast-center" id="centerFlash" aria-live="polite"></div>

  <section class="friend-invite-prompt" id="friendInvitePrompt" hidden aria-live="polite">
    <p class="friend-invite-prompt-text" id="friendInvitePromptText">New invitation</p>
    <div class="friend-invite-prompt-actions">
      <button class="chip" id="friendInviteDeclineButton" type="button">Decline</button>
      <button class="action cta-turquoise" id="friendInviteAcceptButton" type="button">Accept</button>
    </div>
  </section>

  <section class="friend-invite-prompt" id="roomJoinRequestPrompt" hidden aria-live="polite">
    <p class="friend-invite-prompt-text" id="roomJoinRequestPromptText">Join request</p>
    <div class="friend-invite-prompt-actions">
      <button class="chip" id="roomJoinRequestDeclineButton" type="button">Decline</button>
      <button class="action cta-turquoise" id="roomJoinRequestAcceptButton" type="button">Accept</button>
    </div>
  </section>
`;
}
