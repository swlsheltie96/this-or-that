<script>
  export let onlineUsers = 0;
  export let votesLastHour = 0;
  export let compact = false;
  export let fullWidth = false;
  export let isMobile = false;
  export let isHome = false;

  let mobileInfoHeight = 0;

  $: document.documentElement.style.setProperty(
    "--header-top-offset",
    `calc(var(--ticker-height) + ${mobileInfoHeight}px)`,
  );
</script>

<!--
  <span class="header-stat">{onlineUsers} online</span>
  <span class="header-stat">{votesLastHour} votes/hr</span> -->

{#if isHome && isMobile}
  <div class="mobile-info text-small" bind:clientHeight={mobileInfoHeight}>
    A pairwise ranking tool powered by the Elo algorithm. Your ranking problems
    solved.
  </div>
{/if}

<a href="/">
  <div
    class="header-container"
    class:compact
    class:mobile={isMobile}
    class:home={isHome}
    style={isMobile && isHome
      ? `top: calc(var(--ticker-height) + ${mobileInfoHeight}px)`
      : undefined}
  >
    <div
      class="header"
      class:compact
      class:full-width={fullWidth}
      class:home={isHome}
    >
      <div
        id="header-this"
        class={isMobile && !isHome ? "text-small" : "text-base"}>This</div
      >
      <div
        id="header-or"
        class={isMobile && !isHome ? "text-small" : "text-base"}>or</div
      >
      <div
        id="header-that"
        class={isMobile && !isHome ? "text-small" : "text-base"}>That</div
      >
    </div>
  </div>
</a>

<style>
  /* Spacer so page content starts below the fixed header */
  .header-container {
    width: 100%;
    height: 64px;
  }

  .mobile.header-container {
    height: var(--header-home-mobile);
    top: var(--ticker-height);
    position: sticky;
  }

  .mobile:not(.home) {
    top: 0;
    height: var(--ticker-height, 40px);
    border-bottom: 1px solid var(--color-grey);
  }

  /* Compact pages don't need the spacer — header floats in the corner */
  .header-container.compact {
    height: 0;
  }

  .mobile.header-container.compact {
    height: 64px;
  }

  /* left is fixed at the home anchor (20vw); transform/width animate all states */
  .header {
    display: flex;
    position: fixed;
    top: 0;
    left: 20vw;
    width: var(--desktop-max-width);
    box-sizing: border-box;
    /* background-color: var(--color-white); */
    text-transform: uppercase;
    gap: 0.25em;
    justify-content: center;
    padding: var(--spacing-lg) 0;
    z-index: 2;
    transition:
      transform 0.5s ease,
      width 0.5s ease;
  }

  .mobile .header {
    left: 0;
    width: 100%;
    transition: none;
    height: 100%;
    align-items: center;
    position: relative;

    padding-top: 0;
    /* margin-top: 20px; */
  }

  .header.compact {
    transform: translateX(calc(20px - 20vw));
    width: calc((100vw - var(--desktop-max-width)) / 3);
  }
  .mobile .header.compact {
    transform: none;
    width: 100%;
  }

  .header.full-width {
    transform: translateX(-20vw);
    width: 100vw;
  }
  .mobile .header.full-width {
    transform: none;
    width: 100%;
  }

  .header.full-width #header-this,
  .header.full-width #header-that {
    flex: 1 1 auto;
    max-width: none;
    text-align: center;
  }

  .header.full-width:hover {
    gap: 0.25em;
  }

  .header.full-width:hover #header-this,
  .header.full-width:hover #header-that {
    flex-grow: 0;
  }

  #header-this,
  #header-that {
    flex: 1;
    max-width: calc(50% - 10px);
    white-space: nowrap;
    text-align: center;
    transition: flex-grow 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  #header-or {
    text-align: center;
    white-space: nowrap;
  }

  .mobile .header.compact #header-or,
  .mobile .header.compact #header-that {
    display: none;
  }

  .mobile-info {
    position: sticky;
    top: var(--ticker-height);
    z-index: 3;
    text-transform: uppercase;
    text-align: center;
    padding: calc(2 * var(--spacing-xlg)) var(--spacing-margin)
      var(--spacing-xlg);
  }
</style>
