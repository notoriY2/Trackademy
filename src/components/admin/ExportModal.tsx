// src/components/admin/ExportModal.tsx
import React, { useState, useCallback } from 'react';
import {
  Download,
  Calendar,
  Users,
  BookOpen,
  BarChart3,
  Database,
  CheckCircle,
  X,
  Filter,
  Settings,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportId =
  | 'students'
  | 'courses'
  | 'grades'
  | 'attendance'
  | 'lecturers'
  | 'schedule'
  | 'departments'
  | 'analytics'
  | 'eligibility';

interface ExportOption {
  id: ExportId;
  name: string;
  description: string;
  formats: string[];
  category: 'academic' | 'administrative' | 'analytics';
}

const EXPORT_OPTIONS: ExportOption[] = [
  { id: 'students', name: 'Student Records', description: 'Student information and profiles', formats: ['xlsx', 'csv', 'pdf'], category: 'academic' },
  { id: 'courses', name: 'Course Data', description: 'Course details, credits, enrollment numbers', formats: ['xlsx', 'csv', 'pdf'], category: 'academic' },
  { id: 'grades', name: 'Grade Reports', description: 'Enrollments, final grades and percentages', formats: ['xlsx', 'csv', 'pdf'], category: 'academic' },
  { id: 'attendance', name: 'Attendance Records', description: 'Attendance (if available)', formats: ['xlsx', 'csv'], category: 'academic' },
  { id: 'lecturers', name: 'Lecturer Information', description: 'Lecturers and their profile info', formats: ['xlsx', 'csv', 'pdf'], category: 'administrative' },
  { id: 'schedule', name: 'Academic Schedule', description: 'Course schedules and venues', formats: ['xlsx', 'csv', 'pdf'], category: 'administrative' },
  { id: 'departments', name: 'Department Data', description: 'Departments, codes and meta', formats: ['xlsx', 'csv', 'pdf'], category: 'administrative' },
  { id: 'analytics', name: 'Performance Analytics', description: 'High-level counts and KPIs', formats: ['xlsx', 'pdf'], category: 'analytics' },
  { id: 'eligibility', name: 'Exam Eligibility', description: 'Exam eligibility derived from enrollments', formats: ['xlsx', 'csv', 'pdf'], category: 'analytics' },
];

const categories = [
  { id: 'all', name: 'All', count: EXPORT_OPTIONS.length },
  { id: 'academic', name: 'Academic', count: EXPORT_OPTIONS.filter(o => o.category === 'academic').length },
  { id: 'administrative', name: 'Administrative', count: EXPORT_OPTIONS.filter(o => o.category === 'administrative').length },
  { id: 'analytics', name: 'Analytics', count: EXPORT_OPTIONS.filter(o => o.category === 'analytics').length },
];

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [selectedExports, setSelectedExports] = useState<ExportId[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string>('xlsx');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const filteredOptions = activeCategory === 'all'
    ? EXPORT_OPTIONS
    : EXPORT_OPTIONS.filter(o => o.category === (activeCategory as any));

  const toggleExport = (id: ExportId) => {
    setSelectedExports(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllFiltered = () => {
    const ids = filteredOptions.map(o => o.id);
    setSelectedExports(prev => {
      const same = ids.every(id => prev.includes(id));
      return same ? prev.filter(p => !ids.includes(p)) : Array.from(new Set([...prev, ...ids]));
    });
  };

  // -------------------
  // Generic downloader
  // -------------------
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const jsonToXlsxBlob = (rows: any[], sheetName = 'Sheet1') => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: 'application/octet-stream' });
  };

  const jsonToCsvBlob = (rows: any[]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  };

  const jsonToPdfBlob = (rows: any[], title = 'Export', dateRange?: { start: string; end: string }) => {
  const doc = new jsPDF('landscape', 'pt', 'a4');

  // HEADER
  doc.setFontSize(18);
  doc.setTextColor(30, 144, 255); // DodgerBlue
  doc.text(title, 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Exported on: ${new Date().toLocaleString()}`, 40, 60);
  if (dateRange?.start || dateRange?.end) {
    doc.text(`Date range: ${dateRange.start || '—'} → ${dateRange.end || '—'}`, 40, 75);
  }

  if (!rows || rows.length === 0) {
    doc.setFontSize(12);
    doc.text('No data available for export', 40, 100);
    return doc.output('blob');
  }

  const headers = Object.keys(rows[0]);
  const body = rows.map(row =>
    headers.map(h => {
      let v = row[h];
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    })
  );

  // TABLE
  autoTable(doc, {
    startY: 100,
    head: [headers],
    body,
    styles: {
      fontSize: 9,
      cellPadding: 6,
    },
    headStyles: {
      fillColor: [30, 144, 255],
      textColor: 255,
      fontSize: 10,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245], // light gray striping
    },
    didDrawPage: (data) => {
      // FOOTER with page numbers
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 80,
        doc.internal.pageSize.getHeight() - 20
      );
    },
  });

  return doc.output('blob');
};


  // -------------------
  // Export logic
  // -------------------
  const exportSingle = async (id: ExportId, format: string) => {
    setError(null);
    try {
      let rows: any[] = [];
      const filenameBase = `${id}_${new Date().toISOString().slice(0, 10)}`;

      // Fetcher stubs – replace with your own fetch logic
      switch (id) {
        case 'students':
          rows = await supabase.from('students').select('*').then(res => res.data || []);
          break;
        case 'courses':
          rows = await supabase.from('courses').select('*').then(res => res.data || []);
          break;
        default:
          rows = [];
      }

      if (!rows || rows.length === 0) {
        rows = [{ note: 'No records returned for this dataset' }];
      }

      if (format === 'xlsx') {
        downloadBlob(jsonToXlsxBlob(rows, id), `${filenameBase}.xlsx`);
      } else if (format === 'csv') {
        downloadBlob(jsonToCsvBlob(rows), `${filenameBase}.csv`);
      } else if (format === 'pdf') {
        downloadBlob(jsonToPdfBlob(rows, EXPORT_OPTIONS.find(o => o.id === id)?.name ?? id), `${filenameBase}.pdf`);
      }
    } catch (err: any) {
      console.error('Export failed for', id, err);
      setError(err?.message ?? String(err));
      throw err;
    }
  };

  const handleExport = async () => {
    if (!selectedExports.length) return;
    setIsExporting(true);
    setExportProgress(0);
    setError(null);

    const total = selectedExports.length;
    let done = 0;

    try {
      for (const id of selectedExports) {
        const opt = EXPORT_OPTIONS.find(o => o.id === id);
        if (!opt || !opt.formats.includes(selectedFormat)) {
          done += 1;
          setExportProgress(Math.round((done / total) * 100));
          continue;
        }
        await exportSingle(id, selectedFormat);
        done += 1;
        setExportProgress(Math.round((done / total) * 100));
        await new Promise(res => setTimeout(res, 250));
      }
    } finally {
      setIsExporting(false);
      if (!error) {
        setTimeout(() => {
          setSelectedExports([]);
          setExportProgress(0);
          onClose();
        }, 900);
      }
    }
  };

  const getTotalSize = () => {
    const sizeMap: Record<ExportId, number> = {
      students: 2.5,
      courses: 1.2,
      grades: 3.8,
      attendance: 1.8,
      lecturers: 0.8,
      schedule: 0.5,
      departments: 0.3,
      analytics: 4.2,
      eligibility: 1.5,
    };
    const total = selectedExports.reduce((sum, id) => sum + (sizeMap[id] ?? 0), 0);
    return total.toFixed(1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Download className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">Export Data</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-200px)]">
          <div className="w-64 border-r border-gray-200 p-4">
            <div className="space-y-2">
              {categories.map(c => (
                <button key={c.id} onClick={() => setActiveCategory(c.id)} className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${activeCategory === c.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{c.count}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                Date Range (optional)
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">From</label>
                  <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">To</label>
                  <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                  <button onClick={selectAllFiltered} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    {filteredOptions.every(o => selectedExports.includes(o.id)) ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-sm text-gray-500">{selectedExports.length} selected</span>
                </div>

                <div className="flex items-center space-x-3">
                  <Settings className="h-4 w-4 text-gray-400" />
                  <select value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)} className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="xlsx">Excel (.xlsx)</option>
                    <option value="csv">CSV (.csv)</option>
                    <option value="pdf">PDF (.pdf)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredOptions.map(opt => {
                  const Icon = (() => {
                    switch (opt.id) {
                      case 'students': return Users;
                      case 'courses': return BookOpen;
                      case 'grades': return BarChart3;
                      case 'attendance': return Calendar;
                      case 'lecturers': return Users;
                      case 'schedule': return Calendar;
                      case 'departments': return Database;
                      case 'analytics': return BarChart3;
                      case 'eligibility': return CheckCircle;
                      default: return Database;
                    }
                  })();

                  const supports = opt.formats.includes(selectedFormat);
                  const selected = selectedExports.includes(opt.id);

                  return (
                    <div key={opt.id} onClick={() => supports && toggleExport(opt.id)} className={`border rounded-lg p-4 cursor-pointer transition-all ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'} ${!supports ? 'opacity-50' : ''}`}>
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${selected ? 'bg-blue-100' : 'bg-gray-100'}`}>
                          <Icon className={`h-5 w-5 ${selected ? 'text-blue-600' : 'text-gray-600'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-900">{opt.name}</h4>
                            {selected && <CheckCircle className="h-5 w-5 text-blue-600" />}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{opt.description}</p>
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">Formats:</span>
                              <div className="flex space-x-1">
                                {opt.formats.map(f => (<span key={f} className={`text-xs px-2 py-1 rounded ${f === selectedFormat ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`} title={f.toUpperCase()}>{f.toUpperCase()}</span>))}
                              </div>
                            </div>
                            <span className="text-xs text-gray-500" />
                          </div>
                          {!supports && <div className="mt-2 text-xs text-red-600">Not available in {selectedFormat.toUpperCase()}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 p-6">
          {isExporting ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Exporting data...</span>
                <span className="font-medium">{exportProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${exportProgress}%` }} />
              </div>
              {exportProgress === 100 && <div className="flex items-center text-green-600 text-sm"><CheckCircle className="h-4 w-4 mr-2" />All files exported.</div>}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedExports.length > 0 ? <span>Selected: {selectedExports.length} • Est. size: {getTotalSize()} MB</span> : <span>Select one or more items to export</span>}
                {error && <div className="text-red-600 mt-1 text-xs">{error}</div>}
              </div>

              <div className="flex space-x-3">
                <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleExport} disabled={!selectedExports.length} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
                  <Download className="h-4 w-4" />
                  <span>Export Data</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
