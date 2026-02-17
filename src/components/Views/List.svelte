<script>
  export let items = [];
  export let viewSize = "small"; // 'small', 'medium', 'large'

  // Calculate pic width based on display size
  $: picColWidth = viewSize === "small" ? 35 : viewSize === "medium" ? 70 : 100;

  // Parse JSON data for each item - handle both string and object cases
  $: parsedItems = items.map((item, index) => ({
    ...item,
    rank: index + 1,
    parsedData: item.data
      ? typeof item.data === "string"
        ? JSON.parse(item.data)
        : item.data
      : null,
  }));
</script>

<div class="list-container">
  <!-- Items Table Header -->
  <div class="items-header">
    <div class="col-num">
      <div class="rotated-text">NUM</div>
    </div>
    <div class="col-pic-image header-pic" style="width: {picColWidth}px">PIC</div>
    <div class="col-name">NAME</div>
    <div class="col-descrip">DESCRIP</div>
    <div class="col-score">SCORE</div>
  </div>

  <!-- Items Data Rows -->
  {#each parsedItems as item}
    <div class="item-row size-{viewSize}">
      <div class="col-num faded"><span class="rotated-text">{item.rank}</span></div>
      <div class="col-pic-image">
        {#if item.parsedData?.picture}
          <img src={item.parsedData.picture} alt={item.name} />
        {/if}
      </div>
      <div class="col-name content-text">{item.name}</div>
      <div class="col-descrip faded">{item.parsedData?.description || ""}</div>
      <div class="col-score faded">{Math.round(item.elo)}</div>
    </div>
  {/each}
</div>

<style>
  .list-container {
    background-color: var(--color-white);
    width: 100%;
    margin: 0;
    padding: 0;
  }

  /* Items Table Header */
  .items-header {
    display: flex;
    width: 100%;
    border-bottom: var(--border);
  }

  .items-header > div {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--cell-height);
    border-right: var(--border);
    padding: var(--spacing-sm) 0;
    font-family: var(--font-family);
    font-size: var(--font-size-header);
    color: var(--color-text-primary);
    box-sizing: border-box;
  }

  .items-header > div:last-child {
    border-right: none;
  }

  .col-num {
    width: 11px;
    flex-shrink: 0;
    position: relative;
  }

  .rotated-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(90deg);
    white-space: nowrap;
  }

  .col-pic-image {
    width: 35px;
    height: var(--cell-height);
    flex-shrink: 0;
    border-right: var(--border);
    margin-right: -1px;
    padding: var(--spacing-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  .header-pic {
    height: var(--cell-height);
  }

  .col-pic-image img {
    width: 25px;
    height: 25px;
    object-fit: cover;
  }

  .col-name {
    width: 25%;
    flex-shrink: 0;
    padding: var(--spacing-xs);
  }

  .col-descrip {
    flex: 1;
    min-width: 0;
    padding: 0 var(--spacing-md);
  }

  .col-score {
    width: 66px;
    flex-shrink: 0;
    padding: 0 var(--spacing-sm);
  }

  /* Items Data Rows */
  .item-row {
    display: flex;
    width: 100%;
    border-bottom: var(--border);
  }

  .item-row.size-small {
    height: 35px;
  }

  .item-row.size-medium {
    height: 70px;
  }

  .item-row.size-large {
    height: 100px;
  }

  .item-row > div {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    border-right: var(--border);
    font-family: var(--font-family);
    box-sizing: border-box;
  }

  .item-row > div:last-child {
    border-right: none;
  }

  .item-row .col-num,
  .item-row .col-score {
    padding: 0 var(--spacing-sm);
  }

  .item-row .col-name,
  .item-row .col-descrip {
    padding: var(--spacing-xs);
    justify-content: flex-start;
    overflow: hidden;
    white-space: nowrap;
  }

  /* Size variations for pic column */
  .size-medium .col-pic-image {
    width: 70px;
  }

  .size-large .col-pic-image {
    width: 100px;
  }

  /* Image size variations */
  .size-medium .col-pic-image img {
    width: 60px;
    height: 60px;
  }

  .size-large .col-pic-image img {
    width: 90px;
    height: 90px;
  }

  .content-text {
    font-size: var(--font-size-content);
    color: var(--color-text-primary);
  }

  .faded {
    font-size: var(--font-size-content);
    color: var(--color-text-faded);
  }

  /* Num and score columns use header font size */
  .item-row .col-num,
  .item-row .col-score {
    font-size: var(--font-size-header);
  }
</style>
