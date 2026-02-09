import React from 'react';
import { GoogleLogin } from '@react-oauth/google';

const LoginButton = ({ onLoginSuccess, onLoginError }) => {
    return (
        <div className="login-button-container">
            <GoogleLogin
                onSuccess={onLoginSuccess}
                onError={onLoginError}
                theme="filled_black"
                shape="pill"
                text="signin_with"
                locale="en"
            />
        </div>
    );
};

export default LoginButton;
