<script>
  import { onMount, onDestroy } from "svelte";
  import { getSortedList, getListInfo, navigate } from "../lib/api.js";

  export let listName = "";
  export let isMobile = false;

  let items = [];
  let listInfo = {};
  let loading = true;

  let view = "grid";
  let columns = isMobile ? 2 : 4;
  let listViewEl;
  let voteBarHeight = 0;

  function updateVoteBar() {
    if (!listViewEl) return;
    const bottom = listViewEl.getBoundingClientRect().bottom;
    voteBarHeight = Math.max(0, window.innerHeight - Math.max(0, bottom));
  }
  const MIN_COLUMNS = 2;
  const MAX_COLUMNS = 8;

  const baseDPR = window.devicePixelRatio;

  function updateColumns() {
    const zoom = window.devicePixelRatio / baseDPR;
    const raw = Math.round(4 / zoom);
    columns = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, raw));
  }

  function watchDPR() {
    const mql = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mql.addEventListener(
      "change",
      () => {
        updateColumns();
        watchDPR();
      },
      { once: true },
    );
  }

  function formatTimestamp(ts) {
    if (!ts) return "never";
    const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  onDestroy(() => {
    window.removeEventListener("scroll", updateVoteBar);
  });

  onMount(async () => {
    watchDPR();
    window.addEventListener("scroll", updateVoteBar, { passive: true });
    try {
      const [sorted, info] = await Promise.all([
        getSortedList(listName),
        getListInfo(listName),
      ]);
      items = sorted || [];
      listInfo = info || {};
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <!-- <p class="text-base">Loading...</p> -->
{:else}
  <div class="list-header" class:mobile={isMobile}>
    <div class="list-header-data">
      <div class="list-title text-base">{listName}</div>
      <div class="list-data text-base">
        By {listInfo.author}<br />
        {listInfo.itemCount} items<br />
        {listInfo.voteCount} votes<br />
        {formatTimestamp(listInfo.lastVoteTimestamp)}
      </div>
    </div>

    <div class="view">
      <div
        class="text-base"
        class:active={view === "grid"}
        on:click={() => (view = "grid")}>Grid</div
      >

      <div
        class="text-base"
        class:active={view === "list"}
        on:click={() => (view = "list")}>List</div
      >
    </div>
  </div>

  <div class="page-container" class:mobile={isMobile}>
    <div
      class="list-view view-{view}"
      style="--columns: {columns}"
      bind:this={listViewEl}
    >
      {#each items as item, i}
        <div class="item item-grid">
          <div class="item-data-wrapper">
            <div class="item-data rank text-base">{i + 1}</div>
            <div class="item-data name text-base">{item.name}</div>
          </div>
          <div class="item-data img">
            {#if item.data?.picture}
              <img src={item.data.picture} alt={item.name} />
            {:else}
              <div class="img-empty"></div>
            {/if}
          </div>
          <div class="item-data elo text-base">{Math.round(item.elo)}</div>
        </div>

        <div class="item item-list">
          <div class="item-data-wrapper">
            <div class="item-data rank text-base">{i + 1}</div>
            <div class="item-data name text-base">{item.name}</div>
          </div>

          <div class="item-data img">
            {#if item.data?.picture}
              <img src={item.data.picture} alt={item.name} />
            {:else}
              <div class="img-empty"></div>
            {/if}
          </div>
          <div class="item-data elo text-base">{Math.round(item.elo)}</div>
        </div>
      {/each}
    </div>
    <button
      class="mobile-edit-btn text-base"
      class:mobile={isMobile}
      on:click={() =>
        navigate(`/?view=edit&listName=${encodeURIComponent(listName)}`)}
      >Edit</button
    >
  </div>
  <button
    class="edit-btn text-base"
    class:mobile={isMobile}
    on:click={() =>
      navigate(`/?view=edit&listName=${encodeURIComponent(listName)}`)}
    >Edit</button
  >

  <div class="vote-spacer"></div>
  <div class="vote-bar" style="height: {voteBarHeight}px">
    <button
      class="text-base"
      on:click={() =>
        navigate(`/?view=vote&listName=${encodeURIComponent(listName)}`)}
      >Vote</button
    >
  </div>
{/if}

<style>
  .list-header {
    width: calc(var(--desktop-max-width));
    margin: auto;
    margin-bottom: var(--spacing-xlg);
    margin-top: 20px;
  }
  .list-header.mobile {
    width: 100%;
  }
  .list-header-data {
    display: flex;
    border-bottom: 1px solid var(--color-grey);
    padding-bottom: var(--spacing-xlg);
    margin-bottom: var(--spacing-md);
  }
  .list-title {
    width: calc(var(--desktop-max-width) / 2);
    /* margin: auto; */
    text-transform: uppercase;
    /* padding: var(--spacing-md) 0; */
    text-align: left;
  }
  .list-data {
    text-align: right;
    width: 100%;
  }
  .list-actions {
    width: var(--desktop-max-width);
    margin: auto;
    padding-bottom: var(--spacing-md);
  }

  .list-actions button {
    background: none;
    cursor: pointer;
    width: 100%;
  }

  .vote-spacer {
    height: 100vh;
  }

  .vote-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    pointer-events: none;
  }

  .vote-bar button {
    width: var(--desktop-max-width);
    margin: auto;
    cursor: pointer;
    background: var(--color-white);
    pointer-events: auto;
    height: 100%;
    min-height: fit-content;
  }

  .vote-bar button:hover {
    background: var(--color-black);
    color: var(--color-white);
  }

  .page-container {
    display: flex;
    width: 100%;
  }
  .page-container.mobile .list-view {
    width: 100%;
  }
  .list-info {
    width: calc((100vw - var(--desktop-max-width)) / 2);
    flex-shrink: 0;
    box-sizing: border-box;
    position: sticky;
    top: 0;
    align-self: flex-start;
  }
  .edit-btn {
    position: fixed;
    top: 20px;
    right: 0;
    cursor: pointer;
    margin-right: 20px;
    z-index: 3;
  }
  .mobile-edit-btn {
    display: none;
  }
  .mobile.edit-btn {
    display: none;
  }
  .mobile.mobile-edit-btn {
    display: block;
  }
  .list-view {
    width: var(--desktop-max-width);
    flex-shrink: 0;
    box-sizing: border-box;
    margin: auto;
  }
  .view,
  .actions {
    display: flex;
    justify-content: space-between;
  }

  .view .active {
    text-decoration: underline;
    cursor: default;
  }

  .view div:not(.active) {
    cursor: pointer;
  }
  .item:hover {
    background-color: var(--color-highlight);
  }
  .view-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  .view-list .item-list {
    display: flex;
    align-items: center;
    height: 15rem;
    gap: var(--spacing-md);
  }
  .view-list .item-data-wrapper {
    gap: var(--spacing-md);
  }
  .view-list .item-list .item-data-wrapper,
  .view-list .item-list .elo {
    flex: 1;
  }

  .view-list .item-list .elo {
    text-align: right;
  }
  .view-list .img {
    height: 100%;
  }

  .view-list .img img,
  .view-list .img-empty {
    height: 100%;
    aspect-ratio: 1/1;
  }

  .view-list .img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    aspect-ratio: 1/1;
  }

  .view-list .item-grid {
    display: none;
  }

  .view-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-md);
  }
  .view-grid .item-grid {
    flex-direction: column;
    width: calc(
      ((100% - var(--spacing-md) * (var(--columns) - 1)) / var(--columns))
    );
    box-sizing: border-box;
  }
  .view-grid .item-list {
    display: none;
  }

  .view-grid .img {
    width: 100%;
  }

  .view-grid .img img,
  .view-grid .img-empty {
    width: 100%;
    aspect-ratio: 1/1;
  }

  .view-grid .img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    aspect-ratio: 1/1;
  }

  .item-data-wrapper {
    display: flex;
    width: 100%;
  }
  .view-grid .rank {
    flex-shrink: 0;
    margin-right: var(--spacing-md);
  }

  .view-grid .name {
    flex: 1;
    text-align: left;
    overflow: hidden;
    white-space: nowrap;
    /* text-overflow: ellipsis; */
  }

  .view-grid .elo {
    text-align: right;
    width: 100%;
  }
</style>
