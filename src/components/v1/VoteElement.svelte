<script>
  import { createEventDispatcher } from "svelte";

  export let item;
  export let voting = false;

  const dispatch = createEventDispatcher();

  // Parse the JSON data - handle both string and object cases
  $: parsedData = item.data
    ? typeof item.data === "string"
      ? JSON.parse(item.data)
      : item.data
    : null;

  function handleClick() {
    if (!voting) {
      dispatch("vote", item);
    }
  }
</script>

<div class="voteElement box" class:voting>
  <div class="element-info">
    <div class="voteElementTitle">
      <p>{item.name}</p>
    </div>

    {#if parsedData?.picture}
      <div class="voteElementImage">
        <img src={parsedData.picture} alt={item.name} />
      </div>
    {/if}
    {#if parsedData?.description}
      <div class="voteElementDescription">
        <p>{parsedData.description}</p>
      </div>
    {/if}
  </div>

  <button
    class="voteButton clickable"
    on:click={handleClick}
    disabled={voting}
    aria-label="Vote for {item.name}"
  >
    Vote
  </button>
</div>

<style>
  .voteElement {
    width: 100%;
    max-width: 300px;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .element-info {
    flex-grow: 1;
  }

  .voteElement.voting {
    opacity: 0.6;
    pointer-events: none;
  }

  .voteElementTitle {
    font-weight: bold;
    margin-bottom: 5px;
  }

  .voteElementImage {
    margin: 10px 0;
  }

  .voteElement img {
    aspect-ratio: 1 / 1;
    width: 100%;
    object-fit: contain;
  }

  .voteButton {
    width: 100%;
    padding: 10px;
    font-size: 1rem;
  }

  .voteButton:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
