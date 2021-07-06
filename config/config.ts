import { defineConfig } from 'umi';
import proxy from './proxy';
const { REACT_APP_ENV } = process.env;

export default defineConfig({
  // presets: [
  //   '@umijs/preset-react'
  // ],
  plugins: [],
  antd: { dark: true },
  dva: {
    // immer: true,
    hmr: true,
  },
  locale: {
    // default: 'us-EN',
    baseNavigator: true,
  },
  proxy: proxy[REACT_APP_ENV || 'prod'],
  // theme: {"primary-color": "#52e5ff"}
});