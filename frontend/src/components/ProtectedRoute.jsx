import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                    <p className="text-gray-400 mt-4">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;
