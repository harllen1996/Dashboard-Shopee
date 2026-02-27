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

export function useGoogleSheet() {
  const [data, setData] = useState<ShipmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(CSV_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const csvText = await response.text();
      
      if (csvText.trim().toLowerCase().startsWith('<!doctype html>') || csvText.trim().toLowerCase().startsWith('<html')) {
        throw new Error('Received HTML instead of CSV. The Google Sheet might be private. Please publish it to the web (File > Share > Publish to web).');
      }
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
        complete: (results) => {
          try {
            const parsedData = results.data.map((row: any) => ({
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
            }));
            setData(parsedData);
          } catch (err: any) {
            setError(err.message || 'Failed to parse data');
          } finally {
            setLoading(false);
          }
        },
        error: (err: any) => {
          setError(err.message || 'Failed to parse CSV data');
          setLoading(false);
        }
      });
    } catch (err: any) {
      console.error("Fetch error:", err);
      const isCorsError = err.message?.includes('Failed to fetch') || err.name === 'TypeError';
      setError(
        isCorsError
          ? 'CORS_ERROR' 
          : (err.message || 'Failed to fetch data')
      );
      setLoading(false);
    }
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
          const parsedData = results.data.map((row: any) => ({
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
          }));
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

  useEffect(() => {
    fetchData();
    // Auto refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error, refetch: fetchData, handleFileUpload };
}
