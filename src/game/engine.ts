import { buildDeck, type Card } from "./cards";
import { type Rng, shuffle } from "./rng";
import { roundScore, WINNING_SCORE } from "./scoring";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 18;
/** Consecutive timed-out decisions after which a player forfeits. */
export const MAX_MISSED_TURNS = 3;
const LOG_LIMIT = 50;

export type PlayerStatus = "active" | "stayed" | "frozen" | "busted";

export interface Player {
  id: string;
  name: string;
  /** Discord CDN URL, or null to show an initial instead. */
  avatar: string | null;
  total: number;
  status: PlayerStatus;
  numbers: Card[];
  modifiers: Card[];
  secondChance: Card | null;
  draw7: boolean;
  lastRoundScore: number | null;
  /** Decisions in a row the server made for them after a timeout. */
  missedTurns: number;
}

export interface Pending {
  kind: "freeze" | "flipThree" | "giveSecondChance";
  chooser: string;
  card: Card;
  options: string[];
}

// Work queue for card resolution. Flip Three prepends its draws, so nested effects run in rule order.
export type Task =
  | { type: "draw"; player: string; flipThree: boolean }
  | { type: "resolveDeferred"; player: string; cards: Card[] }
  | { type: "resolveAction"; player: string; card: Card }
  | { type: "endTurn" };

export interface GameState {
  phase: "lobby" | "playing" | "roundOver" | "gameOver";
  stage: "deal" | "turns";
  players: Player[];
  deck: Card[];
  discard: Card[];
  round: number;
  dealer: number;
  current: string | null;
  dealQueue: string[];
  tasks: Task[];
  pending: Pending | null;
  winners: string[];
  /** Winner of the most recent game in this session, kept across new games. */
  champion: string | null;
  /** Consecutive games the champion has won. */
  streak: number;
  log: string[];
  /** Card IDs drawn by the latest action, in draw order, so clients can animate them in sequence. */
  drawn: number[];
}

export type Action =
  | { type: "join"; name: string; avatar?: string | null }
  | { type: "leave" }
  | { type: "start" }
  | { type: "hit" }
  | { type: "stay" }
  | { type: "choose"; target: string }
  | { type: "nextRound" }
  /** `keep` lists who stays seated (e.g. those still connected); defaults to everyone. */
  | { type: "newGame"; keep?: string[] };

export type Result =
  { ok: true; state: GameState } | { ok: false; error: string };

export function createGame(): GameState {
  return {
    phase: "lobby",
    stage: "deal",
    players: [],
    deck: [],
    discard: [],
    round: 0,
    dealer: 0,
    current: null,
    dealQueue: [],
    tasks: [],
    pending: null,
    winners: [],
    champion: null,
    streak: 0,
    log: [],
    drawn: [],
  };
}

export function applyAction(
  state: GameState,
  playerId: string,
  action: Action,
  rng: Rng,
): Result {
  const s = structuredClone(state);
  s.drawn = [];
  const actor = s.players.find((p) => p.id === playerId);
  if (actor) actor.missedTurns = 0;
  const error = handle(s, playerId, action, rng);
  return error ? { ok: false, error } : { ok: true, state: s };
}

/** The player the game is waiting on, if any. */
export function awaiting(s: GameState): string | null {
  if (s.phase !== "playing") return null;
  if (s.pending) return s.pending.chooser;
  return s.stage === "turns" ? s.current : null;
}

/**
 * Acts for a player who ran out of time: picks a random option for a pending choice, or stays on their turn.
 * After MAX_MISSED_TURNS in a row they forfeit.
 */
export function autoAction(
  state: GameState,
  playerId: string,
  rng: Rng,
): Result {
  if (awaiting(state) !== playerId)
    return { ok: false, error: "Not waiting on this player" };
  const missed = (player(state, playerId).missedTurns ?? 0) + 1;
  const action: Action = state.pending
    ? {
        type: "choose",
        target:
          state.pending.options[
            Math.floor(rng() * state.pending.options.length)
          ],
      }
    : { type: "stay" };
  const result = applyAction(state, playerId, action, rng);
  if (!result.ok) return result;

  const p = player(result.state, playerId);
  p.missedTurns = missed;
  if (missed >= MAX_MISSED_TURNS) {
    log(result.state, `${p.name} missed ${missed} turns in a row`);
    forfeit(result.state, p, rng);
  }
  return result;
}

export function cardLabel(card: Card): string {
  if (card.kind === "number") return String(card.value);
  if (card.kind === "modifier") return card.modifier;
  return {
    freeze: "Freeze",
    flipThree: "Flip Three",
    secondChance: "Second Chance",
  }[card.action];
}

function handle(
  s: GameState,
  playerId: string,
  action: Action,
  rng: Rng,
): string | undefined {
  const seated = s.players.find((p) => p.id === playerId);

  if (action.type === "join") {
    if (s.phase !== "lobby") return "The game has already started";
    if (seated) return "Already seated";
    if (s.players.length >= MAX_PLAYERS) return "The table is full";
    s.players.push(newPlayer(playerId, action.name, action.avatar ?? null));
    return;
  }
  // Anyone may start the next game, so a table everyone has left can't get stuck on the results screen.
  if (action.type === "newGame") {
    if (s.phase !== "gameOver") return "The game is not over";
    const keep = action.keep ?? s.players.map((p) => p.id);
    Object.assign(s, createGame(), {
      players: s.players
        .filter((p) => keep.includes(p.id))
        .map((p) => newPlayer(p.id, p.name, p.avatar)),
      champion: s.champion,
      streak: s.streak,
    });
    return;
  }
  if (!seated) return "You are not seated";

  switch (action.type) {
    case "leave":
      // After the game the final standings stay put; the next game only keeps players still around.
      if (s.phase === "gameOver") return "The game is over";
      if (s.phase === "lobby")
        s.players = s.players.filter((p) => p.id !== playerId);
      else forfeit(s, seated, rng);
      return;

    case "start":
      if (s.phase !== "lobby") return "The game has already started";
      if (s.players.length < MIN_PLAYERS)
        return `Need at least ${MIN_PLAYERS} players`;
      s.deck = shuffle(buildDeck(), rng);
      s.discard = [];
      s.round = 0;
      s.dealer = 0;
      startRound(s, rng);
      return;

    case "nextRound":
      if (s.phase !== "roundOver") return "The round is not over";
      startRound(s, rng);
      return;

    case "hit":
    case "stay":
      if (
        s.phase !== "playing" ||
        s.stage !== "turns" ||
        s.pending ||
        s.current !== playerId
      ) {
        return "It is not your turn";
      }
      if (action.type === "stay") {
        seated.status = "stayed";
        log(
          s,
          `${seated.name} stays on ${roundScore(seated.numbers, seated.modifiers, false)}`,
        );
        s.tasks.push({ type: "endTurn" });
      } else {
        s.tasks.push(
          { type: "draw", player: playerId, flipThree: false },
          { type: "endTurn" },
        );
      }
      run(s, rng);
      return;

    case "choose": {
      const pending = s.pending;
      if (s.phase !== "playing" || !pending || pending.chooser !== playerId)
        return "Nothing to choose";
      if (!pending.options.includes(action.target)) return "Invalid target";
      s.pending = null;
      applyCardEffect(
        s,
        pending.kind,
        pending.chooser,
        pending.card,
        action.target,
      );
      run(s, rng);
      return;
    }
  }
}

function newPlayer(id: string, name: string, avatar: string | null): Player {
  return {
    id,
    name,
    avatar,
    total: 0,
    status: "active",
    numbers: [],
    modifiers: [],
    secondChance: null,
    draw7: false,
    lastRoundScore: null,
    missedTurns: 0,
  };
}

function startRound(s: GameState, rng: Rng) {
  for (const p of s.players) {
    s.discard.push(
      ...p.numbers,
      ...p.modifiers,
      ...(p.secondChance ? [p.secondChance] : []),
    );
    Object.assign(p, {
      status: "active",
      numbers: [],
      modifiers: [],
      secondChance: null,
      draw7: false,
      lastRoundScore: null,
    });
  }
  s.round += 1;
  if (s.round > 1) s.dealer = (s.dealer + 1) % s.players.length;
  s.phase = "playing";
  s.stage = "deal";
  s.current = null;
  s.tasks = [];
  s.pending = null;
  s.dealQueue = s.players.map(
    (_, i) => s.players[(s.dealer + 1 + i) % s.players.length].id,
  );
  log(s, `Round ${s.round}: ${s.players[s.dealer].name} deals`);
  run(s, rng);
}

function run(s: GameState, rng: Rng) {
  while (s.phase === "playing" && !s.pending) {
    const task = s.tasks.shift();
    if (task) {
      execute(s, task, rng);
      continue;
    }
    if (s.stage === "turns") return; // waiting for the current player

    const next = s.dealQueue.shift();
    if (next === undefined) {
      s.stage = "turns";
      s.current = nextActive(s, s.players[s.dealer].id);
      if (!s.current) endRound(s);
      return;
    }
    if (player(s, next).status === "active") {
      s.current = next;
      s.tasks.push({ type: "draw", player: next, flipThree: false });
    }
  }
}

function execute(s: GameState, task: Task, rng: Rng) {
  switch (task.type) {
    case "draw": {
      const p = player(s, task.player);
      if (p.status !== "active") return;
      const card = drawCard(s, rng);
      if (!card) {
        log(s, "The deck is empty");
        return;
      }
      receive(s, p, card, task.flipThree);
      return;
    }
    case "resolveDeferred":
      if (player(s, task.player).status === "active") {
        s.tasks.unshift(
          ...task.cards.map((card) => ({
            type: "resolveAction" as const,
            player: task.player,
            card,
          })),
        );
      } else {
        s.discard.push(...task.cards);
      }
      return;
    case "resolveAction":
      promptAction(s, player(s, task.player), task.card);
      return;
    case "endTurn":
      s.current = s.current && nextActive(s, s.current);
      if (!s.current) endRound(s);
      return;
  }
}

function receive(s: GameState, p: Player, card: Card, inFlipThree: boolean) {
  if (card.kind === "number") {
    if (p.numbers.some((c) => c.kind === "number" && c.value === card.value)) {
      if (p.secondChance) {
        s.discard.push(card, p.secondChance);
        p.secondChance = null;
        log(s, `${p.name} uses Second Chance on a duplicate ${card.value}`);
      } else {
        p.numbers.push(card);
        p.status = "busted";
        log(s, `${p.name} busts on a duplicate ${card.value}`);
      }
      return;
    }
    p.numbers.push(card);
    log(s, `${p.name} flips ${card.value}`);
    if (p.numbers.length === 7) {
      p.draw7 = true;
      log(s, `${p.name} draws 7!`);
      endRound(s);
    }
    return;
  }

  log(s, `${p.name} flips ${cardLabel(card)}`);
  if (card.kind === "modifier") {
    p.modifiers.push(card);
    return;
  }
  if (card.action === "secondChance") {
    if (!p.secondChance) {
      p.secondChance = card;
      return;
    }
    const options = s.players
      .filter((o) => o.id !== p.id && o.status === "active" && !o.secondChance)
      .map((o) => o.id);
    choose(s, { kind: "giveSecondChance", chooser: p.id, card, options });
    return;
  }
  if (inFlipThree) {
    // Freeze and Flip Three drawn during Flip Three wait until all three cards are flipped.
    const deferred = s.tasks.find(
      (t) => t.type === "resolveDeferred" && t.player === p.id,
    );
    if (deferred?.type === "resolveDeferred") {
      deferred.cards.push(card);
      return;
    }
  }
  promptAction(s, p, card);
}

function promptAction(s: GameState, chooser: Player, card: Card) {
  if (card.kind !== "action" || card.action === "secondChance") return;
  const options = s.players
    .filter((o) => o.status === "active")
    .map((o) => o.id);
  choose(s, { kind: card.action, chooser: chooser.id, card, options });
}

/** Resolves immediately when there is at most one option, otherwise waits for the chooser. */
function choose(s: GameState, pending: Pending) {
  if (pending.options.length === 0) {
    s.discard.push(pending.card);
  } else if (pending.options.length === 1) {
    applyCardEffect(
      s,
      pending.kind,
      pending.chooser,
      pending.card,
      pending.options[0],
    );
  } else {
    s.pending = pending;
  }
}

function applyCardEffect(
  s: GameState,
  kind: Pending["kind"],
  chooserId: string,
  card: Card,
  targetId: string,
) {
  const chooser = player(s, chooserId);
  const target = player(s, targetId);
  switch (kind) {
    case "giveSecondChance":
      target.secondChance = card;
      log(s, `${chooser.name} gives Second Chance to ${target.name}`);
      return;
    case "freeze":
      s.discard.push(card);
      target.status = "frozen";
      log(
        s,
        `${chooser.name} freezes ${target.name} on ${roundScore(target.numbers, target.modifiers, false)}`,
      );
      return;
    case "flipThree":
      s.discard.push(card);
      log(s, `${chooser.name} makes ${target.name} flip three`);
      s.tasks.unshift(
        { type: "draw", player: targetId, flipThree: true },
        { type: "draw", player: targetId, flipThree: true },
        { type: "draw", player: targetId, flipThree: true },
        { type: "resolveDeferred", player: targetId, cards: [] },
      );
      return;
  }
}

/** Drops queued card resolution, sending action cards still waiting on a choice or a Flip Three to the discard pile. */
function clearPendingWork(s: GameState) {
  if (s.pending) s.discard.push(s.pending.card);
  for (const t of s.tasks) {
    if (t.type === "resolveDeferred") s.discard.push(...t.cards);
    if (t.type === "resolveAction") s.discard.push(t.card);
  }
  s.tasks = [];
  s.pending = null;
  s.current = null;
  s.dealQueue = [];
}

/** Removes a player mid-game. Their cards are discarded and play continues without them. */
function forfeit(s: GameState, p: Player, rng: Rng) {
  log(s, `${p.name} forfeits`);
  s.discard.push(
    ...p.numbers,
    ...p.modifiers,
    ...(p.secondChance ? [p.secondChance] : []),
  );

  const remaining = s.players.filter((o) => o !== p);
  if (remaining.length < MIN_PLAYERS) {
    clearPendingWork(s);
    s.players = remaining;
    if (remaining.length === 1)
      declareWinner(s, remaining[0], `${remaining[0].name} wins by forfeit!`);
    else
      Object.assign(s, createGame(), {
        champion: s.champion,
        streak: s.streak,
      });
    return;
  }

  if (s.phase === "playing") {
    // Work queued for them is dropped; their own turn ends and passes on.
    const theirTurn = s.current === p.id;
    const next = nextActive(s, p.id);
    s.tasks = s.tasks.filter((t) => {
      const dropped = t.type === "endTurn" ? theirTurn : t.player === p.id;
      if (dropped && t.type === "resolveDeferred") s.discard.push(...t.cards);
      if (dropped && t.type === "resolveAction") s.discard.push(t.card);
      return !dropped;
    });
    s.dealQueue = s.dealQueue.filter((id) => id !== p.id);
    if (theirTurn) s.current = next === p.id ? null : next;

    const pending = s.pending;
    if (pending?.chooser === p.id) {
      s.discard.push(pending.card);
      s.pending = null;
    } else if (pending?.options.includes(p.id)) {
      s.pending = null;
      choose(s, {
        ...pending,
        options: pending.options.filter((id) => id !== p.id),
      });
    }
  }

  const index = s.players.indexOf(p);
  s.players = remaining;
  // Keep the dealer pointing at the same seat so rotation continues from there.
  if (index <= s.dealer)
    s.dealer = (s.dealer - 1 + remaining.length) % remaining.length;

  if (s.phase === "playing") {
    run(s, rng);
    if (
      s.phase === "playing" &&
      s.stage === "turns" &&
      !s.pending &&
      !s.tasks.length &&
      !s.current
    )
      endRound(s);
  }
}

function declareWinner(s: GameState, winner: Player, message: string) {
  s.phase = "gameOver";
  s.winners = [winner.id];
  s.streak = s.champion === winner.id ? s.streak + 1 : 1;
  s.champion = winner.id;
  log(s, message);
}

function endRound(s: GameState) {
  clearPendingWork(s);
  s.phase = "roundOver";

  for (const p of s.players) {
    p.lastRoundScore =
      p.status === "busted" ? 0 : roundScore(p.numbers, p.modifiers, p.draw7);
    p.total += p.lastRoundScore;
  }
  log(
    s,
    `Round ${s.round} over: ${s.players.map((p) => `${p.name} +${p.lastRoundScore}`).join(", ")}`,
  );

  const top = Math.max(...s.players.map((p) => p.total));
  if (top < WINNING_SCORE) return;
  const leaders = s.players.filter((p) => p.total === top);
  if (leaders.length === 1) {
    declareWinner(s, leaders[0], `${leaders[0].name} wins with ${top}!`);
  } else {
    log(s, `Tie at ${top}, playing another round`);
  }
}

function drawCard(s: GameState, rng: Rng): Card | undefined {
  if (s.deck.length === 0 && s.discard.length > 0) {
    s.deck = shuffle(s.discard, rng);
    s.discard = [];
    log(s, "Discard pile shuffled into the deck");
  }
  const card = s.deck.shift();
  if (card) s.drawn.push(card.id);
  return card;
}

function nextActive(s: GameState, fromId: string): string | null {
  const n = s.players.length;
  const start = s.players.findIndex((p) => p.id === fromId);
  for (let i = 1; i <= n; i++) {
    const p = s.players[(start + i) % n];
    if (p.status === "active") return p.id;
  }
  return null;
}

function player(s: GameState, id: string): Player {
  const p = s.players.find((p) => p.id === id);
  if (!p) throw new Error(`Unknown player ${id}`);
  return p;
}

function log(s: GameState, message: string) {
  s.log.push(message);
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}
