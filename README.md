# Kattalog

A semantic search platform that extracts text from uploaded images using AWS Rekognition, generates vector embeddings with Amazon Bedrock (Titan), and performs hybrid keyword + vector search via Amazon OpenSearch.

## Architecture

```
                          ┌──────────────────────────────────────────────┐
                          │              AWS Cloud (us-east-1)           │
                          │                                              │
 ┌────────┐  upload   ┌───┴────┐  trigger  ┌─────┐  event  ┌──────────┐ │
 │ React  │──────────►│Express │──────────►│ S3  │────────►│  SQS     │ │
 │ Client │  search   │ Server │           │     │         │  Queue   │ │
 │        │◄──────────│        │           └─────┘         └────┬─────┘ │
 └────────┘           └───┬────┘                                │       │
                          │ query                               ▼       │
                          │                              ┌─────────────┐│
                          │                              │   Lambda    ││
                          │                              │  Function   ││
                          │                              └──┬───┬──────┘│
                          │                                 │   │       │
                          │              ┌──────────────────┘   │       │
                          │              ▼                      ▼       │
                          │     ┌──────────────┐      ┌────────────┐   │
                          │     │ Rekognition  │      │  Bedrock   │   │
                          │     │  (OCR/Text   │      │  Titan     │   │
                          │     │  Detection)  │      │  Embed v1  │   │
                          │     └──────────────┘      └─────┬──────┘   │
                          │                                 │          │
                          │       ┌─────────────────────────┘          │
                          │       ▼                                    │
                          │  ┌───────────┐                             │
                          └─►│OpenSearch │  hybrid search              │
                             │ (k-NN +   │  (vector + keyword)        │
                             │ full-text)│                             │
                             └───────────┘                             │
                          └────────────────────────────────────────────┘
```

### Data Ingestion Pipeline

1. User uploads an image through the React client
2. Express server stores the file in an **S3** bucket
3. S3 event notification triggers an **SQS** message
4. **Lambda** function processes each message:
   - **Rekognition** `DetectText` extracts text from the image (confidence >= 80%)
   - Stopwords are removed from the extracted text
   - **Bedrock** Titan Embed v1 generates a 1536-dimensional vector embedding
   - The document (text, embedding, metadata) is indexed into **OpenSearch**

### Hybrid Search

1. User enters a search query in the React client
2. Express server removes stopwords and generates a query embedding via Bedrock
3. OpenSearch executes a **hybrid search** combining:
   - **k-NN vector search** (semantic similarity) — 30% weight
   - **Multi-match keyword search** on `extracted_text` and `title` — 70% weight
4. Results are normalized (min-max), deduplicated by S3 key, and filtered by a minimum score threshold

## Tech Stack

| Layer      | Technology                                                    |
|------------|---------------------------------------------------------------|
| Frontend   | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui          |
| Backend    | Express.js 5, Busboy (multipart uploads)                      |
| AI/ML      | Amazon Bedrock (Titan Embed v1), Amazon Rekognition           |
| Search     | Amazon OpenSearch (k-NN plugin, hybrid queries)               |
| Storage    | Amazon S3                                                     |
| Compute    | AWS Lambda (triggered via SQS)                                |
| Auth       | AWS IAM (SigV4 signed requests to OpenSearch & Bedrock)       |

## OpenSearch Index Schema

```json
{
  "mappings": {
    "properties": {
      "image_id":       { "type": "keyword" },
      "catalog_id":     { "type": "keyword" },
      "user_id":        { "type": "keyword" },
      "s3_key":         { "type": "keyword" },
      "extracted_text": { "type": "text" },
      "description":    { "type": "text" },
      "position":       { "type": "integer" },
      "created_at":     { "type": "date" },
      "text_embedding": { "type": "knn_vector", "dimension": 1536 }
    }
  }
}
```

## Project Structure

```
├── client/             React frontend (Vite + TypeScript + Tailwind)
│   └── src/
│       ├── components/ UI components (SearchBar, ResultsSection, UploadFile)
│       └── pages/      Route pages
├── server/             Express.js API server
│   └── index.js        Upload & search endpoints
└── lambda-text/        AWS Lambda for text extraction & embedding
    └── src/
        ├── index.js    Lambda handler (Rekognition → Bedrock → OpenSearch)
        └── common.js   Shared utilities (presigned URLs, logging middleware)
```

## Getting Started

### Prerequisites

- Node.js >= 18
- AWS CLI configured with credentials that have access to S3, Rekognition, Bedrock, and OpenSearch
- An Amazon OpenSearch domain with the k-NN plugin enabled

### Environment Variables

Copy `.env.example` to `.env` in the `server/` directory and fill in your values:

```
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name
OPENSEARCH_ENDPOINT=https://your-opensearch-domain.us-east-1.es.amazonaws.com
```

### Running Locally

```sh
# Install and start the backend
cd server
npm install
npm run dev

# Install and start the frontend (in another terminal)
cd client
npm install
npm run dev
```

The client runs on `http://localhost:3000` and the server on `http://localhost:4000`.

### Deploying the Lambda

Package and deploy `lambda-text/` to AWS Lambda. Configure an S3 event notification to send `s3:ObjectCreated:*` events to an SQS queue, and set the Lambda's trigger to that queue.

## Key Design Decisions

- **Hybrid search over pure vector search**: Combining keyword matching (70%) with vector similarity (30%) improves precision for exact term matches while still capturing semantic relevance.
- **Stopword removal before embedding**: Reduces noise in both the stored embeddings and query embeddings, improving search quality.
- **Result collapsing by `s3_key`**: Prevents duplicate results when multiple text regions are extracted from the same image.
- **Confidence threshold (80%)**: Filters out low-confidence OCR detections from Rekognition to avoid indexing noise.
- **SQS between S3 and Lambda**: Provides reliable, decoupled event delivery with built-in retry and dead-letter queue support.
