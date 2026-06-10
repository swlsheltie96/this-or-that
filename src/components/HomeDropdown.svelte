<script>
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import { getListsWithPopularity, navigate } from "../lib/api.js";
  import { preloadList } from "../lib/listCache.js";

  export let isMobile = false;

  const dispatch = createEventDispatcher();

  let lists = [];
  let searchQuery = "";
  let sortBy = "recent";
  let listsEl;
  let listItemEls = [];
  let activeIndex = 0;
  let cycleTimer = null;
  const labelStyles = new Map();

  function getLabelStyle(name) {
    if (!labelStyles.has(name)) {
      const left = Math.floor(Math.random() * 55) + 5;
      const rotation = Math.floor(Math.random() * 36) - 18;
      labelStyles.set(
        name,
        `left:${left}%;top:50%;transform:translateY(-50%) rotate(${rotation}deg);`,
      );
    }
    return labelStyles.get(name);
  }

  const sortOptions = [
    { key: "recent", label: "Recently Voted" },
    { key: "title", label: "Title" },
    { key: "length", label: "Length" },
  ];

  const sortKeys = sortOptions.map((o) => o.key);
  function cycleSortBy() {
    const idx = sortKeys.indexOf(sortBy);
    sortBy = sortKeys[(idx + 1) % sortKeys.length];
  }

  $: sortLabel = sortOptions.find((o) => o.key === sortBy)?.label ?? "";

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

  $: sortedLists = [...lists].sort((a, b) => {
    if (sortBy === "title") return a.name.localeCompare(b.name);
    if (sortBy === "length") return b.itemCount - a.itemCount;
    return (
      new Date(b.lastVoteTimestamp || 0) - new Date(a.lastVoteTimestamp || 0)
    );
  });

  $: filteredLists = searchQuery
    ? sortedLists.filter((l) =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : sortedLists;

  $: if (filteredLists.length > 0) {
    dispatch("activeList", {
      listName: filteredLists[activeIndex]?.name ?? filteredLists[0].name,
    });
  }

  function setActive(i) {
    activeIndex = i;
    const name = filteredLists[i]?.name;
    dispatch("activeList", { listName: name });
    if (name) preloadList(name);
  }

  function startCycling() {
    stopCycling();
    cycleTimer = setInterval(() => {
      if (filteredLists.length === 0) return;
      let next = activeIndex;
      if (filteredLists.length > 1) {
        do {
          next = Math.floor(Math.random() * filteredLists.length);
        } while (next === activeIndex);
      }
      setActive(next);
    }, 3000);
  }

  function stopCycling() {
    if (cycleTimer) {
      clearInterval(cycleTimer);
      cycleTimer = null;
    }
  }

  function handleScroll() {
    if (!isMobile || !listsEl || listItemEls.length === 0) return;
    const containerTop = listsEl.getBoundingClientRect().top;
    let closestIdx = 0;
    let closestDist = Infinity;
    listItemEls.forEach((el, i) => {
      if (!el) return;
      const dist = Math.abs(el.getBoundingClientRect().top - containerTop);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });
    if (closestIdx !== activeIndex) {
      activeIndex = closestIdx;
      dispatch("activeList", { listName: filteredLists[activeIndex]?.name });
    }
  }

  onMount(async () => {
    try {
      const res = await getListsWithPopularity();
      lists = res.lists || [];
      if (lists.length > 0) preloadList(lists[0].name);
      if (!isMobile) startCycling();
    } catch (e) {}
  });

  onDestroy(() => stopCycling());
</script>

<div class="home-dropdown">
  <div class="controls-row">
    <input
      type="text"
      placeholder="Search..."
      bind:value={searchQuery}
      class="text-base search-input"
    />
    <div class="controls-buttons">
      <button class="text-base" on:click={cycleSortBy}>Sort: {sortLabel}</button
      >
      <button class="text-base" on:click={() => navigate("/?view=edit")}
        >Create</button
      >
    </div>
  </div>

  <div class="lists-wrapper">
    <div
      class="lists"
      bind:this={listsEl}
      on:scroll={handleScroll}
      on:mouseenter={() => {
        if (!isMobile) stopCycling();
      }}
      on:mouseleave={() => {
        if (!isMobile) startCycling();
      }}
    >
      {#each filteredLists as list, i}
        <div
          class="list-item text-base"
          class:active={i === activeIndex}
          class:prev-item={isMobile && i < activeIndex}
          bind:this={listItemEls[i]}
          on:mouseenter={() => {
            if (!isMobile) setActive(i);
          }}
          on:click={() =>
            navigate(`/?view=vote&listName=${encodeURIComponent(list.name)}`)}
        >
          <span
            class="vote-now-label text-small"
            style={getLabelStyle(list.name)}>VOTE NOW</span
          >
          <span class="name">{list.name}</span>
          <span class="count">{list.itemCount}</span>
          <span class="recency">{timeAgo(list.lastVoteTimestamp)}</span>
        </div>
      {/each}
      {#if isMobile}<div class="list-spacer"></div>{/if}
      <!-- <div class="list-footer text-small"
        ><a href="https://www.shannonlin.xyz"
          >Designed and built by Shannon Lin</a
        ></div
      > -->
    </div>
    <slot />
  </div>
</div>

<style>
  .home-dropdown {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) 0 var(--spacing-sm) var(--spacing-margin);
    gap: var(--spacing-md);
  }

  .search-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    padding: 0;
  }

  .controls-buttons {
    display: flex;
    gap: var(--spacing-md);
    flex-shrink: 0;
  }

  .lists-wrapper {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .lists {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    /* padding: 0 var(--spacing-margin); */
    /* scroll-snap-type: y mandatory; */
    scrollbar-width: none;
  }

  .lists::-webkit-scrollbar {
    display: none;
  }

  .lists::before {
    content: "";
    display: block;
    height: calc(var(--spacing-margin) / 2);
  }
  @media (max-width: 740px) {
    .controls-row {
      flex-direction: column-reverse;
      padding: 0;
    }
    .controls-buttons {
      width: 100%;
      justify-content: space-between;
    }
    .search-input {
      width: 100%;
      padding: var(--spacing-md) 0;
    }
    .lists::before {
      content: "";
      display: none;
    }
  }
  .list-spacer {
    height: calc(100% - 4em - var(--spacing-margin));
  }

  .list-item {
    position: relative;
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-margin);
    cursor: pointer;
    transition: none;
    scroll-snap-align: start;
    border-bottom: 1.5px solid var(--color-black);
    overflow: hidden;
  }
  @media (max-width: 740px) {
    .list-item {
      padding: var(--spacing-md) 0;
    }
  }

  .list-item:hover {
    background-color: var(--color-black);
    color: var(--color-white);
    border-radius: var(--border-radius);
  }

  .list-item:has(+ .list-item:hover) {
    border-bottom-color: transparent;
  }

  .list-item:last-child {
    border-bottom: none;
  }

  .vote-now-label {
    position: absolute;
    background: var(--color-white);
    color: var(--color-black);
    padding: 2px var(--spacing-sm);
    /* border-radius: var(--border-radius); */

    text-transform: uppercase;
    pointer-events: none;
    opacity: 0;
    /* transition: opacity 0.1s; */
    white-space: nowrap;
    z-index: 1;
  }

  .list-item:hover .vote-now-label {
    opacity: 1;
  }

  .list-item.prev-item {
    opacity: 0;
  }

  @media (min-width: 740px) {
    .list-item {
      padding: 12px var(--spacing-margin);
    }
  }

  .name {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .count {
    flex-shrink: 0;
    text-align: right;
    width: 3ch;
  }

  .recency {
    flex-shrink: 0;
    text-align: right;
    width: 3ch;
  }

  .list-footer {
    padding: var(--spacing-md) var(--spacing-margin);
    padding-bottom: var(--spacing-margin);
    opacity: 0.4;
  }
</style>
