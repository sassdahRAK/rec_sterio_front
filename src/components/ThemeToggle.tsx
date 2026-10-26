import { useThemeStore } from '../store/theme';
import { MoonIcon, SunIcon } from './icons';

export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  return (
    <button
      type="button"
      onClick={toggle}
      className="icon-btn"
      aria-label={theme === 'dark' ? 'Use the light theme' : 'Use the dark theme'}
      title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
    >
      {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
    </button>
  );
}
