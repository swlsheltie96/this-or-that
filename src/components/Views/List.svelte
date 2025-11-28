<script>
  export let items = [];
  export let viewSize = "small"; // 'small', 'medium', 'large'

  // Parse JSON data for each item - handle both string and object cases
  $: parsedItems = items.map((item) => ({
    ...item,
    parsedData: item.data
      ? typeof item.data === "string"
        ? JSON.parse(item.data)
        : item.data
      : null,
  }));
</script>

<div class="list-view">
  <div class="items-list">
    {#each parsedItems as item, index}
      <div class="item-row box">
        <div class="rank">{index + 1}</div>
        <div class="item-name">
          <div class="item-picture image-box {viewSize}">
            {#if item.parsedData?.picture}
              <img src={item.parsedData.picture} alt={item.name} class="item-thumbnail" />
            {/if}
          </div>

          {item.name}
        </div>
        <div class="item-description">{item.parsedData?.description || ""}</div>
        <div class="elo-rating">{item.elo.toFixed(2)}</div>
      </div>
    {/each}
  </div>
</div>

<style>
  .rank {
    width: 50px;
    font-weight: bold;
    color: #666;
  }
  .item-row {
    display: flex;
    align-items: center;
    gap: 5px;
    /* justify-content: space-between; */
  }
  .item-name {
    display: flex;
    align-items: center;
    white-space: nowrap;
    gap: 5px;
    font-weight: 500;
    width: 20%;
  }

  /* Image size controls - same as home page */
  .image-box.small {
    width: 30px;
    height: 30px;
  }

  .image-box.medium {
    width: 60px;
    height: 60px;
  }

  .image-box.large {
    width: 100px;
    height: 100px;
  }

  .item-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .item-description {
    color: #666;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
