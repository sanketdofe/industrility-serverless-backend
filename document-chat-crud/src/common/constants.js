const BUCKET_NAME = "document-chat-store";
const PINECONE_INDEX_NAME = "document-kb";

const convertS3DirectoryToPineConeNamespace = (s3Key) => {
  return s3Key
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-");
};

module.exports = {
  BUCKET_NAME,
  PINECONE_INDEX_NAME,
  convertS3DirectoryToPineConeNamespace,
};
