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
  let name1Pos = 0,
    name2Pos = 0;
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

  let hoverSide = 0;
  let hoverX = 50;
  let hoverY = 20;
  let hoverRot = -15;
  function handleImageEnter(side) {
    hoverSide = side;
    hoverX = 15 + Math.random() * 70;
    hoverY = 10 + Math.random() * 60;
    hoverRot = (Math.random() - 0.5) * 40;
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
  <div
    class="vote-preview"
    on:click={handleClick}
  >
    <div class="images-row">
      <div
        class="image-wrap"
        class:hovered={hoverSide === 1}
        style="--hover-x:{hoverX}%;--hover-y:{hoverY}%;--hover-rot:{hoverRot}deg"
        on:mouseenter={() => handleImageEnter(1)}
      >
        {#if noImages}
          <div class="img-no-image text-item">{pair.item1.name}</div>
        {:else if pair.item1.data?.picture}
          <img src={pair.item1.data.picture} alt={pair.item1.name} />
        {:else}
          <div class="img-empty"></div>
        {/if}
      </div>
      <div class="or text-base">or</div>
      <div
        class="image-wrap"
        class:hovered={hoverSide === 2}
        style="--hover-x:{hoverX}%;--hover-y:{hoverY}%;--hover-rot:{hoverRot}deg"
        on:mouseenter={() => handleImageEnter(2)}
      >
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
      <div class="name text-base"
        ><span class="name-inner" bind:this={name1El}>{pair.item1.name}</span
        ></div
      >
      <div class="or text-base" aria-hidden="true">or</div>
      <div class="name text-base"
        ><span class="name-inner" bind:this={name2El}>{pair.item2.name}</span
        ></div
      >
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
  @media (max-width: 740px) {
    .vote-preview {
      margin: 0;
    }
  }

  .image-wrap::after {
    content: "VOTE NOW";
    position: absolute;
    top: var(--hover-y);
    left: var(--hover-x);
    transform: translate(-50%, -50%) rotate(var(--hover-rot));
    background: var(--color-black);
    color: var(--color-white);
    padding: 2px var(--spacing-sm);
    font-family: var(--font-family);
    font-size: 0.8rem;
    text-transform: uppercase;
    pointer-events: none;
    opacity: 0;
    white-space: nowrap;
  }

  .vote-preview:hover .image-wrap.hovered::after {
    opacity: 1;
  }

  .images-row {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .images-row .or {
    flex-shrink: 0;
  }

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
    width: 0;
    flex: 1;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    position: relative;
    border: 1.5px solid var(--color-black);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  .image-wrap img,
  .img-empty {
    width: 100%;
    height: 100%;
    object-fit: contain;
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
