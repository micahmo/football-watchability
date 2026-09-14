/**
 * What town a postal code is in.
 *
 * Only ever used to say where a typed postal code is, as context in the settings
 * panel, so a viewer who enters 60601 sees Chicago beside it and knows it took.
 * Cloudflare supplies the town when the board is reached through the tunnel and
 * supplies nothing when somebody types a code, which is exactly the case a person
 * is least sure of.
 *
 * This was first attempted from the TV lineups already being fetched, since cable
 * headends are named after towns. It is wrong often enough to be worse than
 * silence: across sixteen codes it put 60601 in Marengo, sixty miles from downtown
 * Chicago, and 75201 in Keller rather than Dallas. Zippopotam answered all
 * seventeen tried correctly, including 00501 and 99950.
 *
 * Never load-bearing. It decorates a label, so a failure is a missing word.
 */
const ENDPOINT = "https://api.zippopotam.us/us";
const TIMEOUT_MS = 4000;

export class PlaceStore {
  /** Towns do not move, so a hit is kept for the life of the process. */
  private readonly byZip = new Map<string, string | null>();
  private readonly inFlight = new Map<string, Promise<string | null>>();

  /** The town, or null while it is unknown. Never throws and never blocks twice. */
  async town(zip: string): Promise<string | null> {
    const cached = this.byZip.get(zip);
    if (cached !== undefined) return cached;

    const running = this.inFlight.get(zip);
    if (running) return running;

    const lookup = this.fetchTown(zip)
      .then((name) => {
        // A miss is cached too: a postal code that is not in the dataset will not
        // appear in it on the next request either, and asking again every snapshot
        // would be a request per refresh forever.
        this.byZip.set(zip, name);
        return name;
      })
      .catch(() => null)
      .finally(() => this.inFlight.delete(zip));

    this.inFlight.set(zip, lookup);
    return lookup;
  }

  private async fetchTown(zip: string): Promise<string | null> {
    const res = await fetch(`${ENDPOINT}/${zip}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body: any = await res.json();
    const place = (body?.places ?? [])[0];
    const name = typeof place?.["place name"] === "string" ? place["place name"].trim() : "";
    return name.length > 0 && name.length < 64 ? name : null;
  }
}
