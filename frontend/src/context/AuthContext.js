import React, { createContext, useState, useContext, useEffect } from 'react';
import { googleLogout } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    // Only use the raw JWT token
    const [token, setToken] = useState(localStorage.getItem('googleCredential') || null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Clear any legacy invalid tokens
        if (localStorage.getItem('googleUserInfo')) {
            localStorage.removeItem('googleUserInfo');
        }

        const storedToken = localStorage.getItem('googleCredential');
        if (storedToken) {
            try {
                const decoded = jwtDecode(storedToken);
                // Check if token is expired
                if (decoded.exp * 1000 > Date.now()) {
                    setUser({
                        sub: decoded.sub,
                        email: decoded.email,
                        name: decoded.name,
                        picture: decoded.picture,
                    });
                    setToken(storedToken);
                } else {
                    // Token expired, clear it
                    logout();
                }
            } catch (error) {
                console.error('Failed to decode stored token:', error);
                logout();
            }
        }
        setIsLoading(false);
    }, []);

    const loginWithGoogle = (credential) => {
        try {
            if (!credential) {
                throw new Error('No credential provided');
            }

            // Decode to get user info for UI
            const decoded = jwtDecode(credential);
            const userData = {
                sub: decoded.sub,
                email: decoded.email,
                name: decoded.name,
                picture: decoded.picture,
            };

            localStorage.setItem('googleCredential', credential);
            setToken(credential);
            setUser(userData);

            // Clean up legacy storage if it exists
            localStorage.removeItem('googleUserInfo');

            navigate('/chat');
        } catch (error) {
            console.error('Failed to process Google login:', error);
        }
    };

    const logout = () => {
        googleLogout();
        localStorage.removeItem('googleCredential');
        localStorage.removeItem('googleUserInfo');
        setToken(null);
        setUser(null);
        navigate('/');
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, loginWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
