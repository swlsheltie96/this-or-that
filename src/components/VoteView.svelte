<script>
  import { onMount, onDestroy } from "svelte";
  import { getPairForVoting, vote, getListInfo, navigate } from "../lib/api.js";

  export let listName = "";
  export let isMobile = false;

  let pairData = null;
  let listInfo = {};
  let loading = true;
  let voting = false;
  let error = null;
  let selectedItem = 0;
  let hoveredItem = 0;
  let mouseY = 0;
  let mouseX = 0;
  let imagesRowEl;
  let voteItem1El;
  let namesRowEl;
  let eloPopup = null; // { item: 1|2, delta: number }
  let winnerCountElo = null;
  let eloAnimTimer = null;
  const SVG_W = 140;
  const SVG_H = Math.round((SVG_W * 349) / 479);

  function handleMouseMove(e) {
    if (!imagesRowEl) return;
    const rect = imagesRowEl.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right) {
      hoveredItem = 0;
      return;
    }
    hoveredItem = e.clientX < rect.left + rect.width / 2 ? 1 : 2;
    mouseX = e.clientX;
    const raw = e.clientY - rect.top;
    const imgEl = voteItem1El?.querySelector("img, .img-empty");
    if (imgEl) {
      const imgRect = imgEl.getBoundingClientRect();
      const imgTop = imgRect.top - rect.top;
      const imgBottom = imgRect.bottom - rect.top;
      mouseY = Math.max(imgTop, Math.min(raw, imgBottom));
    } else {
      mouseY = Math.max(SVG_W / 2, Math.min(raw, rect.height - SVG_W / 2));
    }
  }

  $: arrowStyle = (() => {
    if (!hoveredItem || selectedItem !== 0) return "display: none";
    const rotation = hoveredItem === 1 ? -90 : 90;
    const transform = `transform: rotate(${rotation}deg); transform-origin: 50% 100%;`;
    if (imagesRowEl && voteItem1El) {
      const rowRect = imagesRowEl.getBoundingClientRect();
      const imgEl = voteItem1El.querySelector("img, .img-empty");
      if (imgEl) {
        const imgRect = imgEl.getBoundingClientRect();
        const centerX = rowRect.left + rowRect.width / 2;
        const gap = centerX - imgRect.right;
        if (gap < SVG_H) {
          const targetX =
            hoveredItem === 1
              ? rowRect.left + rowRect.width / 4
              : rowRect.left + (rowRect.width * 3) / 4;
          const bottomOffset = namesRowEl
            ? namesRowEl.getBoundingClientRect().height
            : 0;
          return `position: fixed; left: ${targetX - SVG_W / 2}px; bottom: ${bottomOffset}px;`;
        }
      }
    }
    const top = mouseY - SVG_H;
    return `left: calc(50% - ${SVG_W / 2}px); top: ${top}px; ${transform}`;
  })();

  async function loadPair() {
    try {
      loading = true;
      error = null;
      const [pair, info] = await Promise.all([
        getPairForVoting(listName),
        getListInfo(listName),
      ]);
      pairData = {
        item1: {
          ...pair.item1,
          data: pair.item1.data ? JSON.parse(pair.item1.data) : {},
          elo: pair.item1.elo ?? 1000,
        },
        item2: {
          ...pair.item2,
          data: pair.item2.data ? JSON.parse(pair.item2.data) : {},
          elo: pair.item2.elo ?? 1000,
        },
      };
      listInfo = info || {};
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function animateWinnerElo(from, to) {
    if (eloAnimTimer) clearInterval(eloAnimTimer);
    const steps = 16;
    const duration = 380;
    const stepTime = duration / steps;
    let step = 0;
    winnerCountElo = Math.round(from);
    eloAnimTimer = setInterval(() => {
      step++;
      if (step >= steps) {
        winnerCountElo = Math.round(to);
        clearInterval(eloAnimTimer);
        eloAnimTimer = null;
      } else {
        winnerCountElo = Math.round(from + (to - from) * (step / steps));
      }
    }, stepTime);
  }

  function calcDelta(winnerElo, loserElo) {
    const K = 32;
    const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    return Math.round(K * (1 - expected));
  }

  async function castVote(winner, loser, item) {
    if (voting) return;
    voting = true;
    selectedItem = item;
    const winnerElo = item === 1 ? pairData.item1.elo : pairData.item2.elo;
    const loserElo = item === 1 ? pairData.item2.elo : pairData.item1.elo;
    const delta = calcDelta(winnerElo, loserElo);
    eloPopup = { item, delta };
    animateWinnerElo(winnerElo, winnerElo + delta);
    setTimeout(() => {
      eloPopup = null;
    }, 1000);
    try {
      await new Promise((r) => setTimeout(r, 700));
      await vote(listName, winner, loser);
      selectedItem = 0;
      eloPopup = null;
      winnerCountElo = null;
      await loadPair();
    } catch (e) {
      error = e.message;
      selectedItem = 0;
      winnerCountElo = null;
    } finally {
      voting = false;
    }
  }

  function handleKeydown(e) {
    if (voting || !pairData) return;
    if (e.key === "1" || e.key === "ArrowLeft") {
      castVote(pairData.item1.name, pairData.item2.name, 1);
    } else if (e.key === "2" || e.key === "ArrowRight") {
      castVote(pairData.item2.name, pairData.item1.name, 2);
    }
  }

  function navigateToList() {
    navigate(`/?view=listview&listName=${encodeURIComponent(listName)}`);
  }

  onMount(() => {
    loadPair();
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("mousemove", handleMouseMove);
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
    window.removeEventListener("mousemove", handleMouseMove);
    if (eloAnimTimer) clearInterval(eloAnimTimer);
  });
</script>

{#if loading}
  <!-- <p class="text-base">Loading...</p> -->
{:else if error}
  <p class="text-base">{error}</p>
{:else if pairData}
  <div class="vote-container" class:mobile={isMobile}>
    <div class="images-row" bind:this={imagesRowEl}>
      <div
        class="vote-item vote-item-1"
        class:disabled={voting}
        class:selected={selectedItem === 1}
        class:loser={selectedItem === 2}
        bind:this={voteItem1El}
        role="button"
        tabindex="0"
        on:click={() => castVote(pairData.item1.name, pairData.item2.name, 1)}
        on:keydown={(e) =>
          e.key === "Enter" &&
          castVote(pairData.item1.name, pairData.item2.name, 1)}
      >
        {#if pairData.item1.data?.picture}
          <img src={pairData.item1.data.picture} alt={pairData.item1.name} />
        {:else}
          <div class="img-empty"></div>
        {/if}
      </div>
      <div class="mobile-names-row">
        <div class="name text-base">
          {selectedItem !== 0
            ? selectedItem === 1
              ? (winnerCountElo ?? Math.round(pairData.item1.elo))
              : Math.round(pairData.item1.elo)
            : pairData.item1.name}
          {#if eloPopup?.item === 1}
            <span class="elo-popup text-base">+{eloPopup.delta}</span>
          {/if}
        </div>
        <div class="or text-base">or</div>
        <div class="name text-base">
          {selectedItem !== 0
            ? selectedItem === 2
              ? (winnerCountElo ?? Math.round(pairData.item2.elo))
              : Math.round(pairData.item2.elo)
            : pairData.item2.name}
          {#if eloPopup?.item === 2}
            <span class="elo-popup text-base">+{eloPopup.delta}</span>
          {/if}
        </div>
      </div>

      <div
        class="vote-item vote-item-2"
        class:disabled={voting}
        class:selected={selectedItem === 2}
        class:loser={selectedItem === 1}
        role="button"
        tabindex="0"
        on:click={() => castVote(pairData.item2.name, pairData.item1.name, 2)}
        on:keydown={(e) =>
          e.key === "Enter" &&
          castVote(pairData.item2.name, pairData.item1.name, 2)}
      >
        {#if pairData.item2.data?.picture}
          <img src={pairData.item2.data.picture} alt={pairData.item2.name} />
        {:else}
          <div class="img-empty"></div>
        {/if}
      </div>

      <div class="arrow" style={arrowStyle}>
        <svg
          width={SVG_W}
          height={SVG_H}
          viewBox="0 0 479 349"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M239.5 0L446.913 172.5H32.0869L239.5 0Z" fill="black" />
          <rect x="122" y="171" width="234" height="178" fill="black" />
        </svg>
      </div>
    </div>

    <div class="names-row" bind:this={namesRowEl}>
      <div
        class="name text-base"
        class:hovered={hoveredItem === 1 && selectedItem === 0}
      >
        {selectedItem !== 0
          ? selectedItem === 1
            ? (winnerCountElo ?? Math.round(pairData.item1.elo))
            : Math.round(pairData.item1.elo)
          : pairData.item1.name}
        {#if eloPopup?.item === 1}
          <span class="elo-popup text-base">+{eloPopup.delta}</span>
        {/if}
      </div>
      <div class="or text-base">or</div>
      <div
        class="name text-base"
        class:hovered={hoveredItem === 2 && selectedItem === 0}
      >
        {selectedItem !== 0
          ? selectedItem === 2
            ? (winnerCountElo ?? Math.round(pairData.item2.elo))
            : Math.round(pairData.item2.elo)
          : pairData.item2.name}
        {#if eloPopup?.item === 2}
          <span class="elo-popup text-base">+{eloPopup.delta}</span>
        {/if}
      </div>
    </div>
  </div>
  <button
    class="view-list text-base"
    class:mobile={isMobile}
    on:click={navigateToList}>Results</button
  >
{/if}

<style>
  .view-list {
    position: fixed;
    top: 20px;
    right: 0;

    cursor: pointer;
    box-sizing: border-box;
    text-transform: uppercase;
    padding: 8px 8px 6px 8px;
    margin: -10px;
    line-height: 1;
    margin-right: 20px;
    z-index: 2;
  }
  .mobile.view-list {
    position: relative;
    top: unset;
    right: unset;
    margin: unset;
    margin-bottom: 20px;
  }
  .vote-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex: 1;
    min-height: 0;
  }

  .images-row {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .names-row {
    display: flex;
    align-items: center;
    margin: 20px 0;
  }

  .name {
    flex: 1;
    text-align: center;
    text-transform: uppercase;
  }

  .name.hovered {
    text-decoration: underline;
  }

  .name {
    position: relative;
  }

  .elo-popup {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    animation: floatUp 1s ease-out forwards;
    white-space: nowrap;
  }

  @keyframes floatUp {
    0% {
      opacity: 1;
      bottom: 1.5rem;
    }
    100% {
      opacity: 0;
      bottom: calc(1.5rem + 2em);
    }
  }

  .or {
    flex-shrink: 0;
    padding: 0 var(--spacing-md);
    text-align: center;
    text-transform: uppercase;
  }

  .vote-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    overflow: hidden;
  }

  .vote-item.disabled {
    cursor: default;
  }

  .vote-item img,
  .img-empty {
    width: 100%;
    aspect-ratio: 1/1;
    object-fit: cover;
    max-width: 20rem;
    transition:
      transform 0.35s ease,
      filter 0.35s ease;
    transform-origin: center center;
  }

  .vote-item.selected img,
  .vote-item.selected .img-empty {
    transform: scale(4);
  }

  .vote-item.loser img,
  .vote-item.loser .img-empty {
    transform: scale(0.9);
    filter: grayscale(1);
  }

  .arrow {
    position: absolute;
    pointer-events: none;
    line-height: 0;
    transition:
      left 0.3s ease,
      top 0.3s ease,
      bottom 0.3s ease;
  }

  .arrow svg {
    display: block;
  }

  .mobile-names-row {
    display: none;
  }

  .mobile .images-row {
    flex-direction: column;
  }
  .mobile .mobile-names-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    /* margin: 20px 0; */
  }
  .mobile .names-row {
    display: none;
  }
  .mobile .arrow {
    display: none;
  }
</style>
