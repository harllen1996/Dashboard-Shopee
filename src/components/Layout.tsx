import React, { useState } from 'react';
import { LayoutDashboard, PieChart, FileText, Menu, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button } from './ui/Button';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { id: 'operacional', label: 'Operacional', icon: LayoutDashboard },
    { id: 'executiva', label: 'Executiva', icon: PieChart },
    { id: 'relatorio', label: 'Relatório Automático', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-[#F5F6FA] font-sans text-slate-900 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:block",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center px-6 border-b border-slate-200">
            <h1 className="text-xl font-bold text-[#EE4D2D]">Shopee RTS</h1>
            <button 
              className="ml-auto lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                    isActive 
                      ? "bg-[#EE4D2D]/10 text-[#EE4D2D]" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-[#EE4D2D]" : "text-slate-400")} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 sm:px-6 lg:px-8">
          <button
            className="mr-4 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6 text-slate-500" />
          </button>
          <h2 className="text-lg font-semibold text-slate-900">
            {navItems.find(i => i.id === activeTab)?.label}
          </h2>
        </header>
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
