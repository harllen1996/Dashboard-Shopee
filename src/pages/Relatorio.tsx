import React, { useRef, useState, useMemo } from 'react';
import { ShipmentData } from '@/src/hooks/useGoogleSheet';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { format } from 'date-fns';
import { Download, Filter, Search, X, ChevronDown, Check } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface RelatorioProps {
  data: ShipmentData[];
}

export function Relatorio({ data }: RelatorioProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Filter data based on selected operations
  const filteredData = useMemo(() => {
    if (selectedStations.length === 0) return data;
    return data.filter(item => {
      return selectedStations.includes(item.latest_station_name?.trim());
    });
  }, [data, selectedStations]);

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
        avgAging: (data.totalAging / data.count).toFixed(1),
        count: data.count,
        status: (data.totalAging / data.count) > 30 ? 'Crítico' : 'Atenção'
      }))
      .sort((a, b) => Number(b.avgAging) - Number(a.avgAging))
      .slice(0, 5); // Top 5 worst
  }, [filteredData]);

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
        avgAging: (data.totalAging / data.count).toFixed(1),
        count: data.count,
        impact: name.toLowerCase().includes('carrier') ? 'Falha na coleta/devolução física' : 
                name.toLowerCase().includes('logistic') ? 'Falha na conferência/inventário' : 
                'Atraso no processo/disputa'
      }))
      .sort((a, b) => Number(b.avgAging) - Number(a.avgAging));
  }, [filteredData]);

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
            <div className="space-y-3 flex-1 max-w-xl" ref={dropdownRef}>
              <h3 className="text-sm font-medium text-slate-700 flex items-center">
                <Filter className="w-4 h-4 mr-2" />
                Filtrar por Tipo de Operação
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
                      placeholder={selectedStations.length === 0 ? "Buscar operação (ex: SOC, HUB)..." : ""}
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
                {selectedStations.length === 0 ? 'Exibindo todas as operações.' : `${selectedStations.length} estação(ões) selecionada(s).`}
              </p>
            </div>
            
            <Button onClick={handleExportPDF} className="bg-[#EE4D2D] hover:bg-[#D7263D] text-white whitespace-nowrap">
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
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
                <strong className="text-slate-900">PARA:</strong>
                <span className="text-slate-700">Diretoria de Operações / Gerência de Supply Chain</span>
                
                <strong className="text-slate-900">DE:</strong>
                <span className="text-slate-700">Engenharia de Inteligência de Logística Reversa</span>
                
                <strong className="text-slate-900">ASSUNTO:</strong>
                <span className="text-slate-900 font-bold uppercase">Relatório Estratégico de Performance e Recuperação de Ativos</span>
                
                <strong className="text-slate-900">DATA:</strong>
                <span className="text-slate-700">{format(new Date(), 'dd/MM/yyyy')}</span>
              </div>
            </div>

            {/* 1. Resumo Executivo */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">1. Resumo Executivo</h2>
              <div className="space-y-4 text-slate-700 leading-relaxed text-justify">
                <p>
                  O cenário atual da operação de logística reversa {selectedStations.length > 0 ? `(foco em ${displayTags.map(t => t.label).join(', ')})` : ''} apresenta um estado que requer atenção imediata. Com um volume de <strong>{totalShipments.toLocaleString()} itens</strong> retidos no fluxo, a ineficiência operacional é evidenciada pelo Aging Médio que atingiu <strong>{avgAging} dias</strong> de retenção desde o RTS.
                </p>
                <p>
                  A operação registra <strong>{percentOutOfSla}% de descumprimento de SLA</strong> (itens com mais de 30 dias), e a totalidade destes itens é classificada como Risco Alto. Estes dados indicam que os produtos estão, na prática, paralisados no fluxo ou retidos por questões burocráticas/processuais severas, resultando em depreciação do ativo e custo de oportunidade elevado para a companhia.
                </p>
              </div>
            </section>

            {/* 2. Diagnóstico Técnico */}
            <section className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">2. Diagnóstico Técnico</h2>
              <p className="text-slate-700 leading-relaxed text-justify">
                A análise detalhada aponta para gargalos específicos no processo macro de devolução. As tabelas abaixo detalham as localizações mais críticas e os responsáveis com maior tempo de retenção.
              </p>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-800">Análise por Localização (Gargalos Regionais - Top 5)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="border border-slate-300 px-4 py-2 font-semibold">Localização</th>
                        <th className="border border-slate-300 px-4 py-2 font-semibold">Volume (Itens)</th>
                        <th className="border border-slate-300 px-4 py-2 font-semibold">Aging Médio (Dias)</th>
                        <th className="border border-slate-300 px-4 py-2 font-semibold">Status de Criticidade</th>
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
                              {stat.status}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="border border-slate-300 px-4 py-4 text-center text-slate-500">Sem dados para exibir</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-slate-800">Análise por Responsabilidade</h3>
                <p className="text-sm text-slate-700">
                  A responsabilidade está distribuída, mas os seguintes setores detêm os maiores tempos de retenção, indicando falhas na última milha da reversa e na triagem de entrada.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="border border-slate-300 px-4 py-2 font-semibold">Responsável</th>
                        <th className="border border-slate-300 px-4 py-2 font-semibold">Volume</th>
                        <th className="border border-slate-300 px-4 py-2 font-semibold">Aging Médio (Dias)</th>
                        <th className="border border-slate-300 px-4 py-2 font-semibold">Impacto no Processo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {respStats.length > 0 ? respStats.map((stat, idx) => (
                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="border border-slate-300 px-4 py-2">{stat.name}</td>
                          <td className="border border-slate-300 px-4 py-2">{stat.count}</td>
                          <td className="border border-slate-300 px-4 py-2 font-mono">{stat.avgAging}</td>
                          <td className="border border-slate-300 px-4 py-2 text-slate-600">{stat.impact}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="border border-slate-300 px-4 py-4 text-center text-slate-500">Sem dados para exibir</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-slate-50 border-l-4 border-slate-800 p-4 mt-4">
                <p className="text-sm text-slate-700 italic">
                  <strong>Observação de Engenharia:</strong> Um aging superior a 30 dias em grande parte da amostra indica que estes itens podem ter sofrido sinistros não baixados no sistema ou estão em "limbo" administrativo entre as transferências de custódia.
                </p>
              </div>
            </section>

            {/* 3. Recomendações Práticas */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">3. Recomendações Práticas</h2>
              <p className="text-slate-700 leading-relaxed text-justify">
                Para reverter o quadro de estagnação e evitar o agravamento do prejuízo, as seguintes ações devem ser executadas imediatamente:
              </p>
              <ul className="space-y-4 text-slate-700 list-none pl-0">
                <li className="flex items-start">
                  <span className="font-bold text-[#EE4D2D] mr-2 mt-0.5">1.</span>
                  <div>
                    <strong className="text-slate-900">Força-Tarefa de Saneamento (Write-off ou Recuperação):</strong> Devido ao aging elevado, a probabilidade de integridade física dos itens mais antigos é baixa. Recomendo a auditoria física imediata nas localidades mais críticas apontadas acima. Caso os itens não sejam localizados em 48h, proceder com o write-off (baixa contábil) e acionamento de seguro ou penalização dos responsáveis.
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-[#EE4D2D] mr-2 mt-0.5">2.</span>
                  <div>
                    <strong className="text-slate-900">Revisão do Fluxo de Escalonamento:</strong> O fato de uma parcela significativa dos itens estar fora do SLA e ser de Risco Alto sem intervenção prévia demonstra falha nos alertas automáticos. É necessário implementar um Gatilho de Crise no ERP/WMS para casos que ultrapassem 30 dias de aging, com reporte direto à gerência.
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-[#EE4D2D] mr-2 mt-0.5">3.</span>
                  <div>
                    <strong className="text-slate-900">Auditoria de Contratos e SLAs:</strong> É imperativo realizar uma revisão técnica nos contratos de transporte e operação logística para aplicar as cláusulas de penalidade por extravio ou atraso excessivo na logística reversa, visando recuperar o capital parado através de ressarcimento.
                  </div>
                </li>
              </ul>
            </section>

            <div className="pt-12 mt-8 border-t border-slate-200 text-center text-xs text-slate-400 uppercase tracking-widest">
              Shopee Logistics Intelligence • Documento Confidencial
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
