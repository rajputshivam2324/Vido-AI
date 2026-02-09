// Chat session stored in PostgreSQL
export interface ChatSession {
    id: string;
    user_id?: string;
    video_id: string;
    video_url: string;
    title?: string;
    created_at: Date;
}

// Chat message stored in PostgreSQL
export interface ChatMessage {
    id: string;
    session_id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: Date;
}

// API request body for chat endpoint
export interface ChatRequest {
    videoUrl: string;
    question: string;
    sessionId?: string;
}

// API response for chat endpoint
export interface ChatResponse {
    answer: string;
    sessionId: string;
}

// Error response format
export interface ErrorResponse {
    error: string;
    message?: string;
    details?: string;
}

// Vector metadata stored in Pinecone
export interface VectorMetadata {
    videoId: string;
    chunkIndex: number;
    text: string;
    [key: string]: string | number;
}
