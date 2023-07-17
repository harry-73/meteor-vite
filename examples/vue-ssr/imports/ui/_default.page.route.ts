/**
 * Makes imports/ui/ the root of our app routes.
 * Without this, users would need to navigate to http://localhost:5173/imports/ui to get to your index page.
 * {@link https://vite-plugin-ssr.com/filesystemRoutingRoot}
 */
export const filesystemRoutingRoot = '/';