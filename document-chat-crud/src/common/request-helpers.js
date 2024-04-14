const serialize = (object) => {
    return JSON.stringify(object, null, 2);
};

const commonHeaders = {
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Origin': '*'
}

const formatResponse = (body) => {
    return {
        statusCode: 200,
        headers: {
            ...commonHeaders,
            "Content-Type": "application/json",
        },
        isBase64Encoded: false,
        multiValueHeaders: {},
        body: serialize(body),
    };
};

const formatError = (error) => {
    return {
        statusCode: error.statusCode || error.cause?.statusCode,
        headers: {
            ...commonHeaders,
            "Content-Type": "application/json",
            "x-amzn-ErrorType": error.code,
        },
        isBase64Encoded: false,
        body: serialize({
            code:
                error?.code ||
                error?.cause?.code ||
                error.statusCode ||
                error.cause?.statusCode,
            message: error.message,
        }),
    };
};

const parseBody = (event) => {
    try {
        return event.body ? JSON.parse(event.body) : event;
    } catch (e) {
        return formatError({
            message: "Invalid JSON format",
            cause: {code: "BadRequest", statusCode: 400},
        });
    }
};

const validateAccess = (event) => {
    if (!event.headers.Authorization) {
        return {
            valid: false,
            response: formatError({
                message: "Missing Authorization header",
                cause: {code: "Unauthorized", statusCode: 401},
            }),
        };
    }
    if (event.headers.Authorization !== process.env.AUTHORIZATION_TOKEN) {
        return {
            valid: false,
            response: formatError({
                message: "Invalid Authorization header",
                cause: {code: "Unauthorized", statusCode: 401},
            }),
        };
    }
    return {
        valid: true,
    };
};

module.exports = {
    formatResponse,
    formatError,
    parseBody,
    validateAccess,
};
