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
  import { joinList, sendComment, chatMessages, chatName } from "../lib/ws.js";
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
    const H = 30;
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

  $: if (listName) {
    const suffix =
      viewMode === "vote" ? "Vote" : viewMode === "grid" ? "Grid" : "List";
    document.title = `${listName} · ${suffix} | This or That`;
  }

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

  let commentText = "";
  let showChat = false;

  $: if (commentText) showChat = true;

  // ── Effects ────────────────────────────────────────────
  const EFFECTS = [
    "arc-float",
    "crit-hit",
    "loser-shake",
    "winner-flash",
    "particle-burst",
    "praise-text",
    "streak-fire",
    "screen-shake",
    "ripple-ring",
    "ko-upset",
    "combo-multiplier",
    "pixel-scatter",
  ];
  const PRAISE = [
    "NICE!",
    "GREAT!",
    "SICK!",
    "WOW!",
    "YEAH!",
    "LET'S GO!",
    "FIRE!",
  ];

  let activeEffect = null;
  let effectPayload = {};
  let streakCount = 0;
  let comboCount = 0;
  let lastVoteTime = 0;
  let effectTimer = null;
  let particles = [];

  let debugMode = false;
  let debugEffect = EFFECTS[0];

  function clearEffect() {
    activeEffect = null;
    effectPayload = {};
    particles = [];
  }

  function runEffect(effectName, delta, winnerItem) {
    if (effectTimer) clearTimeout(effectTimer);
    clearEffect();
    activeEffect = effectName;
    effectPayload = { delta, winnerItem };

    if (effectName === "particle-burst") {
      particles = Array.from({ length: 8 }, (_, i) => ({
        angle: (i / 8) * 360,
        color: ["#ff4141", "#ffd700", "#00c100", "#00aaff", "#ff69b4"][i % 5],
      }));
    }
    if (effectName === "praise-text") {
      effectPayload.word = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    }
    if (effectName === "ko-upset") {
      effectPayload.word = delta >= 20 ? "UPSET!" : "KO!";
    }
    if (effectName === "combo-multiplier") {
      effectPayload.combo = comboCount;
    }
    if (effectName === "streak-fire") {
      effectPayload.streak = streakCount;
    }
    if (effectName === "pixel-scatter") {
      particles = Array.from({ length: 12 }, (_, i) => ({
        x: Math.random() * 100,
        delay: Math.random() * 0.2,
        size: 4 + Math.random() * 6,
      }));
    }

    effectTimer = setTimeout(clearEffect, 1200);
  }

  function triggerEffect(delta, winnerItem, isUpset) {
    const now = Date.now();
    streakCount++;
    if (now - lastVoteTime < 2000) {
      comboCount++;
    } else {
      comboCount = 1;
    }
    lastVoteTime = now;

    let pool = [...EFFECTS];
    if (!isUpset) pool = pool.filter((e) => e !== "ko-upset");
    if (streakCount < 5) pool = pool.filter((e) => e !== "streak-fire");
    if (comboCount < 3) pool = pool.filter((e) => e !== "combo-multiplier");
    if (pool.length === 0) pool = ["arc-float"];

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    runEffect(chosen, delta, winnerItem);
  }

  function previewEffect(name) {
    runEffect(name, 24, 1);
  }

  let messagesEl;
  function scrollToBottom() {
    if (messagesEl)
      requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
  }
  const unsubMessages = chatMessages.subscribe(() => scrollToBottom());

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
  }

  async function prefetchNextPair() {
    try {
      const data = await getPairForVoting(listName);
      prefetchedPairData = parsePairData(data);
      if (prefetchedPairData.item1.data?.picture)
        new Image().src = prefetchedPairData.item1.data.picture;
      if (prefetchedPairData.item2.data?.picture)
        new Image().src = prefetchedPairData.item2.data.picture;
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
      getListInfo(listName)
        .then((info) => {
          listInfo = info || {};
        })
        .catch(() => {});
    } else {
      loading = true;
      try {
        const [pair, info] = await Promise.all([
          getPairForVoting(listName),
          getListInfo(listName),
        ]);
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
    const isUpset = loserElo - winnerElo > 150;
    triggerEffect(delta, item, isUpset);
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
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "d" || e.key === "D") {
      debugMode = !debugMode;
      return;
    }
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
    if (effectTimer) clearTimeout(effectTimer);
    unsubMessages();
    document.title = "This or That";
  });
</script>

{#if showDropdown}
  <div class="dropdown-overlay">
    <Header />
    <div class="list-name-bar no-border">
      <button
        class="text-base"
        \n
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
        <span class="chevron open">⏷</span>
      </div>
      <div class="right-controls">
        <button
          class="text-base"
          \n
          class:active={viewMode !== "vote"}
          on:click={() => {
            showDropdown = false;
            toggleView();
          }}>{viewButtonLabel}</button
        >
      </div>
    </div>
    <HomeDropdown {isMobile} />
  </div>
{:else}
  {#if isMobile}<Header />{/if}
  <div class="list-name-bar">
    <button
      class="text-base"
      \n
      class:active={viewMode === "vote"}
      on:click={() => (viewMode = "vote")}>Vote</button
    >
    <div
      class="list-name-toggle text-small"
      on:click={() => (showDropdown = true)}
    >
      <span>{listName}</span>
      <span class="chevron">⏷</span>
    </div>
    <div class="right-controls">
      <button
        class="text-base"
        \n
        class:active={viewMode !== "vote"}
        on:click={toggleView}>{viewButtonLabel}</button
      >
    </div>
  </div>
{/if}

<div class="view-and-chat">
  <div class="view-panel" class:fx-shaking={activeEffect === "screen-shake"}>
    {#if loading}
      <!-- loading -->
    {:else if error}
      <p class="text-base">{error}</p>
    {:else if pairData}
      {#if viewMode !== "vote"}
        <div class="mobile-grid-container">
          <div class="grid-data">
            {#if listInfo?.author}<span class="author-chip-group"
                ><span class="grid-data-chip text-small">AUTHOR</span><span
                  class="text-small">{listInfo.author}</span
                ></span
              >{/if}
            <span class="text-small grid-data-right">
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
                <span class="text-small item-votes">{itemHistory.length}</span>
                {#if recentDelta !== null}
                  <span class="grid-data-chip text-small">Recent Change</span>
                  <span
                    class="text-small recent-delta"
                    class:positive={recentDelta > 0}
                    class:negative={recentDelta < 0}
                    ><span style="margin-right: var(--spacing-sm)"
                      >{recentDelta > 0 ? "⏶" : "⏷"}</span
                    >{Math.abs(recentDelta)}</span
                  >
                {/if}
                {#if sparkPoints}
                  <span class="grid-data-chip text-small">History</span>
                  <svg
                    class="sparkline"
                    width="120"
                    height="30"
                    viewBox="0 0 120 30"
                    preserveAspectRatio="none"
                  >
                    <polyline
                      points={sparkPoints}
                      fill="none"
                      stroke="var(--color-white)"
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
            on:click={() =>
              castVote(pairData.item1.name, pairData.item2.name, 1)}
          >
            {#if listInfo?.noImages}
              <div class="img-no-image text-item">{pairData.item1.name}</div>
            {:else if pairData.item1.data?.picture}
              <img
                src={pairData.item1.data.picture}
                alt={pairData.item1.name}
              />
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
            <div
              class="text-small mobile-or-text"
              class:hidden={selectedItem !== 0}>or</div
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
            on:click={() =>
              castVote(pairData.item2.name, pairData.item1.name, 2)}
          >
            {#if listInfo?.noImages}
              <div class="img-no-image text-item">{pairData.item2.name}</div>
            {:else if pairData.item2.data?.picture}
              <img
                src={pairData.item2.data.picture}
                alt={pairData.item2.name}
              />
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
              on:click={() =>
                castVote(pairData.item1.name, pairData.item2.name, 1)}
              on:keydown={(e) =>
                e.key === "Enter" &&
                castVote(pairData.item1.name, pairData.item2.name, 1)}
            >
              {#if listInfo?.noImages}
                <div class="img-no-image text-item">{pairData.item1.name}</div>
              {:else if pairData.item1.data?.picture}
                <img
                  src={pairData.item1.data.picture}
                  alt={pairData.item1.name}
                />
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
              on:click={() =>
                castVote(pairData.item2.name, pairData.item1.name, 2)}
              on:keydown={(e) =>
                e.key === "Enter" &&
                castVote(pairData.item2.name, pairData.item1.name, 2)}
            >
              {#if listInfo?.noImages}
                <div class="img-no-image text-item">{pairData.item2.name}</div>
              {:else if pairData.item2.data?.picture}
                <img
                  src={pairData.item2.data.picture}
                  alt={pairData.item2.name}
                />
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

    <!-- ── Effect overlays ── -->
    {#if activeEffect === "crit-hit"}
      <div
        class="fx-overlay fx-crit"
        style="--fx-side:{effectPayload.winnerItem === 1 ? '25%' : '75%'}"
      >
        <span class="fx-crit-label">CRIT!</span>
        <span class="fx-crit-num">+{effectPayload.delta}</span>
      </div>
    {/if}

    {#if activeEffect === "loser-shake"}
      <div
        class="fx-shake-target"
        class:fx-shake-1={effectPayload.winnerItem === 2}
        class:fx-shake-2={effectPayload.winnerItem === 1}
      ></div>
    {/if}

    {#if activeEffect === "winner-flash"}
      <div
        class="fx-flash"
        style="--fx-side:{effectPayload.winnerItem === 1
          ? '0'
          : '50%'}; --fx-width:50%"
      ></div>
    {/if}

    {#if activeEffect === "particle-burst"}
      <div
        class="fx-particles"
        style="--fx-side:{effectPayload.winnerItem === 1 ? '25%' : '75%'}"
      >
        {#each particles as p}
          <div
            class="fx-particle"
            style="--angle:{p.angle}deg; --pcolor:{p.color}"
          ></div>
        {/each}
      </div>
    {/if}

    {#if activeEffect === "praise-text"}
      <div
        class="fx-overlay fx-praise"
        style="--fx-side:{effectPayload.winnerItem === 1 ? '25%' : '75%'}"
      >
        {effectPayload.word}
      </div>
    {/if}

    {#if activeEffect === "streak-fire"}
      <div class="fx-overlay fx-streak">
        🔥 {effectPayload.streak}× STREAK
      </div>
    {/if}

    {#if activeEffect === "ripple-ring"}
      <div
        class="fx-ripple"
        style="--fx-side:{effectPayload.winnerItem === 1 ? '25%' : '75%'}"
      ></div>
    {/if}

    {#if activeEffect === "ko-upset"}
      <div class="fx-overlay fx-ko">{effectPayload.word}</div>
    {/if}

    {#if activeEffect === "combo-multiplier"}
      <div class="fx-overlay fx-combo">×{effectPayload.combo} COMBO</div>
    {/if}

    {#if activeEffect === "pixel-scatter"}
      <div
        class="fx-pixels"
        style="--fx-side:{effectPayload.winnerItem === 1 ? '25%' : '75%'}"
      >
        {#each particles as p}
          <div
            class="fx-pixel"
            style="--px:{p.x}%; --pdelay:{p.delay}s; --psize:{p.size}px"
          ></div>
        {/each}
      </div>
    {/if}

    {#if activeEffect === "arc-float"}
      <div
        class="fx-overlay fx-arc"
        style="--fx-side:{effectPayload.winnerItem === 1 ? '25%' : '75%'}"
      >
        +{effectPayload.delta}
      </div>
    {/if}
  </div>
</div>

<!-- ── Debug panel ── -->
{#if debugMode}
  <div class="fx-debug-panel">
    <div class="text-small fx-debug-title">EFFECT DEBUG (D to close)</div>
    {#each EFFECTS as name}
      <button
        class="text-small fx-debug-btn"
        class:fx-debug-active={debugEffect === name}
        on:click={() => {
          debugEffect = name;
          previewEffect(name);
        }}>{name}</button
      >
    {/each}
  </div>
{/if}

<div class="bottom-row">
  {#if showChat && $chatMessages.length > 0}
    <div class="chat-messages-area" bind:this={messagesEl}>
      {#each $chatMessages as msg}
        <div class="chat-message text-small">
          <span class="chat-msg-author">{msg.author}</span>
          <span class="chat-msg-text">{msg.text}</span>
        </div>
      {/each}
    </div>
  {/if}
  {#if viewMode !== "vote" && !showDropdown}
    <button class="text-base edit-float" on:click={navigateToEdit}>Edit</button>
  {/if}
  <div class="chat-bar">
    <input
      class="text-small chat-name-input"
      bind:value={$chatName}
      on:keydown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") e.target.blur();
      }}
    />
    <input
      class="text-small chat-input"
      placeholder="Say something..."
      bind:value={commentText}
      on:keydown={(e) => {
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") e.stopPropagation();
        if (e.key === "Enter") submitComment();
      }}
    />
    <div class="chat-actions">
      <button class="text-base send-btn" on:click={submitComment}>Send</button>
      <button
        class="text-base toggle-chat-btn"
        on:click={() => (showChat = !showChat)}
        >{showChat ? "Hide" : "Show"}</button
      >
    </div>
  </div>
</div>

<style>
  .list-name-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    /* padding: var(--spacing-sm) 0; */
    /* border-bottom: var(--border); */
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
    background: var(--color-bkggrey);
    z-index: 50;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-sm);
    gap: var(--spacing-sm);
    box-sizing: border-box;
  }

  .vote-container {
    display: flex;
    flex-direction: column;
    /* width: 100%; */
    flex: 1;
    min-height: 0;
    gap: var(--spacing-margin);
    /* padding: var(--spacing-sm); */
    padding-bottom: var(--spacing-md);
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
    /* padding: var(--spacing-margin); */
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
    height: var(--button-height);
    padding: var(--spacing-sm) 0;
    border-bottom: var(--border);
    border-top: var(--border);
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
    color: var(--color-black);
    opacity: 0.5;
    /* padding: 2px 8px 1px 8px; */
    display: flex;
    border-radius: 100px;
    justify-content: center;
    align-items: center;
    align-self: stretch;
  }

  .grid-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: var(--button-height);
    padding: var(--spacing-sm) 0;
    border-bottom: var(--border);
    gap: var(--spacing-md);
    text-transform: uppercase;
    /* box-sizing: border-box; */
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
    display: flex;
    align-items: center;
  }

  .recent-delta {
    font-variant-numeric: tabular-nums;
    display: flex;
    align-items: center;
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
    border-radius: 2px;
    height: calc(var(--button-height) - 2 * var(--spacing-sm));
    padding: 3px 0;
    background-color: var(--color-black);
  }

  .grid-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .grid-items {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) 0;
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
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) 0;
  }

  .bottom-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-shrink: 0;
  }

  .right-controls {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
  }

  .view-and-chat {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .view-panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .chat-messages-area {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-bottom: var(--spacing-sm);
    max-height: 30vh;
    overflow-y: auto;
    scrollbar-width: none;
    pointer-events: auto;
  }

  .chat-messages-area::-webkit-scrollbar {
    display: none;
  }

  .chat-message {
    display: flex;
    gap: var(--spacing-md);
    /* text-transform: uppercase; */
  }

  .chat-msg-author {
    flex-shrink: 0;
    color: var(--color-white);
    background-color: var(--color-black);
    padding: 2px var(--spacing-sm) 1px var(--spacing-sm);
    border-radius: 2px;
  }

  .chat-msg-text {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--color-black);
    background-color: var(--color-white);
    padding: 2px var(--spacing-sm) 1px var(--spacing-sm);
    border-radius: 2px;
  }

  .chat-bar {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm)
      var(--spacing-margin);
    border: var(--border);
    border-radius: var(--border-radius);
  }

  @media (max-width: 740px) {
    .chat-bar {
      padding: var(--spacing-sm);
    }
  }
  .chat-name-input {
    flex-shrink: 0;
    field-sizing: content;
    border: none;
    outline: none;
    background: transparent;
    border-bottom: 1.5px solid transparent;
    padding: 0;
    text-transform: none;
    opacity: 0.4;
  }

  .chat-name-input:focus {
    opacity: 1;
  }

  .chat-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    padding: 0;
  }

  .chat-actions {
    display: flex;
    gap: var(--spacing-sm);
    flex-shrink: 0;
  }

  .edit-float {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: var(--spacing-sm);
  }

  /* ── Effect overlays ──────────────────────────────── */

  .fx-overlay {
    position: absolute;
    left: var(--fx-side, 50%);
    top: 40%;
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 20;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* arc-float */
  .fx-arc {
    font-size: 2rem;
    font-weight: bold;
    animation: fxArc 1s ease-out forwards;
  }
  @keyframes fxArc {
    0% {
      opacity: 1;
      transform: translateX(-50%) translate(0, 0);
    }
    50% {
      transform: translateX(calc(-50% + 30px)) translate(0, -40px);
    }
    100% {
      opacity: 0;
      transform: translateX(calc(-50% + 50px)) translate(0, -20px);
    }
  }

  /* crit-hit */
  .fx-crit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    animation: fxCrit 1s ease-out forwards;
  }
  .fx-crit-label {
    font-size: 0.9rem;
    color: #ffd700;
    letter-spacing: 2px;
  }
  .fx-crit-num {
    font-size: 3rem;
    font-weight: bold;
    color: #ff4141;
    text-shadow: 2px 2px 0 #000;
  }
  @keyframes fxCrit {
    0% {
      opacity: 1;
      transform: translateX(-50%) scale(0.5);
    }
    20% {
      transform: translateX(-50%) scale(1.3);
    }
    60% {
      transform: translateX(-50%) scale(1) translateY(-20px);
      opacity: 1;
    }
    100% {
      transform: translateX(-50%) scale(0.8) translateY(-50px);
      opacity: 0;
    }
  }

  /* winner-flash */
  .fx-flash {
    position: absolute;
    left: var(--fx-side);
    top: 0;
    width: var(--fx-width);
    height: 100%;
    background: white;
    pointer-events: none;
    z-index: 10;
    border-radius: 4px;
    animation: fxFlash 0.5s ease-out forwards;
  }
  @keyframes fxFlash {
    0% {
      opacity: 0.7;
    }
    100% {
      opacity: 0;
    }
  }

  /* particle-burst */
  .fx-particles {
    position: absolute;
    left: var(--fx-side);
    top: 50%;
    pointer-events: none;
    z-index: 20;
  }
  .fx-particle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: var(--pcolor);
    border-radius: 2px;
    animation: fxParticle 0.8s ease-out forwards;
    transform-origin: center;
  }
  @keyframes fxParticle {
    0% {
      opacity: 1;
      transform: rotate(var(--angle)) translateY(0px);
    }
    100% {
      opacity: 0;
      transform: rotate(var(--angle)) translateY(-60px);
    }
  }

  /* praise-text */
  .fx-praise {
    font-size: 2rem;
    font-weight: bold;
    color: var(--color-black);
    animation: fxPraise 1s ease-out forwards;
  }
  @keyframes fxPraise {
    0% {
      opacity: 1;
      transform: translateX(-50%) scale(1.4) translateY(0);
    }
    40% {
      transform: translateX(-50%) scale(1) translateY(-10px);
      opacity: 1;
    }
    100% {
      transform: translateX(-50%) scale(0.9) translateY(-40px);
      opacity: 0;
    }
  }

  /* streak-fire */
  .fx-streak {
    left: 50%;
    top: 30%;
    font-size: 1.5rem;
    font-weight: bold;
    animation: fxStreak 1.2s ease-out forwards;
  }
  @keyframes fxStreak {
    0% {
      opacity: 0;
      transform: translateX(-50%) scale(0.8);
    }
    20% {
      opacity: 1;
      transform: translateX(-50%) scale(1.1);
    }
    80% {
      opacity: 1;
      transform: translateX(-50%) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateX(-50%) scale(1) translateY(-20px);
    }
  }

  /* screen-shake */
  .fx-shaking {
    animation: fxShake 0.4s ease-out;
  }
  @keyframes fxShake {
    0% {
      transform: translateX(0);
    }
    15% {
      transform: translateX(-6px);
    }
    30% {
      transform: translateX(6px);
    }
    45% {
      transform: translateX(-4px);
    }
    60% {
      transform: translateX(4px);
    }
    75% {
      transform: translateX(-2px);
    }
    100% {
      transform: translateX(0);
    }
  }

  /* ripple-ring */
  .fx-ripple {
    position: absolute;
    left: var(--fx-side);
    top: 50%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    border: 3px solid var(--color-black);
    border-radius: 50%;
    pointer-events: none;
    z-index: 20;
    animation: fxRipple 0.8s ease-out forwards;
  }
  @keyframes fxRipple {
    0% {
      opacity: 0.8;
      transform: translate(-50%, -50%) scale(0.2);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(3);
    }
  }

  /* ko-upset */
  .fx-ko {
    left: 50%;
    top: 35%;
    font-size: 3.5rem;
    font-weight: bold;
    color: var(--color-black);
    letter-spacing: 4px;
    animation: fxKO 1.2s ease-out forwards;
  }
  @keyframes fxKO {
    0% {
      opacity: 0;
      transform: translateX(-50%) scale(2);
    }
    20% {
      opacity: 1;
      transform: translateX(-50%) scale(1);
    }
    75% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateX(-50%) scale(0.9);
    }
  }

  /* combo-multiplier */
  .fx-combo {
    left: 50%;
    top: 30%;
    font-size: 2rem;
    font-weight: bold;
    color: #ffd700;
    text-shadow: 1px 1px 0 #000;
    animation: fxCombo 1s ease-out forwards;
  }
  @keyframes fxCombo {
    0% {
      opacity: 0;
      transform: translateX(-50%) translateY(10px) scale(0.8);
    }
    25% {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1.2);
    }
    75% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
  }

  /* pixel-scatter */
  .fx-pixels {
    position: absolute;
    left: var(--fx-side);
    top: 40%;
    pointer-events: none;
    z-index: 20;
  }
  .fx-pixel {
    position: absolute;
    left: var(--px);
    top: 0;
    width: var(--psize);
    height: var(--psize);
    background: var(--color-black);
    animation: fxPixel 0.9s var(--pdelay) ease-in forwards;
  }
  @keyframes fxPixel {
    0% {
      opacity: 1;
      transform: translateY(0) rotate(0deg);
    }
    100% {
      opacity: 0;
      transform: translateY(80px) rotate(180deg);
    }
  }

  /* ── Debug panel ──────────────────────────────────── */
  .fx-debug-panel {
    position: fixed;
    bottom: 60px;
    right: 0;
    background: var(--color-bkggrey);
    border: var(--border);
    border-right: none;
    padding: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    z-index: 100;
    max-height: 60vh;
    overflow-y: auto;
  }
  .fx-debug-title {
    text-transform: uppercase;
    opacity: 0.5;
    margin-bottom: var(--spacing-xs);
  }
  .fx-debug-btn {
    text-align: left;
    background: none;
    border: var(--border);
    cursor: pointer;
    text-transform: uppercase;
    opacity: 0.6;
    padding: var(--spacing-xs) var(--spacing-sm);
  }
  .fx-debug-btn:hover {
    opacity: 1;
  }
  .fx-debug-active {
    background: var(--color-black);
    color: var(--color-white);
    opacity: 1;
  }
</style>
