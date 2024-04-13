const AWS = require("aws-sdk");
const { Pinecone } = require("@pinecone-database/pinecone");

const secretsManager = new AWS.SecretsManager({
  region: "us-east-1",
});

let pineConeClient = null;

async function getPineconeClient() {
  const pineConeSecret = await secretsManager
    .getSecretValue({
      SecretId: "pinecone-credentials",
    })
    .promise();
  const parsedPineConeSecret = JSON.parse(pineConeSecret.SecretString);
  return new Pinecone({ apiKey: parsedPineConeSecret.apiKey });
}

async function getPineconeIndexStats(index) {
  pineConeClient = pineConeClient || (await getPineconeClient());
  return pineConeClient.index(index).describeIndexStats();
}

module.exports = { getPineconeIndexStats };
