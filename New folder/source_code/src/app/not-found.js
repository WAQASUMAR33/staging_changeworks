'use client';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Home, 
  ArrowLeft, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

export default function NotFound() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsRedirecting(true);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full">
        {/* Main 404 Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          {/* 404 Number with Animation */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8, type: "spring", bounce: 0.4 }}
            className="relative mb-8"
          >
            <h1 className="text-[120px] sm:text-[180px] font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 leading-none">
              404
            </h1>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="absolute top-4 right-4 sm:top-8 sm:right-8"
            >
              <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-500" />
            </motion.div>
          </motion.div>

          {/* Error Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mb-8"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Oops! Page Not Found
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-2">
              The page you&apos;re looking for seems to have wandered off into the digital wilderness. 
              Don&apos;t worry, even the best explorers sometimes take a wrong turn!
            </p>
            <p className="text-sm text-gray-500">
              We&apos;ll redirect you to the home page in{' '}
              <span className="font-semibold text-blue-600">{countdown}</span> seconds
            </p>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <Link href="/">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Home className="w-5 h-5 mr-2" />
                Go Home
              </motion.button>
            </Link>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.back()}
              className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg shadow-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Go Back
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-lg hover:bg-green-700 transition-colors duration-200"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Refresh
            </motion.button>
          </motion.div>
        </motion.div>



        {/* Redirect Notice */}
        {isRedirecting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <div className="bg-white rounded-xl p-8 max-w-sm mx-4 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 mx-auto mb-4"
              >
                <RefreshCw className="w-12 h-12 text-blue-600" />
              </motion.div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Redirecting...
              </h3>
              <p className="text-gray-600">
                Taking you back to safety
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
