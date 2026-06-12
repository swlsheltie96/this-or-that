<script>
  export let item;
  export let voteTags = [];
  export let voteTagItem = 0;
  export let gridEffectItem = 0;
  export let gridEffectUrl = "";
  export let bangItem = 0;
  export let flipItem = 0;
  export let flipUrl = "";
  export let flipRect = null;
  export let rankJump = null;
</script>

{#if voteTagItem === item}
  {#each voteTags as tag (tag.id)}
    <span class="vote-tag text-small" style="left:{tag.x}%;top:{tag.y}%;--tag-rot:{tag.rot}deg">{tag.word}</span>
  {/each}
{/if}

{#if gridEffectItem === item && gridEffectUrl}
  <div class="grid-effect" style="background-image:url({gridEffectUrl})"></div>
{/if}

{#if bangItem === item}
  <span class="bang-tag text-base">!!!!!!!!!!!!!!!!!!</span>
{/if}

{#if flipItem === item && flipRect}
  <div class="flip-bg"></div>
  <div class="flip-card" style="top:{flipRect.top}px;left:{flipRect.left}px;width:{flipRect.width}px;height:{flipRect.height}px">
    <div class="flip-front" style="background-image:url({flipUrl})"></div>
    <div class="flip-back text-base">thank you for voting</div>
  </div>
{/if}

{#if rankJump?.item === item}
  <span class="rank-jump-tag text-base">↑{rankJump.jumped} · {rankJump.name} → #{rankJump.newRank}</span>
{/if}

<style>
  @keyframes tag-pop {
    0%   { transform: rotate(var(--tag-rot)) scale(0); opacity: 0; }
    40%  { transform: rotate(var(--tag-rot)) scale(1.2); opacity: 1; }
    70%  { transform: rotate(var(--tag-rot)) scale(1); opacity: 1; }
    100% { transform: rotate(var(--tag-rot)) scale(1); opacity: 0; }
  }

  .vote-tag {
    position: absolute;
    background: black;
    color: white;
    padding: 3px 5px 2px 5px;
    text-transform: uppercase;
    pointer-events: none;
    white-space: nowrap;
    animation: tag-pop 0.9s ease-out forwards;
  }

  @keyframes grid-move {
    from { background-position: 0 0; }
    to   { background-position: 100px 100px; }
  }

  .grid-effect {
    position: absolute;
    inset: 0;
    background-repeat: repeat;
    background-size: 100px 100px;
    pointer-events: none;
    animation: grid-move 1s linear infinite;
  }

  @keyframes bang-typewriter {
    from { clip-path: inset(0 100% 0 0); }
    to   { clip-path: inset(0 0% 0 0); }
  }

  .bang-tag {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: black;
    color: white;
    padding: 3px 5px 2px 5px;
    text-transform: uppercase;
    pointer-events: none;
    white-space: nowrap;
    animation: bang-typewriter 0.9s steps(18, end) forwards;
  }

  @keyframes flip-front-anim {
    0%   { transform: scaleX(1); }
    50%  { transform: scaleX(0); }
    100% { transform: scaleX(0); }
  }

  @keyframes flip-back-anim {
    0%   { transform: scaleX(0); }
    50%  { transform: scaleX(0); }
    51%  { transform: scaleX(0); }
    100% { transform: scaleX(1); }
  }

  .flip-bg {
    position: absolute;
    inset: 0;
    background: var(--color-bkggrey);
    pointer-events: none;
  }

  .flip-card {
    position: absolute;
    pointer-events: none;
  }

  .flip-front {
    position: absolute;
    inset: 0;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    animation: flip-front-anim 0.5s cubic-bezier(0.55, 0, 1, 0.45) forwards;
  }

  .flip-back {
    position: absolute;
    inset: 0;
    background: black;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    text-transform: uppercase;
    text-align: center;
    padding: 8px;
    animation: flip-back-anim 0.5s cubic-bezier(0, 0.55, 0.45, 1) forwards;
  }

  .rank-jump-tag {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: black;
    color: white;
    padding: 10px 15px;
    border-radius: 2px;
    text-transform: uppercase;
    pointer-events: none;
    white-space: nowrap;
    text-align: center;
  }
</style>
