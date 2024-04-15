const AWS = require("aws-sdk");
const md5 = require("md5");

const s3 = new AWS.S3({
  region: "us-east-1",
});

const sts = new AWS.STS({
  region: "us-east-1",
});

async function getObjectSignedUrlBulk(bucket, keys, expiresInSeconds) {
  if (!keys || !keys.length) {
    return [];
  }
  return Promise.all(
    keys.map((key) =>
      s3.getSignedUrlPromise("getObject", {
        Bucket: bucket,
        Key: key,
        Expires: expiresInSeconds,
      }),
    ),
  ).then((urls) => urls.map((url, index) => ({ url, key: keys[index] })));
}

async function generateCredentialsForFileUpload(bucket, keys) {
  const uniqueKeysRequestId = md5(keys.join("_"));

  const resources = keys.map((key) => `"arn:aws:s3:::${bucket}/${key}"`);

  let policy = "";
  policy += "{\n";
  policy += '  "Version": "2012-10-17",\n';
  policy += '  "Statement": [\n';
  policy += "  {\n";
  policy += '    "Sid": "AllowAuthenticatedUserToUploadMedia",\n';
  policy += '    "Effect": "Allow",\n';
  policy += '    "Action": "s3:PutObject",\n';
  policy += `    "Resource": [${resources.join(",")}]\n`;
  policy += "  }\n";
  policy += "]\n";
  policy += "}";

  const params = {
    DurationSeconds: 1800,
    ExternalId: uniqueKeysRequestId,
    Policy: policy,
    RoleArn: process.env.UPLOAD_FILE_ASSUMED_ROLE,
    RoleSessionName: uniqueKeysRequestId,
  };

  const { Credentials } = await sts.assumeRole(params).promise();

  return { credentials: Credentials, keys, region: "us-east-1" };
}

function listDirectories(bucket, prefix) {
  return s3
    .listObjectsV2({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: "/",
    })
    .promise();
}

function listObjects(bucket, prefix) {
  return s3
    .listObjectsV2({
      Bucket: bucket,
      Prefix: prefix,
    })
    .promise();
}

module.exports = {
  getObjectSignedUrlBulk,
  generateCredentialsForFileUpload,
  listDirectories,
  listObjects,
};
