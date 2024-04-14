const { validateAccess, formatResponse } = require("./common/request-helpers");
const { listDirectories } = require("./common/s3-helpers");
const { BUCKET_NAME } = require("./common/constants");

exports.handler = async (event, context) => {
  const validated = validateAccess(event);
  if (!validated.valid) {
    return validated.response;
  }

  const availableDocumentChats = await listDirectories(BUCKET_NAME, "");
  return formatResponse({
    chats: availableDocumentChats.CommonPrefixes.map((chat) =>
      chat.Prefix.replace(/\/$/g, ""),
    ),
    totalCount: availableDocumentChats.KeyCount,
  });
};
