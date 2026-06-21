import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  FileText,
  Download,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

import { listQuotations, updateActualCost, getPdfUrl, QuotationItem } from '../api/quotations';
import { useAuthStore } from '../store/authStore';

export default function HistoryPage() {
  const { accessToken, user } = useAuthStore();
  const isAdminOrAnalista = user?.role === 'admin' || user?.role === 'analista';

  const [items, setItems] = useState<QuotationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Edición de costo real
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCostoValue, setEditCostoValue] = useState('');
  const [isSavingCost, setIsSavingCost] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listQuotations({
        page: currentPage,
        page_size: PAGE_SIZE,
        search: searchTerm || undefined,
        origen: filterOrigin || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch {
      toast.error('No se pudo cargar el historial.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm, filterOrigin, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Resetear página al cambiar filtros
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterOrigin, dateFrom, dateTo]);

  const handleSaveCost = async (id: string) => {
    const val = Number(editCostoValue);
    if (!val || val <= 0) { toast.error('Ingrese un monto válido.'); return; }
    setIsSavingCost(true);
    try {
      const updated = await updateActualCost(id, val);
      setItems(prev => prev.map(i => i.id === id ? updated : i));
      setEditingId(null);
      toast.success('Costo real registrado.');
    } catch {
      toast.error('No se pudo guardar el costo real.');
    } finally {
      setIsSavingCost(false);
    }
  };

  const handleDownloadPdf = (item: QuotationItem) => {
    const url = getPdfUrl(item.id);
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `cotizacion_${item.code}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => toast.error('No se pudo descargar el PDF.'));
  };

  const handleExportCsv = () => {
    if (items.length === 0) return;
    const headers = ['Código', 'Fecha', 'Puerto Origen', 'Contenedor', 'Peso (kg)', 'Estimado (USD)', 'IC Min', 'IC Max', 'Estado', 'Costo Real'];
    const rows = items.map(i => [
      i.code, i.created_at.slice(0, 10),
      i.puerto_origen, i.tipo_contenedor, i.peso_kg,
      i.flete_estimado_usd, i.ic95_min, i.ic95_max,
      i.estado, i.costo_real_usd ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'historial_cotizaciones.csv';
    link.click();
  };

  // Orígenes únicos de los datos cargados (para el filtro)
  const origins = Array.from(new Set(items.map(i => i.puerto_origen)));

  return (
    <div className="space-y-6">
      {/* Barra de filtros */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Buscar por código..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent/50 outline-none transition-all" />
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-white px-3 py-2 border border-slate-300 rounded-lg">
            <Calendar size={16} className="text-slate-400" />
            <input type="date" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-600 outline-none w-[110px]" />
            <span className="text-slate-300">-</span>
            <input type="date" value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-600 outline-none w-[110px]" />
          </div>

          <div className="flex items-center space-x-2 bg-white px-3 py-2 border border-slate-300 rounded-lg">
            <Filter size={16} className="text-slate-400" />
            <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-600 outline-none">
              <option value="">Todos los Orígenes</option>
              {origins.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <button onClick={handleExportCsv}
            className="p-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2">
            <Download size={16} />
            <span className="text-sm font-semibold hidden sm:inline">CSV</span>
          </button>

          <button onClick={fetchData}
            className="p-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-all">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-sm text-slate-500">Cargando historial...</p>
          </div>
        ) : items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">ID / Fecha</th>
                  <th className="px-5 py-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Detalles Carga</th>
                  {isAdminOrAnalista && (
                    <th className="px-5 py-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Usuario</th>
                  )}
                  <th className="px-5 py-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Flete Estimado</th>
                  <th className="px-5 py-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">Estado / Costo Real</th>
                  <th className="px-5 py-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(quote => (
                  <tr key={quote.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-semibold text-slate-700 block">{quote.code}</span>
                      <span className="text-[11px] text-slate-400 mt-1 block">{quote.created_at.slice(0, 10)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-sm text-slate-700">{quote.puerto_origen} → Callao</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {quote.tipo_contenedor} | {quote.peso_kg.toLocaleString()} kg
                        {quote.flete_unitario_usd != null && (
                          <span className="ml-1 text-slate-400">
                            · ${quote.flete_unitario_usd.toFixed(4)}/kg
                          </span>
                        )}
                      </p>
                    </td>
                    {isAdminOrAnalista && (
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-600">{quote.usuario_nombre ?? '—'}</span>
                      </td>
                    )}
                    <td className="px-5 py-4 text-right">
                      <p className="text-sm font-bold text-slate-900">
                        ${quote.flete_estimado_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        ± ${Math.round(quote.flete_estimado_usd - quote.ic95_min).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-center gap-2">
                        {quote.estado === 'Pendiente' ? (
                          <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 border border-yellow-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            <Clock size={10} /> Pendiente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            <CheckCircle2 size={10} /> Cerrada
                          </span>
                        )}

                        {isAdminOrAnalista && editingId === quote.id ? (
                          <div className="flex items-center gap-1 mt-1">
                            <input type="number"
                              className="w-20 text-xs border border-slate-300 rounded p-1"
                              placeholder="USD..."
                              value={editCostoValue}
                              onChange={e => setEditCostoValue(e.target.value)} />
                            <button disabled={isSavingCost}
                              onClick={() => handleSaveCost(quote.id)}
                              className="bg-primary text-white p-1 rounded text-xs font-semibold disabled:opacity-50">
                              OK
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="bg-slate-200 text-slate-600 p-1 rounded text-xs font-semibold">
                              X
                            </button>
                          </div>
                        ) : isAdminOrAnalista ? (
                          <div className="mt-1 flex flex-col items-center gap-1">
                            {quote.costo_real_usd != null && (
                              <>
                                <p className="text-sm font-bold text-slate-700 text-center">
                                  ${quote.costo_real_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                                {quote.error_pct != null && (
                                  <span className="text-[10px] text-slate-400">err {quote.error_pct.toFixed(1)}%</span>
                                )}
                              </>
                            )}
                            <button
                              onClick={() => { setEditingId(quote.id); setEditCostoValue(quote.costo_real_usd?.toString() ?? ''); }}
                              className="text-[10px] text-accent font-semibold hover:underline flex items-center justify-center gap-1">
                              <Edit3 size={10} /> {quote.costo_real_usd != null ? 'Editar Costo' : 'Ingresar Costo'}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1">
                            {quote.costo_real_usd != null ? (
                              <p className="text-sm font-bold text-slate-700 text-center">
                                ${quote.costo_real_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                            ) : (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center">
                        <button onClick={() => handleDownloadPdf(quote)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                          title="Descargar PDF">
                          <FileText size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle size={32} className="text-slate-300" />
            </div>
            <h4 className="text-base font-semibold text-slate-700">No se encontraron cotizaciones</h4>
            <p className="text-sm text-slate-500 mt-1">Intenta ajustando los filtros o crea tu primera cotización.</p>
          </div>
        )}
      </div>

      {/* Paginación */}
      <div className="bg-slate-50/50 p-4 border border-slate-200 rounded-xl flex items-center justify-between">
        <p className="text-sm text-slate-500 font-medium">
          Mostrando {items.length} de {total} registros
        </p>
        <div className="flex space-x-2">
          <button disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">
            Anterior
          </button>
          <span className="px-4 py-2 text-sm text-slate-500">
            {currentPage} / {totalPages || 1}
          </span>
          <button disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
