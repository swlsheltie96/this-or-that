<div class="mobile-header">
  <a href="/">
    <div class="text-base">This</div>
    <div class="text-base">or</div>
    <div class="text-base">That</div>
  </a>
</div>

<style>
  .mobile-header {
    padding: var(--spacing-margin);
    background: var(--color-black);
    border-radius: var(--border-radius);
    box-sizing: border-box;
  }
  @media (max-width: 740px) {
    .mobile-header {
      padding: var(--spacing-md);
    }
  }
  a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-decoration: none;
    color: var(--color-white);
    text-transform: uppercase;
  }
</style>
