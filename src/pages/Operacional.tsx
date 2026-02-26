import React, { useMemo, useState } from 'react';
import { ShipmentData } from '@/src/hooks/useGoogleSheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import { Badge } from '@/src/components/ui/Badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface OperacionalProps {
  data: ShipmentData[];
}

export function Operacional({ data }: OperacionalProps) {
  const [filters, setFilters] = useState({
    latest_station_name: '',
    responsability: '',
    stuck_aging: '',
    since_drop_aging: '',
  });

  const filteredData = useMemo(() => {
    return data.filter(item => {
      return (
        (!filters.latest_station_name || item.latest_station_name === filters.latest_station_name) &&
        (!filters.responsability || item.responsability === filters.responsability) &&
        (!filters.stuck_aging || item.stuck_aging === filters.stuck_aging) &&
        (!filters.since_drop_aging || item.since_drop_aging === filters.since_drop_aging)
      );
    });
  }, [data, filters]);

  // Computed Fields
  const totalShipments = filteredData.length;
  const avgDaysStation = totalShipments ? (filteredData.reduce((acc, curr) => acc + curr.days_open_in_station, 0) / totalShipments).toFixed(1) : '0.0';
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

  // Filter Options
  const stationOptions = useMemo(() => Array.from(new Set(data.map(d => d.latest_station_name))).filter(Boolean).map(v => ({ label: v, value: v })), [data]);
  const respOptions = useMemo(() => Array.from(new Set(data.map(d => d.responsability))).filter(Boolean).map(v => ({ label: v, value: v })), [data]);
  const stuckAgingOptions = useMemo(() => Array.from(new Set(data.map(d => d.stuck_aging))).filter(Boolean).map(v => ({ label: v, value: v })), [data]);
  const sinceDropAgingOptions = useMemo(() => Array.from(new Set(data.map(d => d.since_drop_aging))).filter(Boolean).map(v => ({ label: v, value: v })), [data]);

  const [page, setPage] = useState(1);
  const rowsPerPage = 25;
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select 
            label="Estação" 
            options={stationOptions} 
            value={filters.latest_station_name} 
            onChange={e => setFilters({ ...filters, latest_station_name: e.target.value })} 
          />
          <Select 
            label="Responsável" 
            options={respOptions} 
            value={filters.responsability} 
            onChange={e => setFilters({ ...filters, responsability: e.target.value })} 
          />
          <Select 
            label="Stuck Aging" 
            options={stuckAgingOptions} 
            value={filters.stuck_aging} 
            onChange={e => setFilters({ ...filters, stuck_aging: e.target.value })} 
          />
          <Select 
            label="Since Drop Aging" 
            options={sinceDropAgingOptions} 
            value={filters.since_drop_aging} 
            onChange={e => setFilters({ ...filters, since_drop_aging: e.target.value })} 
          />
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#EE4D2D] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-white/80 text-sm font-medium">Total Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalShipments.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 text-sm font-medium">Média Dias na Estação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{avgDaysStation} <span className="text-lg font-normal text-slate-500">dias</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 text-sm font-medium">% Stuck &gt;5 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${Number(percentStuck) > 15 ? 'text-[#D7263D]' : 'text-slate-900'}`}>
              {percentStuck}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 text-sm font-medium">Críticos &gt;20 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#D7263D]">{criticalShipments.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Volume por Responsável</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
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
            <CardTitle>Aging em Estação</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
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
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoramento RTS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-3">Shipment ID</th>
                  <th className="px-4 py-3">Estação</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3 text-right">Dias na Estação</th>
                  <th className="px-4 py-3 text-right">Dias RTS</th>
                  <th className="px-4 py-3 text-right">Dias Stuck</th>
                  <th className="px-4 py-3">Stuck Aging</th>
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
                      Nenhum registro encontrado.
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
                Mostrando {(page - 1) * rowsPerPage + 1} a {Math.min(page * rowsPerPage, filteredData.length)} de {filteredData.length} registros
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
