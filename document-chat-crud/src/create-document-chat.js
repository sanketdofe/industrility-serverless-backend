const {
  validateAccess,
  parseBody,
  formatError,
  formatResponse,
} = require("./common/request-helpers");
const {
  getPreSignedUrlForUploadingObjectBulk,
} = require("./common/s3-helpers");
const { BUCKET_NAME } = require("./constants");

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

  const presignedUrls = await getPreSignedUrlForUploadingObjectBulk(
    BUCKET_NAME,
    requestBody.documentNames.map(
      (documentName) => `${requestBody.name}/${documentName}`,
    ),
    10 * 60,
  );

  return formatResponse({
    presignedUrls,
  });
};
