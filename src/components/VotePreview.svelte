<script>
  import { onMount, onDestroy } from "svelte";
  import { getListsWithPopularity, navigate } from "../lib/api.js";
  import { getCachedTopItems, getCachedListInfo } from "../lib/listCache.js";

  export let listName = "";

  let pair = null;
  let noImages = false;
  let allLists = [];
  let cycleInterval;
  let currentListName = "";
  let prefetchedPair = null;

  async function showList(name) {
    try {
      const [items, info] = await Promise.all([getCachedTopItems(name), getCachedListInfo(name)]);
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
      prefetchedPair = { listName: pick.name, item1: items[0], item2: items[1], noImages: info?.noImages || false };
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
    if (currentListName) navigate(`/?view=vote&listName=${encodeURIComponent(currentListName)}`);
  }

  $: if (listName) {
    if (cycleInterval) { clearInterval(cycleInterval); cycleInterval = null; }
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
  });
</script>

{#if pair}
  <div class="vote-preview" on:click={handleClick} style="cursor: pointer;">
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
      <div class="or text-small">or</div>
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
      <div class="name text-small">{pair.item1.name}</div>
      <div class="or text-small" aria-hidden="true">or</div>
      <div class="name text-small">{pair.item2.name}</div>
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
  }

  .images-row,
  .names-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }

  .names-row .or {
    visibility: hidden;
  }

  .image-wrap {
    aspect-ratio: 1 / 1;
    overflow: hidden;
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
