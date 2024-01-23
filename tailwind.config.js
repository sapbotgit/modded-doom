/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.svelte",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require("daisyui"),
  ],

  daisyui: {
    themes: [
      {
        doom: {
          "primary": "#fde047",
          "secondary": "#ffffff",
          "accent": "#9ca3af",
          "neutral": "#075985",
          "base-100": "#0c4a6e",
          "info": "#38bdf8",
          "success": "#cffafe",
          "warning": "#fef9c3",
          "error": "#dc2626",
        },
      },
      'dark',
      'cupcake',
    ],
  },
}
