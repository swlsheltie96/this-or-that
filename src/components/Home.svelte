<script>
  import { onMount, onDestroy, tick } from "svelte";
  import { getListsWithPopularity, navigate } from "../lib/api.js";
  import TickerTape from "./TickerTape.svelte";
  import { onTick } from "../lib/sharedTick.js";

  export let isMobile = false;

  let imgPlaceholderHeight = 0;

  let lists = [];
  let loading = true;
  let hoveredList = null;
  let randomIdx = 0;
  let cycleTimer;
  let sortBy = "recent";
  let showSortMenu = false;
  let showInfo = false;

  let highlightedIndex = 0;
  let listItemEls = [];
  let listsEl;
  let spacerEl;
  let hasScrolled = false;
  let overlayContentHeight = 0;

  $: if (isMobile && overlayContentHeight)
    document.documentElement.style.setProperty(
      "--header-home-mobile",
      `calc(${overlayContentHeight}px + 1.25rem + var(--spacing-md) + var(--spacing-xlg))`,
    );

  const sortOptions = [
    { key: "title", label: "Title" },
    { key: "length", label: "Length" },
    { key: "recent", label: "Recently Voted" },
  ];

  $: sortedLists = [...lists].sort((a, b) => {
    if (sortBy === "title") return a.name.localeCompare(b.name);
    if (sortBy === "length") return b.itemCount - a.itemCount;
    return (
      new Date(b.lastVoteTimestamp || 0) - new Date(a.lastVoteTimestamp || 0)
    );
  });

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

  function pickRandom() {
    if (lists.length < 2) return;
    let next;
    do {
      next = Math.floor(Math.random() * lists.length);
    } while (next === randomIdx);
    randomIdx = next;
  }

  function updateHighlight() {
    if (!listsEl || !isMobile) return;
    hasScrolled = listsEl.scrollTop > 0;
    const containerTop = listsEl.getBoundingClientRect().top;
    const targetY = containerTop + (spacerEl?.offsetHeight ?? 0);
    let closestIdx = 0;
    let closestDist = Infinity;
    listItemEls.forEach((el, i) => {
      if (!el) return;
      const dist = Math.abs(el.getBoundingClientRect().top - targetY);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });
    highlightedIndex = closestIdx;
  }

  let snapping = false;
  let wheelAccum = 0;
  let wheelResetTimer;
  const WHEEL_THRESHOLD = 2;

  function snapBy(direction) {
    if (!listsEl || snapping) return;
    snapping = true;
    const itemHeight =
      listItemEls.find((el) => el)?.offsetHeight ??
      spacerEl?.offsetHeight ??
      50;
    listsEl.scrollBy({ top: direction * itemHeight, behavior: "smooth" });
    setTimeout(() => {
      snapping = false;
    }, 100);
  }

  function handleWheel(e) {
    if (!listsEl) return;
    e.preventDefault();
    if (snapping) return;
    wheelAccum += e.deltaY;
    clearTimeout(wheelResetTimer);
    wheelResetTimer = setTimeout(() => {
      wheelAccum = 0;
    }, 200);
    if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;
    const direction = Math.sign(wheelAccum);
    wheelAccum = 0;
    snapBy(direction);
  }


  onMount(async () => {
    if (isMobile) {
      document.body.style.overflow = "hidden";
      window.addEventListener("wheel", handleWheel, { passive: false });
    }
    try {
      const response = await getListsWithPopularity();
      lists = response.lists || [];
      randomIdx = Math.floor(Math.random() * lists.length);
      cycleTimer = setInterval(pickRandom, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
      if (isMobile) {
        await tick();
        updateHighlight();
      }
    }
  });

  function marquee(node, text) {
    let raf;
    let unsubScroll;
    let position = 0;

    function startScroll() {
      unsubScroll?.();
      position = 0;
      unsubScroll = onTick(() => {
        position -= 5;
        const halfWidth = node.scrollWidth / 2;
        if (Math.abs(position) >= halfWidth) position = 0;
        node.style.transform = `translateX(${position}px)`;
      });
    }

    function apply(t) {
      cancelAnimationFrame(raf);
      unsubScroll?.();
      node.style.transform = "";
      node.textContent = t || "";
      if (!t) return;
      raf = requestAnimationFrame(() => {
        const parent = node.parentElement;
        if (parent && node.offsetWidth > parent.clientWidth) {
          node.textContent = t + "     " + t;
          parent.style.textAlign = "left";
          startScroll();
        } else if (parent) {
          parent.style.textAlign = "center";
        }
      });
    }

    apply(text);
    return {
      update: apply,
      destroy() {
        cancelAnimationFrame(raf);
        unsubScroll?.();
      },
    };
  }

  onDestroy(() => {
    clearInterval(cycleTimer);
    if (isMobile) {
      document.body.style.overflow = "";
      window.removeEventListener("wheel", handleWheel);
    }
  });

  $: displayList = isMobile
    ? hasScrolled
      ? (sortedLists[highlightedIndex] ?? null)
      : (lists[randomIdx] ?? null)
    : (hoveredList ?? lists[randomIdx] ?? null);
  $: overlay_img_1 = (displayList?.previewImages || [])[0] || null;
  $: overlay_img_2 = (displayList?.previewImages || [])[1] || null;
  $: overlay_item_1 = (displayList?.itemsList || "").split(", ")[0];
  $: overlay_item_2 = (displayList?.itemsList || "").split(", ")[1];
</script>

{#if loading}
  <!-- <p>Loading...</p> -->
{:else}
  {#if !isMobile}<TickerTape {isMobile} />{/if}
  {#if isMobile}
    <div class="mobile-controls">
      <button class="sort-btn" on:click={() => (showSortMenu = !showSortMenu)}>
        Sort: {sortOptions.find((o) => o.key === sortBy)?.label}
      </button>
      <button on:click={() => navigate("/?view=edit")}>Create a List</button>
    </div>
    {#if showSortMenu}
      <div class="sort-menu">
        {#each sortOptions as opt}
          <button
            class:active={sortBy === opt.key}
            on:click={() => {
              sortBy = opt.key;
              showSortMenu = false;
            }}>{opt.label}</button
          >
        {/each}
      </div>
    {/if}
  {:else}
    <button class="sort-btn" on:click={() => (showSortMenu = !showSortMenu)}>
      Sort: {sortOptions.find((o) => o.key === sortBy)?.label}
    </button>
    {#if showSortMenu}
      <div class="sort-menu">
        {#each sortOptions as opt}
          <button
            class:active={sortBy === opt.key}
            on:click={() => {
              sortBy = opt.key;
              showSortMenu = false;
            }}>{opt.label}</button
          >
        {/each}
      </div>
    {/if}
  {/if}
  <button class="create-btn" on:click={() => navigate("/?view=edit")}
    >Create a List</button
  >
  <button
    class="info-btn"
    class:active={showInfo}
    on:click={() => (showInfo = !showInfo)}>Info</button
  >

  {#if showInfo}
    <div class="info-row">
      <div class="info-spacer-left"></div>
      <div class="info-spacer-preview"></div>
      <div class="info-box text-base">
        This or That is a pairwise ranking tool powered by the Elo algorithm.
        Pick between two options, and the rankings take care of themselves.
        Create your own list and see what comes out on top.
      </div>
    </div>
  {/if}

  <div
    class="preview-overlay"
    class:mobile={isMobile}
    on:click={() => isMobile && displayList && navigate(`/?view=vote&listName=${encodeURIComponent(displayList.name)}`)}
    style={isMobile && displayList ? 'cursor: pointer;' : undefined}
  >
    <div class="overlay-content" bind:clientHeight={overlayContentHeight}>
      <div class="overlay-item">
        <div class="img-placeholder" bind:clientHeight={imgPlaceholderHeight}>
          {#if overlay_img_1}<img
              src={overlay_img_1}
              alt={overlay_item_1}
            />{/if}
        </div>
        <div class="text-base overlay-name"
          ><span class="marquee-inner" use:marquee={overlay_item_1}></span></div
        >
      </div>
      <div class="text-base or">or</div>
      <div class="overlay-item">
        <div class="img-placeholder">
          {#if overlay_img_2}<img
              src={overlay_img_2}
              alt={overlay_item_2}
            />{/if}
        </div>
        <div class="text-base overlay-name"
          ><span class="marquee-inner" use:marquee={overlay_item_2}></span></div
        >
      </div>
    </div>
  </div>

  <div
    class="lists"
    class:mobile={isMobile}
    bind:this={listsEl}
    on:scroll={updateHighlight}
  >
    {#if isMobile}<div class="list-spacer" bind:this={spacerEl}></div>{/if}
    {#each sortedLists as list, i}
      {@const item_1 = (list.itemsList || "").split(", ")[0]}
      {@const item_2 = (list.itemsList || "").split(", ")[1]}
      <div
        class="list"
        class:prev-item={isMobile && hasScrolled && i < highlightedIndex}
        class:faded={isMobile && hasScrolled && i > highlightedIndex}
        bind:this={listItemEls[i]}
        on:click={() =>
          navigate(`/?view=vote&listName=${encodeURIComponent(list.name)}`)}
        on:mouseenter={() => (hoveredList = list)}
        on:mouseleave={() => (hoveredList = null)}
        style="cursor: pointer;"
      >
        <div class="list-col title">
          <p class="text-base">{list.name}</p>
        </div>
        <div class="list-col preview">
          <div class="preview-vote">
            <div class="text-base vote-item1">{item_1}</div>
            <div class="text-base or">OR</div>
            <div class="text-base vote-item2">{item_2}</div>
          </div>
        </div>
        <div class="list-col length">
          <p class="text-base">{list.itemCount}</p>
        </div>
        <div class="list-col recency">
          <p class="text-base">{timeAgo(list.lastVoteTimestamp)}</p>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .sort-btn {
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 3;
  }
  .mobile.sort-btn {
    position: static;
    margin: 20px 0 8px;
  }

  .sort-menu {
    position: fixed;
    top: 60px;
    left: 10px;
    z-index: 3;
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: var(--spacing-md);
  }
  @media (max-width: 740px) {
    .sort-menu {
      position: static;
      margin-bottom: var(--spacing-md);
    }
  }

  .sort-menu button {
    margin: 0;
  }

  .sort-menu button.active {
    text-decoration: underline;
  }

  .create-btn {
    position: fixed;
    top: 20px;
    right: 110px;
    z-index: 3;
  }
  @media (max-width: 740px) {
    .create-btn {
      display: none;
    }
  }

  .info-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 3;
  }
  @media (max-width: 740px) {
    .info-btn {
      display: none;
    }
  }

  .info-btn.active {
    color: var(--color-white);
    background-color: var(--color-black);
  }

  .info-row {
    display: flex;
    width: 100%;
    margin-bottom: var(--spacing-md);
  }
  .info-spacer-left {
    flex: 1;
  }
  .info-spacer-preview {
    width: var(--desktop-max-width);
    flex-shrink: 0;
  }
  .info-box {
    flex: 1;
    text-align: left;
  }

  @media (max-width: 740px) {
    .info-spacer-left,
    .info-spacer-preview {
      display: none;
    }
    .info-box {
      width: 100%;
    }
  }

  .list {
    display: flex;
    width: 100%;
    padding: var(--spacing-sm) 0;
  }
  .list:first-child {
    padding-top: 0;
  }
  .list-col {
    /* border: var(--guide); */
  }
  .title,
  .length,
  .recency {
    flex: 1;
  }
  .length p,
  .recency p {
    text-align: right;
  }
  .lists.mobile .recency p {
    text-align: left;
  }
  .lists.mobile .list {
    display: flex;
  }
  .lists.mobile .list-col.recency {
    order: 1;
    flex: 0.5;
    text-align: left;
  }
  .lists.mobile .list-col.title {
    order: 2;
    flex: 3;
    text-align: center;
  }
  .lists.mobile .list-col.title p {
    text-align: center;
  }
  .lists.mobile .list-col.length {
    order: 3;
    flex: 0.5;
  }
  .lists.mobile .list-col.preview {
    display: none;
  }
  .preview-vote {
    color: var(--color-grey);
    display: flex;
    align-items: center;
  }
  .list:hover .preview-vote {
    color: var(--color-black);
    text-transform: uppercase;
  }
  .list:hover {
    background-color: transparent;
  }

  .list {
    transition: opacity 0.25s ease;
  }

  .list.prev-item {
    opacity: 0;
  }

  .list.faded {
    opacity: 0.5;
  }
  .preview {
    width: var(--desktop-max-width);
    flex-shrink: 0;
    visibility: hidden;
  }
  .mobile .preview {
    display: none;
  }
  .preview-vote .vote-item1,
  .preview-vote .vote-item2 {
    flex: 1;
    max-width: calc(50% - 10px);
    text-align: center;
    white-space: nowrap;
  }
  .preview-vote .or {
    flex-shrink: 0;
    visibility: hidden;
  }
  .preview-overlay {
    display: flex;
    position: fixed;
    inset: 0;
    height: 100vh;
    pointer-events: none;
    z-index: 2;
    align-items: center;
    text-transform: uppercase;
  }

  .mobile.preview-overlay {
    height: var(--header-home-mobile);
    top: var(--header-top-offset, var(--ticker-height));
    pointer-events: auto;
  }

  .overlay-content {
    width: var(--desktop-max-width);
    margin: 0 auto;
    display: flex;
    align-items: center;
  }
  .mobile .overlay-content {
    width: 100%;
    box-sizing: border-box;
    padding: 20px;
    align-items: flex-start;
  }
  .overlay-content .or {
    flex-shrink: 0;
  }
  .mobile .overlay-content .or {
    visibility: hidden;
    padding: 0 var(--spacing-lg);
  }
  .overlay-item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .mobile .overlay-item {
    position: relative;
  }
  .img-placeholder {
    width: 100%;
    max-width: 20rem;
    aspect-ratio: 1/1;
    background-color: var(--color-white);
  }
  .img-placeholder img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    aspect-ratio: 1 / 1;
  }
  .overlay-name {
    text-align: left;
    margin-top: var(--spacing-md);
    overflow: hidden;
    white-space: nowrap;
    width: 100%;
  }
  .mobile .overlay-name {
    position: relative;
    max-width: 20rem;
  }

  .marquee-inner {
    display: inline-block;
  }

  .lists.mobile {
    height: calc(
      100dvh - var(--header-top-offset, var(--ticker-height)) -
        var(--header-home-mobile)
    );
    overflow-y: scroll;
    scroll-snap-type: y mandatory;
    scrollbar-width: none;
  }

  .lists.mobile::-webkit-scrollbar {
    display: none;
  }
  .lists.mobile::after {
    content: "";
    display: block;
    height: calc(50vh - 2rem);
  }
  .lists.mobile .list {
    scroll-snap-align: start;
  }

  .list-spacer {
    scroll-snap-align: start;
    height: var(--cell-height);
    flex-shrink: 0;
  }

  .mobile-controls {
    display: flex;
    justify-content: space-between;
    position: fixed;
    bottom: var(--spacing-lg);
    left: var(--spacing-margin);
    right: var(--spacing-margin);
    z-index: 3;
  }

  .mobile-controls button {
    margin: 0;
    position: static;
  }

  .mobile-create-btn {
    width: 100%;
    margin-top: var(--spacing-md);
  }

  .mobile-info-btn.active {
    color: var(--color-white);
    background-color: var(--color-black);
  }
</style>
