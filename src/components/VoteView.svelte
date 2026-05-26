<script>
  import { onMount, onDestroy } from "svelte";
  import {
    getPairForVoting,
    vote,
    getListInfo,
    getSortedList,
    getEloHistory,
    navigate,
  } from "../lib/api.js";
  import { joinList, sendComment, chatMessages, chatName, newCommentEvent } from "../lib/ws.js";
  import Header from "./Header.svelte";
  import HomeDropdown from "./HomeDropdown.svelte";
  import GridItem from "./GridItem.svelte";
  import ListViewItem from "./ListViewItem.svelte";

  export let listName = "";
  export let isMobile = false;

  let pairData = null;
  let listInfo = {};
  let loading = true;
  let voting = false;
  let showDropdown = false;
  let viewMode = "vote"; // "vote" | "grid" | "list"
  let rankedItems = [];
  let topItemIndex = 0;
  let itemEls = [];
  let gridScrollEl;

  $: topItemName = rankedItems[topItemIndex]?.name ?? "";
  let hoveredItemName = "";
  $: gridHeaderName = isMobile
    ? topItemName
    : hoveredItemName || rankedItems[0]?.name || "";

  let historyCache = new Map();
  let itemHistory = [];
  let gridHeaderHeight = 0;

  $: recentDelta =
    itemHistory.length >= 2
      ? Math.round(
          itemHistory[itemHistory.length - 1].rating -
            itemHistory[itemHistory.length - 2].rating,
        )
      : null;

  $: sparkPoints = (() => {
    if (itemHistory.length < 2) return "";
    const W = 120;
    const H = (gridHeaderHeight - 6) || 18;
    const ratings = itemHistory.map((h) => h.rating);
    const min = Math.min(...ratings);
    const max = Math.max(...ratings);
    const range = max - min || 1;
    return ratings
      .map((r, i) => {
        const x = (i / (ratings.length - 1)) * W;
        const y = H - ((r - min) / range) * H;
        return `${x},${y}`;
      })
      .join(" ");
  })();

  async function loadItemHistory(name) {
    if (!name) {
      itemHistory = [];
      return;
    }
    if (historyCache.has(name)) {
      itemHistory = historyCache.get(name);
      return;
    }
    try {
      const res = await getEloHistory(listName, name);
      const h = res.history || [];
      historyCache.set(name, h);
      itemHistory = h;
    } catch (e) {
      itemHistory = [];
    }
  }

  $: loadItemHistory(gridHeaderName);

  function timeAgo(ts) {
    if (!ts) return "—";
    const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return "—";
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    if (mins < 10080) return `${Math.floor(mins / 1440)}d`;
    return `${Math.floor(mins / 10080)}w`;
  }

  function handleGridScroll() {
    if (!gridScrollEl || rankedItems.length === 0) return;
    const { scrollTop, scrollHeight, clientHeight } = gridScrollEl;
    const scrollable = scrollHeight - clientHeight;
    if (viewMode === "grid" && scrollable > 0) {
      topItemIndex = Math.round(
        (scrollTop / scrollable) * (rankedItems.length - 1),
      );
    } else {
      if (scrollTop + clientHeight >= scrollHeight - 5) {
        topItemIndex = rankedItems.length - 1;
        return;
      }
      const containerTop = gridScrollEl.getBoundingClientRect().top;
      let closestIdx = 0;
      let closestDist = Infinity;
      itemEls.forEach((el, i) => {
        if (!el) return;
        const dist = Math.abs(el.getBoundingClientRect().top - containerTop);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      });
      topItemIndex = closestIdx;
    }
  }

  async function loadRankings() {
    try {
      topItemIndex = 0;
      const res = await getSortedList(listName);
      rankedItems = (res || []).map((item, i) => ({ ...item, rank: i + 1 }));
      if (!isMobile) hoveredItemName = rankedItems[0]?.name ?? "";
    } catch (e) {}
  }

  function toggleView() {
    if (viewMode === "vote") {
      viewMode = "grid";
      loadRankings();
    } else if (viewMode === "grid") {
      viewMode = "list";
    } else {
      viewMode = "grid";
    }
  }

  $: viewButtonLabel =
    viewMode === "grid" ? "Grid" : viewMode === "list" ? "List" : "View";

  let prevListName = listName;
  $: if (listName !== prevListName) {
    prevListName = listName;
    prefetchedPairData = null;
    showDropdown = false;
    historyCache = new Map();
    itemHistory = [];
    unreadCount = 0;
    joinList(listName);
    loadPair();
    if (viewMode !== "vote") loadRankings();
  }

  let showComments = false;
  let commentText = "";
  let editingName = false;
  let messagesEl;
  let unreadCount = 0;
  let prevEventCount = 0;

  $: if (showComments && listName) joinList(listName);
  $: if (showComments) unreadCount = 0;

  function scrollToBottom() {
    if (messagesEl) requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
  }

  const unsubMessages = chatMessages.subscribe(() => scrollToBottom());

  const unsubNewComment = newCommentEvent.subscribe((count) => {
    if (!showComments && count > prevEventCount) {
      unreadCount += count - prevEventCount;
    }
    prevEventCount = count;
  });

  let _chatName = "";
  chatName.subscribe((v) => (_chatName = v));

  function submitComment() {
    const text = commentText.trim();
    if (!text) return;
    sendComment(listName, _chatName, text);
    commentText = "";
  }

  let prefetchedPairData = null;

  function parsePairData(pair) {
    return {
      item1: { ...pair.item1, data: pair.item1.data ? JSON.parse(pair.item1.data) : {}, elo: pair.item1.elo ?? 1000 },
      item2: { ...pair.item2, data: pair.item2.data ? JSON.parse(pair.item2.data) : {}, elo: pair.item2.elo ?? 1000 },
    };
  }

  async function prefetchNextPair() {
    try {
      const data = await getPairForVoting(listName);
      prefetchedPairData = parsePairData(data);
      if (prefetchedPairData.item1.data?.picture) new Image().src = prefetchedPairData.item1.data.picture;
      if (prefetchedPairData.item2.data?.picture) new Image().src = prefetchedPairData.item2.data.picture;
    } catch {}
  }

  let error = null;
  let selectedItem = 0;
  let hoveredItem = 0;
  let eloPopup = null;
  let winnerCountElo = null;
  let loserCountElo = null;
  let eloAnimTimer = null;
  let loserAnimTimer = null;

  async function loadPair() {
    error = null;
    if (prefetchedPairData) {
      pairData = prefetchedPairData;
      prefetchedPairData = null;
      loading = false;
      getListInfo(listName).then(info => { listInfo = info || {}; }).catch(() => {});
    } else {
      loading = true;
      try {
        const [pair, info] = await Promise.all([getPairForVoting(listName), getListInfo(listName)]);
        pairData = parsePairData(pair);
        listInfo = info || {};
      } catch (e) {
        error = e.message;
      } finally {
        loading = false;
      }
    }
    prefetchNextPair();
  }

  function animateElo(from, to, onUpdate, timerRef, setTimer) {
    if (timerRef) clearInterval(timerRef);
    const steps = 16;
    const stepTime = 380 / steps;
    let step = 0;
    onUpdate(Math.round(from));
    const t = setInterval(() => {
      step++;
      if (step >= steps) {
        onUpdate(Math.round(to));
        clearInterval(t);
        setTimer(null);
      } else {
        onUpdate(Math.round(from + (to - from) * (step / steps)));
      }
    }, stepTime);
    setTimer(t);
  }

  function animateWinnerElo(from, to) {
    animateElo(
      from,
      to,
      (v) => (winnerCountElo = v),
      eloAnimTimer,
      (t) => (eloAnimTimer = t),
    );
  }

  function animateLoserElo(from, to) {
    animateElo(
      from,
      to,
      (v) => (loserCountElo = v),
      loserAnimTimer,
      (t) => (loserAnimTimer = t),
    );
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
    animateLoserElo(loserElo, loserElo - delta);
    setTimeout(() => {
      eloPopup = null;
    }, 1000);
    try {
      await new Promise((r) => setTimeout(r, 700));
      await vote(listName, winner, loser);
      selectedItem = 0;
      eloPopup = null;
      winnerCountElo = null;
      loserCountElo = null;
      await loadPair();
    } catch (e) {
      error = e.message;
      selectedItem = 0;
      winnerCountElo = null;
      loserCountElo = null;
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

  function navigateToEdit() {
    navigate(`/?view=edit&listName=${encodeURIComponent(listName)}`);
  }

  onMount(async () => {
    joinList(listName);
    loadPair();
    window.addEventListener("keydown", handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
    if (eloAnimTimer) clearInterval(eloAnimTimer);
    if (loserAnimTimer) clearInterval(loserAnimTimer);
    unsubMessages();
    unsubNewComment();
  });
</script>

{#if !showDropdown && viewMode !== "vote"}
  <button class="edit-fab text-small" on:click={navigateToEdit}>Edit</button>
{/if}

{#if showDropdown}
  <div class="dropdown-overlay">
    <Header />
    <div class="list-name-bar no-border">
      <button
        class="text-small"
        class:active={viewMode === "vote"}
        on:click={() => {
          viewMode = "vote";
          showDropdown = false;
        }}>Vote</button
      >
      <div
        class="list-name-toggle text-small"
        on:click={() => (showDropdown = false)}
      >
        <span>{listName}</span>
        <span class="chevron open">▾</span>
      </div>
      <div class="right-controls">
        <button
          class="text-small"
          class:active={viewMode !== "vote"}
          on:click={() => {
            showDropdown = false;
            toggleView();
          }}>{viewButtonLabel}</button
        >
        <button
          class="text-small"
          class:active={showComments}
          on:click={() => (showComments = !showComments)}>Chat{#if unreadCount > 0} <span class="chat-badge">{unreadCount}</span>{/if}</button
        >
      </div>
    </div>
    <HomeDropdown {isMobile} />
  </div>
{:else}
  {#if isMobile}<Header />{/if}
  <div class="list-name-bar">
    <button
      class="text-small"
      class:active={viewMode === "vote"}
      on:click={() => (viewMode = "vote")}>Vote</button
    >
    <div
      class="list-name-toggle text-small"
      on:click={() => (showDropdown = true)}
    >
      <span>{listName}</span>
      <span class="chevron">▾</span>
    </div>
    <div class="right-controls">
      <button
        class="text-small"
        class:active={viewMode !== "vote"}
        on:click={toggleView}>{viewButtonLabel}</button
      >
      <button
        class="text-small"
        class:active={showComments}
        on:click={() => (showComments = !showComments)}>Chat{#if unreadCount > 0} <span class="chat-badge">{unreadCount}</span>{/if}</button
      >
    </div>
  </div>
{/if}

<div class="view-and-chat">
  <div class="view-panel">
    {#if loading}
      <!-- loading -->
    {:else if error}
      <p class="text-base">{error}</p>
    {:else if pairData}
  {#if viewMode !== "vote"}
    <div class="mobile-grid-container">
      <div class="grid-data">
        {#if listInfo?.author}<span class="author-chip-group"><span class="grid-data-chip text-small">AUTHOR</span><span
              class:text-base={!isMobile}
              class:text-small={isMobile}>{listInfo.author}</span
            ></span>{/if}
        <span
          class:text-base={!isMobile}
          class:text-small={isMobile}
          class="grid-data-right"
          bind:clientHeight={gridHeaderHeight}
        >
          <span class="grid-data-chip text-small">Votes</span>
          {listInfo?.voteCount ?? 0}
          <span class="grid-data-chip text-small">Last Voted</span>{timeAgo(
            listInfo?.lastVoteTimestamp,
          )}
          <span class="grid-data-chip text-small">Length</span
          >{listInfo?.itemCount ?? rankedItems.length}
        </span>
      </div>
      <div class="grid-header">
        <span class:text-base={!isMobile} class:text-small={isMobile}
          >{gridHeaderName}</span
        >
        {#if itemHistory.length > 0}
          <div class="grid-header-stats">
            <span class="grid-data-chip text-small">Votes</span>
            <span
              class:text-base={!isMobile}
              class:text-small={isMobile}
              class="item-votes">{itemHistory.length}</span
            >
            {#if recentDelta !== null}
              <span class="grid-data-chip text-small">Recent Change</span>
              <span
                class:text-base={!isMobile}
                class:text-small={isMobile}
                class="recent-delta"
                class:positive={recentDelta > 0}
                class:negative={recentDelta < 0}
                >{recentDelta > 0 ? "+" : ""}{recentDelta}</span
              >
            {/if}
            {#if sparkPoints}
              <span class="grid-data-chip text-small">History</span>
              <svg
                class="sparkline"
                width="120"
                height={gridHeaderHeight - 6}
                viewBox="0 0 120 {gridHeaderHeight - 6}"
              >
                <polyline
                  points={sparkPoints}
                  fill="none"
                  stroke="var(--color-grey)"
                  stroke-width="1"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
              </svg>
            {/if}
          </div>
        {/if}
      </div>
      <div
        class="grid-scroll"
        bind:this={gridScrollEl}
        on:scroll={handleGridScroll}
      >
        {#if viewMode === "grid"}
          <div class="grid-items">
            {#each rankedItems as item, i}
              <div
                bind:this={itemEls[i]}
                on:mouseenter={() => {
                  if (!isMobile) hoveredItemName = item.name;
                }}
              >
                <GridItem
                  rank={item.rank}
                  elo={item.elo}
                  name={item.name}
                  picture={item.data?.picture ?? null}
                />
              </div>
            {/each}
          </div>
        {:else}
          <div class="list-items">
            {#each rankedItems as item, i}
              <div
                bind:this={itemEls[i]}
                on:mouseenter={() => {
                  if (!isMobile) hoveredItemName = item.name;
                }}
              >
                <ListViewItem
                  rank={item.rank}
                  elo={item.elo}
                  name={item.name}
                  picture={item.data?.picture ?? null}
                />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {:else if isMobile}
    <div class="mobile-vote-container">
      <div
        class="mobile-image-wrap"
        class:selected={selectedItem === 1}
        class:loser={selectedItem === 2}
        role="button"
        tabindex="0"
        on:click={() => castVote(pairData.item1.name, pairData.item2.name, 1)}
      >
        {#if listInfo?.noImages}
          <div class="img-no-image text-item">{pairData.item1.name}</div>
        {:else if pairData.item1.data?.picture}
          <img src={pairData.item1.data.picture} alt={pairData.item1.name} />
        {:else}
          <div class="img-empty"></div>
        {/if}
      </div>

      <div class="mobile-names">
        <div class="text-base mobile-name-text">
          {selectedItem === 1
            ? (winnerCountElo ?? Math.round(pairData.item1.elo))
            : selectedItem === 2
              ? (loserCountElo ?? Math.round(pairData.item1.elo))
              : pairData.item1.name}
          {#if eloPopup?.item === 1}<span class="elo-popup text-base"
              >+{eloPopup.delta}</span
            >{/if}
          {#if eloPopup?.item === 2}<span class="elo-popup-loser text-base"
              >-{eloPopup.delta}</span
            >{/if}
        </div>
        <div class="text-small mobile-or-text" class:hidden={selectedItem !== 0}
          >or</div
        >
        <div class="text-base mobile-name-text">
          {selectedItem === 2
            ? (winnerCountElo ?? Math.round(pairData.item2.elo))
            : selectedItem === 1
              ? (loserCountElo ?? Math.round(pairData.item2.elo))
              : pairData.item2.name}
          {#if eloPopup?.item === 2}<span class="elo-popup text-base"
              >+{eloPopup.delta}</span
            >{/if}
          {#if eloPopup?.item === 1}<span class="elo-popup-loser text-base"
              >-{eloPopup.delta}</span
            >{/if}
        </div>
      </div>

      <div
        class="mobile-image-wrap"
        class:selected={selectedItem === 2}
        class:loser={selectedItem === 1}
        role="button"
        tabindex="0"
        on:click={() => castVote(pairData.item2.name, pairData.item1.name, 2)}
      >
        {#if listInfo?.noImages}
          <div class="img-no-image text-item">{pairData.item2.name}</div>
        {:else if pairData.item2.data?.picture}
          <img src={pairData.item2.data.picture} alt={pairData.item2.name} />
        {:else}
          <div class="img-empty"></div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="vote-container">
      <div class="images-row">
        <div
          class="vote-item vote-item-1"
          class:disabled={voting}
          class:selected={selectedItem === 1}
          class:loser={selectedItem === 2}
          role="button"
          tabindex="0"
          on:mouseenter={() => (hoveredItem = 1)}
          on:mouseleave={() => (hoveredItem = 0)}
          on:click={() => castVote(pairData.item1.name, pairData.item2.name, 1)}
          on:keydown={(e) =>
            e.key === "Enter" &&
            castVote(pairData.item1.name, pairData.item2.name, 1)}
        >
          {#if listInfo?.noImages}
            <div class="img-no-image text-item">{pairData.item1.name}</div>
          {:else if pairData.item1.data?.picture}
            <img src={pairData.item1.data.picture} alt={pairData.item1.name} />
          {:else}
            <div class="img-empty"></div>
          {/if}
        </div>

        <div
          class="vote-item vote-item-2"
          class:disabled={voting}
          class:selected={selectedItem === 2}
          class:loser={selectedItem === 1}
          role="button"
          tabindex="0"
          on:mouseenter={() => (hoveredItem = 2)}
          on:mouseleave={() => (hoveredItem = 0)}
          on:click={() => castVote(pairData.item2.name, pairData.item1.name, 2)}
          on:keydown={(e) =>
            e.key === "Enter" &&
            castVote(pairData.item2.name, pairData.item1.name, 2)}
        >
          {#if listInfo?.noImages}
            <div class="img-no-image text-item">{pairData.item2.name}</div>
          {:else if pairData.item2.data?.picture}
            <img src={pairData.item2.data.picture} alt={pairData.item2.name} />
          {:else}
            <div class="img-empty"></div>
          {/if}
        </div>
      </div>

      <div class="names-row">
        <div
          class="name text-base"
          class:hovered={hoveredItem === 1 && selectedItem === 0}
        >
          {selectedItem === 1
            ? (winnerCountElo ?? Math.round(pairData.item1.elo))
            : selectedItem === 2
              ? (loserCountElo ?? Math.round(pairData.item1.elo))
              : pairData.item1.name}
          {#if eloPopup?.item === 1}<span class="elo-popup text-base"
              >+{eloPopup.delta}</span
            >{/if}
          {#if eloPopup?.item === 2}<span class="elo-popup-loser text-base"
              >-{eloPopup.delta}</span
            >{/if}
        </div>
        <div class="or text-base">or</div>
        <div
          class="name text-base"
          class:hovered={hoveredItem === 2 && selectedItem === 0}
        >
          {selectedItem === 2
            ? (winnerCountElo ?? Math.round(pairData.item2.elo))
            : selectedItem === 1
              ? (loserCountElo ?? Math.round(pairData.item2.elo))
              : pairData.item2.name}
          {#if eloPopup?.item === 2}<span class="elo-popup text-base"
              >+{eloPopup.delta}</span
            >{/if}
          {#if eloPopup?.item === 1}<span class="elo-popup-loser text-base"
              >-{eloPopup.delta}</span
            >{/if}
        </div>
      </div>
    </div>
  {/if}
    {/if}
  </div>
  {#if showComments}
    <div class="comments-panel">
        <div class="comments-header">
          <span class="text-small" style="text-transform: uppercase; color: var(--color-grey)">Chat</span>
          <div class="chat-name-wrap">
            {#if editingName}
              <input
                class="text-small chat-name-input"
                bind:value={$chatName}
                autofocus
                on:blur={() => (editingName = false)}
                on:keydown={(e) => e.key === "Enter" && (editingName = false)}
              />
            {:else}
              <span class="text-small chat-name-display" on:click={() => (editingName = true)}>{$chatName}</span>
            {/if}
          </div>
        </div>
        <div class="comments-messages" bind:this={messagesEl}>
          {#each $chatMessages as msg}
            <div class="comment">
              <div class="comment-meta text-small">{msg.author} · {timeAgo(msg.timestamp)}</div>
              <div class="comment-text text-small">{msg.text}</div>
            </div>
          {/each}
          {#if $chatMessages.length === 0}
            <div class="comments-empty text-small">No messages yet. Say something!</div>
          {/if}
        </div>
        <div class="comments-input">
          <input
            class="text-small"
            placeholder="Say something..."
            bind:value={commentText}
            on:keydown={(e) => e.key === "Enter" && submitComment()}
          />
        </div>
      </div>
  {/if}
</div>

<style>
  .list-name-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-margin);
    border-bottom: var(--border);
    gap: var(--spacing-md);
  }

  .list-name-bar.no-border {
    border-bottom: none;
  }

  .list-name-toggle {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    text-transform: uppercase;
    min-width: 0;
    gap: var(--spacing-md);
  }

  .list-name-toggle span:first-child {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .chevron {
    flex-shrink: 0;
    transition: transform 0.2s ease;
    transform: rotate(180deg);
  }

  .chevron.open {
    transform: rotate(0deg);
  }

  button.active {
    color: var(--color-white);
    background-color: var(--color-black);
    border-color: var(--color-black);
  }

  .dropdown-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--color-white);
    z-index: 50;
    display: flex;
    flex-direction: column;
  }

  .vote-container {
    display: flex;
    flex-direction: column;
    /* width: 100%; */
    flex: 1;
    min-height: 0;
    gap: var(--spacing-margin);
    padding: var(--spacing-margin);
  }

  .images-row {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
    gap: var(--spacing-margin);
    /* padding: var(--spacing-margin); */
  }

  .names-row {
    display: flex;
    align-items: center;
    /* margin: 20px 0; */
  }

  .name {
    flex: 1;
    text-align: center;
    text-transform: uppercase;
    position: relative;
  }

  .name.hovered {
    text-decoration: underline;
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
    border: var(--border);
    border-radius: 4px;
    padding: var(--spacing-margin);
  }

  .vote-item.disabled {
    cursor: default;
  }

  .img-no-image {
    width: 100%;
    height: 100%;
    background: black;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--spacing-md);
    box-sizing: border-box;
    text-transform: uppercase;
  }

  .vote-item img,
  .img-empty {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition:
      transform 0.35s ease,
      filter 0.35s ease;
    transform-origin: center center;
  }

  @media (min-width: 740px) {
    .vote-item img {
      width: 50%;
      height: 50%;
    }
  }

  .vote-item.selected img,
  .vote-item.selected .img-empty {
    transform: scale(2);
  }

  .vote-item.loser img,
  .vote-item.loser .img-empty {
    filter: grayscale(1);
  }

  .elo-popup-loser {
    position: absolute;
    right: 100%;
    top: 50%;
    bottom: auto;
    margin-right: 0.3em;
    transform: translateY(-50%);
    animation: slideLeft 1s ease-out forwards;
    white-space: nowrap;
  }

  .name .elo-popup-loser {
    right: auto;
    left: 50%;
    top: auto;
    transform: translateX(-50%);
    margin-right: 0;
    animation: floatUp 1s ease-out forwards;
  }

  @keyframes slideLeft {
    0% {
      opacity: 1;
      transform: translateX(0) translateY(-50%);
    }
    100% {
      opacity: 0;
      transform: translateX(-2em) translateY(-50%);
    }
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

  .mobile-vote-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: var(--spacing-margin);
    gap: var(--spacing-margin);
  }

  .mobile-image-wrap {
    flex: 1;
    min-height: 0;
    border: var(--border);
    border-radius: 4px;
    padding: var(--spacing-margin);
    cursor: pointer;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mobile-image-wrap img,
  .mobile-image-wrap .img-empty {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .mobile-image-wrap.loser {
    filter: grayscale(1);
    opacity: 0.5;
  }

  .mobile-names {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
    flex-shrink: 0;
  }

  .mobile-name-text {
    text-align: center;
    text-transform: uppercase;
    position: relative;
  }

  .mobile-or-text {
    text-transform: uppercase;
  }

  .mobile-or-text.hidden {
    visibility: hidden;
  }

  .mobile-names .elo-popup {
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-left: 0.3em;
    animation: slideRight 1s ease-out forwards;
  }

  .mobile-names .elo-popup-loser {
    position: absolute;
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-right: 0.3em;
    animation: slideLeft 1s ease-out forwards;
  }

  .mobile-grid-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .grid-data {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-margin);
    border-bottom: var(--border);
    gap: var(--spacing-md);
    text-transform: uppercase;
    color: var(--color-text-faded);
  }

  .grid-data-right {
    display: flex;
    /* align-items: center; */
    gap: var(--spacing-md);
    flex-shrink: 0;
  }

  .author-chip-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .grid-data-chip {
    background-color: var(--color-grey);
    color: var(--color-white);
    padding: 0 var(--spacing-sm);
    padding-top: 1px;
    display: flex;

    justify-content: center;
    align-items: center;
  }

  .grid-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-margin);
    border-bottom: var(--border);
    gap: var(--spacing-md);
    text-transform: uppercase;
  }

  @media (max-width: 740px) {
    .grid-data,
    .grid-header {
      overflow-x: auto;
      scrollbar-width: none;
      white-space: nowrap;
      flex-wrap: nowrap;
    }

    .grid-data::-webkit-scrollbar,
    .grid-header::-webkit-scrollbar {
      display: none;
    }
  }

  .grid-header-stats {
    display: flex;
    /* align-items: s; */
    gap: var(--spacing-md);
    flex-shrink: 0;
  }

  .item-votes {
    color: var(--color-text-faded);
  }

  .recent-delta {
    font-variant-numeric: tabular-nums;
  }

  .recent-delta.positive {
    color: var(--color-green);
  }

  .recent-delta.negative {
    color: var(--color-red);
  }

  .sparkline {
    display: block;
    overflow: visible;
    border: var(--border);
    padding: 3px 0;
    border-radius: 2px;
  }

  .grid-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .grid-items {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-margin);
    padding: var(--spacing-margin);
  }

  @media (min-width: 741px) {
    .grid-items {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .grid-items > div {
    min-width: 0;
  }

  .list-items {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-margin);
    padding: var(--spacing-margin);
  }

  .edit-fab {
    position: fixed;
    bottom: var(--spacing-margin);
    right: var(--spacing-margin);
    z-index: 10;
    cursor: pointer;
  }

  .right-controls {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
  }

  .chat-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--color-red);
    color: white;
    border-radius: 2px;
    font-size: 10px;
    min-width: 14px;
    height: 13px;
    padding: 0 3px;
    margin-left: 3px;
    line-height: 1;
    vertical-align: middle;
  }

  .view-and-chat {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .view-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .comments-panel {
    width: 280px;
    flex-shrink: 0;
    border-left: var(--border);
    display: flex;
    flex-direction: column;
  }

  .comments-header {
    padding: var(--spacing-margin);
    border-bottom: var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    gap: var(--spacing-md);
  }

  .chat-name-wrap {
    min-width: 0;
    flex: 1;
    display: flex;
    justify-content: flex-end;
  }

  .chat-name-display {
    cursor: pointer;
    color: var(--color-black);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    max-width: 100%;
    border-bottom: 1px dashed var(--color-border);
  }

  .chat-name-input {
    border: none;
    outline: none;
    border-bottom: 1px solid var(--color-black);
    background: transparent;
    text-align: right;
    width: 100%;
  }

  .comments-messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-margin);
    scrollbar-width: none;
  }

  .comments-messages::-webkit-scrollbar {
    display: none;
  }

  .comment {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .comment-meta {
    color: var(--color-grey);
  }

  .comment-text {
    color: var(--color-black);
    word-break: break-word;
  }

  .comments-empty {
    color: var(--color-grey);
    text-align: center;
    padding-top: var(--spacing-lg);
  }

  .comments-input {
    border-top: var(--border);
    flex-shrink: 0;
  }

  .comments-input input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    padding: var(--spacing-margin);
    box-sizing: border-box;
  }
</style>
