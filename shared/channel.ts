/**
 * What the channel chip says: the network, and who is carrying it here.
 *
 * `marketStations` holds the call signs of the local stations showing the game,
 * an empty array for a market-split game the local affiliates are not carrying,
 * and null when there is nothing to say: a game on cable or a streamer, which is
 * on for everybody and belongs to no local station.
 *
 * All three belong in the chip, so that a game out of market is marked whether or
 * not the viewer has asked for those games to be sorted down. The alternative was
 * a separate "not on your channels" note, which only appeared for the exclusion
 * and so said nothing at all about the games that were on.
 *
 * The call signs are worth having even for a national game. "NBC" does not say
 * which channel that is here, and a Monday night game billed as ESPN is watchable
 * on a local ABC affiliate whenever it is simulcast there, which the network name
 * alone actively hides.
 *
 * The call signs were shown once before and removed, on the grounds that the
 * listings grid returned affiliates from neighbouring markets that the viewer
 * could not receive. That was true then and is not now: the grid is filtered to
 * `NFL Football` titles, and Boston, Chicago, Dallas, New York and San Francisco
 * each come back with exactly one correct local affiliate per carried game.
 */
export function channelLabel(game: {
  broadcast: string | null;
  marketStations: string[] | null;
}): string | null {
  if (!game.broadcast) return null;
  if (game.marketStations === null) return game.broadcast;
  if (game.marketStations.length === 0) return `${game.broadcast} · out of market`;
  return `${game.broadcast} · ${game.marketStations.join(", ")}`;
}
