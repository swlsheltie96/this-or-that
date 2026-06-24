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
  import EffectOverlay from "./EffectOverlay.svelte";

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
      viewMode = listInfo?.noImages ? "list" : "grid";
      loadRankings();
    } else if (viewMode === "grid") {
      viewMode = "list";
    } else {
      viewMode = listInfo?.noImages ? "list" : "grid";
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

  let unreadCount = 0;
  let commentText = "";
  let showChat = false;

  const SOUNDS = [
    "sound_004",
    "sound_007",
    "sound_009",
    "sound_054",
    "sound_055",
    "sound_056",
    "sound_057",
    "sound_063",
    "sound_064",
    "sound_065",
    "sound_066",
    "sound_070",
    "sound_071",
    "sound_072",
    "sound_076",
    "sound_080",
    "sound_088",
    "sound_091",
    "sound_097",
    "sound_100",
    "sound_102",
    "sound_109",
    "sound_124",
  ];

  function playVoteSound() {
    const name = SOUNDS[Math.floor(Math.random() * SOUNDS.length)];
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.play().catch(() => {});
  }

  function playTone() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }

  function playNumberOneSound() {
    const audio = new Audio(`/sounds/sound_064.mp3`);
    audio.play().catch(() => {});
  }

  function triggerNumberOne(item, name) {
    numberOneItem = item;
    playNumberOneSound();
    if (name && typeof speechSynthesis !== "undefined") {
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(name);
        const apply = () => {
          const voice = speechSynthesis.getVoices().find(v => v.name === "Good News");
          if (voice) utterance.voice = voice;
          speechSynthesis.speak(utterance);
        };
        if (speechSynthesis.getVoices().length > 0) apply();
        else speechSynthesis.addEventListener("voiceschanged", apply, { once: true });
      }, 600);
    }
    setTimeout(() => { numberOneItem = 0; }, 2000);
  }

  const TAG_WORDS = ["I VOTED"];
  let voteTags = [];
  let voteTagItem = 0;
  let debugMode = false;
  let activeEffect = "tags";
  let rankFlash = null; // { item, text }
  let numberOneItem = 0;
  let voteItem1El, voteItem2El, mobileWrap1El, mobileWrap2El;

  const EFFECTS = ["tags", "rank", "#1"];

  function spawnTags(item, pos = { x: 50, y: 50 }) {
    voteTagItem = item;
    const rot = (Math.random() - 0.5) * 30;
    voteTags = [{ id: Date.now(), x: pos.x, y: pos.y, rot, word: TAG_WORDS[0] }];
    if (!debugMode) {
      setTimeout(() => {
        voteTags = [];
        voteTagItem = 0;
      }, 900);
    }
  }

  function triggerRankFlash(item, text) {
    rankFlash = { item, text };
    setTimeout(() => { rankFlash = null; }, 3000);
  }

  function runEffect(item, delta, pos) {
    if (activeEffect === "tags") {
      spawnTags(item, pos);
    } else if (activeEffect === "rank") {
      if (debugMode) {
        const newRank = Math.floor(Math.random() * 5) + 2;
        const name = item === 1 ? pairData.item1.name : pairData.item2.name;
        triggerRankFlash(item, `${name} is now #${newRank}`);
      }
    } else if (activeEffect === "#1") {
      if (debugMode) {
        const name = item === 1 ? pairData.item1.name : pairData.item2.name;
        triggerNumberOne(item, name);
        triggerRankFlash(item, `${name} is now #1`);
      }
    }
  }

  $: if (commentText) showChat = true;

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

  async function castVote(winner, loser, item, pos = { x: 50, y: 50 }) {
    if (debugMode) {
      runEffect(item, 16, pos);
      return;
    }
    if (voting) return;
    voting = true;
    selectedItem = item;
    const winnerElo = item === 1 ? pairData.item1.elo : pairData.item2.elo;
    const loserElo = item === 1 ? pairData.item2.elo : pairData.item1.elo;
    const delta = calcDelta(winnerElo, loserElo);
    playTone();
    spawnTags(item, pos);
    animateWinnerElo(winnerElo, winnerElo + delta);
    animateLoserElo(loserElo, loserElo - delta);
    const effectStart = Date.now();
    const effectDuration = 900;
    try {
      const oldRank = rankedItems.findIndex((r) => r.name === winner);
      await new Promise((r) => setTimeout(r, 700));
      await vote(listName, winner, loser);
      selectedItem = 0;
      winnerCountElo = null;
      loserCountElo = null;
      const res = await getSortedList(listName);
      const newRanked = (res || []).map((r, i) => ({ ...r, rank: i + 1 }));
      const newRankIdx = newRanked.findIndex((r) => r.name === winner);
      let rankFlashDuration = 0;
      if (newRankIdx === 0 && oldRank !== 0) {
        triggerNumberOne(item, winner);
        triggerRankFlash(item, `${winner} is now #1`);
        rankFlashDuration = 3000;
        winnerCountElo = null;
        loserCountElo = null;
      } else if (oldRank !== -1) {
        const jumped = oldRank - newRankIdx;
        if (jumped > 0) {
          triggerRankFlash(item, `${winner} is now #${newRankIdx + 1}`);
          rankFlashDuration = 3000;
          winnerCountElo = null;
          loserCountElo = null;
        }
      }
      rankedItems = newRanked;
      if (!isMobile) hoveredItemName = newRanked[0]?.name ?? "";
      const elapsed = Date.now() - effectStart;
      const remaining = Math.max(rankFlashDuration, effectDuration - elapsed);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
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
    document.title = "This or That";
  });
</script>

{#if showDropdown}
  <div class="dropdown-overlay">
    <Header />
    <div class="list-name-bar no-border">
      <button
        class="text-base"
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
      <!-- debug
      <button
        class="text-base"
        class:active={debugMode}
        on:click={() => (debugMode = !debugMode)}>Debug</button
      >
      {#if debugMode}
        {#each EFFECTS as fx}
          <button
            class="text-base"
            class:active={activeEffect === fx}
            on:click={() => (activeEffect = fx)}>{fx}{fx === "grid" ? " (depr)" : ""}</button
          >
        {/each}
      {/if}
      -->
      <button
        class="text-base"
        class:active={viewMode !== "vote"}
        on:click={toggleView}>{viewButtonLabel}</button
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
                      noImages={listInfo?.noImages}
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
            bind:this={mobileWrap1El}
            class:selected={selectedItem === 1}
            class:loser={selectedItem === 2}
            role="button"
            tabindex="0"
            on:click={(e) => { const r = e.currentTarget.getBoundingClientRect(); castVote(pairData.item1.name, pairData.item2.name, 1, { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
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
            <EffectOverlay item={1} {voteTags} {voteTagItem} />
          </div>

          <div class="mobile-names">
            <div class="text-base mobile-name-text" class:rank-flash={rankFlash?.item === 1}>
              {rankFlash?.item === 1
                ? rankFlash.text
                : selectedItem === 1
                  ? (winnerCountElo ?? Math.round(pairData.item1.elo))
                  : selectedItem === 2
                    ? (loserCountElo ?? Math.round(pairData.item1.elo))
                    : pairData.item1.name}
            </div>
            <div
              class="text-small mobile-or-text"
              class:hidden={selectedItem !== 0}>or</div
            >
            <div class="text-base mobile-name-text" class:rank-flash={rankFlash?.item === 2}>
              {rankFlash?.item === 2
                ? rankFlash.text
                : selectedItem === 2
                  ? (winnerCountElo ?? Math.round(pairData.item2.elo))
                  : selectedItem === 1
                    ? (loserCountElo ?? Math.round(pairData.item2.elo))
                    : pairData.item2.name}
            </div>
          </div>

          <div
            class="mobile-image-wrap"
            bind:this={mobileWrap2El}
            class:selected={selectedItem === 2}
            class:loser={selectedItem === 1}
            role="button"
            tabindex="0"
            on:click={(e) => { const r = e.currentTarget.getBoundingClientRect(); castVote(pairData.item2.name, pairData.item1.name, 2, { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
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
            <EffectOverlay item={2} {voteTags} {voteTagItem} />
          </div>
        </div>
      {:else}
        <div class="vote-container">
          <div class="images-row">
            <div
              class="vote-item vote-item-1"
              bind:this={voteItem1El}
              class:disabled={voting}
              class:selected={selectedItem === 1}
              class:loser={selectedItem === 2}
              role="button"
              tabindex="0"
              on:mouseenter={() => (hoveredItem = 1)}
              on:mouseleave={() => (hoveredItem = 0)}
              on:click={(e) => { const r = e.currentTarget.getBoundingClientRect(); castVote(pairData.item1.name, pairData.item2.name, 1, { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
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
              <EffectOverlay item={1} {voteTags} {voteTagItem} />
            </div>

            <div
              class="vote-item vote-item-2"
              bind:this={voteItem2El}
              class:disabled={voting}
              class:selected={selectedItem === 2}
              class:loser={selectedItem === 1}
              role="button"
              tabindex="0"
              on:mouseenter={() => (hoveredItem = 2)}
              on:mouseleave={() => (hoveredItem = 0)}
              on:click={(e) => { const r = e.currentTarget.getBoundingClientRect(); castVote(pairData.item2.name, pairData.item1.name, 2, { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
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
              <EffectOverlay item={2} {voteTags} {voteTagItem} />
            </div>
          </div>

          <div class="names-row">
            <div
              class="name text-base"
              class:hovered={hoveredItem === 1 && selectedItem === 0}
              class:rank-flash={rankFlash?.item === 1}
            >
              {rankFlash?.item === 1
                ? rankFlash.text
                : selectedItem === 1
                  ? (winnerCountElo ?? Math.round(pairData.item1.elo))
                  : selectedItem === 2
                    ? (loserCountElo ?? Math.round(pairData.item1.elo))
                    : pairData.item1.name}
            </div>
            <div class="or text-base">or</div>
            <div
              class="name text-base"
              class:hovered={hoveredItem === 2 && selectedItem === 0}
              class:rank-flash={rankFlash?.item === 2}
            >
              {rankFlash?.item === 2
                ? rankFlash.text
                : selectedItem === 2
                  ? (winnerCountElo ?? Math.round(pairData.item2.elo))
                  : selectedItem === 1
                    ? (loserCountElo ?? Math.round(pairData.item2.elo))
                    : pairData.item2.name}
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<div class="bottom-row">
  {#if showChat && $chatMessages.length > 0}
    <div class="chat-messages-area" bind:this={messagesEl}>
      {#each $chatMessages as msg}
        <div class="chat-message text-base">
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
      class="text-base chat-name-input"
      bind:value={$chatName}
      on:keydown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") e.target.blur();
      }}
    />
    <input
      class="text-base chat-input"
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
    gap: var(--spacing-md);
    position: relative;
  }

  .list-name-bar button {
    min-width: 80px;
  }

  .list-name-bar.no-border {
    border-bottom: none;
  }

  .list-name-toggle {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    text-transform: uppercase;
    gap: var(--spacing-md);
    max-width: 50%;
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

  @keyframes rank-typewriter {
    from { clip-path: inset(0 100% 0 0); }
    to   { clip-path: inset(0 0% 0 0); }
  }

  @keyframes rank-blink {
    0%   { opacity: 1; }
    12%  { opacity: 1; }
    13%  { opacity: 0; }
    25%  { opacity: 0; }
    26%  { opacity: 1; }
    37%  { opacity: 1; }
    38%  { opacity: 0; }
    50%  { opacity: 0; }
    51%  { opacity: 1; }
    62%  { opacity: 1; }
    63%  { opacity: 0; }
    75%  { opacity: 0; }
    76%  { opacity: 1; }
    87%  { opacity: 1; }
    88%  { opacity: 0; }
    99%  { opacity: 0; }
    100% { opacity: 1; }
  }

  .rank-flash {
    animation:
      rank-typewriter 1s steps(20, end) forwards,
      rank-blink 1s steps(1, end) 1s forwards;
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
    position: relative;
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

  .vote-item.loser img,
  .vote-item.loser .img-empty {
    filter: grayscale(1);
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
    position: relative;
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
    color: var(--color-black);
    background-color: var(--color-grey);
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
</style>
