<script>
  import { onMount, onDestroy } from "svelte";
  import {
    getPairForVoting,
    vote,
    getListInfo,
    getListsWithPopularity,
    navigate,
  } from "../lib/api.js";

  export let listName = "";
  export let isMobile = false;

  let pairData = null;
  let listInfo = {};
  let loading = true;
  let allLists = [];
  let showDropdown = false;
  let dropdownTop = 0;
  let mobileHeaderEl;
  let voting = false;
  let error = null;
  let selectedItem = 0;
  let hoveredItem = 0;
  let mouseY = 0;
  let mouseX = 0;
  let imagesRowEl;
  let voteItem1El;
  let voteItem2El;
  let namesRowEl;
  let eloPopup = null; // { item: 1|2, delta: number }
  let winnerCountElo = null;
  let eloAnimTimer = null;
  let arrowCurrentPx = null;
  let gyroSetup = false;
  let betaAngle = null;
  let rafId = null;
  let mobileHoveredItem = 0;
  let voteItemSize = null;
  let hoverProgress = 0;
  let hoverStartTime = null;
  const SVG_W = 140;
  const SVG_H = Math.round((SVG_W * 350) / 400);
  let mobileSvgH = 60;
  $: mobileSvgW = Math.round((mobileSvgH * 400) / 350);

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

  $: mobileArrowStyle = `position: fixed; bottom: 20px; left: ${arrowCurrentPx ?? window.innerWidth / 2}px; transform: translateX(-50%); pointer-events: none; z-index: 10;`;

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

  function handleOrientation(e) {
    betaAngle = Math.round(e.gamma ?? 0);
  }

  function smoothTick() {
    const img1 = voteItem1El?.querySelector("img, .img-empty");
    const img2 = voteItem2El?.querySelector("img, .img-empty");
    if (img1 && img2) {
      if (voteItemSize === null) {
        const c = voteItem1El.getBoundingClientRect();
        if (c.width > 0 && c.height > 0)
          voteItemSize = Math.min(c.width, c.height);
      }
      const r1 = img1.getBoundingClientRect();
      const r2 = img2.getBoundingClientRect();
      const leftSnap = r1.left + r1.width / 2;
      const rightSnap = r2.left + r2.width / 2;
      const midSnap = (leftSnap + rightSnap) / 2;

      const target =
        betaAngle !== null && betaAngle < -30
          ? leftSnap
          : betaAngle !== null && betaAngle > 30
            ? rightSnap
            : midSnap;

      if (arrowCurrentPx === null) arrowCurrentPx = target;
      arrowCurrentPx += (target - arrowCurrentPx) * 0.12;

      if (arrowCurrentPx >= r1.left && arrowCurrentPx <= r1.right) {
        mobileHoveredItem = 1;
      } else if (arrowCurrentPx >= r2.left && arrowCurrentPx <= r2.right) {
        mobileHoveredItem = 2;
      } else {
        mobileHoveredItem = 0;
      }

      if (mobileHoveredItem !== 0 && !voting && pairData) {
        if (hoverStartTime === null) hoverStartTime = performance.now();
        hoverProgress = Math.min(
          1,
          (performance.now() - hoverStartTime) / 3000,
        );
        if (hoverProgress >= 1) {
          hoverProgress = 0;
          hoverStartTime = null;
          if (mobileHoveredItem === 1)
            castVote(pairData.item1.name, pairData.item2.name, 1);
          else castVote(pairData.item2.name, pairData.item1.name, 2);
        }
      } else {
        hoverStartTime = null;
        hoverProgress = 0;
      }
    }
    rafId = requestAnimationFrame(smoothTick);
  }

  function setupGyro() {
    if (gyroSetup) return;
    gyroSetup = true;
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      DeviceOrientationEvent.requestPermission()
        .then((state) => {
          if (state === "granted")
            window.addEventListener("deviceorientation", handleOrientation);
        })
        .catch(() => {});
    } else {
      window.addEventListener("deviceorientation", handleOrientation);
    }
  }

  function navigateToList() {
    navigate(`/?view=listview&listName=${encodeURIComponent(listName)}`);
  }

  onMount(async () => {
    loadPair();
    try {
      const response = await getListsWithPopularity();
      allLists = response.lists || [];
    } catch (e) {}
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("mousemove", handleMouseMove);
    if (isMobile) smoothTick();
    if (isMobile) {
      if (
        typeof DeviceOrientationEvent === "undefined" ||
        typeof DeviceOrientationEvent.requestPermission !== "function"
      ) {
        setupGyro();
      }
    }
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("deviceorientation", handleOrientation);
    if (eloAnimTimer) clearInterval(eloAnimTimer);
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

{#if isMobile}
  <div class="mobile-header" bind:this={mobileHeaderEl}>
    <button class="text-small" on:click={() => navigate("/")}>Main</button>
    <div
      class="mobile-header-title text-small"
      on:click={() => {
        dropdownTop = mobileHeaderEl.getBoundingClientRect().bottom;
        showDropdown = !showDropdown;
      }}
    >
      {listName} ▾
    </div>
    <button
      class="text-small"
      on:click={() =>
        navigate(`/?view=listview&listName=${encodeURIComponent(listName)}`)}
      >View</button
    >
  </div>
  {#if showDropdown}
    <div class="list-dropdown" style="top: {dropdownTop}px">
      <div
        class="dropdown-item dropdown-home text-small"
        on:click={() => {
          showDropdown = false;
          navigate("/");
        }}
      >
        <span>This</span><span>or</span><span>That</span>
      </div>
      {#each allLists as list}
        <div
          class="dropdown-item text-base"
          class:active={list.name === listName}
          on:click={() => {
            showDropdown = false;
            navigate(`/?view=vote&listName=${encodeURIComponent(list.name)}`);
          }}
        >
          {list.name}
        </div>
      {/each}
    </div>
  {/if}
{/if}

{#if loading}
  <!-- <p class="text-base">Loading...</p> -->
{:else if error}
  <p class="text-base">{error}</p>
{:else if pairData}
  <div class="vote-container" class:mobile={isMobile}>
    <div class="images-row" bind:this={imagesRowEl}>
      <div class="vote-side">
        <div
          class="text-base mobile-name mobile-name-1"
          class:hovered={mobileHoveredItem === 1}
        >
          <span
            class="name-inner"
            style={isMobile && mobileHoveredItem === 1
              ? `background-size:${hoverProgress * 100}% 100%`
              : ""}
          >
            {selectedItem !== 0
              ? selectedItem === 1
                ? (winnerCountElo ?? Math.round(pairData.item1.elo))
                : Math.round(pairData.item1.elo)
              : pairData.item1.name}
            {#if eloPopup?.item === 1}
              <span class="elo-popup text-base">+{eloPopup.delta}</span>
            {/if}
          </span>
        </div>

        <div
          class="vote-item vote-item-1"
          class:disabled={voting}
          class:selected={selectedItem === 1}
          class:loser={selectedItem === 2}
          bind:this={voteItem1El}
          role="button"
          tabindex="0"
          on:click={() => {
            setupGyro();
            castVote(pairData.item1.name, pairData.item2.name, 1);
          }}
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
      </div>

      <div class="mobile-or text-base">or</div>

      <div class="vote-side">
        <div
          class="text-base mobile-name mobile-name-2"
          class:hovered={mobileHoveredItem === 2}
        >
          <span
            class="name-inner"
            style={isMobile && mobileHoveredItem === 2
              ? `background-size:${hoverProgress * 100}% 100%`
              : ""}
          >
            {selectedItem !== 0
              ? selectedItem === 2
                ? (winnerCountElo ?? Math.round(pairData.item2.elo))
                : Math.round(pairData.item2.elo)
              : pairData.item2.name}
            {#if eloPopup?.item === 2}
              <span class="elo-popup text-base">+{eloPopup.delta}</span>
            {/if}
          </span>
        </div>

        <div
          class="vote-item vote-item-2"
          class:disabled={voting}
          class:selected={selectedItem === 2}
          class:loser={selectedItem === 1}
          bind:this={voteItem2El}
          style={isMobile && voteItemSize
            ? `width:${voteItemSize}px;height:${voteItemSize}px;flex:none`
            : undefined}
          role="button"
          tabindex="0"
          on:click={() => {
            setupGyro();
            castVote(pairData.item2.name, pairData.item1.name, 2);
          }}
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
      </div>

      <div class="arrow" style={isMobile ? mobileArrowStyle : arrowStyle}>
        <svg
          width={isMobile ? mobileSvgW : SVG_W}
          height={isMobile ? mobileSvgH : SVG_H}
          viewBox="0 0 400 350"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M200 0L400 172.994H0L200 0Z" fill="black" />
          <path d="M86.6995 171.49H312.336V350H86.6995V171.49Z" fill="black" />
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
    class="view-list {isMobile ? 'text-small' : 'text-base'}"
    class:mobile={isMobile}
    on:click={navigateToList}
    >{listName} Rankings{betaAngle !== null ? ` ${betaAngle}` : ""}</button
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
    /* padding: 8px 8px 6px 8px; */
    /* margin: -10px; */
    line-height: 1;
    /* margin-right: 20px; */
    z-index: 2;
  }
  .mobile.view-list {
    display: none;
  }

  .mobile-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--color-white);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) 0;
    border-bottom: var(--border);
  }

  .mobile-header-title {
    text-transform: uppercase;
    cursor: pointer;
    flex: 1;
    text-align: center;
  }

  .list-dropdown {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--color-white);
    z-index: 100;
    overflow-y: auto;
    animation: slideDown 0.2s ease;
  }

  @keyframes slideDown {
    from {
      transform: translateY(-8px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .dropdown-item {
    padding: var(--spacing-md) var(--spacing-margin);
    cursor: pointer;
    text-transform: uppercase;
    position: relative;
  }

  .dropdown-item::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: var(--spacing-margin);
    right: var(--spacing-margin);
    border-bottom: var(--border);
  }

  .dropdown-item.active {
    text-decoration: underline;
  }

  .dropdown-home {
    padding-bottom: var(--spacing-xlg);
    padding-top: var(--spacing-xlg);
    display: flex;
    justify-content: space-between;
  }
  .vote-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex: 1;
    min-height: 0;
  }
  .mobile.vote-container {
    padding-bottom: var(--spacing-lg);
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
  /* .elo-popup-test {
    animation: unset;
  } */

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
    transform: scale(2);
  }

  .vote-item.loser img,
  .vote-item.loser .img-empty {
    /* transform: scale(0.5); */
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
  .mobile .arrow svg {
    transform: none;
  }
  .mobile-or {
    display: none;
  }

  .mobile .mobile-or {
    display: flex;
    align-items: center;
    text-align: center;
    text-transform: uppercase;
    padding: 0 var(--spacing-sm);
    flex-shrink: 0;
  }

  .mobile-name {
    display: none;
  }

  .mobile .images-row {
    flex-direction: row;
    align-items: stretch;
  }

  .vote-side {
    display: none;
  }

  .mobile .vote-side {
    display: flex;
    flex-direction: column-reverse;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .mobile .mobile-name {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--spacing-sm) 0;
  }

  .mobile .mobile-name.hovered {
    text-decoration: underline;
  }
  .mobile .names-row {
    display: none;
  }

  .mobile .name-inner {
    position: relative;
    display: inline-block;
    background: linear-gradient(rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.12))
      no-repeat left center;
    background-size: 0% 100%;
  }

  .mobile .elo-popup {
    position: absolute;
    left: 100%;
    top: 50%;
    bottom: auto;
    margin-left: 0.3em;
    transform: translateY(-50%);
    animation: slideRight 1s ease-out forwards;
  }
  .mobile .vote-item {
    flex: 1;
    width: 100%;
    box-sizing: border-box;
    min-height: 0;
    max-width: 100%;
  }

  .mobile .vote-item {
    border: 1px solid var(--color-grey);
    border-radius: 4px;
    padding: var(--spacing-lg);
  }

  .mobile .vote-item img,
  .mobile .vote-item .img-empty {
    width: 100%;
    height: 100%;
    max-width: unset;
    aspect-ratio: unset;
    object-fit: contain;
  }

  @keyframes slideRight {
    0% {
      opacity: 1;
      transform: translateX(0) translateY(-50%);
    }
    100% {
      opacity: 0;
      transform: translateX(2em) translateY(-50%);
    }
  }
</style>
