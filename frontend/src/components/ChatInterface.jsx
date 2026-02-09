import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../context/AuthContext';

// Use consistent API base URL for all backend requests
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3005'
    : 'https://ytchatbot-3.onrender.com');

// const getModelEndpoint = (path) => `${API_BASE_URL}${path}`; // Unused if only using ytchatbot

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  useState('ytchatbot'); // Constant model - value not used, just initializing state
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [tempVideoUrl, setTempVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [videoUrl, setVideoUrl] = useState('');
  const [currentVideoUrl, setCurrentVideoUrl] = useState(''); // Track the video URL being used for current session
  const [, setTranscriptId] = useState(''); // Store transcriptId for the current video
  const [chatTitle, setChatTitle] = useState('New Chat'); // Track the current chat title

  const { user, token, logout } = useAuth();
  const [chatHistory, setChatHistory] = useState([]);


  const messagesEndRef = useRef(null);

  // Load chat history when token changes or component mounts
  useEffect(() => {
    if (token) {
      fetchChatHistory(token);
    }
  }, [token]);

  // Restore last session on page load
  useEffect(() => {
    const restoreLastSession = async () => {
      try {
        const lastSessionId = localStorage.getItem('ytchatbot:lastSessionId');
        if (lastSessionId && token) {
          // Verify session exists before loading
          const response = await fetch(`${API_BASE_URL}/history/${lastSessionId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setSessionId(data.session.id);
            setVideoUrl(data.session.video_url);
            setCurrentVideoUrl(data.session.video_url);
            setChatTitle(data.session.title || 'New Chat');
            setMessages(data.messages.map(msg => ({
              id: msg.id,
              role: msg.role,
              text: msg.content,
              timestamp: msg.created_at
            })));
          } else {
            // Session doesn't exist, clear it
            localStorage.removeItem('ytchatbot:lastSessionId');
          }
        }
      } catch (error) {
        console.error('Failed to restore last session:', error);
        localStorage.removeItem('ytchatbot:lastSessionId');
      }
    };

    if (token) {
      restoreLastSession();
    }
  }, [token]);

  const fetchChatHistory = async (authToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/history`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.status === 401) {
        console.warn('Unauthorized access to chat history. detailed:', response.statusText);
        // Token might be invalid/expired. 
        // AuthContext checks expiry on mount, but if backend rejects it, we should probably logout or clear it.
        // For now, just stop loading history to avoid bad UI state.
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const sessions = data.sessions || [];
        setChatHistory(sessions);
        console.log('Chat history loaded:', sessions.length, 'sessions');
      } else {
        console.error('Failed to fetch chat history:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
      // Don't show error to user, just log it
    }
  };

  // Generate chat title from first user message
  const generateChatTitle = (message) => {
    if (!message || typeof message !== 'string') return 'New Chat';
    const truncated = message.trim().slice(0, 40);
    return truncated.length < message.trim().length ? `${truncated}...` : truncated;
  };

  const loadSession = async (sessionIdToLoad) => {
    try {
      const response = await fetch(`${API_BASE_URL}/history/${sessionIdToLoad}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.session.id);
        setVideoUrl(data.session.video_url);
        setCurrentVideoUrl(data.session.video_url);
        setChatTitle(data.session.title || 'New Chat');
        setMessages(data.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          text: msg.content,
          timestamp: msg.created_at
        })));
        // Update localStorage with the loaded session
        try {
          localStorage.setItem('ytchatbot:lastSessionId', data.session.id);
        } catch {
          // ignore storage errors
        }
      } else {
        console.error('Failed to load session:', response.status);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const models = [
    { value: 'ytchatbot', label: 'YT Chatbot', endpoint: '/ytchatbot', supportsImages: false }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Note: Session loading is now handled by restoreLastSession useEffect above
  // This useEffect is removed as it was calling a non-existent endpoint

  // Validate YouTube URL format
  const isValidYouTubeUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return false;

    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)[\w-]+/,
      /^https?:\/\/youtube\.com\/watch\?.*v=[\w-]+/
    ];

    return patterns.some(pattern => pattern.test(trimmedUrl));
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (isValidYouTubeUrl(tempVideoUrl)) {
      setVideoUrl(tempVideoUrl);
      setShowUrlModal(false);
      setTempVideoUrl('');
      // If video URL changes, we might want to reset the conversation or just notify
      if (tempVideoUrl !== currentVideoUrl) {
        setCurrentVideoUrl(tempVideoUrl);
        setTranscriptId('');
        setMessages([]);
      }
    } else {
      alert('Please enter a valid YouTube URL');
    }
  };

  const removeVideoUrl = () => {
    setVideoUrl('');
    setCurrentVideoUrl('');
    setTranscriptId('');
    setMessages([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Determine which video URL to use
    const urlToUse = videoUrl.trim() || currentVideoUrl;

    // If no video URL is set yet (first question), require it
    if (!urlToUse) {
      alert('Please enter a YouTube video URL');
      return;
    }

    // Validate YouTube URL format
    if (!isValidYouTubeUrl(urlToUse)) {
      alert('Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID)');
      return;
    }

    // If video URL is provided and different from current, update it and clear messages
    if (videoUrl.trim() && videoUrl.trim() !== currentVideoUrl) {
      setCurrentVideoUrl(videoUrl.trim());
      setTranscriptId(''); // Clear transcriptId when video URL changes
      // Clear messages when video URL changes to start fresh conversation
      setMessages([]);
    }

    const userMessage = inputText.trim();
    setInputText('');
    setIsLoading(true);

    // Add user message to chat
    const newUserMessage = {
      id: Date.now(),
      role: 'user',
      text: userMessage,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newUserMessage]);

    try {
      console.log('YT Chatbot - Video URL:', urlToUse, '| Question:', userMessage);

      const requestBody = {
        videoUrl: urlToUse,
        question: userMessage,
        // Pass current sessionId if we already have one from the backend
        sessionId: sessionId && !sessionId.startsWith('session_') ? sessionId : undefined,
      };

      const response = await fetch(`${API_BASE_URL}/ytchatbot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(requestBody)
      });

      console.log('YT Chatbot response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('YT Chatbot response data:', data);

        // Backend returns { answer, sessionId }
        let replyText = '';
        if (typeof data === 'string') {
          replyText = data;
        } else if (data && typeof data === 'object') {
          if (data.message) {
            replyText = data.message;
          } else if (data.answer) {
            replyText = data.answer;
          } else if (data.error) {
            throw new Error(data.message || data.error);
          } else {
            replyText = JSON.stringify(data);
          }
        } else {
          replyText = String(data);
        }

        // Set real sessionId if backend returned one
        if (data && data.sessionId) {
          setSessionId(data.sessionId);
          try {
            localStorage.setItem('ytchatbot:lastSessionId', data.sessionId);
          } catch {
            // ignore
          }
        }

        const assistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          text: replyText,
          timestamp: Date.now()
        };

        setMessages(prev => {
          const newMessages = [...prev, assistantMessage];
          if (chatTitle === 'New Chat' && newMessages.length >= 2) {
            const firstUserMsg = newMessages.find(m => m.role === 'user');
            if (firstUserMsg) {
              setChatTitle(generateChatTitle(firstUserMsg.text));
            }
          }
          return newMessages;
        });

        // Refresh history so this session shows up
        if (token) {
          fetchChatHistory(token);
        }
      } else {
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const responseText = await response.text();
          console.log('Error response text:', responseText);
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            errorMessage = responseText || errorMessage;
          }
        } catch (e) {
          console.error('Failed to read error response:', e);
        }

        if (errorMessage.includes('Could not fetch transcript')) {
          errorMessage = 'Could not fetch transcript. Please check if the video has captions enabled. Some videos may not have captions available.';
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Full error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        text: `Error: ${error.message}`,
        timestamp: Date.now(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const startNewChat = () => {
    // Save current chat to history if it has messages
    if (messages.length > 0 && chatTitle !== 'New Chat') {
      const currentChat = {
        id: sessionId,
        title: chatTitle,
        video_url: currentVideoUrl,
        created_at: new Date().toISOString()
      };
      // Add to local chat history if not already there
      setChatHistory(prev => {
        const exists = prev.some(h => h.id === sessionId);
        if (!exists) {
          return [currentChat, ...prev];
        }
        return prev;
      });
    }

    // Reset for new chat
    setMessages([]);
    setInputText('');
    setVideoUrl('');
    setCurrentVideoUrl(''); // Clear current video URL when starting new chat
    setTranscriptId(''); // Clear transcriptId when starting new chat
    setChatTitle('New Chat'); // Reset chat title
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    try {
      localStorage.removeItem('ytchatbot:lastSessionId');
    } catch {
      // ignore
    }
  };

  const currentModelConfig = models[0]; // Always YT Chatbot

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={startNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            New chat
          </button>
        </div>

        <div className="sidebar-content">
          <div className="chat-history">
            {chatHistory.length === 0 && <div className="no-history">No chat history yet</div>}

            {(() => {
              const grouped = chatHistory.reduce((acc, session) => {
                const date = new Date(session.created_at || Date.now());
                const now = new Date();
                const diffTime = Math.abs(now - date);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let group = 'Older';
                if (diffDays <= 1) group = 'Today';
                else if (diffDays <= 2) group = 'Yesterday';
                else if (diffDays <= 7) group = 'Previous 7 Days';

                if (!acc[group]) acc[group] = [];
                acc[group].push(session);
                return acc;
              }, {});

              const groupOrder = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'];

              return groupOrder.map(group => {
                const sessions = grouped[group];
                if (!sessions || sessions.length === 0) return null;

                return (
                  <div key={group} className="history-group">
                    <div className="group-title">{group}</div>
                    {sessions.map(session => (
                      <div
                        key={session.id}
                        className={`chat-item ${session.id === sessionId ? 'active' : ''}`}
                        onClick={() => loadSession(session.id)}
                      >
                        <div className="chat-item-title">
                          {session.title || 'New Chat'}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="sidebar-footer">
          {user && (
            <div className="user-profile">
              <div className="user-info">
                <img src={user.picture} alt={user.name} className="user-avatar-img" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                <div className="user-details">
                  <span className="user-name">{user.name}</span>
                  <button onClick={logout} className="logout-btn">Sign out</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="chat-header">
          <div className="model-indicator">
            YT Chatbot
          </div>
        </div>

        {/* URL Input Modal */}
        {showUrlModal && (
          <div className="modal-overlay" onClick={() => setShowUrlModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>Attach YouTube Video</h3>
              <p>Paste a YouTube link to chat about its content</p>
              <form onSubmit={handleUrlSubmit}>
                <input
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={tempVideoUrl}
                  onChange={(e) => setTempVideoUrl(e.target.value)}
                  autoFocus
                />
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowUrlModal(false)} className="cancel-btn">Cancel</button>
                  <button type="submit" className="add-btn">Add</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <h1>What's on your mind today?</h1>
              <p>Using {currentModelConfig.label}</p>
              <p className="feature-note">Enter a YouTube video URL above to chat about its content</p>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message) => (
                <div key={message.id} className={`message ${message.role}`}>
                  <div className="message-avatar">
                    {message.role === 'user' ? 'U' : 'AI'}
                  </div>
                  <div className="message-content">
                    {message.text && (
                      <div className={`message-text ${message.isError ? 'error' : ''}`}>
                        {message.role === 'assistant' && !message.isError ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              // Style headings
                              h1: ({ node: _node, ...props }) => <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '20px', color: '#f5f5f5', letterSpacing: '-0.01em' }} {...props} />,
                              h2: ({ node: _node, ...props }) => <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px', marginTop: '24px', color: '#f0f0f0', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '6px' }} {...props} />,
                              h3: ({ node: _node, ...props }) => <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '10px', marginTop: '20px', color: '#dcdcdc' }} {...props} />,
                              // Style paragraphs
                              p: ({ node, ...props }) => <p style={{ marginBottom: '16px', lineHeight: '1.7', color: '#cfcfcf' }} {...props} />,
                              // Style lists
                              ul: ({ node, ...props }) => <ul style={{ margin: '16px 0', paddingLeft: '24px', listStyleType: 'disc', color: '#cfcfcf' }} {...props} />,
                              ol: ({ node, ...props }) => <ol style={{ margin: '16px 0', paddingLeft: '24px', listStyleType: 'decimal', color: '#cfcfcf' }} {...props} />,
                              li: ({ node, ...props }) => <li style={{ marginBottom: '8px', color: '#d0d0d0', lineHeight: '1.6' }} {...props} />,
                              // Style code blocks
                              code: ({ node, inline, ...props }) =>
                                inline ? (
                                  <code style={{ background: 'rgba(255, 255, 255, 0.06)', color: '#f5f5f5', padding: '3px 8px', borderRadius: '6px', fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace", fontSize: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }} {...props} />
                                ) : (
                                  <code style={{ display: 'block', padding: '20px', color: '#f1f1f1', background: 'rgba(255, 255, 255, 0.03)', fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace", fontSize: '14px', lineHeight: '1.5', overflowX: 'auto', whiteSpace: 'pre', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', margin: '16px 0' }} {...props} />
                                ),
                              pre: ({ node, ...props }) => <pre style={{ margin: '16px 0', overflow: 'auto' }} {...props} />,
                              // Style blockquotes
                              blockquote: ({ node, ...props }) => <blockquote style={{ borderLeft: '2px solid rgba(255, 255, 255, 0.15)', paddingLeft: '16px', margin: '16px 0', color: '#bdbdbd', fontStyle: 'italic' }} {...props} />,
                              // Style links
                              a: ({ node: _node, ...props }) => <a style={{ color: '#f5f5f5', textDecoration: 'underline', textUnderlineOffset: '3px' }} target="_blank" rel="noopener noreferrer" {...props} />,
                              // Style strong and emphasis
                              strong: ({ node, ...props }) => <strong style={{ color: '#ffffff', fontWeight: 700 }} {...props} />,
                              em: ({ node, ...props }) => <em style={{ fontStyle: 'italic', color: '#dcdcdc' }} {...props} />,
                              // Style horizontal rules
                              hr: ({ node, ...props }) => <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '24px 0' }} {...props} />,
                              // Style tables with improved formatting
                              table: ({ node, ...props }) => (
                                <div style={{ overflowX: 'auto', margin: '20px 0', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0, background: 'rgba(255, 255, 255, 0.02)' }} {...props} />
                                </div>
                              ),
                              thead: ({ node, ...props }) => <thead style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }} {...props} />,
                              tbody: ({ node, ...props }) => <tbody {...props} />,
                              tr: ({ node, ...props }) => <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }} {...props} />,
                              th: ({ node, ...props }) => <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#f5f5f5', borderRight: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '14px' }} {...props} />,
                              td: ({ node, ...props }) => <td style={{ padding: '12px 16px', color: '#d5d5d5', borderRight: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '14px', lineHeight: '1.6' }} {...props} />,
                            }}
                          >
                            {message.text}
                          </ReactMarkdown>
                        ) : (
                          message.text
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          <div className="input-container">
            {currentVideoUrl && (
              <div className="selected-file">
                <span className="video-url-display">
                  📺 {currentVideoUrl}
                </span>
                <button onClick={removeVideoUrl} className="remove-file">×</button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="input-form">
              <div className="input-wrapper">
                <button
                  type="button"
                  className="attach-btn"
                  onClick={() => setShowUrlModal(true)}
                  title="Attach YouTube URL"
                >
                  🔗
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask me anything..."
                  className="message-input"
                  disabled={isLoading}
                />

                <button
                  type="submit"
                  className="send-btn"
                  disabled={isLoading || !inputText.trim()}
                  title="Send message"
                >
                  {isLoading ? (
                    <div className="loading">⏳</div>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;