import got from 'got';
import { CookieJar } from 'tough-cookie';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent';

const jar = new CookieJar();

await got('https://httpbin.org/cookies/set/session/userid', {
  agent: {
    http: new HttpCookieAgent({ jar }),
    https: new HttpsCookieAgent({ jar }),
  },
});

const cookies = await jar.getCookies('https://httpbin.org');
console.log(cookies);
