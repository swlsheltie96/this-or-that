<script>
  // history: array of { vote_number, rating }
  // currentElo: number
  // item: the full item object
  export let history = [];
  export let item = null;
  export let index = null;

  $: parsedData = item?.data
    ? typeof item.data === "string"
      ? JSON.parse(item.data)
      : item.data
    : null;

  // Build SVG polyline points from history
  // viewBox is 1000 x 22, points scale into it
  const W = 1000;
  const H = 22;
  const PADDING = 1; // vertical padding so line doesn't clip at edges

  $: points = buildPoints(history);

  function buildPoints(hist) {
    if (!hist || hist.length < 2) return "";

    const minRating = Math.min(...hist.map((h) => h.rating));
    const maxRating = Math.max(...hist.map((h) => h.rating));
    const ratingRange = maxRating - minRating || 1;

    const maxVote = hist[hist.length - 1].vote_number;
    const voteRange = maxVote || 1;

    return hist
      .map((h) => {
        const x = (h.vote_number / voteRange) * W;
        const y = H - PADDING - ((h.rating - minRating) / ratingRange) * (H - PADDING * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }
</script>

{#if item}
  <div class="chart-row">
    <div class="chart-thumb">
      {#if parsedData?.picture}
        <img src={parsedData.picture} alt={item.name} />
      {/if}
    </div>
    <span class="chart-rank">{index}</span>
    <span class="chart-name">{item.name}</span>
    <div class="chart-graph">
      {#if history.length >= 2}
        <svg
          viewBox="0 0 {W} {H}"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polyline
            points={points}
            fill="none"
            stroke="black"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
          />
          <!-- dot at end -->
          {#if history.length > 0}
            {@const last = history[history.length - 1]}
            {@const lastX = W}
            {@const minR = Math.min(...history.map((h) => h.rating))}
            {@const maxR = Math.max(...history.map((h) => h.rating))}
            {@const lastY = H - PADDING - ((last.rating - minR) / (maxR - minR || 1)) * (H - PADDING * 2)}
            <circle cx={lastX} cy={lastY} r="4" fill="#888" vector-effect="non-scaling-stroke" />
          {/if}
        </svg>
      {:else}
        <span class="no-data">no history yet</span>
      {/if}
    </div>
    <span class="chart-elo">{item.elo ? Math.round(item.elo) : "—"}</span>
  </div>
{/if}

<style>
  .chart-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    height: var(--cell-height);
    border-bottom: var(--border);
    padding: 0 var(--spacing-sm);
    box-sizing: border-box;
    width: 100%;
  }

  .chart-thumb {
    width: 25px;
    height: 25px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .chart-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .chart-rank,
  .chart-name,
  .chart-elo {
    font-family: var(--font-family);
    font-size: var(--font-size-content);
    color: var(--color-text-primary);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .chart-graph {
    flex: 1;
    min-width: 0;
    height: 22px;
    display: flex;
    align-items: center;
  }

  .chart-graph svg {
    width: 100%;
    height: 22px;
    display: block;
    overflow: visible;
  }

  .no-data {
    font-family: var(--font-family);
    font-size: var(--font-size-header);
    color: var(--color-text-faded);
  }
</style>
