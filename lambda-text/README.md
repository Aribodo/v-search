# Lambda — Text Extraction & Embedding

AWS Lambda function triggered by S3 upload events (via SQS). For each uploaded image it:

1. **Rekognition** — Detects text in the image (`DetectText`, confidence >= 80%)
2. **Stopword removal** — Cleans the extracted text
3. **Bedrock Titan Embed v1** — Generates a 1536-dimensional vector embedding
4. **OpenSearch** — Indexes the document with text + embedding for hybrid search

## Pipeline

```
S3 ObjectCreated → SQS → Lambda → Rekognition → Bedrock → OpenSearch
```

## Environment Variables

| Variable               | Description                          | Default     |
|------------------------|--------------------------------------|-------------|
| `AWS_REGION`           | AWS region                           | `us-east-1` |
| `OPENSEARCH_ENDPOINT`  | OpenSearch domain URL                | —           |

## OpenSearch Document Schema

```json
{
  "image_id": "uuid",
  "s3_key": "uploads/filename.jpg",
  "extracted_text": "cleaned text from image",
  "text_embedding": [0.012, -0.034, ...],
  "created_at": 1700000000000
}
```
