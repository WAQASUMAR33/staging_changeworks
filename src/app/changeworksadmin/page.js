'use client';

import OverviewCards from './components/overviewCards';

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome to the admin control panel</p>
        </div>
      </div>

      <OverviewCards />
    </div>
  );
}