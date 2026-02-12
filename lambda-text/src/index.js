import {
  RekognitionClient,
  DetectTextCommand,
} from "@aws-sdk/client-rekognition";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { Client } from "@opensearch-project/opensearch";
import { removeStopwords } from "stopword";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { withLogging } from "./common.js";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT
  || "https://search-domain-things-with-thought-fpwrnruahpoc6eu5zd7wfomq6q.us-east-1.es.amazonaws.com";
const OPENSEARCH_INDEX = "catalog-items";
const EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v1";
const CONFIDENCE_THRESHOLD = 80;

const rekognitionClient = new RekognitionClient({ region: AWS_REGION });
const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });
const opensearchClient = new Client({
  node: OPENSEARCH_ENDPOINT,
  ...AwsSigv4Signer({
    region: AWS_REGION,
    service: "es",
    credentials: defaultProvider(),
  }),
});

/**
 * Extract text from an image in S3 using Rekognition, then generate a vector
 * embedding of that text using Bedrock Titan Embed.
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @returns {Promise<{ text: string, embedding: object }>}
 */
const detectAndEmbed = async (bucket, key) => {
  // Use Rekognition OCR to extract text from the image
  const rekognitionResponse = await rekognitionClient.send(
    new DetectTextCommand({
      Image: {
        S3Object: { Bucket: bucket, Name: key },
      },
    })
  );

  if (!rekognitionResponse.TextDetections) {
    throw new Error("No text detected in image.");
  }

  // Keep only high-confidence detections and remove common stopwords
  const detectedWords = rekognitionResponse.TextDetections
    .filter((text) => text.Confidence >= CONFIDENCE_THRESHOLD)
    .map((text) => text.DetectedText);
  const cleanedText = removeStopwords(detectedWords).join(" ");

  // Generate a 1536-dimensional vector embedding via Bedrock Titan
  const bedrockResponse = await bedrockClient.send(
    new InvokeModelCommand({
      contentType: "application/json",
      accept: "application/json",
      modelId: EMBEDDING_MODEL_ID,
      body: JSON.stringify({ inputText: cleanedText }),
    })
  );
  const embedding = JSON.parse(new TextDecoder().decode(bedrockResponse.body));

  return { text: cleanedText, embedding };
};

/**
 * Index a document into OpenSearch with the extracted text and its vector embedding.
 * @param {string} key - S3 object key (used as a reference back to the source image)
 * @param {{ text: string, embedding: object }} data
 */
const store = async (key, data) => {
  const document = {
    image_id: crypto.randomUUID(),
    s3_key: key,
    extracted_text: data.text,
    text_embedding: data.embedding.embedding,
    created_at: Date.now(),
  };

  const response = await opensearchClient.index({
    index: OPENSEARCH_INDEX,
    body: document,
  });

  console.log("Indexed document:", response);
};

/**
 * Lambda handler factory. Processes S3 events delivered via SQS:
 * for each uploaded image, extracts text, generates an embedding,
 * and indexes the result in OpenSearch.
 */
const getHandler = () => {
  /** @type {import('aws-lambda').SQSHandler} */
  return async (event) => {
    for (const sqsRecord of event.Records) {
      const s3Event = JSON.parse(sqsRecord.body);
      for (const record of s3Event.Records) {
        const bucket = record.s3.bucket.name;
        const key = record.s3.object.key;
        const embeddingData = await detectAndEmbed(bucket, key);
        await store(key, embeddingData);
      }
    }
  };
};

export const handler = withLogging(getHandler());
