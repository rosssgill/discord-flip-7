<script lang="ts" module>
  const SEEN_KEY = "rulesSeen";

  function seenRules(): boolean {
    try {
      return localStorage.getItem(SEEN_KEY) === "true";
    } catch {
      return false;
    }
  }

  function markRulesSeen() {
    try {
      localStorage.setItem(SEEN_KEY, "true");
    } catch {
      // Storage can be blocked inside iframes; the tutorial then shows once per session.
    }
  }

  // Module-level so the tutorial opens once even though the lobby and table each mount this.
  let autoOpened = false;
</script>

<script lang="ts">
  import BookOpenIcon from "@lucide/svelte/icons/book-open";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import type { Card as CardData } from "../../game/cards";
  import { DRAW_7_BONUS, WINNING_SCORE } from "../../game/scoring";
  import Card from "./Card.svelte";

  const number = (value: number, id = value): CardData => ({
    id,
    kind: "number",
    value,
  });

  const steps: {
    title: string;
    body: string[];
    cards: CardData[];
  }[] = [
    {
      title: `Race to ${WINNING_SCORE}`,
      body: [
        "On your turn, Hit to flip a card or Stay to bank the points in front of you.",
        `Rounds add up. The first player to ${WINNING_SCORE} wins.`,
      ],
      cards: [number(5), number(9), number(12)],
    },
    {
      title: "Don't flip a duplicate",
      body: [
        "Flip a number you already have and you bust, scoring nothing this round.",
        "Big numbers are riskier: there are twelve 12s but only one 1.",
      ],
      cards: [number(8), number(8, 108)],
    },
    {
      title: "Draw 7",
      body: [
        `Collect 7 different numbers to end the round on the spot and score a ${DRAW_7_BONUS}-point bonus.`,
      ],
      cards: [0, 1, 2, 3, 4, 5, 6].map((value) => number(value)),
    },
    {
      title: "Modifiers",
      body: [
        "+2 to +10 add to your score. x2 doubles your numbers, but not the other modifiers.",
        "Modifiers never bust you.",
      ],
      cards: [
        { id: 201, kind: "modifier", modifier: "+4" },
        { id: 202, kind: "modifier", modifier: "x2" },
      ],
    },
    {
      title: "Action cards",
      body: [
        "Freeze: pick a player still in the round. They bank their points and sit out.",
        "Flip Three: pick a player who must flip three cards in a row.",
        "Second Chance: keep it to cancel one duplicate. Already holding one? Give it away.",
      ],
      cards: [
        { id: 301, kind: "action", action: "freeze" },
        { id: 302, kind: "action", action: "flipThree" },
        { id: 303, kind: "action", action: "secondChance" },
      ],
    },
  ];

  let open = $state(false);
  let step = $state(0);
  const current = $derived(steps[step]);
  const last = $derived(step === steps.length - 1);

  if (!autoOpened && !seenRules()) {
    autoOpened = true;
    open = true;
  }

  function onOpenChange(next: boolean) {
    if (next) step = 0;
    else markRulesSeen();
  }
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" size="icon" aria-label="Rules">
        <BookOpenIcon />
      </Button>
    {/snippet}
  </Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{current.title}</Dialog.Title>
      <Dialog.Description>Step {step + 1} of {steps.length}</Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-wrap justify-center gap-1.5">
      {#each current.cards as card (card.id)}
        <Card {card} />
      {/each}
    </div>
    <div class="flex flex-col gap-2">
      {#each current.body as line (line)}
        <p>{line}</p>
      {/each}
    </div>
    <Dialog.Footer>
      {#if step > 0}
        <Button variant="outline" onclick={() => step--}>Back</Button>
      {/if}
      {#if last}
        <Dialog.Close>
          {#snippet child({ props })}
            <Button {...props}>Let's play</Button>
          {/snippet}
        </Dialog.Close>
      {:else}
        <Button onclick={() => step++}>Next</Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
