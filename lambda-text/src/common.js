import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import flow from "lodash/flow.js";

const s3Client = new S3Client({});

/**
 * Create a presigned URL for uploading an object to S3.
 * Expires in 15 minutes.
 * @param {{ bucket: string, key: string, contentType: string }} params
 */
export const createPresignedPutURL = ({ bucket, key, contentType }) => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 15 * 60 });
};

/**
 * Create a presigned URL for downloading an object from S3.
 * Expires in 24 hours.
 * @param {{ bucket: string, key: string }} params
 */
export const createPresignedGetURL = ({ bucket, key }) => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 24 * 60 * 60 });
};

export const RESPONSE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
};

/**
 * Wraps a handler in a try/catch block and logs errors.
 * @param {import("@types/aws-lambda").Handler} handler
 * @returns {import("@types/aws-lambda").Handler}
 */
export const withErrorLogging =
  (handler) =>
  async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

/**
 * Wraps a handler to log its input and output.
 * @param {import("@types/aws-lambda").Handler} handler
 * @returns {import("@types/aws-lambda").Handler}
 */
export const withEventLogging =
  (handler) =>
  async (...args) => {
    console.log("INPUT:", JSON.stringify(args));
    const result = await handler(...args);
    console.log("OUTPUT:", JSON.stringify(result));
    return result;
  };

/**
 * Combines event logging and error logging into a single middleware.
 * @param {import("@types/aws-lambda").Handler} handler
 * @returns {import("@types/aws-lambda").Handler}
 */
export const withLogging = flow(withEventLogging, withErrorLogging);
