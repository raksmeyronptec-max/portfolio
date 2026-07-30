/**
 * Blocking theme initialiser.
 *
 * Runs before first paint and sets `data-theme` on <html> from the stored
 * preference, falling back to the OS setting. Without this, a dark-mode visitor
 * gets a flash of the light theme on every navigation that isn't client-side.
 *
 * It has to be inline and synchronous to beat the first paint, which is why the
 * CSP in next.config.ts permits `'unsafe-inline'` for scripts. The script itself
 * reads two known keys and writes one attribute — it interpolates nothing, so
 * there is no injection surface.
 */
export const THEME_STORAGE_KEY = "portfolio-theme";

const script = `
(function(){
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`.trim();

export function ThemeScript() {
  return (
    <script
      /*
       * eslint react/no-danger is disabled here deliberately, not incidentally.
       *
       * `script` above is a module-level constant with no interpolation of any
       * request, user or database value, so there is no injection surface to
       * guard. The alternative — a separate <script src> — cannot run before
       * first paint, which is the entire reason this component exists.
       */
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
