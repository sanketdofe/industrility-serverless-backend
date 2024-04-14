
exports.handler = async (
    event
) => {
    return {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": true
        },
        statusCode: 200
    };
}