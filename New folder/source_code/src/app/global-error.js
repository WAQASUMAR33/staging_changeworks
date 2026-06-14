'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  Zap,
  Mail
} from 'lucide-react';

export default function GlobalError({ error, reset }) {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    
    // Clear any cached data and reset
    if (typeof window !== 'undefined') {
      // Clear localStorage except for essential data
      const essentialKeys = ['orgToken', 'orgUser', 'token', 'user'];
      const storage = { ...localStorage };
      localStorage.clear();
      
      essentialKeys.forEach(key => {
        if (storage[key]) {
          localStorage.setItem(key, storage[key]);
        }
      });
    }
    
    setTimeout(() => {
      reset();
      setIsResetting(false);
    }, 1500);
  };

  const reloadPage = () => {
    window.location.href = '/';
  };

  return (
    <html>
      <body>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-lg w-full text-center">
            {/* Critical Error Animation */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
              className="mb-8"
            >
              <div className="relative inline-block">
                <motion.div
                  animate={{ 
                    boxShadow: [
                      "0 0 0 0 rgba(220, 38, 38, 0.6)",
                      "0 0 0 30px rgba(220, 38, 38, 0)",
                      "0 0 0 0 rgba(220, 38, 38, 0)"
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center shadow-2xl"
                >
                  <AlertTriangle className="w-16 h-16 text-white" />
                </motion.div>
                <motion.div
                  animate={{ 
                    rotate: [0, 360],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute -top-4 -right-4"
                >
                  <Zap className="w-12 h-12 text-yellow-400" />
                </motion.div>
              </div>
            </motion.div>

            {/* Error Message */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mb-8"
            >
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                Critical Error
              </h1>
              <p className="text-lg text-gray-300 mb-6">
                We&apos;ve encountered a critical system error. This is unusual and our team has been automatically notified.
              </p>
              <div className="bg-red-900 bg-opacity-50 border border-red-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-200">
                  <strong>What happened?</strong> A critical component failed to load properly. 
                  This might be due to a network issue or a temporary system problem.
                </p>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="flex flex-col gap-4 mb-8"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReset}
                disabled={isResetting}
                className="inline-flex items-center justify-center px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <motion.div
                  animate={isResetting ? { rotate: 360 } : {}}
                  transition={{ duration: 1, repeat: isResetting ? Infinity : 0, ease: "linear" }}
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                </motion.div>
                {isResetting ? 'Resetting Application...' : 'Reset Application'}
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={reloadPage}
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg shadow-lg hover:bg-gray-100 transition-colors duration-200"
              >
                <Home className="w-5 h-5 mr-2" />
                Go to Home Page
              </motion.button>
            </motion.div>

            {/* Emergency Contact */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="bg-gray-800 bg-opacity-50 border border-gray-700 rounded-lg p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-3">
                Need Immediate Help?
              </h3>
              <p className="text-gray-300 text-sm mb-4">
                If you&apos;re experiencing urgent issues or this error persists, please contact our emergency support.
              </p>
              <a
                href="mailto:emergency@changeworksfund.org?subject=Critical System Error&body=I encountered a critical error on the ChangeWorks platform that prevents normal operation."
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-300 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg hover:bg-red-800 hover:bg-opacity-50 transition-colors duration-200"
              >
                <Mail className="w-4 h-4 mr-2" />
                Emergency Contact
              </a>
            </motion.div>

            {/* Error Details */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="mt-6"
            >
              <p className="text-xs text-gray-500">
                Error Code: GLOBAL_ERROR_{Date.now().toString(36).toUpperCase()} <br />
                Time: {new Date().toISOString()} <br />
                User Agent: {typeof window !== 'undefined' ? window.navigator.userAgent.slice(0, 50) + '...' : 'Unknown'}
              </p>
            </motion.div>
          </div>
        </div>
      </body>
    </html>
  );
}
