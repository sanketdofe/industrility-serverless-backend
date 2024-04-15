const {
  validateAccess,
  parseBody,
  formatError,
  formatResponse,
} = require("./common/request-helpers");
const { generateCredentialsForFileUpload } = require("./common/s3-helpers");
const { BUCKET_NAME } = require("./common/constants");

exports.handler = async (event, context) => {
  const validated = validateAccess(event);
  if (!validated.valid) {
    return validated.response;
  }

  const requestBody = parseBody(event);

  if (!requestBody.name) {
    return formatError({
      message: "name is required and cannot be empty",
      code: "BadRequest",
      statusCode: 400,
    });
  }
  if (requestBody.name.length > 20) {
    return formatError({
      message: "name cannot be longer than 20 characters",
      code: "BadRequest",
      statusCode: 400,
    });
  }

  if (
    !requestBody.documentNames ||
    !Array.isArray(requestBody.documentNames) ||
    !requestBody.documentNames.length
  ) {
    return formatError({
      message:
        "documentNames is required and must be an array with at least 1 element",
      code: "BadRequest",
      statusCode: 400,
    });
  }

  const { credentials, keys, region } = await generateCredentialsForFileUpload(
    BUCKET_NAME,
    requestBody.documentNames.map(
      (documentName) => `${requestBody.name}/${documentName}`,
    ),
  );

  return formatResponse({
    credentials,
    bucket: BUCKET_NAME,
    keys,
    region,
  });
};
