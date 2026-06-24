<script>
  import { onMount, onDestroy } from "svelte";
  import TickerTape from "./TickerTape.svelte";
  import HomeDropdown from "./HomeDropdown.svelte";
  import VotePreview from "./VotePreview.svelte";
  import { onlineCount, votesLastHour } from "../lib/ws.js";

  export let isMobile = false;

  let activeListName = "";
  let showInfo = false;

  const sentences = [
    "Welcome to This or That. A pairwise ranking tool powered by the Elo algorithm.",
    "Today, your vote will make a difference. Will you answer the call?",
    "Every vote counts, and yours does too. Make your mark here, if you do nothing else all day.",
    "This may be your one and only chance to really show the world that your opinion matters.",
  ];

  let displayText = "";
  let sentenceIndex = 0;
  let typeTimer = null;
  let cycleTimer = null;

  function typeOut(text, onDone) {
    let i = 0;
    displayText = "";
    clearInterval(typeTimer);
    typeTimer = setInterval(() => {
      displayText = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(typeTimer);
        onDone?.();
      }
    }, 30);
  }

  function nextSentence() {
    typeOut(sentences[sentenceIndex], () => {
      cycleTimer = setTimeout(() => {
        sentenceIndex = (sentenceIndex + 1) % sentences.length;
        nextSentence();
      }, 10000);
    });
  }

  onMount(() => nextSentence());
  onDestroy(() => {
    clearInterval(typeTimer);
    clearTimeout(cycleTimer);
  });
</script>

{#if !isMobile}
  <TickerTape {isMobile} />
  <div class="desktop-layout">
    <div class="list-panel">
      <HomeDropdown
        on:activeList={(e) => (activeListName = e.detail.listName)}
      />
    </div>
    <div class="preview-panel">
      <div class="preview-top text-base">
        <span>{$votesLastHour} votes/hour</span>
        <span class="online"
          ><span class="online-dot"></span>{$onlineCount} online</span
        >
      </div>
      <div class="preview-middle">
        {#if !showInfo}<div class="text-top text-small">{displayText}</div>{/if}
        {#if showInfo}
          <div class="info-block text-small"
            >Voting uses the Elo rating system, the algorithm used to rank chess
            players. Every vote is a weighted matchup, not just a tally. Create
            your own list to settle the score. Designed and built by
            <a href="https://www.instagram.com/swl_at_gmail_dot_com/"
              >Shannon Lin.</a
            ></div
          >
        {:else}
          <VotePreview listName={activeListName} />
        {/if}
        <!-- <div class="text-bottom text-small"
          >click any list to start casting your vote</div
        > -->
      </div>
      <div class="preview-bottom text-base">
        <button class="bottom-link" on:click={() => (showInfo = !showInfo)}
          >{showInfo ? "Close" : "Info"}</button
        >
        <a
          class="follow-link bottom-link"
          href="https://www.instagram.com/this____or__that?utm_source=qr"
          target="_blank"
          rel="noopener noreferrer">Follow</a
        >
      </div>
    </div>
  </div>
{/if}

<style>
  .desktop-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: var(--spacing-sm);
  }

  .list-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .preview-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-sm);
  }

  .preview-top {
    /* background: var(--color-grey); */
    border-radius: var(--border-radius);
    padding: var(--spacing-margin);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    text-transform: uppercase;
  }

  .online {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .online-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-green);
    flex-shrink: 0;
  }

  .preview-middle {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 40px;
  }

  .text-top,
  .text-bottom {
    text-transform: uppercase;
    text-align: center;
    padding: 0 var(--spacing-margin);
  }

  .bottom-link {
    color: var(--color-black);
    text-decoration: underline;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-family);
    font-size: inherit;
    text-transform: uppercase;
    padding: 0;
  }

  .info-block {
    padding: 0 var(--spacing-margin);
    text-align: center;
    line-height: 1.6;
    text-transform: uppercase;
  }

  .preview-bottom {
    background: var(--color-lime);
    border-radius: var(--border-radius);
    padding: var(--spacing-margin);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    text-transform: uppercase;
  }
</style>
