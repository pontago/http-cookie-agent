import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent';

const jar = new CookieJar();

const client = axios.create({
  httpAgent: new HttpCookieAgent({ jar }),
  httpsAgent: new HttpsCookieAgent({ jar }),
});

await client.get('https://httpbin.org/cookies/set/session/userid');

const cookies = await jar.getCookies('https://httpbin.org');
console.log(cookies);
