"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimedOutError = exports.ServerError = exports.FloodError = exports.AuthKeyError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.InvalidDCError = exports.RPCError = void 0;
const ts_custom_error_1 = require("ts-custom-error");
class RPCError extends ts_custom_error_1.CustomError {
    constructor(message, request, code) {
        super("{0}: {1}{2}"
            .replace("{0}", (code === null || code === void 0 ? void 0 : code.toString()) || "")
            .replace("{1}", message || "")
            .replace("{2}", RPCError._fmtRequest(request)));
        this.code = code;
        this.errorMessage = message;
    }
    static _fmtRequest(request) {
        // TODO fix this
        if (request) {
            return ` (caused by ${request.className})`;
        }
        else {
            return "";
        }
    }
}
exports.RPCError = RPCError;
/**
 * The request must be repeated, but directed to a different data center.
 */
class InvalidDCError extends RPCError {
    constructor(message, request, code) {
        super(message, request, code);
        this.code = code || 303;
        this.errorMessage = message || "ERROR_SEE_OTHER";
    }
}
exports.InvalidDCError = InvalidDCError;
/**
 * The query contains errors. In the event that a request was created
 * using a form and contains user generated data, the user should be
 * notified that the data must be corrected before the query is repeated.
 */
class BadRequestError extends RPCError {
    constructor() {
        super(...arguments);
        this.code = 400;
        this.errorMessage = "BAD_REQUEST";
    }
}
exports.BadRequestError = BadRequestError;
/**
 * There was an unauthorized attempt to use functionality available only
 * to authorized users.
 */
class UnauthorizedError extends RPCError {
    constructor() {
        super(...arguments);
        this.code = 401;
        this.errorMessage = "UNAUTHORIZED";
    }
}
exports.UnauthorizedError = UnauthorizedError;
/**
 * Privacy violation. For example, an attempt to write a message to
 * someone who has blacklisted the current user.
 */
class ForbiddenError extends RPCError {
    constructor() {
        super(...arguments);
        this.code = 403;
        this.errorMessage = "FORBIDDEN";
    }
}
exports.ForbiddenError = ForbiddenError;
/**
 * An attempt to invoke a non-existent object, such as a method.
 */
class NotFoundError extends RPCError {
    constructor() {
        super(...arguments);
        this.code = 404;
        this.errorMessage = "NOT_FOUND";
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Errors related to invalid authorization key, like
 * AUTH_KEY_DUPLICATED which can cause the connection to fail.
 */
class AuthKeyError extends RPCError {
    constructor() {
        super(...arguments);
        this.code = 406;
        this.errorMessage = "AUTH_KEY";
    }
}
exports.AuthKeyError = AuthKeyError;
/**
 * The maximum allowed number of attempts to invoke the given method
 * with the given input parameters has been exceeded. For example, in an
 * attempt to request a large number of text messages (SMS) for the same
 * phone number.
 */
class FloodError extends RPCError {
    constructor() {
        super(...arguments);
        this.code = 420;
        this.errorMessage = "FLOOD";
    }
}
exports.FloodError = FloodError;
/**
 * An internal server error occurred while a request was being processed
 * for example, there was a disruption while accessing a database or file
 * storage
 */
class ServerError extends RPCError {
    constructor() {
        super(...arguments);
        this.code = 500; // Also witnessed as -500
        this.errorMessage = "INTERNAL";
    }
}
exports.ServerError = ServerError;
/**
 * Clicking the inline buttons of bots that never (or take to long to)
 * call ``answerCallbackQuery`` will result in this "special" RPCError.
 */
class TimedOutError extends RPCError {
    constructor() {
        super(...arguments);
        this.code = 503; // Only witnessed as -503
        this.errorMessage = "Timeout";
    }
}
exports.TimedOutError = TimedOutError;
