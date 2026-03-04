import React, { useRef, useState, useMemo } from 'react';
import { ShipmentData } from '@/src/hooks/useGoogleSheet';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { format } from 'date-fns';
import { Download, Filter, Search, X, ChevronDown, Check, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useLanguage } from '../contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts';
import { parseISO, format as formatDate, isValid } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

interface RelatorioProps {
  data: ShipmentData[];
}

export function Relatorio({ data }: RelatorioProps) {
  const { t, language } = useLanguage();
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [onlyOver3Days, setOnlyOver3Days] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [stationSort, setStationSort] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'avgAging', dir: 'desc' });
  const [respSort, setRespSort] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'avgAging', dir: 'desc' });
  const [spxSort, setSpxSort] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'count', dir: 'desc' });

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Group stations by their prefix (HUB, SOC, XPT, etc.)
  const stationGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    data.forEach(item => {
      if (item.latest_station_name) {
        const name = item.latest_station_name.trim();
        // Extract letters at the beginning of the string (e.g. "XPT1" -> "XPT", "SoC SP" -> "SOC", "HUB-RJ" -> "HUB")
        const match = name.match(/^([A-Za-z]+)/);
        const type = match ? match[1].toUpperCase() : 'OUTROS';
        const groupName = type.length > 1 ? type : 'OUTROS';
        
        if (!groups[groupName]) groups[groupName] = [];
        if (!groups[groupName].includes(name)) {
          groups[groupName].push(name);
        }
      }
    });
    Object.keys(groups).forEach(key => groups[key].sort());
    return groups;
  }, [data]);

  const toggleStation = (station: string) => {
    setSelectedStations(prev => 
      prev.includes(station) ? prev.filter(s => s !== station) : [...prev, station]
    );
  };

  const removeStation = (station: string) => {
    setSelectedStations(prev => prev.filter(s => s !== station));
  };

  const removeGroup = (groupName: string) => {
    const groupStations = stationGroups[groupName];
    setSelectedStations(prev => prev.filter(s => !groupStations.includes(s)));
  };

  const displayTags = useMemo(() => {
    const tags: { id: string, label: string, isGroup: boolean }[] = [];
    const selectedSet = new Set(selectedStations);
    
    Object.entries(stationGroups).forEach(([groupName, stations]) => {
      const selectedInGroup = stations.filter(s => selectedSet.has(s));
      if (selectedInGroup.length === stations.length && stations.length > 0) {
        tags.push({ id: groupName, label: `Todos: ${groupName}`, isGroup: true });
      } else {
        selectedInGroup.forEach(s => {
          tags.push({ id: s, label: s, isGroup: false });
        });
      }
    });
    return tags;
  }, [selectedStations, stationGroups]);

  // Filter data based on selected operations and >3 days filter
  const filteredData = useMemo(() => {
    let result = data;
    if (selectedStations.length > 0) {
      result = result.filter(item => selectedStations.includes(item.latest_station_name?.trim()));
    }
    if (onlyOver3Days) {
      // Use a more robust check for > 3 days
      result = result.filter(item => Number(item.days_open_in_station) > 3);
    }
    return result;
  }, [data, selectedStations, onlyOver3Days]);

  // Month-over-Month Data
  const momData = useMemo(() => {
    const months: Record<string, { volume: number, totalAging: number }> = {};
    
    filteredData.forEach(item => {
      const dateStr = item.latest_spx_datetime || item.current_datetime;
      if (dateStr) {
        // Try to parse date. Format might be "YYYY-MM-DD HH:mm:ss" or ISO
        let date = parseISO(dateStr);
        if (!isValid(date)) {
          // Try manual parse for "YYYY-MM-DD HH:mm:ss"
          const parts = dateStr.split(' ')[0].split('-');
          if (parts.length === 3) {
            date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          }
        }

        if (isValid(date)) {
          const monthKey = formatDate(date, 'yyyy-MM');
          if (!months[monthKey]) months[monthKey] = { volume: 0, totalAging: 0 };
          months[monthKey].volume += 1;
          months[monthKey].totalAging += item.days_open_since_rts;
        }
      }
    });

    return Object.entries(months)
      .map(([month, stats]) => ({
        month,
        displayMonth: formatDate(parseISO(`${month}-01`), 'MMM/yy', { locale: language === 'pt' ? ptBR : enUS }),
        volume: stats.volume,
        avgAging: Number((stats.totalAging / stats.volume).toFixed(1))
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredData, language]);

  // Computed Fields for the report
  const totalShipments = filteredData.length;
  const avgAging = totalShipments 
    ? (filteredData.reduce((acc, curr) => acc + curr.days_open_since_rts, 0) / totalShipments).toFixed(1) 
    : '0.0';
  
  // SLA and Risk (assuming > 30 days is critical/out of SLA for this context)
  const outOfSla = filteredData.filter(d => d.days_open_since_rts > 30).length;
  const percentOutOfSla = totalShipments ? ((outOfSla / totalShipments) * 100).toFixed(1) : '0.0';

  // Group by Station
  const stationStats = useMemo(() => {
    const stats: Record<string, { count: number, totalAging: number }> = {};
    filteredData.forEach(item => {
      const station = item.latest_station_name || 'Desconhecido';
      if (!stats[station]) stats[station] = { count: 0, totalAging: 0 };
      stats[station].count += 1;
      stats[station].totalAging += item.days_open_since_rts;
    });

    return Object.entries(stats)
      .map(([name, data]) => ({
        name,
        avgAging: Number((data.totalAging / data.count).toFixed(1)),
        count: data.count,
        status: (data.totalAging / data.count) > 30 ? 'Crítico' : 'Atenção'
      }))
      .sort((a, b) => {
        const aVal = a[stationSort.key as keyof typeof a];
        const bVal = b[stationSort.key as keyof typeof b];
        if (stationSort.dir === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      })
      .slice(0, 10); // Show more now that it's sortable
  }, [filteredData, stationSort]);

  // Group by Responsibility
  const respStats = useMemo(() => {
    const stats: Record<string, { count: number, totalAging: number }> = {};
    filteredData.forEach(item => {
      const resp = item.responsability || 'Não Atribuído';
      if (!stats[resp]) stats[resp] = { count: 0, totalAging: 0 };
      stats[resp].count += 1;
      stats[resp].totalAging += item.days_open_since_rts;
    });

    return Object.entries(stats)
      .map(([name, data]) => ({
        name,
        avgAging: Number((data.totalAging / data.count).toFixed(1)),
        count: data.count,
        impact: name.toLowerCase().includes('carrier') ? 'Falha na coleta/devolução física' : 
                name.toLowerCase().includes('logistic') ? 'Falha na conferência/inventário' : 
                'Atraso no processo/disputa'
      }))
      .sort((a, b) => {
        const aVal = a[respSort.key as keyof typeof a];
        const bVal = b[respSort.key as keyof typeof b];
        if (respSort.dir === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });
  }, [filteredData, respSort]);

  // Group by SPX Status
  const spxStatusStats = useMemo(() => {
    const stats: Record<string, { count: number, percentage: string }> = {};
    let total = 0;
    
    filteredData.forEach(item => {
      const status = item.latest_spx_status || 'Sem Status';
      stats[status] = stats[status] || { count: 0, percentage: '0%' };
      stats[status].count += 1;
      total++;
    });

    return Object.entries(stats)
      .map(([name, data]) => ({
        name,
        count: data.count,
        percentage: total > 0 ? ((data.count / total) * 100).toFixed(1) + '%' : '0.0%',
        percentageNum: total > 0 ? (data.count / total) : 0
      }))
      .sort((a, b) => {
        const aVal = a[spxSort.key as keyof typeof a];
        const bVal = b[spxSort.key as keyof typeof b];
        if (spxSort.dir === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      })
      .slice(0, 10);
  }, [filteredData, spxSort]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Relatorio_Estrategico_RTS_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Filters */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-4 flex-1">
              <div className="space-y-3 flex-1 max-w-xl" ref={dropdownRef}>
                <h3 className="text-sm font-medium text-slate-700 flex items-center">
                  <Filter className="w-4 h-4 mr-2" />
                  {t('rel.filterOpType')}
                </h3>
                
                <div className="relative">
                  {/* Selected Tags & Input Container */}
                  <div 
                    className="min-h-[42px] p-1.5 bg-white border border-slate-300 rounded-md shadow-sm flex flex-wrap gap-1.5 items-center cursor-text focus-within:border-[#EE4D2D] focus-within:ring-1 focus-within:ring-[#EE4D2D] transition-all"
                    onClick={() => setIsDropdownOpen(true)}
                  >
                    {displayTags.map(tag => (
                      <span 
                        key={tag.id} 
                        className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium border ${tag.isGroup ? 'bg-[#EE4D2D]/10 text-[#EE4D2D] border-[#EE4D2D]/20' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
                      >
                        {tag.label}
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (tag.isGroup) removeGroup(tag.id);
                            else removeStation(tag.id);
                          }}
                          className={`ml-1.5 focus:outline-none ${tag.isGroup ? 'text-[#EE4D2D] hover:text-[#D7263D]' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    
                    <div className="flex-1 min-w-[120px] flex items-center px-1">
                      <Search className="w-4 h-4 text-slate-400 mr-2" />
                      <input
                        type="text"
                        className="w-full bg-transparent border-none focus:outline-none text-sm text-slate-700 placeholder:text-slate-400"
                        placeholder={selectedStations.length === 0 ? t('rel.searchOp') : ""}
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                      />
                    </div>
                    
                    <div className="px-2 text-slate-400">
                      <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-auto">
                      {Object.entries(stationGroups).map(([groupName, stations]) => {
                        const filteredGroupStations = stations.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
                        const groupMatchesSearch = groupName.toLowerCase().includes(searchQuery.toLowerCase());
                        
                        if (!groupMatchesSearch && filteredGroupStations.length === 0) return null;

                        const stationsToRender = groupMatchesSearch && filteredGroupStations.length === 0 ? stations : filteredGroupStations;
                        
                        const allSelected = stationsToRender.every(s => selectedStations.includes(s));
                        const someSelected = stationsToRender.some(s => selectedStations.includes(s));

                        return (
                          <div key={groupName} className="border-b border-slate-100 last:border-0">
                            <div 
                              className="px-3 py-2 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 sticky top-0 z-10"
                              onClick={() => {
                                if (allSelected) {
                                  setSelectedStations(prev => prev.filter(s => !stationsToRender.includes(s)));
                                } else {
                                  setSelectedStations(prev => {
                                    const newSet = new Set(prev);
                                    stationsToRender.forEach(s => newSet.add(s));
                                    return Array.from(newSet);
                                  });
                                }
                              }}
                            >
                              <span className="font-semibold text-slate-700 text-sm">{groupName}</span>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${allSelected ? 'bg-[#EE4D2D] border-[#EE4D2D]' : someSelected ? 'bg-orange-200 border-[#EE4D2D]' : 'border-slate-300'}`}>
                                {allSelected && <Check className="w-3 h-3 text-white" />}
                                {!allSelected && someSelected && <div className="w-2 h-2 bg-[#EE4D2D] rounded-sm" />}
                              </div>
                            </div>
                            <ul className="py-1">
                              {stationsToRender.map(station => {
                                const isSelected = selectedStations.includes(station);
                                return (
                                  <li 
                                    key={station}
                                    className={`px-4 py-1.5 text-sm cursor-pointer flex items-center justify-between hover:bg-slate-50 ${isSelected ? 'text-[#EE4D2D] font-medium' : 'text-slate-600'}`}
                                    onClick={() => toggleStation(station)}
                                  >
                                    {station}
                                    {isSelected && <Check className="w-4 h-4 text-[#EE4D2D]" />}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                      {Object.keys(stationGroups).length === 0 && (
                        <div className="px-3 py-4 text-sm text-slate-500 text-center">
                          Nenhuma operação encontrada
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-slate-500">
                  {selectedStations.length === 0 ? t('rel.showingAll') : t('rel.stationsSelected', { count: selectedStations.length })}
                </p>
              </div>

              {/* New Filter: >3 Days */}
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="over3days" 
                  checked={onlyOver3Days}
                  onChange={(e) => setOnlyOver3Days(e.target.checked)}
                  className="w-4 h-4 text-[#EE4D2D] border-slate-300 rounded focus:ring-[#EE4D2D]"
                />
                <label htmlFor="over3days" className="text-sm font-medium text-slate-700 cursor-pointer">
                  {t('rel.onlyOver3Days')}
                </label>
              </div>
            </div>
            
            <Button onClick={handleExportPDF} className="bg-[#EE4D2D] hover:bg-[#D7263D] text-white whitespace-nowrap self-start">
              <Download className="mr-2 h-4 w-4" />
              {t('rel.exportPdf')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-8 sm:p-12 bg-white" ref={reportRef}>
          <div className="space-y-8 text-slate-800 font-sans">
            
            {/* Header */}
            <div className="border-b-2 border-slate-800 pb-6 space-y-2">
              <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                <strong className="text-slate-900">{t('rel.to')}</strong>
                <span className="text-slate-700">{t('rel.toValue')}</span>
                
                <strong className="text-slate-900">{t('rel.from')}</strong>
                <span className="text-slate-700">{t('rel.fromValue')}</span>
                
                <strong className="text-slate-900">{t('rel.subject')}</strong>
                <span className="text-slate-900 font-bold uppercase">{t('rel.subjectValue')}</span>
                
                <strong className="text-slate-900">{t('rel.date')}</strong>
                <span className="text-slate-700">{format(new Date(), 'dd/MM/yyyy')}</span>
              </div>
            </div>

            {/* 1. Resumo Executivo */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">{t('rel.sec1')}</h2>
              <div className="space-y-4 text-slate-700 leading-relaxed text-justify">
                {onlyOver3Days && (
                  <p className="bg-red-50 p-3 border-l-4 border-red-500 text-red-800 font-medium text-sm">
                    {t('rel.sec1_over3')}
                  </p>
                )}
                <p>
                  {t('rel.p1_1')} {selectedStations.length > 0 ? t('rel.p1_focus', { tags: displayTags.map(t => t.label).join(', ') }) : ''} {t('rel.p1_2')} <strong>{totalShipments.toLocaleString()} {t('rel.p1_3')}</strong> {t('rel.p1_4')} <strong>{avgAging} {t('rel.p1_5')}</strong> {t('rel.p1_6')}
                </p>
                <p>
                  {t('rel.p2_1')} <strong>{percentOutOfSla}{t('rel.p2_2')}</strong> {t('rel.p2_3')}
                </p>
              </div>
            </section>

            {/* MoM Comparison Chart */}
            {momData.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">{t('rel.momTitle')}</h2>
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={momData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="displayMonth" />
                      <YAxis yAxisId="left" orientation="left" stroke="#EE4D2D" />
                      <YAxis yAxisId="right" orientation="right" stroke="#1e293b" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="volume" name={t('rel.momVolume')} fill="#EE4D2D" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="avgAging" name={t('rel.momAging')} stroke="#1e293b" strokeWidth={3} dot={{ r: 6 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* 2. Diagnóstico Técnico */}
            <section className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">{t('rel.sec2')}</h2>
              <p className="text-slate-700 leading-relaxed text-justify">
                {t('rel.sec2_desc')}
              </p>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-800">{t('rel.analysisLoc')}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th 
                          className="border border-slate-300 px-4 py-2 font-semibold cursor-pointer hover:bg-slate-200"
                          onClick={() => setStationSort({ key: 'name', dir: stationSort.key === 'name' && stationSort.dir === 'desc' ? 'asc' : 'desc' })}
                        >
                          {t('rel.location')} {stationSort.key === 'name' && (stationSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th 
                          className="border border-slate-300 px-4 py-2 font-semibold cursor-pointer hover:bg-slate-200"
                          onClick={() => setStationSort({ key: 'count', dir: stationSort.key === 'count' && stationSort.dir === 'desc' ? 'asc' : 'desc' })}
                        >
                          {t('rel.volItems')} {stationSort.key === 'count' && (stationSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th 
                          className="border border-slate-300 px-4 py-2 font-semibold cursor-pointer hover:bg-slate-200"
                          onClick={() => setStationSort({ key: 'avgAging', dir: stationSort.key === 'avgAging' && stationSort.dir === 'desc' ? 'asc' : 'desc' })}
                        >
                          {t('rel.avgAgingDays')} {stationSort.key === 'avgAging' && (stationSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th className="border border-slate-300 px-4 py-2 font-semibold">{t('rel.critStatus')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stationStats.length > 0 ? stationStats.map((stat, idx) => (
                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="border border-slate-300 px-4 py-2">{stat.name}</td>
                          <td className="border border-slate-300 px-4 py-2">{stat.count}</td>
                          <td className="border border-slate-300 px-4 py-2 font-mono">{stat.avgAging}</td>
                          <td className="border border-slate-300 px-4 py-2">
                            <span className={`font-semibold ${stat.status === 'Crítico' ? 'text-red-600' : 'text-amber-600'}`}>
                              {stat.status === 'Crítico' ? t('rel.critical') : t('rel.warning')}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="border border-slate-300 px-4 py-4 text-center text-slate-500">{t('rel.noData')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-800">{t('rel.analysisResp')}</h3>
                <p className="text-sm text-slate-700">
                  {t('rel.analysisRespDesc')}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th 
                          className="border border-slate-300 px-4 py-2 font-semibold cursor-pointer hover:bg-slate-200"
                          onClick={() => setRespSort({ key: 'name', dir: respSort.key === 'name' && respSort.dir === 'desc' ? 'asc' : 'desc' })}
                        >
                          {t('rel.responsible')} {respSort.key === 'name' && (respSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th 
                          className="border border-slate-300 px-4 py-2 font-semibold cursor-pointer hover:bg-slate-200"
                          onClick={() => setRespSort({ key: 'count', dir: respSort.key === 'count' && respSort.dir === 'desc' ? 'asc' : 'desc' })}
                        >
                          {t('rel.volume')} {respSort.key === 'count' && (respSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th 
                          className="border border-slate-300 px-4 py-2 font-semibold cursor-pointer hover:bg-slate-200"
                          onClick={() => setRespSort({ key: 'avgAging', dir: respSort.key === 'avgAging' && respSort.dir === 'desc' ? 'asc' : 'desc' })}
                        >
                          {t('rel.avgAgingDays')} {respSort.key === 'avgAging' && (respSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th className="border border-slate-300 px-4 py-2 font-semibold">{t('rel.processImpact')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {respStats.length > 0 ? respStats.map((stat, idx) => (
                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="border border-slate-300 px-4 py-2">{stat.name}</td>
                          <td className="border border-slate-300 px-4 py-2">{stat.count}</td>
                          <td className="border border-slate-300 px-4 py-2 font-mono">{stat.avgAging}</td>
                          <td className="border border-slate-300 px-4 py-2 text-slate-600">
                            {stat.impact === 'Falha na coleta/devolução física' ? t('rel.impact1') : 
                             stat.impact === 'Falha na conferência/inventário' ? t('rel.impact2') : 
                             t('rel.impact3')}
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="border border-slate-300 px-4 py-4 text-center text-slate-500">{t('rel.noData')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-slate-50 border-l-4 border-slate-800 p-4 mt-4">
                <p className="text-sm text-slate-700 italic">
                  <strong>{t('rel.engObs')}</strong> {t('rel.engObsDesc')}
                </p>
              </div>

              <div className="space-y-3 mt-8">
                <h3 className="font-bold text-slate-800">{t('rel.analysisSpx')}</h3>
                <p className="text-sm text-slate-700">
                  {t('rel.analysisSpxDesc')}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th 
                          className="border border-slate-300 px-4 py-2 font-semibold cursor-pointer hover:bg-slate-200"
                          onClick={() => setSpxSort({ key: 'name', dir: spxSort.key === 'name' && spxSort.dir === 'desc' ? 'asc' : 'desc' })}
                        >
                          {t('rel.spxStatus')} {spxSort.key === 'name' && (spxSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th 
                          className="border border-slate-300 px-4 py-2 font-semibold cursor-pointer hover:bg-slate-200"
                          onClick={() => setSpxSort({ key: 'count', dir: spxSort.key === 'count' && spxSort.dir === 'desc' ? 'asc' : 'desc' })}
                        >
                          {t('rel.volume')} {spxSort.key === 'count' && (spxSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                        <th 
                          className="border border-slate-300 px-4 py-2 font-semibold cursor-pointer hover:bg-slate-200"
                          onClick={() => setSpxSort({ key: 'percentageNum', dir: spxSort.key === 'percentageNum' && spxSort.dir === 'desc' ? 'asc' : 'desc' })}
                        >
                          {t('rel.spxPercentage')} {spxSort.key === 'percentageNum' && (spxSort.dir === 'desc' ? '↓' : '↑')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {spxStatusStats.length > 0 ? spxStatusStats.map((stat, idx) => (
                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="border border-slate-300 px-4 py-2">{stat.name}</td>
                          <td className="border border-slate-300 px-4 py-2">{stat.count}</td>
                          <td className="border border-slate-300 px-4 py-2 font-mono">{stat.percentage}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={3} className="border border-slate-300 px-4 py-4 text-center text-slate-500">{t('rel.noData')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {spxStatusStats.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-md mt-2">
                    <p className="text-sm text-amber-800">
                      <span className="mr-2">💡</span>
                      {t('rel.spxInsight', { status: spxStatusStats[0].name, percentage: spxStatusStats[0].percentage })}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* 3. Recomendações Práticas */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">{t('rel.sec3')}</h2>
              <p className="text-slate-700 leading-relaxed text-justify">
                {t('rel.sec3_desc')}
              </p>
              <ul className="space-y-4 text-slate-700 list-none pl-0">
                <li className="flex items-start">
                  <span className="font-bold text-[#EE4D2D] mr-2 mt-0.5">1.</span>
                  <div>
                    <strong className="text-slate-900">{t('rel.rec1_title')}</strong> {t('rel.rec1_desc')}
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-[#EE4D2D] mr-2 mt-0.5">2.</span>
                  <div>
                    <strong className="text-slate-900">{t('rel.rec2_title')}</strong> {t('rel.rec2_desc')}
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-[#EE4D2D] mr-2 mt-0.5">3.</span>
                  <div>
                    <strong className="text-slate-900">{t('rel.rec3_title')}</strong> {t('rel.rec3_desc')}
                  </div>
                </li>
              </ul>
            </section>

            <div className="pt-12 mt-8 border-t border-slate-200 text-center text-xs text-slate-400 uppercase tracking-widest">
              {t('rel.footer')}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
