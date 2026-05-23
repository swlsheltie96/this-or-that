<script>
  import { onMount, onDestroy } from "svelte";
  import { getPairForVoting, getListsWithPopularity, navigate } from "../lib/api.js";

  export let listName = "";

  let pair = null;
  let allLists = [];
  let cycleInterval;
  let currentListName = "";

  async function loadPair(name) {
    try {
      const data = await getPairForVoting(name);
      currentListName = name;
      pair = {
        item1: {
          ...data.item1,
          data: data.item1.data ? JSON.parse(data.item1.data) : {},
        },
        item2: {
          ...data.item2,
          data: data.item2.data ? JSON.parse(data.item2.data) : {},
        },
      };
    } catch (e) {}
  }

  async function cycleRandom() {
    if (allLists.length === 0) return;
    const pick = allLists[Math.floor(Math.random() * allLists.length)];
    await loadPair(pick.name);
  }

  function handleClick() {
    if (currentListName) navigate(`/?view=vote&listName=${encodeURIComponent(currentListName)}`);
  }

  $: if (listName) {
    if (cycleInterval) {
      clearInterval(cycleInterval);
      cycleInterval = null;
    }
    loadPair(listName);
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
        {#if pair.item1.data?.picture}
          <img src={pair.item1.data.picture} alt={pair.item1.name} />
        {:else}
          <div class="img-empty"></div>
        {/if}
      </div>
      <div class="or text-small">or</div>
      <div class="image-wrap">
        {#if pair.item2.data?.picture}
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
