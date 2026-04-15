import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      /**
       * Redirects 'react-native' to 'react-native-web' so your 
       * <View>, <Text>, etc., render as HTML on Windows.
       */
      'react-native': 'react-native-web',
      
      /**
       * Redirects the native mobile gradient to the web version.
       * Make sure you have installed 'react-native-web-linear-gradient'.
       */
      'react-native-linear-gradient': 'react-native-web-linear-gradient',
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    open: false
  }
})