import { useState, useEffect } from 'react';
import Papa from 'papaparse';

export interface ShipmentData {
  shipment_id: string;
  latest_station_name: string;
  responsability: string;
  days_open_in_station: number;
  days_open_since_rts: number;
  days_stuck: number;
  stuck_aging: string;
  since_drop_aging: string;
  in_station_aging: string;
  latest_spx_status: string;
  // Productivity fields
  operator?: string;
  qty_bips?: number;
  classificacao_reason?: string;
  hour?: string;
  date?: string;
}

const SHEET_ID = '1WUPEzSJqMfNsNzDOPjtw3xAru572e0K7jFzPuZLp3no';
const TAB_NAME = 'RTS Total Open';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(TAB_NAME)}`;

const extractSpxStatus = (row: any) => {
  if (row.lastest_spx_status) return row.lastest_spx_status;
  if (row.latest_spx_status) return row.latest_spx_status;
  if (row.spx_status) return row.spx_status;
  
  const keys = Object.keys(row);
  const normalizedKeys = keys.map(k => ({ 
    original: k, 
    normalized: k.toLowerCase().replace(/[^a-z0-9]/g, '') 
  }));
  
  const possibleNames = ['lastestspxstatus', 'latestspxstatus', 'spxstatus', 'statusspx', 'status'];
  for (const name of possibleNames) {
    const match = normalizedKeys.find(k => k.normalized === name);
    if (match && row[match.original]) return row[match.original];
  }
  
  const partialMatch = normalizedKeys.find(k => k.normalized.includes('spx') && k.normalized.includes('status'));
  if (partialMatch && row[partialMatch.original]) return row[partialMatch.original];
  
  const spxMatch = normalizedKeys.find(k => k.normalized.includes('spx'));
  if (spxMatch && row[spxMatch.original]) return row[spxMatch.original];
  
  return '';
};

const normalizeRow = (row: any) => {
  return {
    shipment_id: row.shipment_id || '',
    latest_station_name: row.latest_station_name || '',
    responsability: row.responsability || '',
    days_open_in_station: Number(row.days_open_in_station) || 0,
    days_open_since_rts: Number(row.days_open_since_rts) || 0,
    days_stuck: Number(row.days_stuck) || 0,
    stuck_aging: row.stuck_aging || '',
    since_drop_aging: row.since_drop_aging || '',
    in_station_aging: row.in_station_aging || '',
    latest_spx_status: extractSpxStatus(row),
    // Productivity fields (mapping common variations)
    operator: row.operator || row.operador || row.user || '',
    qty_bips: Number(row.qty_bips || row.bips || row.quantidade || 0),
    classificacao_reason: row.classificacao_reason || row.motivo || row.reason || '',
    hour: row.hour || row.hora || row.horario || '',
    date: row.date || row.data || '',
  };
};

export function useGoogleSheet() {
  const [data, setData] = useState<ShipmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    // Try different URL formats for Google Sheets CSV export
    const urls = [
      CSV_URL,
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/pub?output=csv&sheet=${encodeURIComponent(TAB_NAME)}`,
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&sheet=${encodeURIComponent(TAB_NAME)}`
    ];

    let lastError = null;

    for (const url of urls) {
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          if (response.status === 403 || response.status === 401) {
            throw new Error('CORS_ERROR'); // Treat as permission/CORS error
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        
        if (csvText.trim().toLowerCase().startsWith('<!doctype html>') || csvText.trim().toLowerCase().startsWith('<html')) {
          throw new Error('CORS_ERROR'); // Likely a redirect to login page
        }
        
        return new Promise<void>((resolve, reject) => {
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
            complete: (results) => {
              try {
                const parsedData = results.data.map(normalizeRow);
                setData(parsedData);
                resolve();
              } catch (err: any) {
                reject(err);
              } finally {
                setLoading(false);
              }
            },
            error: (err: any) => {
              reject(new Error(err.message || 'Failed to parse CSV data'));
            }
          });
        });
      } catch (err: any) {
        console.warn(`Failed to fetch from ${url}:`, err.message);
        lastError = err;
        if (err.message === 'CORS_ERROR') break; // Don't try other URLs if it's a clear permission issue
        continue; // Try next URL
      }
    }

    // If we get here, all URLs failed
    console.error("Final fetch error:", lastError);
    const isNetworkError = lastError?.message?.includes('Failed to fetch') || 
                          lastError?.name === 'TypeError' || 
                          lastError?.message === 'CORS_ERROR';
    
    setError(
      isNetworkError
        ? 'CORS_ERROR' 
        : (lastError?.message || 'Failed to fetch data')
    );
    setLoading(false);
  };

  const handleFileUpload = (file: File) => {
    setLoading(true);
    setError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (results) => {
        try {
          const parsedData = results.data.map(normalizeRow);
          setData(parsedData);
        } catch (err: any) {
          setError(err.message || 'Failed to parse data');
        } finally {
          setLoading(false);
        }
      },
      error: (err: any) => {
        setError(err.message || 'Failed to parse CSV file');
        setLoading(false);
      }
    });
  };

  const loadDemoData = () => {
    setLoading(true);
    setError(null);
    // Generate some mock data for demonstration
    const mockData: ShipmentData[] = Array.from({ length: 100 }).map((_, i) => ({
      shipment_id: `SHP${1000 + i}`,
      latest_station_name: ['SOC SP', 'HUB RJ', 'HUB MG', 'SOC PR', 'XPT RS'][Math.floor(Math.random() * 5)],
      responsability: ['Logistic', 'Carrier', 'Customer'][Math.floor(Math.random() * 3)],
      days_open_in_station: Math.floor(Math.random() * 15),
      days_open_since_rts: Math.floor(Math.random() * 45),
      days_stuck: Math.floor(Math.random() * 10),
      stuck_aging: '5-10 dias',
      since_drop_aging: '10-20 dias',
      in_station_aging: '0-5 dias',
      latest_spx_status: ['Return_SOC_Received', 'Return_SOC_Staging', 'Return_SOC_Packed'][Math.floor(Math.random() * 3)],
      operator: ['João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Lucas Lima'][Math.floor(Math.random() * 5)],
      qty_bips: Math.floor(Math.random() * 200) + 50,
      classificacao_reason: ['Avaria', 'Extravio', 'Endereço não localizado', 'Recusado'][Math.floor(Math.random() * 4)],
      hour: `${Math.floor(Math.random() * 12) + 8}:00`,
      date: '2024-03-01'
    }));
    setData(mockData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // Auto refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error, refetch: fetchData, handleFileUpload, loadDemoData };
}
