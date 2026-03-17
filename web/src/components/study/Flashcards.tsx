import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { api, type FlashcardDeck, type Flashcard } from '../../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

type View = 'decks' | 'detail' | 'study';

interface Props {
  onSessionComplete?: (result: { focusMinutes: number; cardsReviewed: number }) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Flashcards({ onSessionComplete }: Props) {
  const [view, setView] = useState<View>('decks');
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [reviewCards, setReviewCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deck creation
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckEmoji, setNewDeckEmoji] = useState('');

  // Card creation
  const [showNewCard, setShowNewCard] = useState(false);
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');

  // Study state
  const [studyIndex, setStudyIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [cardsReviewed, setCardsReviewed] = useState(0);
  const studyStartRef = useRef<number>(0);

  // ── Data fetching ───────────────────────────────────────────────────────

  const loadDecks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDecks();
      setDecks(data.decks);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando mazos');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDeckCards = useCallback(async (deckId: number) => {
    try {
      setLoading(true);
      const data = await api.getDeckCards(deckId);
      setCards(data.cards);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando cartas');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReviewCards = useCallback(async (deckId: number) => {
    try {
      const data = await api.getCardsForReview(deckId);
      setReviewCards(data.cards);
      return data.cards.length;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  // ── Deck actions ────────────────────────────────────────────────────────

  async function handleCreateDeck() {
    if (!newDeckName.trim()) return;
    try {
      const data = await api.createDeck(newDeckName.trim(), newDeckEmoji.trim() || undefined);
      setDecks((prev) => [...prev, data.deck]);
      setNewDeckName('');
      setNewDeckEmoji('');
      setShowNewDeck(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error creando mazo');
    }
  }

  async function handleDeleteDeck(id: number) {
    try {
      await api.deleteDeck(id);
      setDecks((prev) => prev.filter((d) => d.id !== id));
      if (selectedDeck?.id === id) {
        setSelectedDeck(null);
        setView('decks');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando mazo');
    }
  }

  async function handleOpenDeck(deck: FlashcardDeck) {
    setSelectedDeck(deck);
    setView('detail');
    await loadDeckCards(deck.id);
    await loadReviewCards(deck.id);
  }

  // ── Card actions ────────────────────────────────────────────────────────

  async function handleCreateCard() {
    if (!newCardFront.trim() || !newCardBack.trim() || !selectedDeck) return;
    try {
      const data = await api.createCard(selectedDeck.id, newCardFront.trim(), newCardBack.trim());
      setCards((prev) => [...prev, data.card]);
      setNewCardFront('');
      setNewCardBack('');
      setShowNewCard(false);
      // Update deck card count locally
      setDecks((prev) =>
        prev.map((d) => (d.id === selectedDeck.id ? { ...d, cardCount: d.cardCount + 1 } : d)),
      );
      setSelectedDeck((prev) => (prev ? { ...prev, cardCount: prev.cardCount + 1 } : prev));
      // Reload review cards
      await loadReviewCards(selectedDeck.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error creando carta');
    }
  }

  async function handleDeleteCard(cardId: number) {
    if (!selectedDeck) return;
    try {
      await api.deleteCard(cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      setDecks((prev) =>
        prev.map((d) => (d.id === selectedDeck.id ? { ...d, cardCount: Math.max(0, d.cardCount - 1) } : d)),
      );
      setSelectedDeck((prev) => (prev ? { ...prev, cardCount: Math.max(0, prev.cardCount - 1) } : prev));
      await loadReviewCards(selectedDeck.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando carta');
    }
  }

  // ── Study actions ───────────────────────────────────────────────────────

  function startStudy() {
    if (reviewCards.length === 0) return;
    setStudyIndex(0);
    setFlipped(false);
    setCardsReviewed(0);
    studyStartRef.current = Date.now();
    setView('study');
  }

  async function handleRate(quality: number) {
    const card = reviewCards[studyIndex];
    if (!card) return;

    try {
      await api.reviewCard(card.id, quality);
    } catch {
      // continue even on error
    }

    const newReviewed = cardsReviewed + 1;
    setCardsReviewed(newReviewed);

    if (studyIndex + 1 < reviewCards.length) {
      setFlipped(false);
      setStudyIndex((i) => i + 1);
    } else {
      // Session complete
      const focusMinutes = Math.round((Date.now() - studyStartRef.current) / 60000);
      onSessionComplete?.({ focusMinutes: Math.max(1, focusMinutes), cardsReviewed: newReviewed });
      setView('detail');
      if (selectedDeck) {
        await loadReviewCards(selectedDeck.id);
        await loadDeckCards(selectedDeck.id);
      }
    }
  }

  function goBack() {
    if (view === 'study') {
      // Exiting study early — still report partial
      if (cardsReviewed > 0) {
        const focusMinutes = Math.round((Date.now() - studyStartRef.current) / 60000);
        onSessionComplete?.({ focusMinutes: Math.max(1, focusMinutes), cardsReviewed });
      }
      setView('detail');
      if (selectedDeck) {
        loadReviewCards(selectedDeck.id);
      }
    } else if (view === 'detail') {
      setView('decks');
      setSelectedDeck(null);
      setCards([]);
      setReviewCards([]);
      setShowNewCard(false);
    }
  }

  // ── Clear error after 3s ────────────────────────────────────────────────

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full rounded-2xl bg-accent-coral/10 border border-accent-coral/20 px-4 py-2 text-sm text-accent-coral text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back button */}
      {view !== 'decks' && (
        <button
          onClick={goBack}
          className="self-start flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
      )}

      {/* ── DECK LIST VIEW ─────────────────────────────────────────────── */}
      {view === 'decks' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full space-y-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Mis Mazos</h2>
            <button
              onClick={() => setShowNewDeck(!showNewDeck)}
              className={cn(
                'w-10 h-10 rounded-2xl flex items-center justify-center transition-all',
                'bg-white/[0.04] backdrop-blur-xl border border-white/[0.06]',
                showNewDeck && 'border-accent-mint/40 text-accent-mint',
                !showNewDeck && 'text-text-muted hover:text-text-primary',
              )}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* New deck form */}
          <AnimatePresence>
            {showNewDeck && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] p-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Emoji"
                      value={newDeckEmoji}
                      onChange={(e) => setNewDeckEmoji(e.target.value)}
                      maxLength={2}
                      className="w-14 bg-white/[0.06] border border-white/[0.08] rounded-xl px-2 py-2 text-center text-lg outline-none focus:border-accent-mint/40 text-text-primary"
                    />
                    <input
                      type="text"
                      placeholder="Nombre del mazo"
                      value={newDeckName}
                      onChange={(e) => setNewDeckName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateDeck()}
                      className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-mint/40 placeholder:text-text-muted"
                    />
                  </div>
                  <button
                    onClick={handleCreateDeck}
                    disabled={!newDeckName.trim()}
                    className="w-full py-2 rounded-xl bg-accent-mint/10 border border-accent-mint/20 text-accent-mint text-sm font-semibold transition-all hover:bg-accent-mint/15 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Crear mazo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading */}
          {loading && decks.length === 0 && (
            <p className="text-sm text-text-muted text-center py-8">Cargando...</p>
          )}

          {/* Empty state */}
          {!loading && decks.length === 0 && (
            <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] p-8 text-center">
              <p className="text-3xl mb-2">🃏</p>
              <p className="text-sm text-text-muted">
                No hay mazos todavia. Crea uno para empezar.
              </p>
            </div>
          )}

          {/* Deck cards */}
          {decks.map((deck) => (
            <motion.div
              key={deck.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] overflow-hidden"
            >
              <button
                onClick={() => handleOpenDeck(deck)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-xl">{deck.emoji || '📚'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{deck.name}</p>
                  <p className="text-xs text-text-muted font-mono">{deck.cardCount} cartas</p>
                </div>
                <svg className="w-4 h-4 text-text-muted flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {/* Delete button */}
              <div className="border-t border-white/[0.04] px-4 py-1.5 flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteDeck(deck.id); }}
                  className="text-xs text-accent-coral/60 hover:text-accent-coral transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── DECK DETAIL VIEW ───────────────────────────────────────────── */}
      {view === 'detail' && selectedDeck && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full space-y-4"
        >
          {/* Deck header */}
          <div className="text-center">
            <span className="text-3xl">{selectedDeck.emoji || '📚'}</span>
            <h2 className="text-lg font-semibold text-text-primary mt-1">{selectedDeck.name}</h2>
            <p className="text-xs text-text-muted font-mono mt-0.5">
              {cards.length} cartas &middot; {reviewCards.length} para repasar
            </p>
          </div>

          {/* Study button */}
          {reviewCards.length > 0 && (
            <button
              onClick={startStudy}
              className={cn(
                'w-full py-3 rounded-2xl font-semibold text-sm transition-all',
                'bg-accent-mint/10 border border-accent-mint/20 text-accent-mint',
                'hover:bg-accent-mint/15 hover:shadow-[0_0_16px_rgba(74,222,128,0.12)]',
              )}
            >
              Estudiar ({reviewCards.length} cartas)
            </button>
          )}

          {reviewCards.length === 0 && cards.length > 0 && (
            <div className="rounded-2xl bg-accent-violet/5 border border-accent-violet/10 px-4 py-3 text-center">
              <p className="text-sm text-accent-violet">
                No hay cartas para repasar hoy
              </p>
            </div>
          )}

          {/* Add card form */}
          <div>
            <button
              onClick={() => setShowNewCard(!showNewCard)}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-2 rounded-2xl text-sm transition-all',
                'bg-white/[0.04] backdrop-blur-xl border border-white/[0.06]',
                showNewCard ? 'border-accent-violet/40 text-accent-violet' : 'text-text-muted hover:text-text-primary',
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Agregar carta
            </button>

            <AnimatePresence>
              {showNewCard && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] p-4 space-y-3">
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Frente</label>
                      <textarea
                        placeholder="Pregunta o concepto"
                        value={newCardFront}
                        onChange={(e) => setNewCardFront(e.target.value)}
                        rows={2}
                        className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-violet/40 placeholder:text-text-muted resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Dorso</label>
                      <textarea
                        placeholder="Respuesta"
                        value={newCardBack}
                        onChange={(e) => setNewCardBack(e.target.value)}
                        rows={2}
                        className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-violet/40 placeholder:text-text-muted resize-none"
                      />
                    </div>
                    <button
                      onClick={handleCreateCard}
                      disabled={!newCardFront.trim() || !newCardBack.trim()}
                      className="w-full py-2 rounded-xl bg-accent-violet/10 border border-accent-violet/20 text-accent-violet text-sm font-semibold transition-all hover:bg-accent-violet/15 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Agregar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Card list */}
          {loading && cards.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">Cargando cartas...</p>
          ) : cards.length === 0 ? (
            <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] p-6 text-center">
              <p className="text-sm text-text-muted">
                Este mazo esta vacio. Agrega cartas para empezar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-secondary tracking-wider uppercase">
                Cartas
              </p>
              {cards.map((card) => (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{card.front}</p>
                      <p className="text-xs text-text-muted truncate mt-0.5">{card.back}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {card.nextReview && (
                        <span className="text-[10px] text-text-muted font-mono">
                          {card.interval}d
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        className="text-accent-coral/40 hover:text-accent-coral transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── STUDY SESSION VIEW ─────────────────────────────────────────── */}
      {view === 'study' && reviewCards.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full flex flex-col items-center gap-6"
        >
          {/* Progress counter */}
          <p className="text-sm text-text-muted font-mono">
            <span className="text-accent-mint font-semibold">{studyIndex + 1}</span>
            /{reviewCards.length}
          </p>

          {/* Progress bar */}
          <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full bg-accent-mint rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((studyIndex) / reviewCards.length) * 100}%` }}
              transition={{ duration: 0.3 }}
              style={{ boxShadow: '0 0 8px rgba(74,222,128,0.3)' }}
            />
          </div>

          {/* Flashcard with flip */}
          <div
            className="w-full perspective-[800px]"
            style={{ perspective: '800px' }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`card-${studyIndex}-${flipped ? 'back' : 'front'}`}
                initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                style={{ transformStyle: 'preserve-3d' }}
                onClick={() => !flipped && setFlipped(true)}
                className={cn(
                  'w-full min-h-[200px] rounded-2xl border p-6 flex flex-col items-center justify-center cursor-pointer select-none',
                  'bg-white/[0.04] backdrop-blur-xl',
                  flipped
                    ? 'border-accent-violet/20'
                    : 'border-white/[0.06] hover:border-white/[0.12] transition-colors',
                )}
              >
                {!flipped ? (
                  <>
                    <p className="text-base text-text-primary text-center leading-relaxed whitespace-pre-wrap">
                      {reviewCards[studyIndex]?.front}
                    </p>
                    <p className="text-xs text-text-muted mt-4">Toca para dar vuelta</p>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-semibold tracking-wider text-accent-violet uppercase mb-3">
                      Respuesta
                    </p>
                    <p className="text-base text-text-primary text-center leading-relaxed whitespace-pre-wrap">
                      {reviewCards[studyIndex]?.back}
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Rating buttons (only show when flipped) */}
          <AnimatePresence>
            {flipped && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.25 }}
                className="w-full flex gap-2"
              >
                <button
                  onClick={() => handleRate(1)}
                  className={cn(
                    'flex-1 py-3 rounded-2xl text-sm font-semibold transition-all',
                    'bg-white/[0.04] backdrop-blur-xl border',
                    'border-accent-coral/20 text-accent-coral hover:bg-accent-coral/10',
                  )}
                >
                  No sabia
                </button>
                <button
                  onClick={() => handleRate(3)}
                  className={cn(
                    'flex-1 py-3 rounded-2xl text-sm font-semibold transition-all',
                    'bg-white/[0.04] backdrop-blur-xl border',
                    'border-accent-amber/20 text-accent-amber hover:bg-accent-amber/10',
                  )}
                >
                  Dificil
                </button>
                <button
                  onClick={() => handleRate(5)}
                  className={cn(
                    'flex-1 py-3 rounded-2xl text-sm font-semibold transition-all',
                    'bg-white/[0.04] backdrop-blur-xl border',
                    'border-accent-mint/20 text-accent-mint hover:bg-accent-mint/10',
                  )}
                >
                  Facil
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
