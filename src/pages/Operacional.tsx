import React, { useMemo, useState } from 'react';
import { ShipmentData } from '@/src/hooks/useGoogleSheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import { Badge } from '@/src/components/ui/Badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type SortConfig = {
  key: keyof ShipmentData | null;
  direction: 'asc' | 'desc' | null;
};

type KpiFilterType = 'ALL' | 'AVG_STATION' | 'STUCK_5' | 'CRITICAL_20' | null;

interface OperacionalProps {
  data: ShipmentData[];
}

export function Operacional({ data }: OperacionalProps) {
  const { t } = useLanguage();
  const [filters, setFilters] = useState({
    latest_station_name: '',
    responsability: '',
    stuck_aging: '',
    since_drop_aging: '',
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });
  const [activeKpi, setActiveKpi] = useState<KpiFilterType>(null);

  const handleSort = (key: keyof ShipmentData) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key: direction ? key : null, direction });
  };

  const filteredData = useMemo(() => {
    let result = data.filter(item => {
      return (
        (!filters.latest_station_name || item.latest_station_name === filters.latest_station_name) &&
        (!filters.responsability || item.responsability === filters.responsability) &&
        (!filters.stuck_aging || item.stuck_aging === filters.stuck_aging) &&
        (!filters.since_drop_aging || item.since_drop_aging === filters.since_drop_aging)
      );
    });

    if (sortConfig.key && sortConfig.direction) {
      result = [...result].sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, filters, sortConfig]);

  // Computed Fields
  const totalShipments = filteredData.length;
  const avgDaysStationNum = totalShipments ? (filteredData.reduce((acc, curr) => acc + curr.days_open_in_station, 0) / totalShipments) : 0;
  const avgDaysStation = avgDaysStationNum.toFixed(1);
  const totalStuckOver5 = filteredData.filter(d => d.days_stuck > 5).length;
  const percentStuck = totalShipments ? ((totalStuckOver5 / totalShipments) * 100).toFixed(1) : '0.0';
  const criticalShipments = filteredData.filter(d => d.days_open_since_rts > 20).length;

  // Chart Data: Volume por Responsável
  const volumeByResponsability = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(d => {
      counts[d.responsability] = (counts[d.responsability] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // Chart Data: Aging em Estação
  const agingInStation = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(d => {
      counts[d.in_station_aging] = (counts[d.in_station_aging] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // Chart Data: Histograma de Dias desde RTS
  const histogramData = useMemo(() => {
    const bins = {
      '0-5 dias': 0,
      '6-10 dias': 0,
      '11-20 dias': 0,
      '21-30 dias': 0,
      '31+ dias': 0,
    };
    filteredData.forEach(d => {
      const days = d.days_open_since_rts;
      if (days <= 5) bins['0-5 dias']++;
      else if (days <= 10) bins['6-10 dias']++;
      else if (days <= 20) bins['11-20 dias']++;
      else if (days <= 30) bins['21-30 dias']++;
      else bins['31+ dias']++;
    });
    return Object.entries(bins).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  // Filter Options
  const stationOptions = useMemo(() => Array.from(new Set(data.map(d => d.latest_station_name))).filter(Boolean).map(v => ({ label: v, value: v })), [data]);
  const respOptions = useMemo(() => Array.from(new Set(data.map(d => d.responsability))).filter(Boolean).map(v => ({ label: v, value: v })), [data]);
  const stuckAgingOptions = useMemo(() => Array.from(new Set(data.map(d => d.stuck_aging))).filter(Boolean).map(v => ({ label: v, value: v })), [data]);
  const sinceDropAgingOptions = useMemo(() => Array.from(new Set(data.map(d => d.since_drop_aging))).filter(Boolean).map(v => ({ label: v, value: v })), [data]);

  const [page, setPage] = useState(1);
  const rowsPerPage = 25;
  
  // Apply KPI filter if active
  const tableData = useMemo(() => {
    if (!activeKpi) return filteredData;
    switch (activeKpi) {
      case 'ALL': return filteredData;
      case 'AVG_STATION': return filteredData.filter(d => d.days_open_in_station > avgDaysStationNum);
      case 'STUCK_5': return filteredData.filter(d => d.days_stuck > 5);
      case 'CRITICAL_20': return filteredData.filter(d => d.days_open_since_rts > 20);
      default: return filteredData;
    }
  }, [filteredData, activeKpi, avgDaysStationNum]);

  const totalPages = Math.ceil(tableData.length / rowsPerPage);
  const paginatedData = tableData.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // Reset page when data changes
  React.useEffect(() => {
    setPage(1);
  }, [tableData.length]);

  const renderSortIcon = (key: keyof ShipmentData) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-400" />;
    if (sortConfig.direction === 'asc') return <ArrowUp className="w-3 h-3 ml-1 text-[#EE4D2D]" />;
    return <ArrowDown className="w-3 h-3 ml-1 text-[#EE4D2D]" />;
  };

  const getKpiTitle = () => {
    switch (activeKpi) {
      case 'ALL': return t('op.allShipments');
      case 'AVG_STATION': return t('op.aboveAvg', { avg: avgDaysStation });
      case 'STUCK_5': return t('op.stuck5');
      case 'CRITICAL_20': return t('op.criticalRts');
      default: return t('op.rtsMonitoring');
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select 
            label={t('op.station')} 
            options={stationOptions} 
            value={filters.latest_station_name} 
            onChange={e => setFilters({ ...filters, latest_station_name: e.target.value })} 
          />
          <Select 
            label={t('op.responsability')} 
            options={respOptions} 
            value={filters.responsability} 
            onChange={e => setFilters({ ...filters, responsability: e.target.value })} 
          />
          <Select 
            label={t('op.stuckAging')} 
            options={stuckAgingOptions} 
            value={filters.stuck_aging} 
            onChange={e => setFilters({ ...filters, stuck_aging: e.target.value })} 
          />
          <Select 
            label={t('op.sinceDropAging')} 
            options={sinceDropAgingOptions} 
            value={filters.since_drop_aging} 
            onChange={e => setFilters({ ...filters, since_drop_aging: e.target.value })} 
          />
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeKpi === 'ALL' ? 'ring-2 ring-[#EE4D2D]' : ''} bg-[#EE4D2D] text-white`}
          onClick={() => setActiveKpi(activeKpi === 'ALL' ? null : 'ALL')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-white/80 text-sm font-medium">{t('op.totalShipments')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalShipments.toLocaleString()}</div>
            <p className="text-xs text-white/70 mt-1">{t('op.clickToViewAll')}</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeKpi === 'AVG_STATION' ? 'ring-2 ring-[#EE4D2D]' : ''}`}
          onClick={() => setActiveKpi(activeKpi === 'AVG_STATION' ? null : 'AVG_STATION')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 text-sm font-medium">{t('op.avgDaysStation')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{avgDaysStation} <span className="text-lg font-normal text-slate-500">{t('op.days')}</span></div>
            <p className="text-xs text-slate-400 mt-1">{t('op.clickToViewAboveAvg')}</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeKpi === 'STUCK_5' ? 'ring-2 ring-[#EE4D2D]' : ''}`}
          onClick={() => setActiveKpi(activeKpi === 'STUCK_5' ? null : 'STUCK_5')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 text-sm font-medium">{t('op.percentStuck')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${Number(percentStuck) > 15 ? 'text-[#D7263D]' : 'text-slate-900'}`}>
              {percentStuck}%
            </div>
            <p className="text-xs text-slate-400 mt-1">{t('op.clickToViewCases', { count: totalStuckOver5 })}</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeKpi === 'CRITICAL_20' ? 'ring-2 ring-[#EE4D2D]' : ''}`}
          onClick={() => setActiveKpi(activeKpi === 'CRITICAL_20' ? null : 'CRITICAL_20')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 text-sm font-medium">{t('op.critical20')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#D7263D]">{criticalShipments.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1">{t('op.clickToDetailCritical')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('op.volByResp')}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeByResponsability} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" fill="#EE4D2D" radius={[0, 4, 4, 0]}>
                  {volumeByResponsability.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#EE4D2D' : '#FF7A59'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('op.agingInStation')}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingInStation} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" fill="#0F172A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('op.distRtsDays')}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                  {histogramData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index > 2 ? '#D7263D' : '#3B82F6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className={activeKpi ? 'ring-2 ring-[#EE4D2D] shadow-lg' : ''}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            {getKpiTitle()}
            {activeKpi && (
              <Badge variant="secondary" className="ml-3 bg-[#EE4D2D]/10 text-[#EE4D2D] border-none">
                {tableData.length} registros
              </Badge>
            )}
          </CardTitle>
          {activeKpi && (
            <button 
              onClick={() => setActiveKpi(null)}
              className="text-slate-400 hover:text-slate-600 flex items-center text-sm font-medium"
            >
              <X className="w-4 h-4 mr-1" /> {t('op.clearFilter')}
            </button>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('shipment_id')}>
                    <div className="flex items-center">{t('op.shipmentId')} {renderSortIcon('shipment_id')}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('latest_station_name')}>
                    <div className="flex items-center">{t('op.station')} {renderSortIcon('latest_station_name')}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('responsability')}>
                    <div className="flex items-center">{t('op.responsability')} {renderSortIcon('responsability')}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => handleSort('days_open_in_station')}>
                    <div className="flex items-center justify-end">{t('op.daysInStation')} {renderSortIcon('days_open_in_station')}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => handleSort('days_open_since_rts')}>
                    <div className="flex items-center justify-end">{t('op.rtsDays')} {renderSortIcon('days_open_since_rts')}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => handleSort('days_stuck')}>
                    <div className="flex items-center justify-end">{t('op.stuckDays')} {renderSortIcon('days_stuck')}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('stuck_aging')}>
                    <div className="flex items-center">{t('op.stuckAging')} {renderSortIcon('stuck_aging')}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, i) => (
                  <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.shipment_id}</td>
                    <td className="px-4 py-3">{row.latest_station_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{row.responsability}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{row.days_open_in_station}</td>
                    <td className="px-4 py-3 text-right">{row.days_open_since_rts}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={row.days_stuck > 5 ? 'text-[#D7263D] font-semibold' : ''}>
                        {row.days_stuck}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.stuck_aging}</td>
                  </tr>
                ))}
                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      {t('op.noRecords')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-slate-500">
                {t('op.showing', { start: (page - 1) * rowsPerPage + 1, end: Math.min(page * rowsPerPage, tableData.length), total: tableData.length })}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 hover:bg-slate-50"
                >
                  {t('op.prev')}
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 hover:bg-slate-50"
                >
                  {t('op.next')}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
