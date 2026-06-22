/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind v4 ships its PostCSS plugin separately and handles nesting and
    // vendor prefixing internally, so `tailwindcss/nesting` and `autoprefixer`
    // are no longer needed.
    "@tailwindcss/postcss": {},
  },
};

export default config;
