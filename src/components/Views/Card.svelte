<script>
  export let item;
  export let index;
  export let viewSize = "small"; // 'small', 'medium', 'large'

  // Parse JSON data - handle both string and object cases
  $: parsedData = item.data
    ? typeof item.data === "string"
      ? JSON.parse(item.data)
      : item.data
    : null;
  $: description = parsedData?.description || "";
  $: sizeClass =
    viewSize === "large" ? "largeSquare" : viewSize === "medium" ? "mediumSquare" : "smallSquare";
</script>

<div class="card box {sizeClass}">
  <div class="header {sizeClass}">
    <h4 class="index">{index}</h4>

    <div class="eloTag {sizeClass}">
      <p>{item.elo.toFixed(2)}</p>
    </div>
  </div>

  <div class="item-picture">
    {#if parsedData?.picture}
      <img src={parsedData.picture} alt={item.name} class="inner-box {sizeClass}" />
    {/if}
  </div>

  <h4 class="itemName">{item.name}</h4>

  {#if description}
    <div class="eloTag description {sizeClass}">
      <p>{description}</p>
    </div>
  {/if}
</div>

<style>
  .card {
    max-width: 100%;
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .item-picture img {
    max-width: 100%;
    width: 100%;
    min-width: 0;
  }
  .header {
    display: flex;
    justify-content: space-between;
  }
</style>
