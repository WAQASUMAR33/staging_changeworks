'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

import {
  Settings,
  ArrowRightLeft,
  LogOut,
  CircleUserRound,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Gift,
  Users,
  ClipboardPlus,
  Home,
  Shield,
  Bell,
  Menu,
  X,
  ChevronLeft,
  Pin,
  PinOff,
} from 'lucide-react';

const OrgSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState({});

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const toggleSubmenu = (name) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleLogout = () => {
    // Clear session storage
    sessionStorage.removeItem('orgToken');
    sessionStorage.removeItem('orgUser');
    
    // Also clear any old localStorage data
    localStorage.removeItem('orgToken');
    localStorage.removeItem('orgUser');
    localStorage.removeItem('orgRememberMe');
    
    router.push('/organization/login');
  };

  const togglePin = () => {
    setIsPinned(!isPinned);
  };

  const isExpanded = isHovered || isPinned;

  const menuItems = [
    { 
      name: 'Dashboard', 
      icon: LayoutDashboard, 
      path: '/organization/dashboard',
    },
    {
      name: 'Fund Transfers',
      icon: ArrowRightLeft,
      path: '/organization/dashboard/fund-transfers',
    },
    {
      name: 'Transactions',
      icon: ClipboardPlus,
      path: '/organization/dashboard/transactions',
    },
    {
      name: 'Settings',
      icon: Settings,
      path: '/organization/dashboard/settings',
      subItems: [
        { name: 'Profile', path: '/organization/dashboard/settings/profile' }
      ],
    },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-gray-800 shadow-2xl">
      {/* Modern Logo Section */}
      <div className="flex items-center justify-between h-20 px-6 border-b border-gray-700/50">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">CW</span>
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3 }}
                className="ml-1"
              >
                <h1 className="text-xl font-bold text-white">ChangeWorks</h1>
                <p className="text-sm text-gray-300">Organization Portal</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {isExpanded && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={togglePin}
              className="p-2 rounded-xl hover:bg-gray-700/50 transition-all duration-200 hover:shadow-lg"
            >
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>


      {/* Modern Navigation Menu */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item, index) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
            const hasSub = item.subItems && item.subItems.length > 0;
            const isSubmenuOpen = openSubmenus[item.name];

            return (
              <li key={item.name}>
                {/* Main menu item */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (hasSub) {
                      toggleSubmenu(item.name);
                    } else {
                      router.push(item.path);
                    }
                  }}
                  className={`group flex items-center px-4 py-4 cursor-pointer rounded-2xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                      : 'text-gray-300 hover:bg-gray-700/50 hover:text-white hover:shadow-md'
                  }`}
                >
                  <div className={`p-2 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-white/20' 
                      : 'bg-gray-700/50 group-hover:bg-gray-600/50'
                  }`}>
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  </div>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center justify-between flex-1 ml-4"
                      >
                        <span className="font-semibold text-sm">{item.name}</span>
                        {hasSub && (
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSubmenuOpen ? 'rotate-180' : ''} ${isActive ? 'text-white' : 'text-gray-400'}`} />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Modern Submenu */}
                <AnimatePresence>
                  {hasSub && isSubmenuOpen && isExpanded && (
                    <motion.ul
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="ml-8 mt-2 space-y-1"
                    >
                      {item.subItems.map((sub, subIndex) => {
                        const isSubActive = pathname === sub.path;
                        return (
                          <motion.li
                            key={sub.name}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: subIndex * 0.1 }}
                          >
                            <Link
                              href={sub.path}
                              className={`block px-4 py-3 text-sm rounded-xl transition-all duration-200 ${
                                isSubActive 
                                  ? 'bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30' 
                                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                              }`}
                            >
                              {sub.name}
                            </Link>
                          </motion.li>
                        );
                      })}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Modern Bottom Section */}
      <div className="p-4 border-t border-gray-700/50">
        {/* Modern Logout Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-4 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-2xl transition-all duration-300 group"
        >
          <div className="p-2 rounded-xl bg-red-500/10 group-hover:bg-red-500/20 transition-all duration-200">
            <LogOut className="w-5 h-5" />
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3 }}
                className="ml-4 font-semibold text-sm"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );

  return (
    <>
      {/* Modern Desktop Sidebar */}
      <motion.div
        initial={{ width: 80 }}
        animate={{ width: isExpanded ? 320 : 80 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        onMouseEnter={() => !isPinned && setIsHovered(true)}
        onMouseLeave={() => !isPinned && setIsHovered(false)}
        className="hidden lg:block h-full bg-gradient-to-b from-gray-900 to-gray-800 border-r border-gray-700/50 shadow-2xl overflow-hidden"
      >
        <SidebarContent />
      </motion.div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Modern Mobile Sidebar */}
      <motion.div
        initial={{ x: -320 }}
        animate={{ x: isMobileOpen ? 0 : -320 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className="lg:hidden fixed left-0 top-0 h-full w-80 bg-gradient-to-b from-gray-900 to-gray-800 border-r border-gray-700/50 shadow-2xl z-50"
      >
        <SidebarContent />
      </motion.div>

      {/* Modern Mobile Menu Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-6 left-6 z-50 p-4 bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl text-white shadow-2xl border border-gray-700/50 hover:shadow-3xl transition-all duration-300"
      >
        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </motion.button>
    </>
  );
};

export default OrgSidebar;
