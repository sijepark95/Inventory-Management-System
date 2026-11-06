import React from 'react';
import { Building2, TrendingUp, Users, ShieldCheck, Database, LayoutDashboard, ChevronRight } from 'lucide-react';

interface LandingPageProps {
  onAccessPortal: () => void;
}

export default function LandingPage({ onAccessPortal }: LandingPageProps) {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex flex-col font-sans selection:bg-blue-200 selection:text-blue-900">
      
      {/* Hero Section */}
      <section className="relative px-6 pt-20 pb-24 lg:px-8 max-w-7xl mx-auto w-full flex-1 flex flex-col justify-center">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-8 flex justify-center">
            <div className="relative rounded-full px-3 py-1 text-xs/6 text-slate-600 ring-1 ring-slate-900/10 hover:ring-slate-900/20 font-medium">
              Internal Company Use Only.{' '}
              <span className="font-semibold text-blue-600">
                <span className="absolute inset-0" aria-hidden="true" />
                Read Security Policy <span aria-hidden="true">&rarr;</span>
              </span>
            </div>
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl text-balance">
            SMA Management <span className="text-blue-600">System</span>
          </h1>
          <p className="mt-6 text-lg/8 text-slate-600 font-medium">
            Centralized portal for multi-store operations, global inventory synchronization, automated cost auditing, and unified workforce analytics.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <button
              onClick={onAccessPortal}
              className="rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 flex items-center gap-2 transition-all group cursor-pointer"
            >
              Access Portal
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onAccessPortal}
              className="text-sm/6 font-semibold text-slate-900 flex items-center gap-1 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Log in with Single Sign-On <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mx-auto mt-24 max-w-7xl sm:mt-32">
          <div className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-4 lg:gap-y-16">
            
            <div className="relative pl-16">
              <dt className="text-base/7 font-bold text-slate-900">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
                  <LayoutDashboard className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                Multi-Store Control
              </dt>
              <dd className="mt-2 text-sm/6 text-slate-600">
                Manage all regional stores from a single unified dashboard. Track performance, consolidate vendor orders, and enforce standardization.
              </dd>
            </div>

            <div className="relative pl-16">
              <dt className="text-base/7 font-bold text-slate-900">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
                  <Database className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                Master Inventory
              </dt>
              <dd className="mt-2 text-sm/6 text-slate-600">
                Real-time stock synchronization across all locations. Automated cost recalculations based on the latest vendor invoices.
              </dd>
            </div>

            <div className="relative pl-16">
              <dt className="text-base/7 font-bold text-slate-900">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
                  <TrendingUp className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                Financial Analytics
              </dt>
              <dd className="mt-2 text-sm/6 text-slate-600">
                Monitor COGS, labor margins, and gross profitability dynamically. Detect cost anomalies before they impact the bottom line.
              </dd>
            </div>

            <div className="relative pl-16">
              <dt className="text-base/7 font-bold text-slate-900">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
                  <ShieldCheck className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                Enterprise Security
              </dt>
              <dd className="mt-2 text-sm/6 text-slate-600">
                Role-based access control (RBAC) ensuring branch managers, corporate executives, and staff only access authorized data tiers.
              </dd>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-semibold text-slate-900">SMA Management System</span>
          </div>
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} SMA Corporation. All rights reserved. Strictly confidential.
          </p>
        </div>
      </footer>
    </div>
  );
}
