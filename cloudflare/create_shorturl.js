addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/******************************************************************************
 * The code below, bytesToUuid, and the uuidv4 function are adapted from
 * node-uuid (https://github.com/kelektiv/node-uuid/blob/master/v4.js) with the
 * following license.  Note that the remainder of the project is licensed under
 * GNU GPLv3 (see https://github.com/typpo/quickchart/blob/master/LICENSE).
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2010-2016 Robert Kieffer and other contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *****************************************************************************/

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
  const rnds = crypto.getRandomValues(new Uint8Array(16));

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  return bytesToUuid(rnds);
}
/******************************************************************************
 * End MIT licensed code. All other code licensed under GNU GPLv3.
 *****************************************************************************/

// 3 months in seconds
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
