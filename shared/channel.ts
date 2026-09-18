/**
 * Where a game can actually be found, as facts rather than as a sentence.
 *
 * `marketStations` holds the call signs of the local stations showing the game,
 * an empty array for a market-split game the local affiliates are not carrying,
 * and null when there is nothing to say: a game on cable or a streamer, which is
 * on for everybody and belongs to no local station.
 *
 * The call signs are worth having even for a national game. "NBC" does not say
 * which channel that is here, and a Monday night game billed as ESPN is watchable
 * on a local ABC affiliate wherever it is simulcast, which the network name alone
 * actively hides.
 *
 * Returned in pieces because the two callers cannot render the same thing. The
 * board draws the exclusion as a struck-through pin, which is shorter than any
 * phrase and keeps the word "market" out of a interface that never uses it
 * anywhere else. A notification has no room for an icon and has to say it.
 */
export interface ChannelParts {
  network: string;
  /** Local stations carrying it. Empty when there are none to name. */
  stations: string[];
  /** Split by market, and not on anything this viewer gets. */
  outOfMarket: boolean;
}

export function channelParts(game: {
  broadcast: string | null;
  marketStations: string[] | null;
}): ChannelParts | null {
  if (!game.broadcast) return null;
  const stations = game.marketStations ?? [];
  return {
    network: game.broadcast,
    stations,
    outOfMarket: game.marketStations !== null && stations.length === 0,
  };
}

/** The same thing in words, for a notification, which cannot draw an icon. */
export function channelLabel(game: {
  broadcast: string | null;
  marketStations: string[] | null;
}): string | null {
  const parts = channelParts(game);
  if (parts === null) return null;
  if (parts.outOfMarket) return `${parts.network} · out of market`;
  if (parts.stations.length === 0) return parts.network;
  return `${parts.network} · ${parts.stations.join(", ")}`;
}
