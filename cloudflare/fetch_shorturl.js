addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(request) {
  console.log('Got request', request);

  const id = request.url.replace('https://quickchart.io/chart/render/', '');
  console.log('id', id);

  const list = await SHORTURLS.list();
  console.log(list.keys);

  const body = await SHORTURLS.get(id, 'json');
  if (!body) {
    return new Response('Chart not found', {
      status: 404,
    });
  }

  const response = await fetch('https://quickchart.io/chart', {
    body: JSON.stringify(body),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response;
}
