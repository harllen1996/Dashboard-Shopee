import React, { useMemo, useState } from 'react';
import { ShipmentData } from '@/src/hooks/useGoogleSheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExecutivaProps {
  data: ShipmentData[];
}

export function Executiva({ data }: ExecutivaProps) {
  const { t } = useLanguage();
  const [showAllSpxStatus, setShowAllSpxStatus] = useState(false);
  
  // Computed Fields
  const totalShipments = data.length;
  const totalStuckOver5 = data.filter(d => d.days_stuck > 5).length;
  const percentStuck = totalShipments ? ((totalStuckOver5 / totalShipments) * 100).toFixed(1) : '0.0';
  const criticalShipments = data.filter(d => d.days_open_since_rts > 20).length;

  // Chart Data: Distribuição RTS Aging
  const agingDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach(d => {
      counts[d.since_drop_aging] = (counts[d.since_drop_aging] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const COLORS = ["#EE4D2D", "#FF7A59", "#FFB199", "#FFD3C4", "#FFEDEB"];

  // Chart Data: Top 10 Estações Críticas (>10 dias)
  const topCriticalStations = useMemo(() => {
    const stationStats: Record<string, { totalDays: number, count: number }> = {};
    
    // Filter by >10 days
    const criticalData = data.filter(d => d.days_open_since_rts > 10);
    
    criticalData.forEach(d => {
      if (!stationStats[d.latest_station_name]) {
        stationStats[d.latest_station_name] = { totalDays: 0, count: 0 };
      }
      stationStats[d.latest_station_name].totalDays += d.days_open_since_rts;
      stationStats[d.latest_station_name].count += 1;
    });

    return Object.entries(stationStats)
      .map(([name, stats]) => ({
        name,
        avgDays: Number((stats.totalDays / stats.count).toFixed(1))
      }))
      .sort((a, b) => b.avgDays - a.avgDays)
      .slice(0, 10);
  }, [data]);

  // Table Data: SPX Status
  const spxStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    
    data.forEach(d => {
      const status = d.latest_spx_status || 'Sem Status';
      counts[status] = (counts[status] || 0) + 1;
      total++;
    });

    const sortedData = Object.entries(counts)
      .map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0.0%'
      }))
      .sort((a, b) => b.count - a.count);

    return { sortedData, total };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('exec.distRtsAging')}</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={agingDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {agingDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('exec.top10Critical')}</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCriticalStations} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="avgDays" fill="#0F172A" radius={[0, 4, 4, 0]}>
                  {topCriticalStations.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#D7263D' : '#0F172A'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-l-4 border-l-[#EE4D2D]">
        <CardContent className="p-6">
          <div className="prose prose-slate max-w-none">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
              <span className="mr-2">📌</span> {t('exec.execSummary')}
            </h3>
            <ul className="space-y-2 text-slate-700 list-disc list-inside">
              <li><strong>{t('exec.currentBase')}</strong> {totalShipments.toLocaleString()} {t('exec.openShipments')}</li>
              <li><strong>{percentStuck}%</strong> {t('exec.stuckMoreThan5')}</li>
              <li><strong>{criticalShipments.toLocaleString()}</strong> {t('exec.casesExceed20')}</li>
              {spxStatusData.sortedData.length > 0 && (
                <li>
                  {t('exec.topSpxStatus')} <strong>{spxStatusData.sortedData[0].status}</strong>, {t('exec.representing')} <strong>{spxStatusData.sortedData[0].percentage}</strong> {t('exec.ofTotalVolume')}.
                </li>
              )}
            </ul>
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start">
              <span className="mr-2">⚠️</span>
              <p className="m-0 font-medium">{t('exec.recommendation')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SPX Status Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('exec.spxStatusVol')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-700">
                <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b-2 border-slate-300">
                  <tr>
                    <th className="px-4 py-2 italic font-semibold">latest_spx_status</th>
                    <th className="px-4 py-2 text-right font-semibold">RTS Total Open</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllSpxStatus ? spxStatusData.sortedData : spxStatusData.sortedData.slice(0, 5)).map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2">{row.status}</td>
                      <td className="px-4 py-2 text-right">{row.count.toLocaleString()}</td>
                    </tr>
                  ))}
                  {spxStatusData.sortedData.length > 5 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-2 text-center bg-slate-50 border-b border-slate-100">
                        <button 
                          onClick={() => setShowAllSpxStatus(!showAllSpxStatus)}
                          className="text-[#EE4D2D] hover:text-[#D7263D] font-medium text-xs uppercase tracking-wider flex items-center justify-center w-full py-1"
                        >
                          {showAllSpxStatus ? (
                            <><ChevronUp className="w-4 h-4 mr-1" /> {t('exec.showLess')}</>
                          ) : (
                            <><ChevronDown className="w-4 h-4 mr-1" /> {t('exec.showMore', { count: spxStatusData.sortedData.length - 5 })}</>
                          )}
                        </button>
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                    <td className="px-4 py-2">{t('exec.grandTotal')}</td>
                    <td className="px-4 py-2 text-right">{spxStatusData.total.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('exec.spxStatusPct')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-700">
                <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b-2 border-slate-300">
                  <tr>
                    <th className="px-4 py-2 italic font-semibold">latest_spx_status</th>
                    <th className="px-4 py-2 text-right font-semibold">RTS Total Open</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllSpxStatus ? spxStatusData.sortedData : spxStatusData.sortedData.slice(0, 5)).map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2">{row.status}</td>
                      <td className="px-4 py-2 text-right">{row.percentage}</td>
                    </tr>
                  ))}
                  {spxStatusData.sortedData.length > 5 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-2 text-center bg-slate-50 border-b border-slate-100">
                        <button 
                          onClick={() => setShowAllSpxStatus(!showAllSpxStatus)}
                          className="text-[#EE4D2D] hover:text-[#D7263D] font-medium text-xs uppercase tracking-wider flex items-center justify-center w-full py-1"
                        >
                          {showAllSpxStatus ? (
                            <><ChevronUp className="w-4 h-4 mr-1" /> {t('exec.showLess')}</>
                          ) : (
                            <><ChevronDown className="w-4 h-4 mr-1" /> {t('exec.showMore', { count: spxStatusData.sortedData.length - 5 })}</>
                          )}
                        </button>
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                    <td className="px-4 py-2">{t('exec.grandTotal')}</td>
                    <td className="px-4 py-2 text-right">100.0%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
