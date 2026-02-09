import { fetchTranscript } from 'youtube-transcript-plus';
import { CharacterTextSplitter } from '@langchain/textsplitters';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

import { pool } from '../db/postgres.client.js';
import { config } from '../config/env.js';
import { storeEmbeddings, querySimilarChunks, videoExists } from './pinecone.service.js';
import { ChatSession, ChatMessage } from '../types/chat.types.js';

// Extract video ID from YouTube URL
export function extractVideoId(url: string): string {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    // Fallback: create hash from URL
    return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
}

// Create a new chat session
export async function createSession(videoUrl: string, userId?: string): Promise<ChatSession> {
    const videoId = extractVideoId(videoUrl);
    const title = `Chat about ${videoId}`; // Detailed title could be fetched from YouTube API if needed

    const result = await pool.query(
        `INSERT INTO chat_sessions (video_id, video_url, user_id, title) VALUES ($1, $2, $3, $4) RETURNING *`,
        [videoId, videoUrl, userId, title]
    );

    return result.rows[0] as ChatSession;
}

// Get session by ID
export async function getSession(sessionId: string): Promise<ChatSession | null> {
    const result = await pool.query(
        `SELECT * FROM chat_sessions WHERE id = $1`,
        [sessionId]
    );

    return result.rows[0] as ChatSession || null;
}

// Save a chat message
export async function saveMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
): Promise<ChatMessage> {
    const result = await pool.query(
        `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3) RETURNING *`,
        [sessionId, role, content]
    );

    return result.rows[0] as ChatMessage;
}

// Get chat history for a session
export async function getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
    const result = await pool.query(
        `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
        [sessionId]
    );

    return result.rows as ChatMessage[];
}

// Update chat session title
export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await pool.query(
        `UPDATE chat_sessions SET title = $1 WHERE id = $2`,
        [title, sessionId]
    );
}

// Get all sessions for a user
export async function getUserSessions(userId: string): Promise<ChatSession[]> {
    const result = await pool.query(
        `SELECT * FROM chat_sessions WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
    );

    return result.rows as ChatSession[];
}

// Process video transcript and store in Pinecone
async function processTranscript(videoUrl: string, videoId: string): Promise<void> {
    console.log('Fetching transcript for:', videoUrl);
    
    // Try multiple languages in order of preference
    const languages = ['en', 'hi', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'zh'];
    let transcript = null;
    let lastError: Error | null = null;

    for (const lang of languages) {
        try {
            transcript = await fetchTranscript(videoUrl, { lang });
            if (transcript && transcript.length > 0) {
                console.log(`Successfully fetched transcript in language: ${lang}`);
                break;
            }
        } catch (error) {
            lastError = error as Error;
            // Continue to next language
            continue;
        }
    }

    // If all languages failed, try without specifying language (gets any available)
    if (!transcript || transcript.length === 0) {
        try {
            transcript = await fetchTranscript(videoUrl);
            if (transcript && transcript.length > 0) {
                console.log('Successfully fetched transcript (auto-detected language)');
            }
        } catch (error) {
            lastError = error as Error;
        }
    }

    if (!transcript || transcript.length === 0) {
        const errorMsg = lastError?.message || 'Could not fetch transcript';
        throw new Error(`${errorMsg}. Please check if the video has captions enabled.`);
    }

    const fullText = transcript.map((item) => item.text).join(' ');

    console.log('Splitting text into chunks...');
    const textSplitter = new CharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const chunks = await textSplitter.splitText(fullText);

    console.log('Storing embeddings in Pinecone...');
    await storeEmbeddings(videoId, chunks);
}

// Internal helper: prepare session and context for a given question
export async function prepareQuestionContext(
    videoUrl: string,
    question: string,
    sessionId?: string,
    userId?: string
): Promise<{ session: ChatSession; context: string; videoId: string }> {
    const videoId = extractVideoId(videoUrl);

    // Create or get session
    let session: ChatSession;
    if (sessionId) {
        const existingSession = await getSession(sessionId);
        if (!existingSession) {
            session = await createSession(videoUrl, userId);
        } else {
            session = existingSession;
            // potential check: if (userId && session.user_id && session.user_id !== userId) throw new Error("Unauthorized");
        }
    } else {
        session = await createSession(videoUrl, userId);
    }

    // Save user message
    await saveMessage(session.id, 'user', question);

    // Check if we need to process the transcript
    const hasEmbeddings = await videoExists(videoId);
    if (!hasEmbeddings) {
        await processTranscript(videoUrl, videoId);
    }

    // Query similar chunks from Pinecone
    console.log('Querying similar chunks...');
    const relevantChunks = await querySimilarChunks(question, videoId, 5);
    const context = relevantChunks.join('\n\n');

    return { session, context, videoId };
}

// Main function: Process question and generate full answer (non-streaming)
export async function processQuestion(
    videoUrl: string,
    question: string,
    sessionId?: string,
    userId?: string
): Promise<{ answer: string; sessionId: string }> {
    const { session, context } = await prepareQuestionContext(
        videoUrl,
        question,
        sessionId,
        userId
    );

    // Generate answer using LLM
    console.log('Generating answer...');
    const llm = new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-flash',
        apiKey: config.googleApiKey,
        temperature: 0.7,
    });

    const promptTemplate = ChatPromptTemplate.fromMessages([
        [
            'system',
            `You are a helpful assistant.
      Answer ONLY from the provided transcript context.
      If the context is insufficient, just say you don't know.`,
        ],
        ['human', 'Question: {question}\n\nContext:\n{context}'],
    ]);

    const parser = new StringOutputParser();
    const chain = promptTemplate.pipe(llm).pipe(parser);

    const answer = await chain.invoke({ question, context });

    // Save assistant message
    await saveMessage(session.id, 'assistant', answer);

    // Update session title based on first user question if it's still the default
    if (session.title && session.title.startsWith('Chat about')) {
        const cleaned = question.trim().replace(/\s+/g, ' ');
        const truncated = cleaned.slice(0, 60);
        const title = truncated.length < cleaned.length ? `${truncated}...` : truncated;
        await updateSessionTitle(session.id, title);
    }

    console.log('Successfully generated answer');
    return { answer, sessionId: session.id };
}
