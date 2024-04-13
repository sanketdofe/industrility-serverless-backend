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
  try {
    const object = await S3.getObject({
      Bucket: s3Object.bucket.name,
      Key: decodeURIComponent(s3Object.object.key.replace(/\+/g, " ")),
    }).promise();

    const blob = new Blob([object.Body], {
      type: object.ContentType,
    });

    const loader = new WebPDFLoader(blob);

    const docs = await loader.load();

    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex,
    });
  } catch (e) {
    console.log(e);
  }
};
