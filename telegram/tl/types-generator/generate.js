"use strict";
const path = require("path");
const fs = require("fs");
const { parseTl } = require("../generationHelpers");
const templateFn = require("./template");
const INPUT_FILE = path.resolve(__dirname, "../static/api.tl");
const SCHEMA_FILE = path.resolve(__dirname, "../static/schema.tl");
const OUTPUT_FILE = path.resolve(__dirname, "../api.d.ts");
const peersToPatch = [
    "InputPeer",
    "Peer",
    "InputUser",
    "User",
    "UserFull",
    "Chat",
    "ChatFull",
    "InputChannel",
];
function patchMethods(methods) {
    for (const method of methods) {
        for (const arg in method["argsConfig"]) {
            if (peersToPatch.includes(method["argsConfig"][arg]["type"])) {
                method["argsConfig"][arg]["type"] = "EntityLike";
            }
            else if (method["argsConfig"][arg]["type"] &&
                arg.toLowerCase().includes("msgid")) {
                if (method["argsConfig"][arg]["type"] !== "long") {
                    method["argsConfig"][arg]["type"] = "MessageIDLike";
                }
            }
        }
    }
}
function main() {
    const tlContent = fs.readFileSync(INPUT_FILE, "utf-8");
    const apiConfig = extractParams(tlContent);
    const schemeContent = fs.readFileSync(SCHEMA_FILE, "utf-8");
    const schemeConfig = extractParams(schemeContent);
    const types = [...apiConfig.types, ...schemeConfig.types];
    const functions = [...apiConfig.functions, ...schemeConfig.functions];
    const constructors = [
        ...apiConfig.constructors,
        ...schemeConfig.constructors,
    ];
    // patching custom types
    patchMethods(functions);
    const generated = templateFn({
        types: types,
        functions: functions,
        constructors: constructors,
    });
    fs.writeFileSync(OUTPUT_FILE, generated);
}
function extractParams(fileContent) {
    const defInterator = parseTl(fileContent, 109);
    const types = {};
    const constructors = [];
    const functions = [];
    for (const def of defInterator) {
        if (def.isFunction) {
            functions.push(def);
        }
        else {
            if (!types[def.result]) {
                const [namespace, name] = def.result.includes(".")
                    ? def.result.split(".")
                    : [undefined, def.result];
                types[def.result] = {
                    namespace,
                    name,
                    constructors: [],
                };
            }
            types[def.result].constructors.push(def.namespace ? `${def.namespace}.${def.name}` : def.name);
            constructors.push(def);
        }
    }
    return {
        types: Object.values(types),
        constructors,
        functions,
    };
}
main();
