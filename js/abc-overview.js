document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.abc-state-chip:not(.active)').forEach(btn => {
    btn.addEventListener('click', () => alert('State dashboard will be added once validated backend data is available.'));
  });
});
