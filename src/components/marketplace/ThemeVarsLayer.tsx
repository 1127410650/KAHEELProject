/**
 * طبقة رموز الألوان: تطبع لوحة المنصة المفعّلة كمتغيّرات CSS على `:root`.
 *
 * القيم الافتراضية مطبوعة أصلًا في `src/styles.css`، فالخادم يرسل HTML ملوّنًا
 * صحيحًا بلا وميض، وهذه الطبقة تكتفي بتصحيح ما يخالف الافتراضي بعد وصول
 * اللوحة من القاعدة (استعلام واحد مخزَّن).
 */
import { useActiveTheme } from "@/lib/mkt-theme";
import { DEFAULT_TOKENS, THEME_TOKENS, tokensCss } from "@/lib/theme-tokens";

export function ThemeVarsLayer() {
  const theme = useActiveTheme();
  const tokens = theme.data;
  if (!tokens) return null;
  const changed = THEME_TOKENS.some((token) => tokens[token] !== DEFAULT_TOKENS[token]);
  if (!changed) return null;
  return <style data-kaheel-theme>{tokensCss(tokens)}</style>;
}
