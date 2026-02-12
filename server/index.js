const express = require("express");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const cors = require("cors");
const { Client } = require("@opensearch-project/opensearch");
const { AwsSigv4Signer } = require("@opensearch-project/opensearch/aws");
const { defaultProvider } = require("@aws-sdk/credential-provider-node");
const { removeStopwords } = require("stopword");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const Busboy = require("busboy");

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const S3_BUCKET = process.env.S3_BUCKET || "things-with-thought";
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT
  || "https://search-domain-things-with-thought-fpwrnruahpoc6eu5zd7wfomq6q.us-east-1.es.amazonaws.com";
const OPENSEARCH_INDEX = "catalog-items";
const EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v1";
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }));

// AWS service clients (credentials resolved from the environment via the default provider chain)
const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });
const s3Client = new S3Client({ region: AWS_REGION });
const opensearchClient = new Client({
  node: OPENSEARCH_ENDPOINT,
  ...AwsSigv4Signer({
    region: AWS_REGION,
    service: "es",
    credentials: defaultProvider(),
  }),
});

/**
 * POST /api/upload
 * Accepts multipart form data and uploads each file to S3.
 * S3 triggers the downstream Lambda pipeline (via SQS) for text extraction and embedding.
 */
app.post("/api/upload", async (req, res) => {
  try {
    const busboy = Busboy({ headers: req.headers });
    const uploadPromises = [];

    busboy.on("file", async (fieldname, file, filename) => {
      const chunks = [];
      for await (const chunk of file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      const upload = s3Client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: `uploads/${filename.filename}`,
          Body: fileBuffer,
        })
      );
      uploadPromises.push(upload);
    });

    busboy.on("finish", async () => {
      try {
        await Promise.all(uploadPromises);
        res.json({ message: "Upload complete" });
      } catch (err) {
        console.error("S3 upload error:", err);
        res.status(500).json({ error: "Upload failed" });
      }
    });

    req.pipe(busboy);
  } catch (err) {
    console.error("Upload handler error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/**
 * GET /api/search?query=<text>
 * Performs hybrid search: generates a vector embedding for the query via Bedrock,
 * then runs a combined k-NN + keyword search against OpenSearch.
 */
app.get("/api/search", async (req, res) => {
  try {
    // Remove common stopwords to improve embedding and keyword relevance
    const cleanedQuery = removeStopwords(req.query.query.split(" ")).join(" ");

    // Generate a 1536-dimensional embedding for the search query
    const bedrockResponse = await bedrockClient.send(
      new InvokeModelCommand({
        contentType: "application/json",
        accept: "application/json",
        modelId: EMBEDDING_MODEL_ID,
        body: JSON.stringify({ inputText: cleanedQuery }),
      })
    );
    const { embedding } = JSON.parse(new TextDecoder().decode(bedrockResponse.body));

    // Hybrid query: k-NN vector similarity + full-text keyword match
    const searchBody = {
      min_score: 0.7,
      query: {
        hybrid: {
          queries: [
            {
              knn: {
                text_embedding: {
                  vector: embedding,
                  k: 5,
                },
              },
            },
            {
              multi_match: {
                query: req.query.query,
                fields: ["extracted_text", "title"],
              },
            },
          ],
        },
      },
      // Deduplicate results from the same source image
      collapse: { field: "s3_key" },
      // Normalize and combine scores: 30% vector similarity, 70% keyword match
      search_pipeline: {
        phase_results_processors: [
          {
            "normalization-processor": {
              normalization: { technique: "min_max" },
              combination: {
                technique: "arithmetic_mean",
                parameters: { weights: [0.3, 0.7] },
              },
              ignore_failure: false,
            },
          },
        ],
      },
    };

    const response = await opensearchClient.search({
      index: OPENSEARCH_INDEX,
      body: searchBody,
    });

    res.json(response);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
