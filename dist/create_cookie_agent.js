"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCookieAgent = void 0;
const url_1 = __importDefault(require("url"));
const tough_cookie_1 = require("tough-cookie");
const GET_REQUEST_URL = Symbol('getRequestUrl');
const SET_COOKIE_HEADER = Symbol('setCookieHeader');
const CREATE_COOKIE_HEADER_STRING = Symbol('createCookieHeaderString');
const OVERWRITE_REQUEST_EMIT = Symbol('overwriteRequestEmit');
function createCookieAgent(BaseAgentClass) {
    // @ts-ignore
    class CookieAgent extends BaseAgentClass {
        jar;
        constructor(options, ...rest) {
            super(options, ...rest);
            this.jar = options.jar;
        }
        [GET_REQUEST_URL](req) {
            const parsedPath = req.path.split('?');
            const requestUrl = url_1.default.format({
                protocol: req.protocol,
                host: req.host,
                pathname: parsedPath[0],
                search: parsedPath[1],
            });
            return requestUrl;
        }
        async [CREATE_COOKIE_HEADER_STRING](req) {
            const requestUrl = this[GET_REQUEST_URL](req);
            const cookies = await this.jar.getCookies(requestUrl);
            const cookiesMap = new Map(cookies.map((cookie) => [cookie.key, cookie]));
            const cookieHeaderList = [req.getHeader('Cookie')].flat();
            for (const header of cookieHeaderList) {
                if (typeof header !== 'string') {
                    continue;
                }
                for (const str of header.split(';')) {
                    const cookie = tough_cookie_1.Cookie.parse(str.trim());
                    if (cookie === undefined) {
                        continue;
                    }
                    cookiesMap.set(cookie.key, cookie);
                }
            }
            const cookieHeader = Array.from(cookiesMap.values())
                .map((cookie) => cookie.cookieString())
                .join(';\x20');
            return cookieHeader;
        }
        async [SET_COOKIE_HEADER](req) {
            const cookieHeader = await this[CREATE_COOKIE_HEADER_STRING](req);
            if (cookieHeader === '') {
                return;
            }
            if (req._header === null) {
                req.setHeader('Cookie', cookieHeader);
                return;
            }
            const alreadyHeaderSent = req._headerSent;
            req._header = null;
            req.setHeader('Cookie', cookieHeader);
            req._implicitHeader();
            if (alreadyHeaderSent !== true) {
                return;
            }
            const firstChunk = req.outputData.shift();
            const dataWithoutHeader = firstChunk.data.split('\r\n\r\n').slice(1).join('\r\n\r\n');
            const chunk = {
                ...firstChunk,
                data: `${req._header}${dataWithoutHeader}`,
            };
            req.outputData.unshift(chunk);
            const diffSize = chunk.data.length - firstChunk.data.length;
            req.outputSize += diffSize;
            req._onPendingData(diffSize);
        }
        async [OVERWRITE_REQUEST_EMIT](req) {
            const requestUrl = this[GET_REQUEST_URL](req);
            const emit = req.emit.bind(req);
            req.emit = (event, ...args) => {
                if (event !== 'response') {
                    return emit(event, ...args);
                }
                const res = args[0];
                (async () => {
                    const cookies = res.headers['set-cookie'];
                    if (cookies !== undefined) {
                        for (const cookie of cookies) {
                            await this.jar.setCookie(cookie, requestUrl, { ignoreError: true });
                        }
                    }
                })()
                    .then(() => emit('response', res))
                    .catch((err) => emit('error', err));
                return req.listenerCount(event) !== 0;
            };
        }
        addRequest(req, options) {
            Promise.resolve()
                .then(() => this[SET_COOKIE_HEADER](req))
                .then(() => this[OVERWRITE_REQUEST_EMIT](req))
                .then(() => super.addRequest(req, options))
                .catch((err) => req.emit('error', err));
        }
    }
    return CookieAgent;
}
exports.createCookieAgent = createCookieAgent;
