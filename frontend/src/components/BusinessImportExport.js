import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, downloadBlobResponse } from '../services/api';
import { BUSINESS_CATEGORIES } from '../utils/categories';

const FIELD_LABELS = {
  merchant: 'المورد / العميل (البيان)',
  amount: 'المبلغ',
  date: 'التاريخ',
  category: 'الفئة',
  entryType: 'نوع الحركة (مصروف/إيراد)',
  paymentMethod: 'طريقة الدفع',
  description: 'وصف / ملاحظات',
  projectTag: 'مشروع / عميل',
};

const REQUIRED_FIELDS = new Set(['amount']);

const PERIOD_OPTIONS = [
  { id: '30', label: '30 يوم' },
  { id: '90', label: '90 يوم' },
  { id: '365', label: 'سنة' },
  { id: '', label: 'كل الفترة' },
];

const BusinessImportExport = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState('import');

  // Import state
  const [step, setStep] = useState('upload'); // upload | mapping | result
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [defaultEntryType, setDefaultEntryType] = useState('expense');
  const [defaultCategory, setDefaultCategory] = useState('Other');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Export state
  const [exportPeriod, setExportPeriod] = useState('90');
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const res = await api.importPreview(file);
      const data = res.data;
      setPreview(data);
      setMapping(data.suggestedMapping || {});
      setStep('mapping');
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'تعذّرت قراءة الملف — تأكد أنه CSV أو Excel');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMappingChange = (field, column) => {
    setMapping((prev) => ({ ...prev, [field]: column || null }));
  };

  const canConfirm = !!mapping.amount;

  const handleConfirm = async () => {
    if (!preview || !canConfirm || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await api.importConfirm({
        importId: preview.importId,
        mapping,
        defaultEntryType,
        defaultCategory,
        skipDuplicates,
      });
      setResult(res.data);
      setStep('result');
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'تعذّر إتمام الاستيراد');
    } finally {
      setConfirming(false);
    }
  };

  const resetImport = () => {
    setStep('upload');
    setPreview(null);
    setMapping({});
    setResult(null);
    setError(null);
  };

  const handleExport = async (kind, format) => {
    setExportError(null);
    setExporting(`${kind}-${format}`);
    try {
      const days = exportPeriod ? Number(exportPeriod) : undefined;
      const res = kind === 'report'
        ? await api.exportReport({ days: days || 90 })
        : await api.exportExpenses({ format, days });
      downloadBlobResponse(res, `riyalai_${kind}.${format === 'csv' ? 'csv' : 'xlsx'}`);
    } catch (err) {
      setExportError(err.response?.data?.detail || err.response?.data?.error || 'تعذّر التصدير');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="page">
      <div className="header-bar">
        <h1 className="page-title">استيراد وتصدير</h1>
        <Link to="/home" className="text-green" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>رجوع</Link>
      </div>

      <div className="mode-switcher" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`mode-switch-btn${tab === 'import' ? ' active' : ''}`}
          onClick={() => setTab('import')}
        >
          استيراد تقارير سابقة
        </button>
        <button
          type="button"
          className={`mode-switch-btn${tab === 'export' ? ' active' : ''}`}
          onClick={() => setTab('export')}
        >
          تصدير
        </button>
      </div>

      {tab === 'import' && (
        <>
          {error && <div className="error-banner">{error}</div>}

          {step === 'upload' && (
            <div className="glass-card upload-dropzone">
              <p className="section-title" style={{ marginTop: 0 }}>رفع تقرير مصاريف/إيرادات سابق</p>
              <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
                يدعم ملفات Excel (.xlsx) أو CSV. الذكاء الاصطناعي يحاول يطابق أعمدة ملفك (التاريخ، المبلغ، الفئة...)
                تلقائياً — وتقدر تعدّل المطابقة قبل الاستيراد.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                disabled={uploading}
                style={{ marginTop: 16 }}
              />
              {uploading && <p className="text-secondary" style={{ marginTop: 12 }}>جاري تحليل الملف بالذكاء الاصطناعي...</p>}
            </div>
          )}

          {step === 'mapping' && preview && (
            <>
              <div className="glass-card">
                <div className="biz-vat-header">
                  <p className="section-title" style={{ margin: 0 }}>{preview.filename}</p>
                  <span className="ai-chip">{preview.mappingSource === 'ai' ? '✦ مطابقة AI' : 'مطابقة تلقائية'}</span>
                </div>
                <p className="text-secondary" style={{ fontSize: '0.8rem' }}>
                  {preview.totalRows} صف مكتشف — راجع المطابقة تحت وعدّلها إذا لزم
                </p>
              </div>

              <div className="glass-card">
                <p className="section-title" style={{ marginTop: 0 }}>مطابقة الأعمدة</p>
                {Object.keys(FIELD_LABELS).map((field) => (
                  <div key={field} className="mapping-row">
                    <label>
                      {FIELD_LABELS[field]}
                      {REQUIRED_FIELDS.has(field) && <span className="text-gold"> *</span>}
                    </label>
                    <select
                      value={mapping[field] || ''}
                      onChange={(e) => handleMappingChange(field, e.target.value)}
                    >
                      <option value="">— بدون —</option>
                      {preview.columns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}

                <div className="mapping-row">
                  <label>نوع الحركة الافتراضي (عند عدم وجود عمود للنوع)</label>
                  <select value={defaultEntryType} onChange={(e) => setDefaultEntryType(e.target.value)}>
                    <option value="expense">مصروف</option>
                    <option value="income">إيراد</option>
                  </select>
                </div>
                <div className="mapping-row">
                  <label>الفئة الافتراضية (عند عدم التعرّف على الفئة)</label>
                  <select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)}>
                    {BUSINESS_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.labelAr}</option>
                    ))}
                  </select>
                </div>
                <label className="import-checkbox-row">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                  />
                  <span>تخطّي الحركات المكررة (نفس المبلغ والتاريخ والبيان)</span>
                </label>
              </div>

              <div className="glass-card">
                <p className="section-title" style={{ marginTop: 0 }}>معاينة أول صفوف</p>
                <div className="import-preview-table-wrap">
                  <table className="import-preview-table">
                    <thead>
                      <tr>
                        {preview.columns.map((col) => <th key={col}>{col}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => <td key={j}>{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn-outline" onClick={resetImport} disabled={confirming}>
                  إلغاء
                </button>
                <button type="button" className="btn-primary" onClick={handleConfirm} disabled={!canConfirm || confirming}>
                  {confirming ? 'جاري الاستيراد...' : `استورد ${preview.totalRows} حركة`}
                </button>
              </div>
            </>
          )}

          {step === 'result' && result && (
            <div className="glass-card import-summary-card">
              <div style={{ fontSize: '2.5rem', textAlign: 'center' }}>✓</div>
              <h2 style={{ textAlign: 'center', marginTop: 8 }}>{result.message}</h2>
              <div className="biz-profit-grid" style={{ marginTop: 16 }}>
                <div className="glass-card biz-stat">
                  <p className="text-secondary">تم استيرادها</p>
                  <p className="font-mono biz-stat-value income">{result.imported}</p>
                </div>
                <div className="glass-card biz-stat">
                  <p className="text-secondary">مكررة تم تخطّيها</p>
                  <p className="font-mono biz-stat-value">{result.skippedDuplicates}</p>
                </div>
              </div>
              {result.rowErrorCount > 0 && (
                <p className="biz-warning" style={{ marginTop: 12 }}>
                  {result.rowErrorCount} صف تعذّر استيرادها (مبلغ غير صالح)
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn-outline" onClick={resetImport}>استيراد ملف آخر</button>
                <button type="button" className="btn-primary" onClick={() => navigate('/glance')}>
                  شوف التحليل الذكي
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'export' && (
        <>
          {exportError && <div className="error-banner">{exportError}</div>}

          <div className="glass-card">
            <p className="section-title" style={{ marginTop: 0 }}>الفترة</p>
            <div className="mode-switcher" style={{ flexWrap: 'wrap' }}>
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`mode-switch-btn${exportPeriod === opt.id ? ' active' : ''}`}
                  onClick={() => setExportPeriod(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card">
            <p className="section-title" style={{ marginTop: 0 }}>بيانات الحركات الخام</p>
            <p className="text-secondary" style={{ fontSize: '0.8rem' }}>
              كل المصاريف والإيرادات كما هي — تصلح لعمل نسخة احتياطية أو تسليمها لمحاسب
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => handleExport('expenses', 'csv')}
                disabled={exporting === 'expenses-csv'}
              >
                {exporting === 'expenses-csv' ? '...' : 'CSV'}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleExport('expenses', 'xlsx')}
                disabled={exporting === 'expenses-xlsx'}
              >
                {exporting === 'expenses-xlsx' ? '...' : 'Excel'}
              </button>
            </div>
          </div>

          <div className="glass-card">
            <p className="section-title" style={{ marginTop: 0 }}>تقرير ملخّص جاهز للطباعة</p>
            <p className="text-secondary" style={{ fontSize: '0.8rem' }}>
              الربح، جاهزية الضريبة، صحة المشروع، تفصيل الفئات، ونقاط الهدر — بصيغة Excel منسّقة
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => handleExport('report', 'xlsx')}
              disabled={exporting === 'report-xlsx'}
            >
              {exporting === 'report-xlsx' ? '...' : 'تصدير التقرير'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default BusinessImportExport;
