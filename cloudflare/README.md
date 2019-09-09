The ability to generate short chart URLs is built on Cloudflare KV Workers.  In
order to support short URLs on your own deployment, you'll have to set up the
following workers and corresponding routes:

  - `create_shorturl.js`: `/chart/create`
  - `fetch_shorturl.js`: `/chart/render/*`

Additionally, you will have to create a KV namespace and bind it to your
Workers as `SHORTURLS`.

Note that this will cost a little bit of money depending on how many charts
you're generating and saving.
