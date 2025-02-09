"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint @typescript-eslint/restrict-template-expressions: [ "error", { "allowNumber": true, "allowBoolean": true } ] */
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const promises_1 = require("fs/promises");
const https = __importStar(require("https"));
const path = __importStar(require("path"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const check_1 = require("../helpers/check");
const compact_1 = require("../helpers/compact");
const multipart_stream_1 = __importDefault(require("./multipart-stream"));
const error_1 = __importDefault(require("./error"));
const url_1 = require("url");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const debug = require('debug')('telegraf:client');
const { isStream } = multipart_stream_1.default;
const WEBHOOK_REPLY_METHOD_ALLOWLIST = new Set([
    'answerCallbackQuery',
    'answerInlineQuery',
    'deleteMessage',
    'leaveChat',
    'sendChatAction',
]);
const DEFAULT_EXTENSIONS = {
    audio: 'mp3',
    photo: 'jpg',
    sticker: 'webp',
    video: 'mp4',
    animation: 'mp4',
    video_note: 'mp4',
    voice: 'ogg',
};
const DEFAULT_OPTIONS = {
    apiRoot: 'https://api.telegram.org',
    apiMode: 'bot',
    webhookReply: true,
    agent: new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 10000,
    }),
    attachmentAgent: undefined,
    testEnv: false,
};
function includesMedia(payload) {
    return Object.entries(payload).some(([key, value]) => {
        if (key === 'link_preview_options')
            return false;
        if (Array.isArray(value)) {
            return value.some(({ media }) => media && typeof media === 'object' && (media.source || media.url));
        }
        return (value &&
            typeof value === 'object' &&
            (((0, check_1.hasProp)(value, 'source') && value.source) ||
                ((0, check_1.hasProp)(value, 'url') && value.url) ||
                ((0, check_1.hasPropType)(value, 'media', 'object') &&
                    (((0, check_1.hasProp)(value.media, 'source') && value.media.source) ||
                        ((0, check_1.hasProp)(value.media, 'url') && value.media.url)))));
    });
}
function replacer(_, value) {
    if (value == null)
        return undefined;
    return value;
}
function buildJSONConfig(payload) {
    return Promise.resolve({
        method: 'POST',
        compress: true,
        headers: { 'content-type': 'application/json', connection: 'keep-alive' },
        body: JSON.stringify(payload, replacer),
    });
}
const FORM_DATA_JSON_FIELDS = [
    'results',
    'reply_markup',
    'mask_position',
    'shipping_options',
    'errors',
];
async function buildFormDataConfig(payload, agent) {
    for (const field of FORM_DATA_JSON_FIELDS) {
        if ((0, check_1.hasProp)(payload, field) && typeof payload[field] !== 'string') {
            payload[field] = JSON.stringify(payload[field]);
        }
    }
    const boundary = crypto.randomBytes(32).toString('hex');
    const formData = new multipart_stream_1.default(boundary);
    await Promise.all(Object.keys(payload).map((key) => 
    // @ts-expect-error payload[key] can obviously index payload, but TS doesn't trust us
    attachFormValue(formData, key, payload[key], agent)));
    return {
        method: 'POST',
        compress: true,
        headers: {
            'content-type': `multipart/form-data; boundary=${boundary}`,
            connection: 'keep-alive',
        },
        body: formData,
    };
}
async function attachFormValue(form, id, value, agent) {
    if (value == null) {
        return;
    }
    if (typeof value === 'string' ||
        typeof value === 'boolean' ||
        typeof value === 'number') {
        form.addPart({
            headers: { 'content-disposition': `form-data; name="${id}"` },
            body: `${value}`,
        });
        return;
    }
    if (id === 'thumb' || id === 'thumbnail') {
        const attachmentId = crypto.randomBytes(16).toString('hex');
        await attachFormMedia(form, value, attachmentId, agent);
        return form.addPart({
            headers: { 'content-disposition': `form-data; name="${id}"` },
            body: `attach://${attachmentId}`,
        });
    }
    if (Array.isArray(value)) {
        const items = await Promise.all(value.map(async (item) => {
            var _a;
            if (typeof item.media !== 'object') {
                return await Promise.resolve(item);
            }
            const attachmentId = crypto.randomBytes(16).toString('hex');
            await attachFormMedia(form, item.media, attachmentId, agent);
            const thumb = (_a = item.thumb) !== null && _a !== void 0 ? _a : item.thumbnail;
            if (typeof thumb === 'object') {
                const thumbAttachmentId = crypto.randomBytes(16).toString('hex');
                await attachFormMedia(form, thumb, thumbAttachmentId, agent);
                return {
                    ...item,
                    media: `attach://${attachmentId}`,
                    thumbnail: `attach://${thumbAttachmentId}`,
                };
            }
            return { ...item, media: `attach://${attachmentId}` };
        }));
        return form.addPart({
            headers: { 'content-disposition': `form-data; name="${id}"` },
            body: JSON.stringify(items),
        });
    }
    if (value &&
        typeof value === 'object' &&
        (0, check_1.hasProp)(value, 'media') &&
        (0, check_1.hasProp)(value, 'type') &&
        typeof value.media !== 'undefined' &&
        typeof value.type !== 'undefined') {
        const attachmentId = crypto.randomBytes(16).toString('hex');
        await attachFormMedia(form, value.media, attachmentId, agent);
        return form.addPart({
            headers: { 'content-disposition': `form-data; name="${id}"` },
            body: JSON.stringify({
                ...value,
                media: `attach://${attachmentId}`,
            }),
        });
    }
    return await attachFormMedia(form, value, id, agent);
}
async function attachFormMedia(form, media, id, agent) {
    var _a, _b, _c;
    let fileName = (_a = media.filename) !== null && _a !== void 0 ? _a : `${id}.${(_b = DEFAULT_EXTENSIONS[id]) !== null && _b !== void 0 ? _b : 'dat'}`;
    if ('url' in media && media.url !== undefined) {
        const timeout = 500000; // ms
        const res = await (0, node_fetch_1.default)(media.url, { agent, timeout });
        return form.addPart({
            headers: {
                'content-disposition': `form-data; name="${id}"; filename="${fileName}"`,
            },
            body: res.body,
        });
    }
    if ('source' in media && media.source) {
        let mediaSource = media.source;
        if (typeof media.source === 'string') {
            const source = await (0, promises_1.realpath)(media.source);
            if ((await (0, promises_1.stat)(source)).isFile()) {
                fileName = (_c = media.filename) !== null && _c !== void 0 ? _c : path.basename(media.source);
                mediaSource = await fs.createReadStream(media.source);
            }
            else {
                throw new TypeError(`Unable to upload '${media.source}', not a file`);
            }
        }
        if (isStream(mediaSource) || Buffer.isBuffer(mediaSource)) {
            form.addPart({
                headers: {
                    'content-disposition': `form-data; name="${id}"; filename="${fileName}"`,
                },
                body: mediaSource,
            });
        }
    }
}
async function answerToWebhook(response, payload, options) {
    if (!includesMedia(payload)) {
        if (!response.headersSent) {
            response.setHeader('content-type', 'application/json');
        }
        response.end(JSON.stringify(payload), 'utf-8');
        return true;
    }
    const { headers, body } = await buildFormDataConfig(payload, options.attachmentAgent);
    if (!response.headersSent) {
        for (const [key, value] of Object.entries(headers)) {
            response.setHeader(key, value);
        }
    }
    await new Promise((resolve) => {
        response.on('finish', resolve);
        body.pipe(response);
    });
    return true;
}
function redactToken(error) {
    error.message = error.message.replace(/\/(bot|user)(\d+):[^/]+\//, '/$1$2:[REDACTED]/');
    throw error;
}
class ApiClient {
    constructor(token, options, response) {
        this.token = token;
        this.response = response;
        this.options = {
            ...DEFAULT_OPTIONS,
            ...(0, compact_1.compactOptions)(options),
        };
        if (this.options.apiRoot.startsWith('http://')) {
            this.options.agent = undefined;
        }
    }
    /**
     * If set to `true`, first _eligible_ call will avoid performing a POST request.
     * Note that such a call:
     * 1. cannot report errors or return meaningful values,
     * 2. resolves before bot API has a chance to process it,
     * 3. prematurely confirms the update as processed.
     *
     * https://core.telegram.org/bots/faq#how-can-i-make-requests-in-response-to-updates
     * https://github.com/telegraf/telegraf/pull/1250
     */
    set webhookReply(enable) {
        this.options.webhookReply = enable;
    }
    get webhookReply() {
        return this.options.webhookReply;
    }
    async callApi(method, payload, { signal } = {}) {
        const { token, options, response } = this;
        if (options.webhookReply &&
            (response === null || response === void 0 ? void 0 : response.writableEnded) === false &&
            WEBHOOK_REPLY_METHOD_ALLOWLIST.has(method)) {
            debug('Call via webhook', method, payload);
            // @ts-expect-error using webhookReply is an optimisation that doesn't respond with normal result
            // up to the user to deal with this
            return await answerToWebhook(response, { method, ...payload }, options);
        }
        if (!token) {
            throw new error_1.default({
                error_code: 401,
                description: 'Bot Token is required',
            });
        }
        debug('HTTP call', method, payload);
        const config = includesMedia(payload)
            ? await buildFormDataConfig({ method, ...payload }, options.attachmentAgent)
            : await buildJSONConfig(payload);
        const apiUrl = new url_1.URL(`./${options.apiMode}${token}${options.testEnv ? '/test' : ''}/${method}`, options.apiRoot);
        config.agent = options.agent;
        // @ts-expect-error AbortSignal shim is missing some props from Request.AbortSignal
        config.signal = signal;
        config.timeout = 500000; // ms
        const res = await (0, node_fetch_1.default)(apiUrl, config).catch(redactToken);
        if (res.status >= 500) {
            const errorPayload = {
                error_code: res.status,
                description: res.statusText,
            };
            throw new error_1.default(errorPayload, { method, payload });
        }
        const data = await res.json();
        if (!data.ok) {
            debug('API call failed', data);
            throw new error_1.default(data, { method, payload });
        }
        return data.result;
    }
}
exports.default = ApiClient;
