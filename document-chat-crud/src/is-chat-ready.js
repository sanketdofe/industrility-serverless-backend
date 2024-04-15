const {
  validateAccess,
  formatError,
  formatResponse,
} = require("./common/request-helpers");
const { getPineconeIndexStats } = require("./common/pinecone-helpers");
const {
  PINECONE_INDEX_NAME,
  convertS3DirectoryToPineConeNamespace,
} = require("./common/constants");

exports.handler = async (event, context) => {
  const validated = validateAccess(event);
  if (!validated.valid) {
    return validated.response;
  }
  if (!event.pathParameters.chatId) {
    return formatError({
      message: "Missing chatId path parameter",
      code: "BadRequest",
      statusCode: 400,
    });
  }
  const chatId = event.pathParameters.chatId;

  const pineconeIndexStats = await getPineconeIndexStats(PINECONE_INDEX_NAME);

  let isChatReady = false;
  if (pineconeIndexStats.namespaces) {
    const formattedChatNamespace =
      convertS3DirectoryToPineConeNamespace(chatId);
    const matchingNamespace =
      pineconeIndexStats.namespaces[formattedChatNamespace];
    if (matchingNamespace?.recordCount > 0) {
      isChatReady = true;
    }
  }
  return formatResponse({
    id: chatId,
    isChatReady,
  });
};
