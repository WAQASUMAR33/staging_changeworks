'use client';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  User, 
  LogOut, 
  Search,
  ChevronDown
} from 'lucide-react';
import Image from 'next/image';
import { getAdminUser, clearAdminAuth } from '../../lib/admin-auth';

export default function Header() {
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [showProfile, setShowProfile] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const profileRef = useRef(null);
    const router = useRouter();

    useEffect(() => {
        const adminUser = getAdminUser();
        if (adminUser) {
            setUserName(adminUser.name || 'Admin');
            setUserRole(adminUser.role || 'ADMIN');
            setUserEmail(adminUser.email || 'admin@changeworks.com');
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
        clearAdminAuth();
        router.push('/login');
    };


    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div className="flex justify-between items-center px-6 py-4">
                {/* Left Section - Welcome & Search */}
                <div className="flex items-center space-x-8">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">
                            Welcome back, <span className="text-blue-600">{userName || 'Admin'}</span>
                        </h1>
                        <p className="text-sm text-gray-500">Here&apos;s what&apos;s happening today</p>
                    </div>

                    {/* Search Bar */}
                    <div className="hidden md:flex items-center relative">
                        <Search className="absolute left-3 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 w-64 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                    </div>
                </div>

                {/* Right Section - Actions */}
                <div className="flex items-center space-x-3">
                    {/* Profile Dropdown */}
                    <div className="relative" ref={profileRef}>
                        <button 
                            onClick={() => setShowProfile(!showProfile)}
                            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                        >
                            <div className="w-8 h-8 bg-[#0E0061] rounded-lg flex items-center justify-center">
                                <span className="text-white text-sm font-medium">
                                    {userName ? userName.charAt(0).toUpperCase() : 'A'}
                                </span>
                            </div>
                            <div className="hidden md:block text-left">
                                <p className="text-sm font-medium text-gray-900">{userName || 'Admin'}</p>
                                <p className="text-xs text-gray-500">{userRole || 'Administrator'}</p>
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
                                            <div className="w-10 h-10 bg-[#0E0061] rounded-lg flex items-center justify-center">
                                                <span className="text-white font-medium">
                                                    {userName ? userName.charAt(0).toUpperCase() : 'A'}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{userName || 'Admin'}</p>
                                                <p className="text-sm text-gray-500">{userEmail}</p>
                                                <p className="text-xs text-blue-600 font-medium">{userRole}</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-2">
                                        <button 
                                            onClick={() => {
                                                setShowProfile(false);
                                                router.push('/admin/profile');
                                            }}
                                            className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                                        >
                                            <User className="w-4 h-4" />
                                            <span>My Profile</span>
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

