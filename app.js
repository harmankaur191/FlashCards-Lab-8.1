// =================================================================
// Storage Helpers (LocalStorage persistence with versioning)
// =================================================================
const STORAGE_KEY = 'flashcards_app_state_v1';

const defaultInitialState = {
  decks: [
    {
      id: 'deck-1',
      name: 'JavaScript Basics',
      cards: [
        { id: 'c-1', front: 'What is the output of typeof null in JavaScript?', back: 'object' },
        { id: 'c-2', front: 'Which method converts JSON data into a JavaScript object?', back: 'JSON.parse()' },
        { id: 'c-3', front: 'What keyword is used to declare a constant variable?', back: 'const' }
      ]
    },
    {
      id: 'deck-2',
      name: 'World Capitals',
      cards: [
        { id: 'c-4', front: 'What is the capital of Japan?', back: 'Tokyo' },
        { id: 'c-5', front: 'What is the capital of France?', back: 'Paris' }
      ]
    }
  ],
  activeDeckId: 'deck-1',
  activeCardIndex: 0,
  isFlipped: false,
  searchQuery: ''
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultInitialState;
    const parsed = JSON.parse(raw);
    return {
      decks: Array.isArray(parsed.decks) ? parsed.decks : defaultInitialState.decks,
      activeDeckId: parsed.activeDeckId || defaultInitialState.activeDeckId,
      activeCardIndex: 0,
      isFlipped: false,
      searchQuery: ''
    };
  } catch (e) {
    console.error('Failed to parse storage, falling back to default:', e);
    return defaultInitialState;
  }
}

function saveState() {
  try {
    const payload = {
      decks: state.decks,
      activeDeckId: state.activeDeckId
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('Failed to save state to localStorage:', e);
  }
}

// =================================================================
// Application State Initialization
// =================================================================
const saved = loadState();
const state = {
  decks: saved.decks,
  activeDeckId: saved.activeDeckId,
  activeCardIndex: 0,
  isFlipped: false,
  searchQuery: '',
  lastFocusedElement: null,
  activeModal: null
};

if (!state.decks.some(d => d.id === state.activeDeckId) && state.decks.length > 0) {
  state.activeDeckId = state.decks[0].id;
}

// =================================================================
// DOM Elements
// =================================================================
const deckListEl = document.getElementById('deck-list');
const activeDeckTitleEl = document.getElementById('active-deck-title');
const cardCounterEl = document.getElementById('card-counter');
const flashcardEl = document.getElementById('flashcard');
const cardTopActions = document.getElementById('card-top-actions');
const cardFrontContentEl = document.getElementById('card-front-content');
const cardBackContentEl = document.getElementById('card-back-content');
const cardSearchInput = document.getElementById('card-search');

const newDeckBtn = document.getElementById('new-deck-btn');
const deckModal = document.getElementById('deck-modal');
const deckForm = document.getElementById('deck-form');
const deckModalTitle = document.getElementById('deck-modal-title');
const deckIdInput = document.getElementById('deck-id-input');
const deckNameInput = document.getElementById('deck-name-input');
const deckModalCancelBtn = document.getElementById('deck-modal-cancel-btn');
const deckModalCloseBtn = document.getElementById('deck-modal-close-btn');

const newCardBtn = document.getElementById('new-card-btn');
const editCardBtn = document.getElementById('edit-card-btn');
const deleteCardBtn = document.getElementById('delete-card-btn');
const cardModal = document.getElementById('card-modal');
const cardForm = document.getElementById('card-form');
const cardModalTitle = document.getElementById('card-modal-title');
const cardIndexInput = document.getElementById('card-index-input');
const cardFrontInput = document.getElementById('card-q-input');
const cardBackInput = document.getElementById('card-a-input');
const cardModalCancelBtn = document.getElementById('card-modal-cancel-btn');
const cardModalCloseBtn = document.getElementById('card-modal-close-btn');

const flipCardBtn = document.getElementById('flip-card-btn');
const prevCardBtn = document.getElementById('prev-card-btn');
const nextCardBtn = document.getElementById('next-card-btn');
const shuffleBtn = document.getElementById('shuffle-btn');

// =================================================================
// Helper: Get Filtered Cards (View-only filter)
// =================================================================
function getFilteredCards(deck) {
  if (!deck) return [];
  if (!state.searchQuery.trim()) return deck.cards;
  const query = state.searchQuery.toLowerCase();
  return deck.cards.filter(c => c.front.toLowerCase().includes(query) || c.back.toLowerCase().includes(query));
}

// =================================================================
// Render Functions
// =================================================================
function renderDecks() {
  deckListEl.innerHTML = '';
  if (state.decks.length === 0) {
    deckListEl.innerHTML = '<li style="padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.875rem;">No decks yet. Create one!</li>';
    return;
  }

  state.decks.forEach(deck => {
    const li = document.createElement('li');
    li.className = `deck-item ${deck.id === state.activeDeckId ? 'active' : ''}`;
    
    li.innerHTML = `
      <button class="deck-btn ${deck.id === state.activeDeckId ? 'active' : ''}" data-id="${deck.id}" type="button">
        ${escapeHtml(deck.name)} (${deck.cards.length})
      </button>
      <div class="deck-actions-group">
        <button class="icon-btn" data-action="edit" data-id="${deck.id}" aria-label="Edit deck ${deck.name}" title="Edit">✏️</button>
        <button class="icon-btn delete" data-action="delete" data-id="${deck.id}" aria-label="Delete deck ${deck.name}" title="Delete">🗑️</button>
      </div>
    `;
    deckListEl.appendChild(li);
  });
}

function renderActiveDeck() {
  const activeDeck = state.decks.find(d => d.id === state.activeDeckId);
  
  if (!activeDeck) {
    activeDeckTitleEl.textContent = 'No Decks Available';
    cardCounterEl.textContent = 'Card 0 of 0';
    cardFrontContentEl.textContent = 'Create a deck using "+ New Deck" to get started.';
    cardBackContentEl.textContent = '';
    if (cardTopActions) cardTopActions.style.display = 'none';
    flashcardEl.classList.remove('is-flipped');
    return;
  }

  activeDeckTitleEl.textContent = activeDeck.name;
  const filteredCards = getFilteredCards(activeDeck);

  if (filteredCards.length === 0) {
    cardCounterEl.textContent = '0 matching cards';
    cardFrontContentEl.textContent = state.searchQuery ? 'No cards match your search criteria.' : 'This deck is empty. Click "+ New Card" to add cards.';
    cardBackContentEl.textContent = '';
    if (cardTopActions) cardTopActions.style.display = 'none';
    flashcardEl.classList.remove('is-flipped');
    return;
  }

  if (cardTopActions) cardTopActions.style.display = 'flex';
  if (state.activeCardIndex >= filteredCards.length) {
    state.activeCardIndex = 0;
  }

  cardCounterEl.textContent = `Card ${state.activeCardIndex + 1} of ${filteredCards.length}`;
  const currentCard = filteredCards[state.activeCardIndex];

  cardFrontContentEl.textContent = currentCard.front;
  cardBackContentEl.textContent = currentCard.back;

  if (state.isFlipped) {
    flashcardEl.classList.add('is-flipped');
  } else {
    flashcardEl.classList.remove('is-flipped');
  }
}

function updateUI() {
  renderDecks();
  renderActiveDeck();
  saveState();
}

// =================================================================
// Modal Management & Focus Trap
// =================================================================
function openModal(modalEl, mode, editData = null) {
  state.lastFocusedElement = document.activeElement;
  state.activeModal = modalEl;
  modalEl.classList.add('open');

  if (modalEl === deckModal) {
    if (mode === 'create') {
      deckModalTitle.textContent = 'Create New Deck';
      deckIdInput.value = '';
      deckNameInput.value = '';
    } else {
      deckModalTitle.textContent = 'Edit Deck Name';
      deckIdInput.value = editData.id;
      deckNameInput.value = editData.name;
    }
    deckNameInput.focus();
  } else if (modalEl === cardModal) {
    if (mode === 'create') {
      cardModalTitle.textContent = 'Create New Card';
      cardIndexInput.value = '';
      cardFrontInput.value = '';
      cardBackInput.value = '';
    } else {
      cardModalTitle.textContent = 'Edit Card';
      cardIndexInput.value = editData.index;
      cardFrontInput.value = editData.card.front;
      cardBackInput.value = editData.card.back;
    }
    cardFrontInput.focus();
  }
}

function closeModal() {
  if (!state.activeModal) return;
  state.activeModal.classList.remove('open');
  state.activeModal = null;
  if (state.lastFocusedElement) {
    state.lastFocusedElement.focus();
  }
}

document.addEventListener('keydown', (e) => {
  if (!state.activeModal) return;

  if (e.key === 'Escape') {
    closeModal();
    return;
  }

  if (e.key === 'Tab') {
    const focusableEls = state.activeModal.querySelectorAll('button, [type="text"], [type="hidden"], textarea');
    if (focusableEls.length === 0) return;
    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];

    if (e.shiftKey && document.activeElement === firstEl) {
      lastEl.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      firstEl.focus();
      e.preventDefault();
    }
  }
});

// =================================================================
// Event Listeners: Decks CRUD
// =================================================================
deckListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const parentItem = btn.closest('.deck-item');
  if (!parentItem) return;
  const deckBtn = parentItem.querySelector('.deck-btn');
  if (!deckBtn) return;

  const deckId = deckBtn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'edit') {
    const deck = state.decks.find(d => d.id === deckId);
    if (deck) openModal(deckModal, 'edit', deck);
  } else if (action === 'delete') {
    const deckToDelete = state.decks.find(d => d.id === deckId);
    if (!deckToDelete) return;

    if (confirm(`Are you sure you want to delete the deck "${deckToDelete.name}"?`)) {
      state.decks = state.decks.filter(d => d.id !== deckId);
      if (state.activeDeckId === deckId && state.decks.length > 0) {
        state.activeDeckId = state.decks[0].id;
      }
      state.activeCardIndex = 0;
      state.isFlipped = false;
      state.searchQuery = '';
      cardSearchInput.value = '';
      updateUI();
    }
  } else {
    state.activeDeckId = deckId;
    state.activeCardIndex = 0;
    state.isFlipped = false;
    state.searchQuery = '';
    cardSearchInput.value = '';
    updateUI();
  }
});

newDeckBtn.addEventListener('click', () => openModal(deckModal, 'create'));
deckModalCancelBtn.addEventListener('click', closeModal);
deckModalCloseBtn.addEventListener('click', closeModal);
deckModal.addEventListener('click', (e) => { if (e.target === deckModal) closeModal(); });

deckForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = deckNameInput.value.trim();
  const deckId = deckIdInput.value;
  if (!name) return;

  if (deckId) {
    const deck = state.decks.find(d => d.id === deckId);
    if (deck) deck.name = name;
  } else {
    const newDeck = { id: 'deck-' + Date.now(), name, cards: [] };
    state.decks.push(newDeck);
    state.activeDeckId = newDeck.id;
    state.activeCardIndex = 0;
  }
  closeModal();
  updateUI();
});

// =================================================================
// Event Listeners: Cards CRUD
// =================================================================
newCardBtn.addEventListener('click', () => {
  const activeDeck = state.decks.find(d => d.id === state.activeDeckId);
  if (!activeDeck) {
    alert('Please select or create a deck first.');
    return;
  }
  openModal(cardModal, 'create');
});

editCardBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const activeDeck = state.decks.find(d => d.id === state.activeDeckId);
  const filtered = getFilteredCards(activeDeck);
  const card = filtered[state.activeCardIndex];
  if (!card) return;
  openModal(cardModal, 'edit', { index: activeDeck.cards.indexOf(card), card });
});

deleteCardBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const activeDeck = state.decks.find(d => d.id === state.activeDeckId);
  const filtered = getFilteredCards(activeDeck);
  const card = filtered[state.activeCardIndex];
  if (!card) return;

  if (confirm('Delete this flashcard?')) {
    activeDeck.cards = activeDeck.cards.filter(c => c.id !== card.id);
    state.isFlipped = false;
    if (state.activeCardIndex >= getFilteredCards(activeDeck).length) {
      state.activeCardIndex = Math.max(0, getFilteredCards(activeDeck).length - 1);
    }
    updateUI();
  }
});

cardModalCancelBtn.addEventListener('click', closeModal);
cardModalCloseBtn.addEventListener('click', closeModal);
cardModal.addEventListener('click', (e) => { if (e.target === cardModal) closeModal(); });

cardForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const activeDeck = state.decks.find(d => d.id === state.activeDeckId);
  if (!activeDeck) return;

  const front = cardFrontInput.value.trim();
  const back = cardBackInput.value.trim();
  const cardIndexVal = cardIndexInput.value;

  if (!front || !back) return;

  if (cardIndexVal !== '') {
    const index = parseInt(cardIndexVal, 10);
    activeDeck.cards[index].front = front;
    activeDeck.cards[index].back = back;
  } else {
    const newCard = { id: 'card-' + Date.now(), front, back };
    activeDeck.cards.push(newCard);
    state.activeCardIndex = getFilteredCards(activeDeck).length - 1;
  }

  state.isFlipped = false;
  closeModal();
  updateUI();
});

// =================================================================
// Study Mode Navigation & Interaction
// =================================================================
function toggleFlip() {
  state.isFlipped = !state.isFlipped;
  renderActiveDeck();
}

flashcardEl.addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
  toggleFlip();
});
flipCardBtn.addEventListener('click', toggleFlip);

nextCardBtn.addEventListener('click', () => {
  const activeDeck = state.decks.find(d => d.id === state.activeDeckId);
  const filtered = getFilteredCards(activeDeck);
  if (filtered.length === 0) return;
  state.activeCardIndex = (state.activeCardIndex + 1) % filtered.length;
  state.isFlipped = false;
  renderActiveDeck();
});

prevCardBtn.addEventListener('click', () => {
  const activeDeck = state.decks.find(d => d.id === state.activeDeckId);
  const filtered = getFilteredCards(activeDeck);
  if (filtered.length === 0) return;
  state.activeCardIndex = (state.activeCardIndex - 1 + filtered.length) % filtered.length;
  state.isFlipped = false;
  renderActiveDeck();
});

shuffleBtn.addEventListener('click', () => {
  const activeDeck = state.decks.find(d => d.id === state.activeDeckId);
  if (!activeDeck || activeDeck.cards.length <= 1) return;
  for (let i = activeDeck.cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [activeDeck.cards[i], activeDeck.cards[j]] = [activeDeck.cards[j], activeDeck.cards[i]];
  }
  state.activeCardIndex = 0;
  state.isFlipped = false;
  updateUI();
});

// =================================================================
// Debounced Keyword Search (300ms)
// =================================================================
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const handleSearchInput = debounce((e) => {
  state.searchQuery = e.target.value;
  state.activeCardIndex = 0;
  state.isFlipped = false;
  renderActiveDeck();
}, 300);

cardSearchInput.addEventListener('input', handleSearchInput);

// =================================================================
// Global Keyboard Navigation
// =================================================================
document.addEventListener('keydown', (e) => {
  if (state.activeModal) return;
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  if (e.code === 'Space') {
    e.preventDefault();
    toggleFlip();
  } else if (e.code === 'ArrowRight') {
    nextCardBtn.click();
  } else if (e.code === 'ArrowLeft') {
    prevCardBtn.click();
  }
});

// Initial startup render
updateUI();

// =================================================================
// Utility Functions
// =================================================================
function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}