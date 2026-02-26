import React, { useMemo } from 'react';
import { ShipmentData } from '@/src/hooks/useGoogleSheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ExecutivaProps {
  data: ShipmentData[];
}

export function Executiva({ data }: ExecutivaProps) {
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição RTS Aging</CardTitle>
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
            <CardTitle>Top 10 Estações Críticas (&gt;10 dias)</CardTitle>
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
              <span className="mr-2">📌</span> RESUMO EXECUTIVO
            </h3>
            <ul className="space-y-2 text-slate-700 list-disc list-inside">
              <li><strong>Base atual:</strong> {totalShipments.toLocaleString()} envios em aberto</li>
              <li><strong>{percentStuck}%</strong> estão com mais de 5 dias de stuck</li>
              <li><strong>{criticalShipments.toLocaleString()}</strong> casos ultrapassam 20 dias</li>
            </ul>
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start">
              <span className="mr-2">⚠️</span>
              <p className="m-0 font-medium">Recomenda-se ação imediata nas estações com média superior a 10 dias.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
