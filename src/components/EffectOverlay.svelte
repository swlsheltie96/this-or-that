<script>
  export let item;
  export let voteTags = [];
  export let voteTagItem = 0;
</script>

{#if voteTagItem === item}
  {#each voteTags as tag (tag.id)}
    <span
      class="vote-tag text-base"
      style="left:{tag.x}%;top:{tag.y}%;--tag-rot:{tag.rot}deg">{tag.word}</span
    >
  {/each}
{/if}

<style>
  .vote-tag {
    position: absolute;
    transform: translate(-50%, -50%) rotate(var(--tag-rot));
    background: var(--color-black);
    color: var(--color-white);
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--border-radius);
    text-transform: uppercase;
    pointer-events: none;
    white-space: nowrap;
    line-height: 1;
  }
</style>
