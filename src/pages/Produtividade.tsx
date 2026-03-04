import React, { useMemo, useState, useRef } from 'react';
import { ShipmentData } from '@/src/hooks/useGoogleSheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, User, Clock, MessageSquare, Sparkles, Upload } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ProdutividadeProps {
  data: ShipmentData[];
  onFileUpload: (file: File) => void;
}

export function Produtividade({ data, onFileUpload }: ProdutividadeProps) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState({
    operator: '',
    classificacao_reason: '',
    date: '',
  });

  const COLORS = ["#EE4D2D", "#FF7A59", "#FFB199", "#FFD3C4", "#FFEDEB", "#0F172A", "#334155", "#64748B", "#94A3B8", "#CBD5E1"];

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  // Filter data that actually has productivity info
  const productivityData = useMemo(() => {
    const excludedUsers = ['spx@shopee.com', 'system'];
    return data.filter(d => 
      d.operator && 
      !excludedUsers.includes(d.operator.toLowerCase()) &&
      d.qty_bips !== undefined && 
      d.qty_bips > 0
    );
  }, [data]);

  const filteredData = useMemo(() => {
    return productivityData.filter(item => {
      return (
        (!filters.operator || item.operator === filters.operator) &&
        (!filters.classificacao_reason || item.classificacao_reason === filters.classificacao_reason) &&
        (!filters.date || item.date === filters.date)
      );
    });
  }, [productivityData, filters]);

  // Aggregate by operator
  const operatorStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredData.forEach(d => {
      if (d.operator) {
        stats[d.operator] = (stats[d.operator] || 0) + (d.qty_bips || 0);
      }
    });

    const entries = Object.entries(stats).map(([name, bips]) => ({ name, bips }));
    const totalBips = entries.reduce((acc, curr) => acc + curr.bips, 0);
    const avgBips = entries.length ? totalBips / entries.length : 0;

    const ranked = entries
      .sort((a, b) => b.bips - a.bips)
      .map((op, index) => {
        let level: 'OURO' | 'PRATA' | 'BRONZE' = 'BRONZE';
        if (index < 2) level = 'OURO';
        else if (index < 5) level = 'PRATA';
        
        return { ...op, level };
      });

    return { ranked, avgBips, totalBips };
  }, [filteredData]);

  // Aggregate by station
  const stationStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredData.forEach(d => {
      if (d.latest_station_name) {
        stats[d.latest_station_name] = (stats[d.latest_station_name] || 0) + (d.qty_bips || 0);
      }
    });

    return Object.entries(stats)
      .map(([name, bips]) => ({ name, bips }))
      .sort((a, b) => b.bips - a.bips);
  }, [filteredData]);

  // Tier List by Process & Station
  const tierListByProcess = useMemo(() => {
    const stats: Record<string, { totalBips: number, count: number, stations: Set<string> }> = {};
    filteredData.forEach(d => {
      const process = d.classificacao_processo || 'Outros';
      if (!stats[process]) stats[process] = { totalBips: 0, count: 0, stations: new Set() };
      stats[process].totalBips += (d.qty_bips || 0);
      stats[process].count += 1;
      if (d.latest_station_name) stats[process].stations.add(d.latest_station_name);
    });

    return Object.entries(stats)
      .map(([name, data]) => ({
        name,
        avgBips: Number((data.totalBips / data.count).toFixed(1)),
        totalBips: data.totalBips,
        stationCount: data.stations.size,
        topStation: Array.from(data.stations)[0] || 'N/A'
      }))
      .sort((a, b) => b.avgBips - a.avgBips);
  }, [filteredData]);

  const top10Operators = useMemo(() => operatorStats.ranked.slice(0, 10), [operatorStats.ranked]);
  const topStations = useMemo(() => stationStats.slice(0, 5), [stationStats]);
  const bottomStations = useMemo(() => [...stationStats].reverse().slice(0, 5).reverse(), [stationStats]);

  // Daily Average Stats
  const dailyStats = useMemo(() => {
    const stats: Record<string, { total: number, count: number }> = {};
    filteredData.forEach(d => {
      if (d.date) {
        const date = d.date;
        if (!stats[date]) stats[date] = { total: 0, count: 0 };
        stats[date].total += (d.qty_bips || 0);
        stats[date].count += 1;
      }
    });

    return Object.entries(stats)
      .map(([date, data]) => ({
        date,
        avgBips: Number((data.total / data.count).toFixed(1))
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData]);

  const performanceDistribution = useMemo(() => {
    const counts = { OURO: 0, PRATA: 0, BRONZE: 0 };
    operatorStats.ranked.forEach(op => {
      counts[op.level]++;
    });
    return [
      { name: t('prod.gold'), value: counts.OURO, color: '#F59E0B' },
      { name: t('prod.silver'), value: counts.PRATA, color: '#9CA3AF' },
      { name: t('prod.bronze'), value: counts.BRONZE, color: '#EF4444' },
    ].filter(d => d.value > 0);
  }, [operatorStats.ranked, t]);

  const bronzePercentage = useMemo(() => {
    if (operatorStats.ranked.length === 0) return 0;
    const bronzeCount = operatorStats.ranked.filter(op => op.level === 'BRONZE').length;
    return (bronzeCount / operatorStats.ranked.length) * 100;
  }, [operatorStats.ranked]);

  const goldCount = useMemo(() => operatorStats.ranked.filter(op => op.level === 'OURO').length, [operatorStats.ranked]);

  // Insights Logic
  const insights = useMemo(() => {
    if (filteredData.length === 0) return null;

    const topOp = operatorStats.ranked[0];
    const bottomOp = operatorStats.ranked[operatorStats.ranked.length - 1];
    
    // Find peak hour
    const hourCounts: Record<string, number> = {};
    filteredData.forEach(d => {
      if (d.hour) {
        // Normalize hour string if it's just a number or has different format
        let h = d.hour.trim();
        if (/^\d+$/.test(h)) h = `${h.padStart(2, '0')}:00`;
        hourCounts[h] = (hourCounts[h] || 0) + (d.qty_bips || 0);
      }
    });
    // Find main reason
    const reasonCounts: Record<string, number> = {};
    filteredData.forEach(d => {
      if (d.classificacao_reason) reasonCounts[d.classificacao_reason] = (reasonCounts[d.classificacao_reason] || 0) + 1;
    });
    const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);
    const mainReason = sortedReasons[0]?.[0] || 'N/A';
    const secondReason = sortedReasons[1]?.[0];

    // Station efficiency
    const stationEfficiency = stationStats.length > 0 ? {
      best: stationStats[0].name,
      worst: stationStats[stationStats.length - 1].name,
      gap: (stationStats[0].bips / (stationStats[stationStats.length - 1].bips || 1)).toFixed(1)
    } : null;

    const trend = operatorStats.avgBips > 100 ? 'alta' : 'baixa';

    return {
      topOp: topOp?.name || 'N/A',
      bottomOp: bottomOp?.name || 'N/A',
      mainReason,
      secondReason,
      stationEfficiency,
      trend
    };
  }, [filteredData, operatorStats, stationStats]);

  // Filter Options
  const operatorOptions = useMemo(() => 
    Array.from(new Set(productivityData.map(d => d.operator))).filter(Boolean).sort().map(v => ({ label: v!, value: v! })), 
    [productivityData]
  );
  
  const reasonOptions = useMemo(() => 
    Array.from(new Set(productivityData.map(d => d.classificacao_reason))).filter(Boolean).sort().map(v => ({ label: v!, value: v! })), 
    [productivityData]
  );

  const dateOptions = useMemo(() => 
    Array.from(new Set(productivityData.map(d => d.date))).filter(Boolean).sort().map(v => ({ label: v!, value: v! })), 
    [productivityData]
  );

  if (productivityData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center space-y-4 max-w-md text-center">
          <Upload className="w-12 h-12 text-[#EE4D2D]" />
          <h2 className="text-xl font-bold text-slate-900">{t('prod.uploadCsv')}</h2>
          <p className="text-sm text-slate-600">
            {t('prod.uploadDesc')}
          </p>
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={onFileChange}
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#EE4D2D] hover:bg-[#D7263D] text-white"
          >
            {t('app.uploadCsv')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">{t('app.tab.produtividade')}</h1>
        <div className="flex space-x-2">
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={onFileChange}
          />
          <Button 
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="text-slate-600 border-slate-300"
          >
            <Upload className="w-4 h-4 mr-2" />
            {t('app.uploadCsv')}
          </Button>
        </div>
      </div>

      {/* Alert Banner */}
      {bronzePercentage > 20 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm animate-pulse">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
            <p className="text-red-800 font-bold">
              {t('prod.alertBanner')}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select 
            label={t('prod.filterOperator')} 
            options={operatorOptions} 
            value={filters.operator} 
            onChange={e => setFilters({ ...filters, operator: e.target.value })} 
          />
          <Select 
            label={t('prod.filterReason')} 
            options={reasonOptions} 
            value={filters.classificacao_reason} 
            onChange={e => setFilters({ ...filters, classificacao_reason: e.target.value })} 
          />
          <Select 
            label="Filtrar por Data" 
            options={dateOptions} 
            value={filters.date} 
            onChange={e => setFilters({ ...filters, date: e.target.value })} 
          />
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-[#F59E0B]">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('prod.highPerformance')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{goldCount}</div>
            <p className="text-xs text-slate-400 mt-1 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1 text-emerald-500" /> 
              {((goldCount / operatorStats.ranked.length) * 100).toFixed(1)}% do total
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-[#EE4D2D]">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('prod.avgProductivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{operatorStats.avgBips.toFixed(1)}</div>
            <p className="text-xs text-slate-400 mt-1">BIPs por operador</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('prod.totalBips')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{operatorStats.totalBips.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1">Volume total processado</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-indigo-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('prod.activeOperators')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{operatorStats.ranked.length}</div>
            <p className="text-xs text-slate-400 mt-1">Colaboradores em operação</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranking Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('prod.rankingTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10Operators} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg">
                          <p className="font-bold text-slate-900">{data.name}</p>
                          <p className="text-sm text-slate-600">BIPs: {data.bips}</p>
                          <Badge 
                            className={`mt-2 ${
                              data.level === 'OURO' ? 'bg-[#F59E0B]' : 
                              data.level === 'PRATA' ? 'bg-[#9CA3AF]' : 'bg-[#EF4444]'
                            } text-white border-none`}
                          >
                            {data.level}
                          </Badge>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="bips" radius={[0, 4, 4, 0]}>
                  {top10Operators.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        entry.level === 'OURO' ? '#F59E0B' : 
                        entry.level === 'PRATA' ? '#9CA3AF' : '#EF4444'
                      } 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribution & Insights */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('prod.performanceDist')}</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={performanceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {performanceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-24 h-24" />
            </div>
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-indigo-400" />
                {t('prod.insightsTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {insights ? (
                <div className="prose prose-invert max-w-none">
                  <p className="text-slate-300 leading-relaxed text-sm">
                    Observa-se destaque positivo para o operador <span className="text-[#F59E0B] font-bold">{insights.topOp}</span>. 
                    Há incidência relevante do motivo <span className="text-indigo-400 font-bold">{insights.mainReason}</span> 
                    {insights.secondReason ? ` seguido de ${insights.secondReason}` : ''} impactando o processo.
                  </p>
                  
                  {insights.stationEfficiency && (
                    <p className="text-slate-300 leading-relaxed text-sm mt-2">
                      A estação <span className="text-emerald-400 font-bold">{insights.stationEfficiency.best}</span> lidera em eficiência, 
                      sendo <span className="text-white font-bold">{insights.stationEfficiency.gap}x</span> mais produtiva que a 
                      estação <span className="text-red-400 font-bold">{insights.stationEfficiency.worst}</span>.
                    </p>
                  )}

                  <p className="text-slate-300 leading-relaxed text-sm mt-2">
                    A tendência geral é de <span className={`font-bold ${insights.trend === 'alta' ? 'text-emerald-400' : 'text-red-400'}`}>{insights.trend} produtividade</span>.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-emerald-500/20 rounded">
                        <User className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Top Performer</p>
                        <p className="text-xs font-medium truncate w-24">{insights.topOp}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-sm italic">Analisando dados...</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Stations Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('prod.topStationRankingTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topStations}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="bips"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {topStations.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tier List by Process */}
        <Card>
          <CardHeader>
            <CardTitle>{t('prod.tierListTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tierListByProcess.map((tier, idx) => (
                <div key={idx} className="flex flex-col p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                        idx === 0 ? 'bg-[#F59E0B]' : idx === 1 ? 'bg-[#9CA3AF]' : 'bg-[#B45309]'
                      }`}>
                        {idx === 0 ? 'S' : idx === 1 ? 'A' : 'B'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{tier.name}</p>
                        <p className="text-xs text-slate-500">{tier.totalBips.toLocaleString()} BIPs totais</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{tier.avgBips}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Média BIPs</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 uppercase font-bold">Estação Principal:</span>
                    <span className="text-slate-900 font-medium">{tier.topStation}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Stations Chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t('prod.bottomRankingTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bottomStations}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="bips"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {bottomStations.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Histogram */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Média de BIPs por Data</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgBips" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Média BIPs" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
