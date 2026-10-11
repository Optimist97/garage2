import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages (projet dédié) : pensez à remplacer './' par '/NOM-DU-DEPOT/'
// si vous voulez des URLs absolues. './' fonctionne partout, avec HashRouter.
// Le build copie index.html -> 404.html (voir workflow) pour le refresh.
export default defineConfig({
  plugins: [react()],
  base: './',
})
