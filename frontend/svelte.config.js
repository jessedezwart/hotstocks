import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html',  // SPA fallback for GitHub Pages
			precompress: false,
			strict: true
		}),
		paths: {
			// For GitHub Pages with custom domain, base can be empty
			base: ''
		}
	}
};

export default config;
