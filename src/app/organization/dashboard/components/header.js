'use client';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  User, 
  LogOut,
  ChevronDown
} from 'lucide-react';

export default function OrgHeader() {
    const [orgName, setOrgName] = useState('');
    const [orgEmail, setOrgEmail] = useState('');
    const [showProfile, setShowProfile] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const profileRef = useRef(null);

    useEffect(() => {
        const org = JSON.parse(sessionStorage.getItem('orgUser'));
        if (org) {
            setOrgName(org.name || 'Organization');
            setOrgEmail(org.email || 'org@changeworks.com');
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setShowProfile(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        // Clear session storage
        sessionStorage.removeItem('orgToken');
        sessionStorage.removeItem('orgUser');
        
        // Also clear any old localStorage data
        localStorage.removeItem('orgToken');
        localStorage.removeItem('orgUser');
        localStorage.removeItem('orgRememberMe');
        
        // Redirect to login
        window.location.href = '/organization/login';
    };

    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div className="flex justify-between items-center px-6 py-4">
                {/* Left Section - Welcome */}
                <div className="flex items-center">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">
                            Welcome back, <span className="text-blue-600">{orgName || 'Organization'}</span>
                        </h1>
                        <p className="text-sm text-gray-500">Manage your organization and track donations</p>
                    </div>
                </div>

                {/* Right Section - Profile */}
                <div className="flex items-center space-x-3">
                    {/* Profile Dropdown */}
                    <div className="relative" ref={profileRef}>
                        <button 
                            onClick={() => setShowProfile(!showProfile)}
                            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                        >
                            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                                <span className="text-white text-sm font-medium">
                                    {orgName ? orgName.charAt(0).toUpperCase() : 'O'}
                                </span>
                            </div>
                            <div className="hidden md:block text-left">
                                <p className="text-sm font-medium text-gray-900">{orgName || 'Organization'}</p>
                                <p className="text-xs text-gray-500">Organization</p>
                            </div>
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                        </button>

                        <AnimatePresence>
                            {showProfile && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden"
                                >
                                    <div className="p-4 border-b border-gray-100">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                                                <span className="text-white font-medium">
                                                    {orgName ? orgName.charAt(0).toUpperCase() : 'O'}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{orgName || 'Organization'}</p>
                                                <p className="text-sm text-gray-500">{orgEmail}</p>
                                                <p className="text-xs text-blue-600 font-medium">Organization</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-2">
                                        <button className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                                            <User className="w-4 h-4" />
                                            <span>Organization Profile</span>
                                        </button>
                                        
                                        <button className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                                            <Settings className="w-4 h-4" />
                                            <span>Settings</span>
                                        </button>
                                        
                                        <button className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                                            <Activity className="w-4 h-4" />
                                            <span>Activity Log</span>
                                        </button>
                                        
                                        <div className="border-t border-gray-100 my-2" />
                                        
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            <span>Sign Out</span>
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>
    );
}
