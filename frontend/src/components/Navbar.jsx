import React, { useState, useEffect } from 'react';
import { FiMenu, FiX, FiSun, FiMoon } from 'react-icons/fi';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const { loginWithGoogle, user, logout } = useAuth();

  const handleGoogleSuccess = (credentialResponse) => {
    loginWithGoogle(credentialResponse.credential);
    setShowLoginPopup(false);
  };

  const handleGoogleError = () => {
    console.error('Google Login Failed');
    setShowLoginPopup(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 20;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    document.addEventListener('scroll', handleScroll);
    return () => {
      document.removeEventListener('scroll', handleScroll);
    };
  }, [scrolled]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'py-3 bg-[#0f0f0f]/95 border-b border-white/5 backdrop-blur-xl' : 'py-4 bg-transparent'}`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <a href="/" className="text-2xl font-bold text-white flex items-center">
              <span className="gradient-text">Vido </span>
              <span className="text-white">AI</span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</a>

            {user ? (
              <div className="flex items-center space-x-4">
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-sm font-medium text-white">{user.name}</span>
                <button
                  onClick={logout}
                  className="px-5 py-2 rounded-full text-sm font-semibold text-white border border-white/10 bg-[#161616] hover:border-white/30 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowLoginPopup(!showLoginPopup)}
                  className="px-5 py-2 rounded-full text-sm font-semibold text-white border border-white/10 bg-[#161616] hover:border-white/30 transition-colors"
                >
                  Login
                </button>
                {showLoginPopup && (
                  <div className="absolute right-0 top-12 bg-[#1a1a1a] border border-white/10 rounded-lg p-4 shadow-xl">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      theme="filled_black"
                      shape="pill"
                      text="signin_with"
                      locale="en"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-300 hover:text-white focus:outline-none"
              aria-label="Toggle menu"
            >
              {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden mt-4 pb-4">
            <div className="flex flex-col space-y-4">
              <a
                href="#features"
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                onClick={() => setIsOpen(false)}
              >
                How it Works
              </a>
              <a
                href="#pricing"
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Pricing
              </a>
              <div className="flex items-center justify-between pt-3">
                <button
                  onClick={() => {
                    toggleDarkMode();
                    setIsOpen(false);
                  }}
                  className="p-2 rounded-full bg-[#151515] border border-white/10 text-gray-300 hover:border-white/30 transition-colors"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
                </button>
                {user ? (
                  <button
                    onClick={() => {
                      logout();
                      setIsOpen(false);
                    }}
                    className="px-5 py-2 rounded-full text-sm font-semibold text-white border border-white/10 bg-[#161616] hover:border-white/30 transition-colors"
                  >
                    Logout
                  </button>
                ) : (
                  <div className="relative">
                    <GoogleLogin
                      onSuccess={(credentialResponse) => {
                        handleGoogleSuccess(credentialResponse);
                        setIsOpen(false);
                      }}
                      onError={handleGoogleError}
                      theme="filled_black"
                      shape="pill"
                      size="medium"
                      text="signin"
                      locale="en"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
