<script>
  import { onMount } from "svelte";
  import {
    getSortedList,
    getListInfo,
    getListsWithPopularity,
    navigate,
  } from "../lib/api.js";

  export let listName = "";
  export let isMobile = false;

  let items = [];
  let listInfo = {};
  let loading = true;

  let view = "grid";
  let columns = isMobile ? 2 : 4;
  let listViewEl;
  let allLists = [];
  let showDropdown = false;
  let dropdownTop = 0;
  let mobileHeaderEl;
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

  onMount(async () => {
    watchDPR();
    try {
      const [sorted, info, lists] = await Promise.all([
        getSortedList(listName),
        getListInfo(listName),
        getListsWithPopularity(),
      ]);
      items = sorted || [];
      listInfo = info || {};
      allLists = lists?.lists || [];
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
  {#if isMobile}
    <div class="mobile-header" bind:this={mobileHeaderEl}>
      <button
        class="text-small"
        on:click={() =>
          navigate(`/?view=edit&listName=${encodeURIComponent(listName)}`)}
        >Edit</button
      >
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
          navigate(`/?view=vote&listName=${encodeURIComponent(listName)}`)}
        >Vote</button
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
              navigate(
                `/?view=listview&listName=${encodeURIComponent(list.name)}`,
              );
            }}
          >
            {list.name}
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  <div class="list-header" class:mobile={isMobile}>
    <div class="list-header-data">
      <div class="list-data-left text-small">
        <span class="grid-data-chip text-small">AUTHOR</span>
        {listInfo.author || "—"}
      </div>
      <div class="list-data text-small">
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
            {#if listInfo?.noImages}
              <div class="img-no-image text-item">{item.name}</div>
            {:else if item.data?.picture}
              <img src={item.data.picture} alt={item.name} loading="lazy" />
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
            <div class="item-data elo-mobile text-base"
              >{Math.round(item.elo)}</div
            >
          </div>

          <div class="item-data img">
            {#if listInfo?.noImages}
              <div class="img-no-image text-item">{item.name}</div>
            {:else if item.data?.picture}
              <img src={item.data.picture} alt={item.name} loading="lazy" />
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

  {#if !isMobile}
    <div class="vote-bar">
      <button
        class="text-small vote-btn"
        on:click={() =>
          navigate(`/?view=vote&listName=${encodeURIComponent(listName)}`)}
        >Vote</button
      >
    </div>
  {/if}
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

  .list-data-left {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
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

  .grid-data-chip {
    background-color: var(--color-grey);
    color: var(--color-white);
    padding: 0 var(--spacing-sm);
    padding-top: 1px;
    flex-shrink: 0;
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

  .vote-bar {
    position: fixed;
    top: 20px;
    right: 0;
    display: flex;
    gap: var(--spacing-md);
    z-index: 2;
  }
  .mobile ~ .vote-bar,
  .mobile-header ~ * .vote-bar {
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
    /* color: var(--color-text-faded); */
    padding-bottom: var(--spacing-xlg);
    padding-top: var(--spacing-xlg);
    display: flex;
    justify-content: space-between;
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
    gap: var(--spacing-md);
  }
  .view-list .item-data-wrapper {
    gap: var(--spacing-md);
  }
  .view-list .item-list .item-data-wrapper {
    flex: 1;
    min-width: 0;
  }
  .view-list .item-list .elo {
    flex: 1;
  }

  .view-list .item-list .elo {
    text-align: right;
  }
  .view-list .img {
    width: 25vw;
    height: 25vw;
    flex-shrink: 0;
  }

  .view-list .img img,
  .view-list .img .img-empty {
    width: 100%;
    height: 100%;
    object-fit: contain;
    aspect-ratio: unset;
  }

  .page-container.mobile .view-list .img {
    order: 1;
  }
  .page-container.mobile .view-list .item-data-wrapper {
    order: 2;
  }
  .page-container.mobile .view-list .elo {
    order: 3;
  }

  .elo-mobile {
    display: none;
  }
  .page-container.mobile .elo-mobile {
    display: block;
    flex: 3;
    text-align: right;
  }
  .page-container.mobile .view-list .item-list .rank {
    flex: 1;
  }
  .page-container.mobile .view-list .item-list .name {
    flex: 6;
  }
  .page-container.mobile .view-list .item-list .elo {
    display: none;
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
