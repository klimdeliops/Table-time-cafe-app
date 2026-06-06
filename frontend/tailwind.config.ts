import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          amber:    '#FFA239',
          cream:    '#FCF9EA',
          sage:     '#AEB784',
          espresso: '#4B2E2B',
        },
      },
    },
  },
  plugins: [],
};

export default config;
