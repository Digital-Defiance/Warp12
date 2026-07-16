import { DominoTile } from 'double-eighteen-react';
import type { Coordinate, DraftState } from 'warp12-engine';
import { WARP_PIP_COLORS, WARP_TILE_SURFACE, type WarpTileBg } from 'warp12-theme';
import styles from './draft-phase.module.scss';

export interface DraftPhaseProps {
  draftState: DraftState;
  myId: string;
  names: Readonly<Record<string, string>>;
  tileBg: WarpTileBg;
  maxPip: number;
  onPickTile: (coordinate: Coordinate) => void;
  /** Abort the draft / leave the sector (e.g. return to setup). */
  onAbort?: () => void;
  abortLabel?: string;
}

export function DraftPhase({
  draftState,
  myId,
  names,
  tileBg,
  maxPip,
  onPickTile,
  onAbort,
  abortLabel = 'Return to setup',
}: DraftPhaseProps) {
  const myPack = draftState.currentPacks[myId] || [];
  const myPicked = draftState.pickedTiles[myId] || [];
  const isMyTurn = draftState.currentDrafter === myId;
  const currentDrafterName = names[draftState.currentDrafter] || 'Captain';
  
  // Calculate total pack size from first captain's total (picked + current)
  const firstCaptainId = draftState.draftOrder[0];
  const totalPackSize =
    (draftState.pickedTiles[firstCaptainId]?.length || 0) +
    (draftState.currentPacks[firstCaptainId]?.length || 0);

  const tileSurface = WARP_TILE_SURFACE[tileBg];

  return (
    <div className={styles.draftPhase}>
      <div className={styles.header}>
        <h2 className={styles.title}>Tactical Requisition</h2>
        <p className={styles.subtitle}>
          Pick {draftState.pickNumber} of {totalPackSize}
        </p>
        {isMyTurn ? (
          <p className={styles.turnIndicator} data-my-turn="true">
            Your turn — select a coordinate
          </p>
        ) : (
          <p className={styles.turnIndicator}>
            {currentDrafterName} is selecting...
          </p>
        )}
      </div>

      <div className={styles.content}>
        {/* My current pack */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Your Requisition Pack ({myPack.length} remaining)
          </h3>
          <div className={styles.pack}>
            {myPack.length === 0 ? (
              <p className={styles.emptyPack}>Pack empty — waiting for others</p>
            ) : (
              myPack.map((tile, i) => (
                <button
                  key={i}
                  type="button"
                  className={styles.tile}
                  onClick={() => onPickTile(tile)}
                  disabled={!isMyTurn}
                  title={
                    isMyTurn
                      ? `Pick ${tile.low}:${tile.high}`
                      : 'Not your turn'
                  }
                >
                  <DominoTile
                    maxPips={maxPip}
                    value1={tile.low}
                    value2={tile.high}
                    width={40}
                    height={80}
                    rotation={0}
                    backgroundColor={tileSurface.fill}
                    borderColor={tileSurface.border}
                    pipColors={WARP_PIP_COLORS}
                  />
                  <span className={styles.tilePips}>{tile.low + tile.high}</span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* My picked tiles */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Your Loadout ({myPicked.length} secured)
          </h3>
          <div className={styles.picked}>
            {myPicked.length === 0 ? (
              <p className={styles.emptyPicked}>No coordinates secured yet</p>
            ) : (
              myPicked.map((tile, i) => (
                <div key={i} className={styles.pickedTile}>
                  <DominoTile
                    maxPips={maxPip}
                    value1={tile.low}
                    value2={tile.high}
                    width={30}
                    height={60}
                    rotation={0}
                    backgroundColor={tileSurface.fill}
                    borderColor={tileSurface.border}
                    pipColors={WARP_PIP_COLORS}
                  />
                </div>
              ))
            )}
          </div>
        </section>

        {/* Other captains' progress */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Fleet Status</h3>
          <div className={styles.captains}>
            {draftState.draftOrder
              .filter((id) => id !== myId)
              .map((id) => {
                const picked = draftState.pickedTiles[id]?.length || 0;
                const remaining = draftState.currentPacks[id]?.length || 0;
                const isDrafting = id === draftState.currentDrafter;
                return (
                  <div
                    key={id}
                    className={styles.captain}
                    data-drafting={isDrafting ? 'true' : undefined}
                  >
                    <span className={styles.captainName}>
                      {names[id] || 'Captain'}
                      {isDrafting && (
                        <span className={styles.draftingIndicator}> ◀</span>
                      )}
                    </span>
                    <span className={styles.captainProgress}>
                      {picked} picked · {remaining} remaining
                    </span>
                  </div>
                );
              })}
          </div>
        </section>
      </div>

      <div className={styles.footer}>
        <p className={styles.hint}>
          Select coordinates strategically — versatile pips give you more options
          throughout the sector.
        </p>
        {onAbort && (
          <button
            type="button"
            className={styles.abortBtn}
            onClick={onAbort}
          >
            {abortLabel}
          </button>
        )}
      </div>
    </div>
  );
}
