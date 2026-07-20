import { OnlineGamePage } from './online-game-page.js';

/**
 * Off-camera play surface for streamers. Same seat auth as /play (Firebase uid
 * — anonymous or Google). Helm strip + Continuum panels only (table stays on
 * the capture Bridge). Pair with Stream setup → hide hand.
 */
export function OnlineHandPage() {
  return <OnlineGamePage privateHand />;
}

export default OnlineHandPage;
