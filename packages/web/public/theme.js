// Applies the visitor's saved theme before the page draws, so it never flashes the wrong one.
try {
  if (localStorage.getItem('mch-theme') === 'light')
    document.documentElement.dataset.theme = 'light';
} catch {
  // Private mode: the default (dark) applies.
}
