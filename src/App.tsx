import React, { useState, useRef } from 'react';
import { Layout } from './components/Layout';
import { Operacional } from './pages/Operacional';
import { Executiva } from './pages/Executiva';
import { Relatorio } from './pages/Relatorio';
import { useGoogleSheet } from './hooks/useGoogleSheet';
import { AlertCircle, Loader2, Upload } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('operacional');
  const { data, loading, error, refetch, handleFileUpload } = useGoogleSheet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  if (loading && data.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#EE4D2D]" />
          <p>Loading RTS data...</p>
        </div>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-100 max-w-lg w-full space-y-6">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-slate-900">Failed to load data</h2>
            <p className="text-slate-600">
              {error === 'CORS_ERROR' 
                ? 'The Google Sheet is restricted to your company and cannot be accessed directly by the dashboard.' 
                : error}
            </p>
          </div>

          {error === 'CORS_ERROR' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 text-center">
                <h3 className="font-semibold text-slate-800 mb-2">Alternative: Upload CSV Manually</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Since the sheet is private to your company, you can download it as a CSV (File &gt; Download &gt; Comma-separated values) and upload it here.
                </p>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={onFileChange}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center px-4 py-2.5 bg-slate-800 text-white font-medium rounded-md hover:bg-slate-900 transition-colors shadow-sm"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload CSV File
                </button>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Or try again</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center pt-2">
            <button 
              onClick={refetch}
              className="px-6 py-2.5 bg-[#EE4D2D] text-white font-medium rounded-md hover:bg-[#D7263D] transition-colors shadow-sm"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'operacional' && <Operacional data={data} />}
      {activeTab === 'executiva' && <Executiva data={data} />}
      {activeTab === 'relatorio' && <Relatorio data={data} />}
    </Layout>
  );
}
