/**
 * طبقة رموز المنصة: تطبع لوحة الألوان ورموز التصميم المفعّلة كمتغيّرات CSS
 * على `:root`.
 *
 * القيم الافتراضية مطبوعة أصلًا في `src/styles.css`، فالخادم يرسل HTML صحيحًا
 * بلا وميض، وهذه الطبقة تكتفي بتصحيح ما يخالف الافتراضي بعد وصول اللوحة من
 * القاعدة (استعلام واحد مخزَّن يخدم الألوان والرموز معًا).
 */
import { useActiveDesignTokens, useActiveTheme } from "@/lib/mkt-theme";
import {
  DEFAULT_TOKENS,
  THEME_TOKENS,
  designTokensChanged,
  designTokensCss,
  tokensCss,
} from "@/lib/theme-tokens";

export function ThemeVarsLayer() {
  const theme = useActiveTheme();
  const design = useActiveDesignTokens();
  const tokens = theme.data;
  const colorChanged =
    tokens !== undefined && THEME_TOKENS.some((token) => tokens[token] !== DEFAULT_TOKENS[token]);
  const designChanged = design.data !== undefined && designTokensChanged(design.data);
  if (!colorChanged && !designChanged) return null;
  return (
    <style data-kaheel-theme>
      {[
        colorChanged && tokens ? tokensCss(tokens) : "",
        designChanged && design.data ? designTokensCss(design.data) : "",
      ]
        .filter(Boolean)
        .join("")}
    </style>
  );
}
