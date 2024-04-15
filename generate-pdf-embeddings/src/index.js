const AWS = require("aws-sdk");
const {
  BedrockEmbeddings,
} = require("@langchain/community/embeddings/bedrock");
const { PineconeStore } = require("@langchain/pinecone");
const { Pinecone } = require("@pinecone-database/pinecone");
const { WebPDFLoader } = require("langchain/document_loaders/web/pdf");

const S3 = new AWS.S3();
const secretsManager = new AWS.SecretsManager({
  region: "us-east-1",
});

const embeddings = new BedrockEmbeddings({
  model: "amazon.titan-embed-text-v1",
  region: "us-east-1",
});

async function getPineconeClient() {
  const pineConeSecret = await secretsManager
    .getSecretValue({
      SecretId: "pinecone-credentials",
    })
    .promise();
  const parsedPineConeSecret = JSON.parse(pineConeSecret.SecretString);
  return new Pinecone({ apiKey: parsedPineConeSecret.apiKey });
}

exports.handler = async (event, context) => {
  const pinecone = await getPineconeClient();
  const pineconeIndex = pinecone.index("document-kb");

  const s3Object = event.Records[0].s3;
  const key = decodeURIComponent(s3Object.object.key.replace(/\+/g, " "));
  try {
    const object = await S3.getObject({
      Bucket: s3Object.bucket.name,
      Key: key,
    }).promise();

    const blob = new Blob([object.Body], {
      type: object.ContentType,
    });

    // To allow grouping documents in a namespace
    const parentDir = key.split("/").slice(0, -1).join("/");

    const loader = new WebPDFLoader(blob);

    const docs = await loader.load();

    const sanitizedNamespace = parentDir
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-");

    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex,
      namespace: sanitizedNamespace,
      maxConcurrency: 1,
    });
  } catch (e) {
    console.log(e);
  }
};
