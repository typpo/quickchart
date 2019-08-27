addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

const CHART_TTL = 60 * 60 * 24 * 30 * 3;

function fail(msg) {
  return new Response(
    JSON.stringify({
      success: false,
      error: msg,
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

function success(data) {
  return new Response(
    JSON.stringify(
      Object.assign(
        {
          success: true,
        },
        data,
      ),
    ),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1);
}

function bytesToUuid(buf) {
  let i = 0;
  const bth = byteToHex;
  // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4
  return [
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    '-',
    bth[buf[i++]],
    bth[buf[i++]],
    '-',
    bth[buf[i++]],
    bth[buf[i++]],
    '-',
    bth[buf[i++]],
    bth[buf[i++]],
    '-',
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
    bth[buf[i++]],
  ].join('');
}

function uuidv4() {
  // From node-uuid https://github.com/kelektiv/node-uuid/blob/master/v4.js
  const rnds = crypto.getRandomValues(new Uint8Array(16));

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  return bytesToUuid(rnds);
}

/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(request) {
  console.log('Got request', request);

  const { headers } = request;
  const contentType = headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return fail('Expecting POST with Content-Type application/json');
  }

  const body = await request.json();

  const id = uuidv4();

  const exists = await SHORTURLS.get(id);
  if (exists) {
    return fail('UUID collision. Buy a lottery ticket.');
  }

  console.log('Storing id', id, body);
  await SHORTURLS.put(id, JSON.stringify(body), { expirationTtl: CHART_TTL });

  const url = `https://quickchart.io/chart/render/${id}`;
  return success({
    url,
  });
}
