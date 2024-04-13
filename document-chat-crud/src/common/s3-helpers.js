const AWS = require("aws-sdk");

const s3 = new AWS.S3({
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

async function getPreSignedUrlForUploadingObjectBulk(
  bucket,
  keys,
  expiresInSeconds,
) {
  if (!keys || !keys.length) {
    return [];
  }
  return Promise.all(
    keys.map((key) =>
      s3.getSignedUrlPromise("putObject", {
        Bucket: bucket,
        Key: key,
        Expires: expiresInSeconds,
      }),
    ),
  ).then((urls) => urls.map((url, index) => ({ url, key: keys[index] })));
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
  getPreSignedUrlForUploadingObjectBulk,
  listDirectories,
  listObjects,
};
