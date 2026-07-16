import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type AnnouncePriority = 'polite' | 'assertive';

export interface LiveAnnouncerApi {
  /**
   * Queue a screen-reader announcement.
   * - `polite` (default): spoken when the reader next pauses. Use for routine
   *   game narration (a captain played a tile, a draw, score updates).
   * - `assertive`: interrupts the reader. Use sparingly for time-critical events
   *   the player must act on (your turn, illegal move, errors).
   */
  announce: (message: string, priority?: AnnouncePriority) => void;
}

const LiveAnnouncerContext = createContext<LiveAnnouncerApi | null>(null);

type Slot = readonly ['a' | 'b', string];

/**
 * App-wide screen-reader announcer. Renders visually-hidden `aria-live` regions
 * and exposes {@link useAnnounce} so any component can narrate game/app events
 * without a visible UI change — the backbone for playing Warp without sight.
 *
 * Each politeness level uses two alternating nodes: writing the next message to
 * a freshly-changed node guarantees repeated identical messages (e.g. "Your
 * turn" two rounds in a row) are still spoken, which a single region would drop.
 */
export function LiveAnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState<Slot>(['a', '']);
  const [assertive, setAssertive] = useState<Slot>(['a', '']);
  const politeSlot = useRef<'a' | 'b'>('a');
  const assertiveSlot = useRef<'a' | 'b'>('a');

  const announce = useCallback(
    (message: string, priority: AnnouncePriority = 'polite') => {
      const text = message.trim();
      if (!text) {
        return;
      }
      if (priority === 'assertive') {
        assertiveSlot.current = assertiveSlot.current === 'a' ? 'b' : 'a';
        setAssertive([assertiveSlot.current, text]);
      } else {
        politeSlot.current = politeSlot.current === 'a' ? 'b' : 'a';
        setPolite([politeSlot.current, text]);
      }
    },
    []
  );

  const api = useMemo<LiveAnnouncerApi>(() => ({ announce }), [announce]);

  return (
    <LiveAnnouncerContext.Provider value={api}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {polite[0] === 'a' ? polite[1] : ''}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {polite[0] === 'b' ? polite[1] : ''}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive[0] === 'a' ? assertive[1] : ''}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive[0] === 'b' ? assertive[1] : ''}
      </div>
    </LiveAnnouncerContext.Provider>
  );
}

/**
 * Access the announcer. Returns a no-op outside a provider (isolated tests /
 * Storybook) so callers never need to null-check.
 */
export function useAnnounce(): LiveAnnouncerApi['announce'] {
  const ctx = useContext(LiveAnnouncerContext);
  return ctx ? ctx.announce : NOOP_ANNOUNCE;
}

const NOOP_ANNOUNCE: LiveAnnouncerApi['announce'] = () => undefined;
