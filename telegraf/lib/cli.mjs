#!/usr/bin/env node
import d from 'debug';
import parse from 'mri';
import path from 'path';
import { Telegraf } from './index.js';
const debug = d('telegraf:cli');
const helpMsg = `Usage: telegraf [opts] <bot-file>

  -t  Bot token [$BOT_TOKEN]
  -d  Webhook domain [$BOT_DOMAIN]
  -H  Webhook host [0.0.0.0]
  -p  Webhook port [$PORT or 3000]
  -l  Enable logs
  -h  Show this help message
  -m  Bot API method to run directly
  -D  Data to pass to the Bot API method`;
const help = () => console.log(helpMsg);
/**
 * Runs the cli program and returns exit code
 */
export async function main(argv, env = {}) {
    const args = parse(argv, {
        alias: {
            // string params, all optional
            t: 'token',
            d: 'domain',
            m: 'method',
            D: 'data',
            // defaults exist
            H: 'host',
            p: 'port',
            // boolean params
            l: 'logs',
            h: 'help',
        },
        boolean: ['h', 'l'],
        default: {
            H: '0.0.0.0',
            p: env.PORT || '3000',
        },
    });
    if (args.help) {
        help();
        return 0;
    }
    const token = args.token || env.BOT_TOKEN;
    const domain = args.domain || env.BOT_DOMAIN;
    if (!token) {
        console.error('Please supply Bot Token');
        help();
        return 1;
    }
    const bot = new Telegraf(token);
    if (args.method) {
        const method = args.method;
        console.log(await bot.telegram.callApi(method, JSON.parse(args.data || '{}')));
        return 0;
    }
    let [, , file] = args._;
    if (!file) {
        try {
            const packageJson = (await import(path.resolve(process.cwd(), 'package.json')));
            file = packageJson.main || 'index.js';
            // eslint-disable-next-line no-empty
        }
        catch (err) { }
    }
    if (!file) {
        console.error('Please supply a bot handler file.\n');
        help();
        return 2;
    }
    if (file[0] !== '/')
        file = path.resolve(process.cwd(), file);
    try {
        if (args.logs)
            d.enable('telegraf:*');
        const mod = await import(file);
        const botHandler = mod.botHandler || mod.default;
        const httpHandler = mod.httpHandler;
        const tlsOptions = mod.tlsOptions;
        const config = {};
        if (domain) {
            config.webhook = {
                domain,
                host: args.host,
                port: Number(args.port),
                tlsOptions,
                cb: httpHandler,
            };
        }
        bot.use(botHandler);
        debug(`Starting module ${file}`);
        await bot.launch(config);
    }
    catch (err) {
        console.error(`Error launching bot from ${file}`, err === null || err === void 0 ? void 0 : err.stack);
        return 3;
    }
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    return 0;
}
process.exitCode = await main(process.argv, process.env);
