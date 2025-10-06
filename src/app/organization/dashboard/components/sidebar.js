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
  BarChart3,
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
      name: 'Reports',
      icon: BarChart3,
      path: '/organization/dashboard/reports',
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
    <div className="flex flex-col h-full bg-gray-800">
      {/* Logo Section */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">CW</span>
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="ml-1"
              >
                <h1 className="text-lg font-semibold text-white">ChangeWorks</h1>
                <p className="text-xs text-gray-400">Organization Portal</p>
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
              className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors duration-200"
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>


      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item, index) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
            const hasSub = item.subItems && item.subItems.length > 0;
            const isSubmenuOpen = openSubmenus[item.name];

            return (
              <li key={item.name}>
                {/* Main menu item */}
                <div
                  onClick={() => {
                    if (hasSub) {
                      toggleSubmenu(item.name);
                    } else {
                      router.push(item.path);
                    }
                  }}
                  className={`group flex items-center px-3 py-3 cursor-pointer rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-between flex-1 ml-3"
                      >
                        <span className="font-medium text-sm">{item.name}</span>
                        {hasSub && (
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSubmenuOpen ? 'rotate-180' : ''} ${isActive ? 'text-white' : 'text-gray-400'}`} />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Submenu */}
                <AnimatePresence>
                  {hasSub && isSubmenuOpen && isExpanded && (
                    <motion.ul
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="ml-6 mt-1 space-y-1"
                    >
                      {item.subItems.map((sub, subIndex) => {
                        const isSubActive = pathname === sub.path;
                        return (
                          <motion.li
                            key={sub.name}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: subIndex * 0.05 }}
                          >
                            <Link
                              href={sub.path}
                              className={`block px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                                isSubActive 
                                  ? 'bg-purple-600/20 text-purple-300 font-medium' 
                                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
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

      {/* Bottom Section */}
      <div className="p-3 border-t border-gray-700">
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200 group"
        >
          <LogOut className="w-5 h-5" />
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="ml-3 font-medium text-sm"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.div
        initial={{ width: 64 }}
        animate={{ width: isExpanded ? 280 : 64 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        onMouseEnter={() => !isPinned && setIsHovered(true)}
        onMouseLeave={() => !isPinned && setIsHovered(false)}
        className="hidden lg:block h-full bg-gray-800 border-r border-gray-700 shadow-xl overflow-hidden"
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

      {/* Mobile Sidebar */}
      <motion.div
        initial={{ x: -280 }}
        animate={{ x: isMobileOpen ? 0 : -280 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="lg:hidden fixed left-0 top-0 h-full w-70 bg-gray-800 border-r border-gray-700 shadow-xl z-50"
      >
        <SidebarContent />
      </motion.div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-gray-800 rounded-lg text-white shadow-xl border border-gray-700 hover:bg-gray-700 transition-colors"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
    </>
  );
};

export default OrgSidebar;
