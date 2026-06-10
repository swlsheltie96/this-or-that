<script>
  import { onMount, onDestroy, afterUpdate } from "svelte";
  import { onTick } from "../lib/sharedTick.js";
  import { getListsWithPopularity, navigate } from "../lib/api.js";
  import { getCachedTopItems, getCachedListInfo } from "../lib/listCache.js";

  export let listName = "";

  let pair = null;
  let noImages = false;
  let allLists = [];
  let cycleInterval;
  let currentListName = "";
  let prefetchedPair = null;

  let name1El, name2El;
  let name1Pos = 0, name2Pos = 0;
  let unsubNameTick;
  let prevPair = null;

  afterUpdate(() => {
    if (pair !== prevPair) {
      prevPair = pair;
      name1Pos = 0;
      name2Pos = 0;
      if (name1El) name1El.style.transform = "translateX(0)";
      if (name2El) name2El.style.transform = "translateX(0)";
    }
  });

  onMount(() => {
    unsubNameTick = onTick(() => {
      if (name1El) {
        const max = name1El.scrollWidth - name1El.parentElement.clientWidth;
        if (max > 0) {
          name1Pos = name1Pos >= max ? 0 : name1Pos + 5;
          name1El.style.transform = `translateX(${-name1Pos}px)`;
        }
      }
      if (name2El) {
        const max = name2El.scrollWidth - name2El.parentElement.clientWidth;
        if (max > 0) {
          name2Pos = name2Pos >= max ? 0 : name2Pos + 5;
          name2El.style.transform = `translateX(${-name2Pos}px)`;
        }
      }
    });
  });

  async function showList(name) {
    try {
      const [items, info] = await Promise.all([
        getCachedTopItems(name),
        getCachedListInfo(name),
      ]);
      if (!items || items.length < 2) return;
      currentListName = name;
      noImages = info?.noImages || false;
      pair = { item1: items[0], item2: items[1] };
    } catch {}
  }

  async function prefetchNext() {
    if (allLists.length === 0) return;
    const pick = allLists[Math.floor(Math.random() * allLists.length)];
    const items = await getCachedTopItems(pick.name);
    if (items && items.length >= 2) {
      const info = await getCachedListInfo(pick.name);
      prefetchedPair = {
        listName: pick.name,
        item1: items[0],
        item2: items[1],
        noImages: info?.noImages || false,
      };
    }
  }

  async function cycleRandom() {
    if (allLists.length === 0) return;
    if (prefetchedPair) {
      currentListName = prefetchedPair.listName;
      noImages = prefetchedPair.noImages;
      pair = { item1: prefetchedPair.item1, item2: prefetchedPair.item2 };
      prefetchedPair = null;
    } else {
      const pick = allLists[Math.floor(Math.random() * allLists.length)];
      await showList(pick.name);
    }
    prefetchNext();
  }

  function handleClick() {
    if (currentListName)
      navigate(`/?view=vote&listName=${encodeURIComponent(currentListName)}`);
  }

  $: if (listName) {
    if (cycleInterval) {
      clearInterval(cycleInterval);
      cycleInterval = null;
    }
    showList(listName);
  }

  onMount(async () => {
    if (!listName) {
      try {
        const res = await getListsWithPopularity();
        allLists = res.lists || [];
      } catch (e) {}
      await cycleRandom();
      cycleInterval = setInterval(cycleRandom, 4000);
    }
  });

  onDestroy(() => {
    if (cycleInterval) clearInterval(cycleInterval);
    unsubNameTick?.();
  });
</script>

{#if pair}
  <div class="vote-preview" on:click={handleClick}>
    <div class="vote-now-label text-small">VOTE NOW</div>
    <div class="images-row">
      <div class="image-wrap">
        {#if noImages}
          <div class="img-no-image text-item">{pair.item1.name}</div>
        {:else if pair.item1.data?.picture}
          <img src={pair.item1.data.picture} alt={pair.item1.name} />
        {:else}
          <div class="img-empty"></div>
        {/if}
      </div>
      <div class="or text-base">or</div>
      <div class="image-wrap">
        {#if noImages}
          <div class="img-no-image text-item">{pair.item2.name}</div>
        {:else if pair.item2.data?.picture}
          <img src={pair.item2.data.picture} alt={pair.item2.name} />
        {:else}
          <div class="img-empty"></div>
        {/if}
      </div>
    </div>
    <div class="names-row">
      <div class="name text-base"><span class="name-inner" bind:this={name1El}>{pair.item1.name}</span></div>
      <div class="or text-base" aria-hidden="true">or</div>
      <div class="name text-base"><span class="name-inner" bind:this={name2El}>{pair.item2.name}</span></div>
    </div>
  </div>
{/if}

<style>
  .vote-preview {
    display: flex;
    flex-direction: column;
    margin: 0 var(--spacing-margin);
    gap: var(--spacing-md);
    padding: var(--spacing-margin) 0;
    cursor: pointer;
    position: relative;
  }

  .vote-now-label {
    position: absolute;
    top: var(--spacing-margin);
    right: 0;
    background: var(--color-black);
    color: var(--color-white);
    padding: 2px var(--spacing-sm);
    /* border-radius: var(--border-radius); */
    text-transform: uppercase;
    transform: rotate(-15deg);
    transform-origin: top right;
    opacity: 0;
    pointer-events: none;
    /* transition: opacity 0.1s; */
  }

  .vote-preview:hover .vote-now-label {
    opacity: 1;
  }

  .images-row,
  .names-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }

  .name {
    overflow: hidden;
    white-space: nowrap;
  }

  .name-inner {
    display: inline-block;
    white-space: nowrap;
  }


  .names-row .or {
    visibility: hidden;
  }

  .image-wrap {
    aspect-ratio: 1 / 1;
    overflow: hidden;
    border: 1.5px solid var(--color-black);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius);
  }

  .image-wrap img,
  .img-empty {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .img-empty {
    background: var(--color-grey);
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

  .or {
    text-align: center;
    text-transform: uppercase;
    padding: 0 var(--spacing-md);
  }

  .name {
    text-align: center;
    text-transform: uppercase;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
