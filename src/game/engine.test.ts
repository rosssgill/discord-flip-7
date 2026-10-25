import { describe, expect, it } from "vitest";
import { buildDeck, type ActionKind, type Card, type Modifier } from "./cards";
import { type Action, applyAction, autoAction, awaiting, createGame, type GameState } from "./engine";
import { seededRng } from "./rng";
import { roundScore } from "./scoring";
import { toView } from "./view";

const rng = seededRng(1);
let nextId = 1000;
const num = (value: number): Card => ({ id: nextId++, kind: "number", value });
const mod = (modifier: Modifier): Card => ({ id: nextId++, kind: "modifier", modifier });
const act = (action: ActionKind): Card => ({ id: nextId++, kind: "action", action });

/** Seats players A, B, … and starts a round dealt from `deck` (top first), with the last player dealing. */
function game(playerCount: number, deck: Card[], totals: number[] = []): GameState {
  let s = createGame();
  for (const id of "ABCDEF".slice(0, playerCount)) s = ok(applyAction(s, id, { type: "join", name: id }, rng));
  s.players.forEach((p, i) => (p.total = totals[i] ?? 0));
  s = { ...s, phase: "roundOver", deck, round: 0, dealer: playerCount - 1 };
  return play(s, "A", { type: "nextRound" });
}

function ok(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function play(s: GameState, playerId: string, action: Action): GameState {
  return ok(applyAction(s, playerId, action, rng));
}

const p = (s: GameState, id: string) => s.players.find((x) => x.id === id)!;
const values = (cards: Card[]) => cards.map((c) => (c.kind === "number" ? c.value : c));

describe("deck", () => {
  it("has 94 cards with the Draw 7 distribution", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(94);
    expect(new Set(deck.map((c) => c.id)).size).toBe(94);
    const count = (pred: (c: Card) => boolean) => deck.filter(pred).length;
    expect(count((c) => c.kind === "number" && c.value === 0)).toBe(1);
    expect(count((c) => c.kind === "number" && c.value === 12)).toBe(12);
    expect(count((c) => c.kind === "modifier")).toBe(6);
    expect(count((c) => c.kind === "action" && c.action === "freeze")).toBe(3);
    expect(count((c) => c.kind === "action")).toBe(9);
  });
});

describe("scoring", () => {
  it("adds numbers and modifiers, doubling only the numbers", () => {
    expect(roundScore([num(3), num(5)], [mod("+4")], false)).toBe(12);
    expect(roundScore([num(3), num(5)], [mod("+4"), mod("x2")], false)).toBe(20);
    expect(roundScore([num(3)], [mod("x2")], true)).toBe(21);
  });
});

describe("dealing and turns", () => {
  it("deals one card each from the dealer's left, then starts turns there", () => {
    const s = game(3, [num(1), num(2), num(3)]);
    expect(values(p(s, "A").numbers)).toEqual([1]);
    expect(values(p(s, "C").numbers)).toEqual([3]);
    expect(s.stage).toBe("turns");
    expect(s.current).toBe("A");
    expect(s.drawn).toEqual([...p(s, "A").numbers, ...p(s, "B").numbers, ...p(s, "C").numbers].map((c) => c.id));
  });

  it("records only the cards drawn by the latest action", () => {
    let s = game(2, [num(1), num(2), num(3)]);
    s = play(s, "A", { type: "hit" });
    expect(s.drawn).toEqual([p(s, "A").numbers[1].id]);
    s = play(s, "B", { type: "stay" });
    expect(s.drawn).toEqual([]);
  });

  it("rejects actions out of turn or phase", () => {
    const s = game(2, [num(1), num(2)]);
    expect(applyAction(s, "B", { type: "hit" }, rng)).toEqual({ ok: false, error: "It is not your turn" });
    expect(applyAction(s, "Z", { type: "join", name: "Z" }, rng)).toMatchObject({ ok: false });
    const lobby = ok(applyAction(createGame(), "A", { type: "join", name: "A" }, rng));
    expect(applyAction(lobby, "A", { type: "start" }, rng)).toEqual({ ok: false, error: "Need at least 2 players" });
  });

  it("busts on a duplicate number and scores 0", () => {
    let s = game(3, [num(5), num(6), num(7), num(5)]);
    s = play(s, "A", { type: "hit" });
    expect(p(s, "A").status).toBe("busted");
    expect(s.current).toBe("B");
    s = play(s, "B", { type: "stay" });
    s = play(s, "C", { type: "stay" });
    expect(s.phase).toBe("roundOver");
    expect(s.players.map((x) => x.total)).toEqual([0, 6, 7]);
  });

  it("rotates the dealer each round", () => {
    let s = game(2, [num(1), num(2), num(3), num(4)]);
    s = play(play(s, "A", { type: "stay" }), "B", { type: "stay" });
    s = play(s, "A", { type: "nextRound" });
    expect(s.dealer).toBe(0);
    expect(values(p(s, "B").numbers)).toEqual([3]);
    expect(s.current).toBe("B");
  });

  it("shuffles the discard pile into the deck when it runs out", () => {
    let s = game(2, [num(1), num(2)]);
    s.discard = [num(9)];
    s = play(s, "A", { type: "hit" });
    expect(values(p(s, "A").numbers)).toEqual([1, 9]);
  });
});

describe("Draw 7", () => {
  it("ends the round immediately with a 15 point bonus", () => {
    let s = game(2, [num(1), num(9), mod("+4"), num(2), num(3), num(4), num(5), num(6), num(7)]);
    s = play(s, "A", { type: "hit" });
    s = play(s, "B", { type: "stay" });
    for (let i = 0; i < 6; i++) s = play(s, "A", { type: "hit" });
    expect(s.phase).toBe("roundOver");
    expect(p(s, "A").draw7).toBe(true);
    expect(p(s, "A").total).toBe(28 + 4 + 15);
    expect(p(s, "B").total).toBe(9);
  });
});

describe("action cards", () => {
  it("Freeze waits for the drawer to choose, and frozen players are skipped", () => {
    let s = game(3, [act("freeze"), num(3), num(4)]);
    expect(s.pending).toMatchObject({ kind: "freeze", chooser: "A", options: ["A", "B", "C"] });
    expect(awaiting(s)).toBe("A");
    s = play(s, "A", { type: "choose", target: "B" });
    expect(p(s, "B").status).toBe("frozen");
    expect(p(s, "B").numbers).toEqual([]);
    expect(values(p(s, "C").numbers)).toEqual([3]);
    expect(s.current).toBe("A");
  });

  it("Freeze targets the drawer when they are the only active player", () => {
    let s = game(2, [num(1), num(2), num(3), act("freeze")]);
    s = play(s, "A", { type: "hit" });
    s = play(s, "B", { type: "stay" });
    s = play(s, "A", { type: "hit" });
    expect(p(s, "A").status).toBe("frozen");
    expect(s.phase).toBe("roundOver");
    expect(p(s, "A").total).toBe(4);
  });

  it("Flip Three draws three cards and resolves actions drawn during it afterwards", () => {
    let s = game(2, [act("flipThree"), num(2), act("freeze"), num(4), num(5)]);
    s = play(s, "A", { type: "choose", target: "B" });
    expect(values(p(s, "B").numbers)).toEqual([2, 4]);
    expect(s.pending).toMatchObject({ kind: "freeze", chooser: "B" });
    s = play(s, "B", { type: "choose", target: "A" });
    expect(p(s, "A").status).toBe("frozen");
    expect(values(p(s, "B").numbers)).toEqual([2, 4, 5]);
    expect(s.current).toBe("B");
  });

  it("Flip Three stops on a bust and discards deferred actions", () => {
    let s = game(2, [act("flipThree"), num(3), act("freeze"), num(3), num(8)]);
    s = play(s, "A", { type: "choose", target: "B" });
    expect(p(s, "B").status).toBe("busted");
    expect(s.discard.some((c) => c.kind === "action" && c.action === "freeze")).toBe(true);
    expect(s.pending).toBeNull();
    expect(s.current).toBe("A");
    expect(s.deck).toHaveLength(1);
  });

  it("Second Chance discards a duplicate instead of busting", () => {
    let s = game(2, [act("secondChance"), num(6), num(7), num(7)]);
    s = play(s, "A", { type: "hit" });
    s = play(s, "B", { type: "stay" });
    s = play(s, "A", { type: "hit" });
    expect(p(s, "A").status).toBe("active");
    expect(p(s, "A").secondChance).toBeNull();
    expect(values(p(s, "A").numbers)).toEqual([7]);
    expect(s.discard).toHaveLength(2);
  });

  it("a second Second Chance must be given to an active player without one", () => {
    let s = game(3, [act("secondChance"), num(1), num(2), act("secondChance")]);
    s = play(s, "A", { type: "hit" });
    expect(s.pending).toMatchObject({ kind: "giveSecondChance", options: ["B", "C"] });
    s = play(s, "A", { type: "choose", target: "C" });
    expect(p(s, "C").secondChance).not.toBeNull();
    expect(s.current).toBe("B");
  });

  it("a spare Second Chance is discarded when nobody can take it", () => {
    let s = game(2, [act("secondChance"), act("secondChance"), act("secondChance")]);
    s = play(s, "A", { type: "hit" });
    expect(s.pending).toBeNull();
    expect(s.discard).toHaveLength(1);
  });
});

describe("game end", () => {
  it("ends when a single player reaches 200", () => {
    let s = game(2, [num(10), num(1)], [195, 0]);
    s = play(play(s, "A", { type: "stay" }), "B", { type: "stay" });
    expect(s.phase).toBe("gameOver");
    expect(s.winners).toEqual(["A"]);
    s = play(s, "B", { type: "newGame" });
    expect(s.phase).toBe("lobby");
    expect(s.players.map((x) => x.total)).toEqual([0, 0]);
    expect(s.champion).toBe("A");
    expect(s.streak).toBe(1);
  });

  it("counts consecutive wins and restarts the streak for a new champion", () => {
    const win = (s: GameState, totals: number[]) => {
      s.players.forEach((x, i) => (x.total = totals[i]));
      s = { ...s, phase: "roundOver", deck: [num(10), num(10)], round: 0, dealer: 1 };
      s = play(play(play(s, "A", { type: "nextRound" }), "A", { type: "stay" }), "B", { type: "stay" });
      expect(s.phase).toBe("gameOver");
      return play(s, "A", { type: "newGame" });
    };
    let s = game(2, [num(1), num(1)]);
    s = win(s, [195, 0]);
    s = win(s, [195, 0]);
    expect([s.champion, s.streak]).toEqual(["A", 2]);
    s = win(s, [0, 195]);
    expect([s.champion, s.streak]).toEqual(["B", 1]);
  });

  it("lets anyone start the next game, keeping only the listed players", () => {
    let s = game(3, [num(10), num(1), num(2)], [195, 0, 0]);
    s = play(play(play(s, "A", { type: "stay" }), "B", { type: "stay" }), "C", { type: "stay" });
    expect(s.phase).toBe("gameOver");
    expect(applyAction(s, "A", { type: "leave" }, rng)).toEqual({ ok: false, error: "The game is over" });
    s = play(s, "spectator", { type: "newGame", keep: ["B", "spectator"] });
    expect(s.phase).toBe("lobby");
    expect(s.players.map((x) => x.id)).toEqual(["B"]);
  });

  it("plays another round on a tie", () => {
    let s = game(2, [num(10), num(10)], [190, 190]);
    s = play(play(s, "A", { type: "stay" }), "B", { type: "stay" });
    expect(s.phase).toBe("roundOver");
  });
});

describe("forfeiting", () => {
  it("passes the turn on and discards the forfeiter's cards", () => {
    let s = game(3, [num(1), num(2), num(3)]);
    s = play(s, "A", { type: "leave" });
    expect(s.players.map((x) => x.id)).toEqual(["B", "C"]);
    expect(s.current).toBe("B");
    expect(values(s.discard)).toEqual([1]);
  });

  it("awards the game to the last player standing", () => {
    let s = game(2, [num(1), num(2)]);
    s = play(s, "B", { type: "leave" });
    expect(s.phase).toBe("gameOver");
    expect(s.winners).toEqual(["A"]);
    expect(s.champion).toBe("A");
  });

  it("discards an action card the forfeiter was choosing a target for", () => {
    let s = game(3, [act("freeze"), num(2), num(3)]);
    s = play(s, "A", { type: "leave" });
    expect(s.pending).toBeNull();
    expect(s.discard.some((c) => c.kind === "action")).toBe(true);
    expect(values(p(s, "B").numbers)).toEqual([2]);
    expect(s.current).toBe("B");
  });

  it("removes the forfeiter from someone else's choice, resolving it if one option is left", () => {
    let s = game(3, [num(1), num(2), num(3), act("freeze")]);
    s = play(play(s, "A", { type: "stay" }), "B", { type: "hit" });
    expect(s.pending).toMatchObject({ chooser: "B", options: ["B", "C"] });
    s = play(s, "C", { type: "leave" });
    expect(s.pending).toBeNull();
    expect(p(s, "B").status).toBe("frozen");
    expect(s.phase).toBe("roundOver");
  });
});

describe("autoAction", () => {
  it("stays on the absent player's turn and picks for their pending choice", () => {
    let s = game(2, [num(1), num(2)]);
    s = ok(autoAction(s, "A", rng));
    expect(p(s, "A").status).toBe("stayed");
    expect(autoAction(s, "A", rng).ok).toBe(false);

    s = game(2, [act("freeze"), num(2)]);
    s = ok(autoAction(s, "A", rng));
    expect(s.pending).toBeNull();
    expect(s.players.some((x) => x.status === "frozen")).toBe(true);
  });
});

describe("missed turns", () => {
  it("forfeits a player after three timeouts in a row", () => {
    let s = game(3, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(num));
    for (let missed = 0; missed < 3; ) {
      const who = awaiting(s);
      if (who === "A") {
        s = ok(autoAction(s, "A", rng));
        missed++;
      } else if (who) {
        s = play(s, who, { type: "stay" });
      } else {
        s = play(s, "B", { type: "nextRound" });
      }
    }
    expect(s.players.map((x) => x.id)).toEqual(["B", "C"]);
    expect(s.log).toContain("A missed 3 turns in a row");
  });

  it("resets the count when the player acts themselves", () => {
    let s = game(2, [num(1), num(2), num(3), num(4), num(5)]);
    s = ok(autoAction(s, "A", rng));
    s = play(s, "B", { type: "stay" });
    s = play(s, "A", { type: "nextRound" });
    expect(p(s, "A").missedTurns).toBe(0);
  });
});

describe("view", () => {
  it("hides the deck order", () => {
    const view = toView(game(2, [num(1), num(2), num(3)]));
    expect(view).not.toHaveProperty("deck");
    expect(view).not.toHaveProperty("tasks");
    expect(view.deckCount).toBe(1);
    expect(view.waitingOn).toBe("A");
  });
});

describe("random games", () => {
  function cardsInPlay(s: GameState): number {
    let n = s.deck.length + s.discard.length + (s.pending ? 1 : 0);
    for (const x of s.players) n += x.numbers.length + x.modifiers.length + (x.secondChance ? 1 : 0);
    for (const t of s.tasks) if (t.type === "resolveDeferred") n += t.cards.length;
    return n;
  }

  it("always finish and never lose or duplicate cards", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = seededRng(seed);
      let s = createGame();
      const ids = ["A", "B", "C", "D", "E", "F"].slice(0, 2 + (seed % 5));
      for (const id of ids) s = ok(applyAction(s, id, { type: "join", name: id }, r));
      s = ok(applyAction(s, "A", { type: "start" }, r));

      for (let step = 0; s.phase !== "gameOver"; step++) {
        expect(step).toBeLessThan(5000);
        const who = awaiting(s);
        let action: Action;
        if (!who) action = { type: "nextRound" };
        else if (s.pending) action = { type: "choose", target: s.pending.options[Math.floor(r() * s.pending.options.length)] };
        else action = { type: r() < 0.65 ? "hit" : "stay" };
        let actor = who ?? s.players[0].id;
        if (s.players.length > 2 && r() < 0.01) {
          actor = s.players[Math.floor(r() * s.players.length)].id;
          action = { type: "leave" };
        }
        s = ok(applyAction(s, actor, action, r));
        expect(cardsInPlay(s)).toBe(94);
      }
      expect(Math.max(...s.players.map((x) => x.total))).toBeGreaterThanOrEqual(200);
    }
  });
});
