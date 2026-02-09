import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';
import { VectorMetadata } from '../types/chat.types.js';

// Initialize Pinecone client
const pinecone = new Pinecone({
    apiKey: config.pineconeApiKey,
});

// Initialize Google AI for embeddings
const genAI = new GoogleGenerativeAI(config.googleApiKey);
const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

// Get Pinecone index
function getIndex() {
    return pinecone.index(config.pineconeIndexName);
}

// Generate embeddings using Google AI directly
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
        const result = await embeddingModel.embedContent(text);
        embeddings.push(result.embedding.values);
    }

    console.log(`Generated ${embeddings.length} embeddings, dimension: ${embeddings[0]?.length || 0}`);
    return embeddings;
}

// Generate single embedding for a query
async function generateQueryEmbedding(text: string): Promise<number[]> {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
}

// Store transcript chunks as vectors in Pinecone
export async function storeEmbeddings(
    videoId: string,
    chunks: string[]
): Promise<void> {
    const index = getIndex();

    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    const vectors = await generateEmbeddings(chunks);

    // Prepare records for Pinecone
    const records = chunks.map((text, i) => ({
        id: `${videoId}_chunk_${i}`,
        values: vectors[i],
        metadata: {
            videoId,
            chunkIndex: i,
            text,
        } as VectorMetadata,
    }));

    // Upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await index.upsert(batch);
    }

    console.log(`Stored ${records.length} vectors for video: ${videoId}`);
}

// Query similar chunks from Pinecone
export async function querySimilarChunks(
    question: string,
    videoId: string,
    topK: number = 5
): Promise<string[]> {
    const index = getIndex();

    // Generate embedding for the question
    const queryVector = await generateQueryEmbedding(question);
    console.log(`Query vector dimension: ${queryVector.length}`);

    // Query Pinecone with filter for specific video
    const results = await index.query({
        vector: queryVector,
        topK,
        includeMetadata: true,
        filter: { videoId },
    });

    // Extract text from results
    const chunks = results.matches
        .filter((match) => match.metadata?.text)
        .map((match) => match.metadata!.text as string);

    return chunks;
}

// Check if video embeddings already exist
export async function videoExists(videoId: string): Promise<boolean> {
    const index = getIndex();

    try {
        const result = await index.fetch([`${videoId}_chunk_0`]);
        return Object.keys(result.records).length > 0;
    } catch {
        return false;
    }
}

// Delete video embeddings
export async function deleteVideoEmbeddings(videoId: string): Promise<void> {
    const index = getIndex();

    await index.deleteMany({
        filter: { videoId },
    });

    console.log(`Deleted embeddings for video: ${videoId}`);
}
