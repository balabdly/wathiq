import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; // تأكد من مسار العميل لديك
import * as XLSX from 'xlsx';
import { 
  Plus, Trash2, Printer, FileSpreadsheet, Search, 
  AlertTriangle, CheckCircle, RefreshCw, Download, SlidersHorizontal 
} from 'lucide-react';

export default function InventoryPage() {
  // حالات إدارة البيانات
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, low_stock, out_of_stock

  // حالات النوافذ المنبثقة (Modals)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [selectedItemForTx, setSelectedItemForTx] = useState(null);

  // نماذج المدخلات
  const [newItem, setNewItem] = useState({
    item_code: '',
    item_name: '',
    category: 'Electrical', // افتراضي للأعمال الكهربائية
    sec_material_no: '',   // رقم المواد الخاص بـ SEC
    work_order_no: '',     // رقم أمر العمل
    quantity: 0,
    unit: 'Meter',
    min_safety_stock: 10,
    warehouse_location: ''
  });

  const [transaction, setTransaction] = useState({
    type: 'issue', // issue = صرف, receive = استلام, adjust = مطابقة/تسوية
    quantity: 0,
    project_name: '',
    reference_no: '' // رقم المستند أو أمر العمل
  });

  // 1. جلب البيانات من Supabase عند تحميل الصفحة
  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      alert('حدث خطأ أثناء جلب بيانات المخزون: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. إضافة مادة جديدة مع التحقق من الحقول
  const handleAddItem = async (e) => {
    e.preventDefault();
    
    // التحقق الإجباري من حقول شركة الكهرباء والمواد الأساسية
    if (!newItem.item_code || !newItem.item_name) {
      alert('يرجى ملء الكود واسم المادة الأساسية.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('inventory')
        .insert([{
          ...newItem,
          quantity: Number(newItem.quantity),
          min_safety_stock: Number(newItem.min_safety_stock),
          updated_at: new Date()
        }])
        .select();

      if (error) throw error;

      alert('تم إضافة المادة بنجاح للمخزون.');
      setIsAddModalOpen(false);
      // إعادة تعيين النموذج
      setNewItem({
        item_code: '', item_name: '', category: 'Electrical',
        sec_material_no: '', work_order_no: '', quantity: 0,
        unit: 'Meter', min_safety_stock: 10, warehouse_location: ''
      });
      fetchInventory();
    } catch (error) {
      alert('خطأ أثناء الإضافة: ' + error.message);
    }
  };

  // 3. إدارة حركات المخزون (صرف / استلام / تسوية ومطابقة)
  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItemForTx || transaction.quantity <= 0) {
      alert('يرجى تحديد كمية صحيحة أكبر من الصفر.');
      return;
    }

    let newQuantity = selectedItemForTx.quantity;
    const txQty = Number(transaction.quantity);

    if (transaction.type === 'receive') {
      newQuantity += txQty;
    } else if (transaction.type === 'issue') {
      if (txQty > selectedItemForTx.quantity) {
        alert('الكمية المطلوبة للصرف أكبر من الكمية المتوفرة في المخزن!');
        return;
      }
      newQuantity -= txQty;
    } else if (transaction.type === 'adjust') {
      // مطابقة وتسوية مباشرة للكمية الحقيقية
      newQuantity = txQty;
    }

    try {
      // تحديث الكمية في جدول المخزون الرئيسي
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ quantity: newQuantity, updated_at: new Date() })
        .eq('id', selectedItemForTx.id);

      if (updateError) throw updateError;

      // تسجيل الحركة في جدول سجل الحركات (Transactions Log) للرقابة
      await supabase
        .from('inventory_transactions')
        .insert([{
          item_id: selectedItemForTx.id,
          item_code: selectedItemForTx.item_code,
          type: transaction.type,
          quantity: txQty,
          project_name: transaction.project_name,
          reference_no: transaction.reference_no,
          created_at: new Date()
        }]);

      alert('تم تحديث الكمية وتسجيل الحركة بنجاح.');
      setIsTransactionModalOpen(false);
      setTransaction({ type: 'issue', quantity: 0, project_name: '', reference_no: '' });
      fetchInventory();
    } catch (error) {
      alert('حدث خطأ أثناء معالجة الحركة: ' + error.message);
    }
  };

  // 4. الحذف الجماعي المحسّن (Bulk Delete) - استعلام واحد بدلاً من حلقات تكرارية
  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف ${selectedItems.length} مواد محددة نهائياً؟`);
    if (!confirmDelete) return;

    try {
      // تحسين الأداء: استدعاء واحد باستخدام عامل التصفية .in()
      const { error } = await supabase
        .from('inventory')
        .delete()
        .in('id', selectedItems);

      if (error) throw error;

      alert('تم حذف المواد المحددة بنجاح.');
      setSelectedItems([]);
      fetchInventory();
    } catch (error) {
      alert('خطأ أثناء الحذف الجماعي: ' + error.message);
    }
  };

  // 5. استيراد البيانات من ملف Excel ذكي يطابق الحقول المطلوبة
  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        // تجهيز البيانات ومطابقتها مع أعمدة قاعدة البيانات
        const formattedData = data.map(row => ({
          item_code: String(row['كود المادة'] || row['item_code'] || ''),
          item_name: String(row['اسم المادة'] || row['item_name'] || ''),
          category: String(row['التصنيف'] || row['category'] || 'Electrical'),
          sec_material_no: String(row['رقم مواد SEC'] || row['sec_material_no'] || ''),
          work_order_no: String(row['أمر العمل'] || row['work_order_no'] || ''),
          quantity: Number(row['الكمية'] || row['quantity'] || 0),
          unit: String(row['الوحدة'] || row['unit'] || 'Meter'),
          min_safety_stock: Number(row['حد الأمان'] || row['min_safety_stock'] || 10),
          warehouse_location: String(row['موقع المستودع'] || row['warehouse_location'] || ''),
          updated_at: new Date()
        })).filter(item => item.item_code && item.item_name); // استبعاد السطور الفارغة

        if (formattedData.length === 0) {
          alert('لم يتم العثور على بيانات صالحة للاستيراد. تأكد من تطابق أسماء الأعمدة.');
          return;
        }

        const { error } = await supabase.from('inventory').insert(formattedData);
        if (error) throw error;

        alert(`تم استيراد ${formattedData.length} مادة بنجاح!`);
        fetchInventory();
      } catch (error) {
        alert('خطأ أثناء قراءة أو استيراد ملف Excel: ' + error.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // 6. طباعة تقارير المخزون وتضمين اسم الشركة رسمياً
  const printInventoryReport = () => {
    const printWindow = window.open('', '_blank');
    
    // تصفية المواد التي تظهر في الطباعة بناءً على البحث والفلتر الحالي في الواجهة
    const itemsToPrint = filteredInventory;

    const htmlContent = `
      <html>
      <head>
        <title>تقرير المخزون المطبوع</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0284c7; padding-bottom: 15px; }
          .header h1 { margin: 0; color: #0284c7; font-size: 24px; }
          .header h2 { margin: 5px 0 0 0; font-size: 16px; color: #4b5563; fontWeight: 500; }
          .meta-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: right; font-size: 13px; }
          th { background-color: #f3f4f6; color: #1f2937; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .alert-stock { color: #dc2626; font-weight: bold; }
          .warning-stock { color: #d97706; font-weight: bold; }
          @media print {
            button { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>شركة إنشاءات الشمال للمقاولات</h1>
          <h2>نظام إدارة المستودعات والمخزون المطور</h2>
        </div>
        <div class="meta-info">
          <div>تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</div>
          <div>عدد المواد المطبوعة: ${itemsToPrint.length}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>كود المادة</th>
              <th>رقم مواد SEC</th>
              <th>اسم المادة / الوصف</th>
              <th>أمر العمل</th>
              <th>الكمية الحالية</th>
              <th>الوحدة</th>
              <th>حد الأمان</th>
              <th>الموقع</th>
            </tr>
          </thead>
          <tbody>
            ${itemsToPrint.map(item => {
              const isOut = item.quantity === 0;
              const isLow = item.quantity <= item.min_safety_stock && item.quantity > 0;
              let stockClass = '';
              if (isOut) stockClass = 'class="alert-stock"';
              else if (isLow) stockClass = 'class="warning-stock"';

              return `
                <tr>
                  <td>${item.item_code}</td>
                  <td>${item.sec_material_no || '-'}</td>
                  <td>${item.item_name}</td>
                  <td>${item.work_order_no || '-'}</td>
                  <td ${stockClass}>${item.quantity}</td>
                  <td>${item.unit}</td>
                  <td>${item.min_safety_stock}</td>
                  <td>${item.warehouse_location || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <script>window.print();</script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // منطق الفلترة والبحث المتقدم المدمج
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.sec_material_no && item.sec_material_no.includes(searchTerm)) ||
      (item.work_order_no && item.work_order_no.includes(searchTerm));

    if (!matchesSearch) return false;

    if (filterStatus === 'out_of_stock') return item.quantity === 0;
    if (filterStatus === 'low_stock') return item.quantity > 0 && item.quantity <= item.min_safety_stock;
    
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredInventory.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredInventory.map(item => item.id));
    }
  };

  const toggleSelectItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
      
      {/* الترويسة الرئيسية */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مخزون شركة إنشاءات الشمال</h1>
          <p className="text-sm text-gray-500 mt-1">تتبع مواد ومشاريع شركة الكهرباء SEC، التسويات، وصرف الكميات</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            <Plus size={18} /> مادة جديدة
          </button>
          <button 
            onClick={printInventoryReport}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm transition"
          >
            <Printer size={18} /> طباعة التقرير
          </button>
          <label className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition">
            <FileSpreadsheet size={18} />
            <span>استيراد Excel</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
          </label>
          <button 
            onClick={fetchInventory}
            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg border border-gray-200"
            title="تحديث البيانات"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* لوحة التحكم، الفلاتر، والبحث */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div className="relative">
          <span className="absolute inset-y-0 right-3 flex items-center text-gray-400">
            <Search size={18} />
          </span>
          <input 
            type="text" 
            placeholder="ابحث بالكود، الاسم، رقم SEC أو أمر العمل..."
            className="w-full pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-gray-400" />
          <select 
            className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">عرض جميع المواد</option>
            <option value="low_stock">⚠️ مواد وصلت لحد الأمان</option>
            <option value="out_of_stock">🚨 مواد منتهية (رصيد صفر)</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2">
          {selectedItems.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-medium border border-red-200 transition"
            >
              <Trash2 size={16} /> حذف المحدَّد ({selectedItems.length})
            </button>
          )}
        </div>
      </div>

      {/* جدول عرض المخزون */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">جاري تحميل مستندات المخزون الحالية...</div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-12 text-center text-gray-500">لا توجد مواد تطابق خيارات البحث الحالية.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-700 text-sm border-b border-gray-200">
                  <th className="p-4 w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedItems.length === filteredInventory.length} 
                      onChange={toggleSelectAll}
                      className="rounded text-sky-600 focus:ring-sky-500"
                    />
                  </th>
                  <th className="p-4 font-semibold">كود المادة</th>
                  <th className="p-4 font-semibold">رقم مواد SEC</th>
                  <th className="p-4 font-semibold">اسم المادة / الوصف</th>
                  <th className="p-4 font-semibold">أمر العمل</th>
                  <th className="p-4 font-semibold">الكمية المتوفرة</th>
                  <th className="p-4 font-semibold">الوحدة</th>
                  <th className="p-4 font-semibold">الحالة / تنبيه</th>
                  <th className="p-4 font-semibold text-center">العمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                {filteredInventory.map((item) => {
                  const isOut = item.quantity === 0;
                  const isLow = item.quantity <= item.min_safety_stock && item.quantity > 0;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="p-4">
                        <input 
                          type="checkbox" 
                          checked={selectedItems.includes(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                          className="rounded text-sky-600 focus:ring-sky-500"
                        />
                      </td>
                      <td className="p-4 font-mono font-medium text-gray-900">{item.item_code}</td>
                      <td className="p-4 font-mono text-gray-500">{item.sec_material_no || '-'}</td>
                      <td className="p-4 font-medium text-gray-800">{item.item_name}</td>
                      <td className="p-4 text-xs bg-gray-50 text-gray-600 px-2 rounded font-mono">{item.work_order_no || '-'}</td>
                      <td className={`p-4 font-bold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                        {item.quantity}
                      </td>
                      <td className="p-4 text-gray-400 text-xs">{item.unit}</td>
                      <td className="p-4">
                        {isOut ? (
                          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full w-max">
                            <AlertTriangle size={12} /> نفذت الكمية
                          </span>
                        ) : isLow ? (
                          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full w-max">
                            <AlertTriangle size={12} /> تحت حد الأمان
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full w-max">
                            <CheckCircle size={12} /> آمن ومستقر
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => {
                            setSelectedItemForTx(item);
                            setIsTransactionModalOpen(true);
                          }}
                          className="text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 px-3 py-1.5 rounded-md font-medium transition"
                        >
                          إدارة الحركة والتسوية
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ----------------- مُنبثقة (Modal) إضافة مادة جديدة ----------------- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
            <div className="bg-sky-700 p-4 text-white font-bold flex justify-between items-center">
              <span>إدخال مادة جديدة للمستودع</span>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white hover:text-gray-200 text-lg">×</button>
            </div>
            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">كود المادة الداخلي *</label>
                  <input 
                    type="text" required
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                    value={newItem.item_code}
                    onChange={(e) => setNewItem({...newItem, item_code: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">رقم المادة في نظام SEC (إن وجد)</label>
                  <input 
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                    value={newItem.sec_material_no}
                    onChange={(e) => setNewItem({...newItem, sec_material_no: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">اسم المادة ووصفها الفني *</label>
                <input 
                  type="text" required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                  value={newItem.item_name}
                  onChange={(e) => setNewItem({...newItem, item_name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">مرتبط بأمر عمل رقم (Work Order)</label>
                  <input 
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                    value={newItem.work_order_no}
                    onChange={(e) => setNewItem({...newItem, work_order_no: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">تصنيف المادة الرئيسي</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                    value={newItem.category}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                  >
                    <option value="Electrical">أعمال كهربائية شبكات ومحطات</option>
                    <option value="Telecom">أعمال اتصالات وفايبر</option>
                    <option value="Civil">أعمال مدنية وحفريات</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">الكمية الافتتاحية</label>
                  <input 
                    type="number" min="0"
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">الوحدة</label>
                  <input 
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">حد الأمان للمخزون</label>
                  <input 
                    type="number" min="0"
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                    value={newItem.min_safety_stock}
                    onChange={(e) => setNewItem({...newItem, min_safety_stock: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">موقع التخزين بالمستودع</label>
                <input 
                  type="text" placeholder="مثال: الرف A3 / مستودع الجوف الرئيسي"
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                  value={newItem.warehouse_location}
                  onChange={(e) => setNewItem({...newItem, warehouse_location: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button 
                  type="button" onClick={() => setIsAddModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  حفظ في المستودع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- مُنبثقة (Modal) حركات وإدارة حركة المخزون / التسوية ----------------- */}
      {isTransactionModalOpen && selectedItemForTx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in duration-200">
            <div className="bg-gray-800 p-4 text-white font-bold flex justify-between items-center">
              <span>إدارة وتسوية الكمية: {selectedItemForTx.item_name}</span>
              <button onClick={() => setIsTransactionModalOpen(false)} className="text-white hover:text-gray-200 text-lg">×</button>
            </div>
            <form onSubmit={handleTransactionSubmit} className="p-6 space-y-4">
              
              <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600 space-y-1">
                <div>الكود الحالي: <span className="font-mono font-bold text-gray-800">{selectedItemForTx.item_code}</span></div>
                <div>الرصيد الفعلي الحالي بالمخزن: <span className="font-bold text-sky-700">{selectedItemForTx.quantity} {selectedItemForTx.unit}</span></div>
                {selectedItemForTx.sec_material_no && <div>رقم مادة SEC: <span className="font-mono">{selectedItemForTx.sec_material_no}</span></div>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">نوع الحركة المخزنية</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    type="button"
                    className={`p-2 text-xs font-medium rounded-lg border text-center ${transaction.type === 'issue' ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'bg-white border-gray-200 text-gray-600'}`}
                    onClick={() => setTransaction({...transaction, type: 'issue'})}
                  >
                    صرف لمشروع
                  </button>
                  <button 
                    type="button"
                    className={`p-2 text-xs font-medium rounded-lg border text-center ${transaction.type === 'receive' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'bg-white border-gray-200 text-gray-600'}`}
                    onClick={() => setTransaction({...transaction, type: 'receive'})}
                  >
                    توريد/استلام جديد
                  </button>
                  <button 
                    type="button"
                    className={`p-2 text-xs font-medium rounded-lg border text-center ${transaction.type === 'adjust' ? 'bg-amber-50 border-amber-500 text-amber-700 font-bold' : 'bg-white border-gray-200 text-gray-600'}`}
                    onClick={() => setTransaction({...transaction, type: 'adjust'})}
                    title="مطابقة الجرد الفعلي للمخزن"
                  >
                    تسوية ومطابقة جرد
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {transaction.type === 'adjust' ? 'الكمية الفعلية الصحيحة الناتجة عن الجرد' : 'الكمية المستهدفة'} *
                </label>
                <input 
                  type="number" min="0" required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                  value={transaction.quantity}
                  onChange={(e) => setTransaction({...transaction, quantity: e.target.value})}
                />
              </div>

              {transaction.type !== 'adjust' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">اسم المشروع المستلم / الجهة</label>
                  <input 
                    type="text" placeholder="مثال: مشروع تمديد سكاكا / شركة الكهرباء"
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                    value={transaction.project_name}
                    onChange={(e) => setTransaction({...transaction, project_name: e.target.value})}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">رقم السند المرجعي أو أمر العمل</label>
                <input 
                  type="text" placeholder="رقم الفاتورة، رقم إذن الصرف، أو الـ WO"
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500"
                  value={transaction.reference_no}
                  onChange={(e) => setTransaction({...transaction, reference_no: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button 
                  type="button" onClick={() => setIsTransactionModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="bg-gray-800 hover:bg-gray-950 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  اعتماد وتحديث القيود
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
